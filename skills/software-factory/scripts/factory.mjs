#!/usr/bin/env node
// software-factory: GitHub issues in, verified pull requests out. A human merges.
//
//   node factory.mjs init                 write factory.config.json for this repository
//   node factory.mjs doctor               check tools, auth, config and the repository
//   node factory.mjs plan                 show what a run would do (no agents, no claims)
//   node factory.mjs run [--yes]          run the factory (asks for confirmation unless --yes)
//   node factory.mjs integrate [--run ID] merge a run's ready branches into the integration branch
//   node factory.mjs report [--run ID]    print and save a run's report
//   node factory.mjs stats                totals across every run (input for factory-improve)
//   node factory.mjs release --issues 1,2 remove claims so issues can be worked again
//
// Common flags: --config <file>  --issues 1,3,5  --concurrency N  --agent fake|claude
//               --model <m>  --sandbox local|shared  --no-integrate  --no-review  --grounding
//               --keep-sandboxes  --yes  --run <id>  --json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, DEFAULTS } from "./lib/config.mjs";
import { claimStore, loadIssues } from "./lib/issues.mjs";
import { LocalSandboxes } from "./lib/sandbox.mjs";
import { integrate, runFactory } from "./lib/pipeline.mjs";
import { Ledger, listRuns, newRunId, readRun, round } from "./lib/ledger.mjs";
import { startDocsProxy } from "./lib/docs-proxy.mjs";
import { groundingContract } from "./lib/prompts.mjs";
import { available, run } from "./lib/proc.mjs";

const DOCS_SCRIPT = join(import.meta.dirname, "..", "..", "factory-live-docs", "scripts", "docs.mjs");

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: "string", default: "factory.config.json" },
    issues: { type: "string" },
    concurrency: { type: "string" },
    agent: { type: "string" },
    sandbox: { type: "string" },
    model: { type: "string" },
    run: { type: "string" },
    yes: { type: "boolean", short: "y" },
    "no-integrate": { type: "boolean" },
    "no-review": { type: "boolean" },
    grounding: { type: "boolean" },
    "keep-sandboxes": { type: "boolean" },
    json: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

