// The pipeline. One issue moves through:
//
//   claim -> triage (box 1) -> worker (box 2) -> runner commits + pushes branch
//         -> verifier (box 3: fresh copy, runs the tests itself) -> reviewer (box 3, read-only)
//         -> pull request (a human merges)
//
// and after all lanes finish, the integrator merges every ready branch, one at a time, into an
// integration branch, resolving conflicts and re-running the tests after every merge.
//
// Every decision that can be made by code is made by code. Agents only do what needs judgment.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runStage } from "./agent.mjs";
import { run } from "./proc.mjs";
import { integratorPrompt, reviewerPrompt, triagePrompt, workerPrompt } from "./prompts.mjs";

/** Run every issue through the pipeline, `cfg.concurrency` lanes at a time. */
export async function runFactory({ cfg, issues, claims, boxes, ledger, log, extraContract = "", stageEnv = () => ({}) }) {
  const queue = [...issues];
  const lane = async (n) => {
    for (let issue = queue.shift(); issue; issue = queue.shift()) {
      const t0 = Date.now();
      let outcome;
      try {
        // A claim can fail (network, rate limit). That is this issue's error, not the whole run's.
        if (!(await claims.claim(issue, `${ledger.runId}/lane-${n}`))) {
          log(`#${issue.id} already claimed, skipping`);
          ledger.event("skipped_claimed", { issue: issue.id });
          continue;
        }
        ledger.event("claimed", { issue: issue.id, lane: n });
        outcome = await handleIssue({ cfg, issue, boxes, ledger, log, extraContract, stageEnv });
      } catch (err) {
        // Keep everything the issue got through before it failed (triage, work, branch, costs).
        const partial = err.partial ?? { issue: issue.id, title: issue.title, seconds: {}, costUsd: err.costUsd ?? 0 };
        outcome = { ...partial, stage: "error", error: String(err.message ?? err).slice(0, 1500) };
        log(`#${issue.id} error: ${outcome.error.split("\n").slice(0, 2).join(" ")}`);
      }
      outcome.seconds.total = Math.round((Date.now() - t0) / 1000);
      outcome.lane = n;
      ledger.outcome(outcome);
      ledger.event("outcome", { issue: issue.id, stage: outcome.stage });
    }
  };
  // allSettled: a lane that dies unexpectedly must not end the run while other lanes still use sandboxes.
  const lanes = await Promise.allSettled(Array.from({ length: cfg.concurrency }, (_, n) => lane(n + 1)));
  for (const l of lanes) if (l.status === "rejected") log(`lane failed: ${String(l.reason?.message ?? l.reason).split("\n")[0]}`);
  return ledger.data.outcomes;
}

async function handleIssue(ctx) {
  const out = { issue: ctx.issue.id, title: ctx.issue.title, stage: "blocked", seconds: {}, costUsd: 0 };
  try {
    return await work(ctx, out);
  } catch (err) {
    err.partial = out; // what the issue achieved and spent before the failure
    throw err;
  }
}

async function work({ cfg, issue, boxes, ledger, log, extraContract, stageEnv }, out) {
  const branch = `${cfg.branchPrefix}/issue-${issue.id}`;
  const stage = async (name, sandbox, prompt, contract = "") => {
    ledger.event("stage_start", { issue: issue.id, stage: name, sandbox: sandbox.label });
    try {
      const r = await runStage({ cfg, stage: name, sandbox, prompt, traceDir: ledger.traces, traceName: `issue-${issue.id}.${name}`, extraContract: contract, env: stageEnv(`#${issue.id} ${name}`) });
      out.costUsd += r.costUsd;
      out.seconds[name] = r.seconds;
      if (r.denied.length) (out.deniedTools ??= {})[name] = r.denied;
      ledger.event("stage_end", { issue: issue.id, stage: name, costUsd: r.costUsd, seconds: r.seconds, turns: r.turns });
      return r.result;
    } catch (err) {
      out.costUsd += err.costUsd ?? 0;
      throw err;
    }
  };

  // 1. Triage in a throwaway sandbox: is there a concrete, testable outcome?
  const tri = await boxes.create(`issue-${issue.id}-triage`);
  try {
    out.triage = await stage("triage", tri, triagePrompt(issue));
  } finally {
    await tri.destroy();
  }
  if (!out.triage.actionable) {
    log(`#${issue.id} triaged out: ${out.triage.reason}`);
    return { ...out, stage: "triaged_out" };
  }
  log(`#${issue.id} triage: ${out.triage.kind}, actionable`);

  // 2. Worker in its own sandbox. Nothing another lane does can touch this copy.
  const worker = await boxes.create(`issue-${issue.id}-worker`);
  try {
    out.work = await stage("worker", worker, workerPrompt(issue, out.triage, cfg), extraContract);
    log(`#${issue.id} worker: ${out.work.status}, says tests ${out.work.testsPass ? "pass" : "fail"}`);
    if (out.work.status === "blocked") return { ...out, stage: "blocked" };
    const commit = await worker.commitAndPush(branch, `fix: ${issue.title} (#${issue.id})`);
    if (!commit.pushed) {
      log(`#${issue.id} worker changed nothing`);
      return { ...out, stage: "no_changes" };
    }
    out.branch = branch;
    out.filesChanged = commit.files;
    // Deterministic guard: deleting a test is not a fix.
    const removedTests = commit.deleted.filter((f) => cfg.protectedPaths.some((p) => f.includes(p)));
    if (removedTests.length) {
      log(`#${issue.id} rejected: worker deleted protected files ${removedTests.join(", ")}`);
      return { ...out, stage: "rejected", rejectedBy: "guard", guard: `deleted protected files: ${removedTests.join(", ")}` };
    }
  } finally {
    await worker.destroy();
  }

  // 3. Verifier in a FRESH sandbox: the worker never grades its own work.
  const verifier = await boxes.create(`issue-${issue.id}-verify`);
  try {
    await verifier.checkout(branch);
    const changed = await verifier.changedFiles();
    if (changed.some((f) => /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements[^/]*\.txt|pyproject\.toml|go\.(mod|sum)|Cargo\.(toml|lock))$/.test(f))) {
      await verifier.setup(); // the branch changed dependencies: install them like a clean CI run would
    }
    const t0 = Date.now();
    let tests = await verifier.test();
    if (!tests.ok && !tests.timedOut) {
      // One retry before rejecting: a single red run can be flaky rather than wrong.
      const second = await verifier.test();
      if (second.ok) tests = { ...second, flaky: true };
    }
    out.seconds.verify = Math.round((Date.now() - t0) / 100) / 10;
    out.verifier = { ok: tests.ok, flaky: Boolean(tests.flaky), output: tests.output.split("\n").slice(-25).join("\n") };
    out.selfReportMismatch = out.work.testsPass && !tests.ok;
    log(`#${issue.id} verifier: tests ${tests.ok ? "pass" : "FAIL"}${out.selfReportMismatch ? " (worker claimed they passed)" : ""}${tests.flaky ? " (flaky: passed on retry)" : ""}`);
    if (!tests.ok) return { ...out, stage: "rejected", rejectedBy: "verifier" };

    // 4. Reviewer: reads the diff in the verifier's sandbox, may not change anything.
    if (cfg.review.enabled) {
      const before = await verifier.status();
      out.review = await stage("reviewer", verifier, reviewerPrompt(issue, cfg, out.verifier), extraContract);
      if ((await verifier.status()) !== before) {
        log(`#${issue.id} reviewer modified files; review discarded`);
        return { ...out, stage: "rejected", rejectedBy: "guard", guard: "reviewer modified the working tree" };
      }
      log(`#${issue.id} reviewer: ${out.review.verdict}${out.review.issuesFound.length ? ` (${out.review.issuesFound.length} issues)` : ""}`);
      if (out.review.verdict !== "approve") return { ...out, stage: "rejected", rejectedBy: "reviewer" };
    }

    // 5. Pull request. Merging stays a human decision.
    out.pr = await openPullRequest(cfg, ledger, issue, branch, out);
    log(`#${issue.id} ready for human: ${out.pr}`);
    return { ...out, stage: "ready_for_human" };
  } finally {
    await verifier.destroy();
  }
}

function prBody(cfg, issue, out) {
  const lines = [
    `Automated change for #${issue.id} from the software factory (run \`${out.runId ?? ""}\`).`,
    "",
    `**Summary.** ${out.work.summary}`,
    "",
    `| Gate | Result |`,
    `|---|---|`,
    `| Triage | ${out.triage.kind}: ${out.triage.reason} |`,
    `| Worker self-report | tests ${out.work.testsPass ? "pass" : "fail"}, tests added: ${out.work.testsAdded ? "yes" : "no"} |`,
    `| Verifier (clean copy, \`${cfg.test}\`) | ${out.verifier.ok ? "pass" : "fail"}${out.verifier.flaky ? " (flaky, passed on retry)" : ""} |`,
    `| Reviewer | ${out.review?.verdict ?? "skipped"} |`,
  ];
  if (out.review?.riskNotes) lines.push("", `**Reviewer notes.** ${out.review.riskNotes}`);
  lines.push("", `Closes #${issue.id}`, "", "_A human merges this pull request. The factory never merges._");
  return lines.join("\n");
}

async function openPullRequest(cfg, ledger, issue, branch, out) {
  const title = `${issue.title} (#${issue.id})`;
  const body = prBody(cfg, issue, { ...out, runId: ledger.runId });
  const file = join(ledger.prs, `issue-${issue.id}.md`);
  writeFileSync(file, `# ${title}\n\nBranch: \`${branch}\` -> \`${cfg.baseBranch}\`\n\n${body}\n`);
  if (cfg.source.kind !== "gh") return `local:${branch}`;

  const args = ["pr", "create", "--repo", cfg.source.repo, "--base", cfg.baseBranch, "--head", branch, "--title", title, "--body-file", file];
  if (cfg.pr.draft) args.push("--draft");
  for (const l of cfg.pr.labels ?? []) args.push("--label", l);
  const r = await run("gh", args, { timeoutMs: 120_000 });
  if (r.code === 0) return r.stdout.trim().split("\n").at(-1);
  // A PR for this branch may already exist from an earlier run; the push above updated it.
  const existing = await run("gh", ["pr", "view", branch, "--repo", cfg.source.repo, "--json", "url", "-q", ".url"]);
  if (existing.code === 0 && existing.stdout.trim()) return existing.stdout.trim();
  throw new Error(`gh pr create failed: ${(r.stderr || r.stdout).trim().slice(-400)}`);
}