const command = positionals[0] ?? "help";
const c = process.stdout.isTTY ? { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", x: "\x1b[0m" } : { dim: "", b: "", g: "", r: "", y: "", x: "" };
const t0 = Date.now();
const log = (s) => console.log(`${c.dim}${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s${c.x} ${s}`);

function overrides() {
  const o = {};
  if (flags.concurrency) o.concurrency = Number(flags.concurrency);
  if (flags.agent) o.agent = flags.agent;
  if (flags.sandbox) o.sandbox = flags.sandbox;
  if (flags.model) o.model = flags.model;
  if (flags["keep-sandboxes"]) o.keepSandboxes = true;
  if (flags["no-review"]) o.review = { enabled: false };
  if (flags["no-integrate"]) o.integrate = { auto: false };
  if (flags.grounding) o.grounding = { enabled: true };
  return o;
}

function selectIssues(all) {
  if (!flags.issues) return all;
  const wanted = new Set(flags.issues.split(",").map((s) => Number(s.trim())));
  return all.filter((i) => wanted.has(i.id));
}

async function confirm(question) {
  if (flags.yes) return true;
  if (!process.stdin.isTTY) {
    console.log(`${question} -> not confirmed (no terminal). Re-run with --yes to start the factory.`);
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// ---- commands ------------------------------------------------------------------------------------

async function cmdInit() {
  const file = flags.config;
  if (existsSync(file)) throw new Error(`${file} already exists; not overwriting it`);
  let issues = "gh:OWNER/REPO";
  const remote = await run("git", ["remote", "get-url", "origin"]).catch(() => ({ code: 1 }));
  const m = remote.code === 0 && remote.stdout.trim().match(/github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/);
  if (m) issues = `gh:${m[1]}`;
  const pkg = existsSync("package.json") ? JSON.parse(readFileSync("package.json", "utf8")) : null;
  const config = {
    issues,
    label: DEFAULTS.label,
    baseBranch: DEFAULTS.baseBranch,
    concurrency: DEFAULTS.concurrency,
    setup: pkg ? (existsSync("package-lock.json") ? "npm ci --no-audit --no-fund" : "npm install --no-audit --no-fund") : "",
    test: pkg?.scripts?.test ? "npm test" : "REPLACE_WITH_YOUR_TEST_COMMAND",
    model: DEFAULTS.model,
    budgets: DEFAULTS.budgets,
    grounding: { enabled: false },
    integrate: DEFAULTS.integrate,
  };
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  console.log(`Wrote ${file}. Review "issues", "setup" and "test", then run: node factory.mjs doctor`);
}

async function cmdDoctor() {
  const checks = [];
  const ok = (name, pass, hint = "", optional = false) => checks.push({ name, pass, hint, optional });
  const [major] = process.versions.node.split(".").map(Number);
  ok(`node ${process.versions.node}`, major >= 22, "Node 22 or later is required");
  ok("git", await available("git"), "install git");
  let cfg;
  try {
    cfg = loadConfig(flags.config, overrides());
    ok(`config ${flags.config}`, true);
  } catch (err) {
    ok(`config ${flags.config}`, false, err.message);
  }
  if (cfg) {
    if (cfg.source.kind === "gh") {
      const gh = await available("gh");
      ok("gh CLI", gh, "install the GitHub CLI: https://cli.github.com");
      if (gh) ok("gh auth", (await run("gh", ["auth", "status"])).code === 0, "run: gh auth login");
    } else {
      ok(`issues file ${cfg.source.path}`, existsSync(cfg.source.path), "create it or fix the path");
    }
    if (cfg.agent === "claude") ok(`claude (${cfg.claudeBin})`, await available(cfg.claudeBin), "install Claude Code: https://code.claude.com");
    const ls = await run("git", ["ls-remote", "--heads", cfg.repo, cfg.baseBranch], { timeoutMs: 60_000 });
    ok(`repo ${cfg.repo} has ${cfg.baseBranch}`, ls.code === 0 && ls.stdout.includes(`refs/heads/${cfg.baseBranch}`), "check the repo URL/path, base branch and git credentials");
    if (cfg.grounding.enabled) ok(`grounding key ${cfg.grounding.apiKeyEnv}`, Boolean(process.env[cfg.grounding.apiKeyEnv]), "optional: without a key Context7 serves keyless, rate-limited requests", true);
    ok(`test command "${cfg.test}"`, !/REPLACE_WITH/.test(cfg.test), "set the command the verifier should trust");
  }
  for (const k of checks) console.log(`${k.pass ? c.g + "ok  " : k.optional ? c.y + "warn" : c.r + "FAIL"}${c.x} ${k.name}${!k.pass && k.hint ? `${c.dim}  -> ${k.hint}${c.x}` : ""}`);
  const failed = checks.filter((k) => !k.pass && !k.optional).length;
  console.log(failed ? `\n${failed} problem(s) to fix before running.` : `\nReady. Next: node factory.mjs plan`);
  process.exitCode = failed ? 1 : 0;
}

async function cmdPlan() {
  const cfg = loadConfig(flags.config, overrides());
  const claims = claimStore(cfg);
  const issues = selectIssues(await loadIssues(cfg));
  console.log(`${c.b}Factory plan${c.x}  repo ${cfg.repo}  base ${cfg.baseBranch}  agent ${cfg.agent}${cfg.agent === "claude" ? ` (${cfg.model})` : ""}  lanes ${cfg.concurrency}  sandbox ${cfg.sandbox}\n`);
  let todo = 0;
  for (const i of issues) {
    const claimed = await claims.isClaimed(i);
    if (!claimed) todo++;
    console.log(`  #${String(i.id).padEnd(4)} ${claimed ? c.dim + "claimed, will skip" + c.x : "queued            "}  ${i.title}`);
  }
  const perIssue = cfg.budgets.triage + cfg.budgets.worker + cfg.budgets.reviewer;
  console.log(`\n${todo} issue(s) to work. Budget ceiling: $${round(todo * perIssue)} for the run${cfg.integrate.auto && todo > 1 ? ` + up to $${cfg.budgets.integrator} per integration conflict` : ""} (ceilings, not estimates).`);
  console.log(`Stages per issue: claim -> triage -> worker -> verifier${cfg.review.enabled ? " -> reviewer" : ""} -> pull request. A human merges.`);
  return { cfg, issues, todo };
}

async function cmdRun() {
  const { cfg, issues, todo } = await cmdPlan();
  if (todo === 0) return console.log("\nNothing to do.");
  if (cfg.sandbox === "shared") console.log(`\n${c.y}sandbox "shared": every stage uses ONE checkout. This reproduces the failure modes on purpose.${c.x}`);
  if (!(await confirm(`\nStart the factory on ${todo} issue(s)?`))) return;

  const runId = newRunId();
  const ledger = new Ledger(cfg.runsDir, runId);
  ledger.set({ config: { repo: cfg.repo, issues: cfg.issues, baseBranch: cfg.baseBranch, agent: cfg.agent, model: cfg.model, concurrency: cfg.concurrency, sandbox: cfg.sandbox, grounding: cfg.grounding.enabled, review: cfg.review.enabled } });
  console.log(`\n${c.b}run ${runId}${c.x}  ledger: ${ledger.dir}\n`);

  const claims = claimStore(cfg);
  await claims.ensureLabel();
  const boxes = new LocalSandboxes(cfg, ledger.dir);
  log(`preparing snapshot (clone${cfg.setup ? ` + ${cfg.setup}` : ""})`);
  await boxes.prepare(log);
  log("snapshot ready; every stage starts from a copy of it");

  let proxy;
  let extraContract = "";
  let stageEnv = () => ({});
  if (cfg.grounding.enabled) {
    proxy = await startDocsProxy({ endpoint: cfg.grounding.endpoint, apiKey: process.env[cfg.grounding.apiKeyEnv], logFile: join(ledger.dir, "docs-queries.log") });
    extraContract = groundingContract(`node "${DOCS_SCRIPT}"`);
    stageEnv = (caller) => ({ FACTORY_DOCS_URL: proxy.url, FACTORY_CALLER: caller });
    log(`live docs: proxy ${proxy.url} (the Context7 key stays in this process)`);
  }

  try {
    // Claimed issues stay in the queue on purpose: each lane re-checks the claim and logs the skip.
    const outcomes = await runFactory({ cfg, issues, claims, boxes, ledger, log, extraContract, stageEnv });
    ledger.set({ factorySeconds: Math.round((Date.now() - t0) / 1000) });
    if (cfg.integrate.auto && outcomes.filter((o) => o.stage === "ready_for_human").length > 1) {
      const i0 = Date.now();
      const integration = await integrate({ cfg, outcomes, boxes, ledger, log, stageEnv });
      ledger.set({ integration: { ...integration, seconds: Math.round((Date.now() - i0) / 1000) } });
    }
  } finally {
    ledger.set({ finishedAt: new Date().toISOString(), wallSeconds: Math.round((Date.now() - t0) / 1000) });
    await proxy?.close();
    await boxes.cleanup();
  }
  console.log("");
  printReport(ledger.data, ledger.dir);
}

async function cmdIntegrate() {
  const cfg = loadConfig(flags.config, overrides());
  const data = readRun(cfg.runsDir, flags.run);
  const ledger = new Ledger(cfg.runsDir, data.runId);
  const boxes = new LocalSandboxes(cfg, ledger.dir);
  await boxes.prepare(log);
  try {
    const i0 = Date.now();
    const integration = await integrate({ cfg, outcomes: data.outcomes, boxes, ledger, log });
    ledger.set({ integration: { ...integration, seconds: Math.round((Date.now() - i0) / 1000) } });
  } finally {
    await boxes.cleanup();
  }
  printReport(ledger.data, ledger.dir);
}

function cmdReport() {
  const cfg = loadConfig(flags.config, overrides());
  const data = readRun(cfg.runsDir, flags.run);
  if (flags.json) return console.log(JSON.stringify(data, null, 2));
  printReport(data, join(cfg.runsDir, data.runId));
}

function cmdStats() {
  const cfg = loadConfig(flags.config, overrides());
  // --agent claude: only runs made with real agents (fake dry runs would distort every signal).
  const runs = listRuns(cfg.runsDir).map((id) => readRun(cfg.runsDir, id)).filter((r) => !flags.agent || r.config?.agent === flags.agent);
  const all = runs.flatMap((r) => r.outcomes.map((o) => ({ ...o, runId: r.runId })));
  const stats = {
    runs: runs.length,
    issuesProcessed: all.length,
    byStage: all.reduce((m, o) => ({ ...m, [o.stage]: (m[o.stage] ?? 0) + 1 }), {}),
    rejectedBy: all.filter((o) => o.stage === "rejected").reduce((m, o) => ({ ...m, [o.rejectedBy]: (m[o.rejectedBy] ?? 0) + 1 }), {}),
    selfReportMismatches: all.filter((o) => o.selfReportMismatch).map((o) => ({ runId: o.runId, issue: o.issue })),
    reviewerFindings: all.filter((o) => o.review?.issuesFound?.length).map((o) => ({ runId: o.runId, issue: o.issue, verdict: o.review.verdict, issuesFound: o.review.issuesFound })),
    triagedOut: all.filter((o) => o.stage === "triaged_out").map((o) => ({ runId: o.runId, issue: o.issue, reason: o.triage?.reason })),
    errors: all.filter((o) => o.stage === "error").map((o) => ({ runId: o.runId, issue: o.issue, error: o.error.split("\n")[0] })),
    deniedTools: all.filter((o) => o.deniedTools).map((o) => ({ runId: o.runId, issue: o.issue, deniedTools: o.deniedTools })),
    conflictHotspots: runs.flatMap((r) => r.integration?.conflicts ?? []).flatMap((x) => x.files).reduce((m, f) => ({ ...m, [f]: (m[f] ?? 0) + 1 }), {}),
    costUsd: round(runs.reduce((s, r) => s + (r.totals?.costUsd ?? 0), 0)),
    avgIssueSeconds: all.length ? Math.round(all.reduce((s, o) => s + (o.seconds?.total ?? 0), 0) / all.length) : 0,
  };
  console.log(JSON.stringify(stats, null, 2));
}

async function cmdRelease() {
  const cfg = loadConfig(flags.config, overrides());
  if (!flags.issues) throw new Error("release needs --issues 1,2,3");
  const claims = claimStore(cfg);
  for (const id of flags.issues.split(",").map(Number)) {
    await claims.release(id);
    console.log(`released #${id}`);
  }
}

function printReport(data, dir) {
  const icon = { ready_for_human: `${c.g}PR${c.x}`, triaged_out: `${c.dim}skip${c.x}`, rejected: `${c.r}rej${c.x}`, blocked: `${c.y}blk${c.x}`, no_changes: `${c.y}none${c.x}`, error: `${c.r}err${c.x}` };
  const lines = [`# Factory run ${data.runId}`, ""];
  lines.push("| Issue | Result | Verifier | Reviewer | Seconds | Cost | Pull request / reason |", "|---|---|---|---|---|---|---|");
  for (const o of data.outcomes) {
    const why = {
      ready_for_human: o.pr,
      triaged_out: o.triage?.reason,
      blocked: o.work?.blockedReason,
      no_changes: "the worker changed nothing",
      rejected: o.guard ?? (o.rejectedBy === "reviewer" ? o.review?.issuesFound?.[0] : "tests fail on a clean copy of the branch"),
      error: o.error?.split("\n")[0],
    }[o.stage] ?? "";
    lines.push(`| #${o.issue} ${o.title.slice(0, 50)} | ${o.stage} | ${o.verifier ? (o.verifier.ok ? "pass" : "FAIL") : "-"} | ${o.review?.verdict ?? "-"} | ${o.seconds?.total ?? "-"} | $${(o.costUsd ?? 0).toFixed(2)} | ${String(why).replace(/\|/g, "/").slice(0, 120)} |`);
  }
  const t = data.totals ?? {};
  const lanesCost = data.outcomes.reduce((s, o) => s + (o.costUsd ?? 0), 0);
  lines.push("", `**Totals.** ${t.issues ?? 0} issue${t.issues === 1 ? "" : "s"}: ${Object.entries(t.byStage ?? {}).map(([k, v]) => `${v} ${k}`).join(", ")}. Factory wall clock ${data.factorySeconds ?? data.wallSeconds ?? "?"} s. Model cost $${lanesCost.toFixed(2)} for the lanes${data.integration ? ` + $${(data.integration.costUsd ?? 0).toFixed(2)} integration = $${(t.costUsd ?? 0).toFixed(2)}` : ""}.`);
  if (data.integration) {
    const i = data.integration;
    lines.push("", `**Integration** into \`${i.into}\`: ${i.merged.length} merged, ${i.conflicts.length} needed conflict resolution${i.failed ? `, stopped at #${i.failed.issue} (${i.failed.reason})` : ", tests pass on the combined tree"}. Integrator cost $${(i.costUsd ?? 0).toFixed(2)}.`);
  }
  lines.push("", "Next: review and merge the pull requests yourself. The factory never merges.");
  const md = lines.join("\n");
  writeFileSync(join(dir, "report.md"), md + "\n");
  console.log(md.replace(/\| (ready_for_human|triaged_out|rejected|blocked|no_changes|error) \|/g, (_, s) => `| ${icon[s]} ${s} |`));
  console.log(`\n${c.dim}ledger: ${dir}${c.x}`);
}

function help() {
  const lines = readFileSync(import.meta.filename, "utf8").split(/\r?\n/);
  const end = lines.findIndex((l, i) => i > 0 && !l.startsWith("//"));
  console.log(lines.slice(1, end).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
}

const commands = { init: cmdInit, doctor: cmdDoctor, plan: cmdPlan, run: cmdRun, integrate: cmdIntegrate, report: cmdReport, stats: cmdStats, release: cmdRelease, help };
try {
  if (flags.help || command === "help") help();
  else if (!commands[command]) {
    console.error(`unknown command: ${command}
`);
    help();
    process.exitCode = 2;
  } else await commands[command]();
} catch (err) {
  console.error(`${c.r}error:${c.x} ${err.message}`);
  process.exitCode = 1;
}