// ---- Integrator ----------------------------------------------------------------------------------

/**
 * Merge every ready branch, in issue order, into `cfg.integrate.into`. Conflicts go to the integrator
 * agent; the runner then checks no conflict markers remain and re-runs the tests before moving on.
 * The base branch is never touched. Progress is pushed after every merge, so nothing is lost on failure.
 */
export async function integrate({ cfg, outcomes, boxes, ledger, log, stageEnv = () => ({}) }) {
  const ready = outcomes.filter((o) => o.stage === "ready_for_human" && o.branch).sort((a, b) => a.issue - b.issue);
  const result = { into: cfg.integrate.into, merged: [], conflicts: [], failed: null, costUsd: 0, testsPass: null };
  if (ready.length === 0) {
    log("integrator: nothing to integrate");
    return result;
  }
  const box = await boxes.create("integrator", { fresh: true });
  let current = null;
  try {
    await box.gitMust(["checkout", "-q", "-B", cfg.integrate.into, `origin/${cfg.baseBranch}`]);
    for (const pr of ready) {
      current = pr.issue;
      await box.gitMust(["fetch", "-q", "origin", `+refs/heads/${pr.branch}:refs/remotes/origin/${pr.branch}`]);
      const m = await box.git(["merge", "--no-ff", "--no-edit", "-m", `Integrate #${pr.issue}: ${pr.title}`, `origin/${pr.branch}`]);
      if (m.code === 0) {
        log(`integrator: #${pr.issue} merged cleanly`);
      } else {
        const files = (await box.git(["diff", "--name-only", "--diff-filter=U"])).stdout.trim().split("\n").filter(Boolean);
        if (!files.length) throw new Error(`merge of ${pr.branch} failed without conflicts: ${m.stderr.trim().slice(-300)}`);
        log(`integrator: #${pr.issue} conflicts in ${files.join(", ")}, agent resolving`);
        result.conflicts.push({ issue: pr.issue, files });
        let r;
        try {
          r = await runStage({ cfg, stage: "integrator", sandbox: box, prompt: integratorPrompt(pr, files, cfg), traceDir: ledger.traces, traceName: `integrate-${pr.issue}`, env: stageEnv(`integrate #${pr.issue}`) });
        } catch (err) {
          result.costUsd += err.costUsd ?? 0;
          await box.git(["merge", "--abort"]);
          result.failed = { issue: pr.issue, reason: String(err.message).slice(0, 500) };
          break;
        }
        result.costUsd += r.costUsd;
        await box.git(["add", "-u"]);
        const unmerged = (await box.git(["diff", "--name-only", "--diff-filter=U"])).stdout.trim();
        const markers = (await box.git(["grep", "-l", "-E", "^(<<<<<<<|>>>>>>>) ", "--", "."])).stdout.trim();
        if (!r.result.resolved || unmerged || markers) {
          await box.git(["merge", "--abort"]);
          result.failed = { issue: pr.issue, reason: `unresolved conflicts: ${unmerged || markers || r.result.summary}` };
          log(`integrator: #${pr.issue} NOT resolved, stopping`);
          break;
        }
        await box.gitMust(["commit", "-q", "--no-verify", "--no-edit"]);
        log(`integrator: #${pr.issue} resolved: ${r.result.summary.slice(0, 120)}`);
      }
      const tests = await box.test();
      if (!tests.ok) {
        result.failed = { issue: pr.issue, reason: "tests fail after merging", output: tests.output.split("\n").slice(-20).join("\n") };
        log(`integrator: tests FAIL after #${pr.issue}, stopping (${cfg.integrate.into} keeps everything before it)`);
        break;
      }
      await box.gitMust(["push", "-q", "--no-verify", "--force", "origin", `HEAD:refs/heads/${cfg.integrate.into}`]);
      result.merged.push(pr.issue);
    }
    result.testsPass = !result.failed;
    result.head = (await box.git(["rev-parse", "--short", "HEAD"])).stdout.trim();
  } catch (err) {
    // Any unexpected failure (fetch, push, merge) stops integration but keeps what was already pushed.
    result.failed = { issue: current, reason: String(err.message ?? err).slice(0, 500) };
    result.testsPass = false;
    log(`integrator: stopped at #${current}: ${result.failed.reason.split("\n")[0]}`);
  } finally {
    await box.destroy();
  }
  log(`integrator: ${result.merged.length}/${ready.length} merged into ${cfg.integrate.into}, ${result.conflicts.length} needed conflict resolution${result.failed ? `, stopped at #${result.failed.issue}` : ""}`);
  return result;
}
