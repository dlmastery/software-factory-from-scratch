// End to end with the zero-cost fake agent: seed a local practice repo, run the whole factory,
// check every outcome, the claims, the ledger and the integration branch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "..");
const FACTORY = join(ROOT, "skills", "software-factory", "scripts", "factory.mjs");
const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 600_000 });

test("fake run: 9 PRs, vague issue triaged out, conflicts integrated, claims respected", { timeout: 900_000 }, () => {
  const lab = join(mkdtempSync(join(tmpdir(), "sf-e2e-")), "lab");
  const seed = node([join(ROOT, "codelab", "scripts", "seed.mjs"), "local", lab]);
  assert.equal(seed.status, 0, seed.stderr);

  const doctor = node([FACTORY, "doctor"], lab);
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);

  const run = node([FACTORY, "run", "--yes", "--concurrency", "5"], lab);
  assert.equal(run.status, 0, run.stdout + run.stderr);

  const runsDir = join(lab, ".factory", "runs");
  const [runId] = readdirSync(runsDir);
  const data = JSON.parse(readFileSync(join(runsDir, runId, "run.json"), "utf8"));
  assert.equal(data.outcomes.length, 10);
  assert.equal(data.totals.byStage.ready_for_human, 9);
  assert.equal(data.totals.byStage.triaged_out, 1);
  assert.equal(data.outcomes.find((o) => o.issue === 10).stage, "triaged_out");
  assert.ok(data.outcomes.filter((o) => o.stage === "ready_for_human").every((o) => o.verifier.ok && o.review.verdict === "approve"));

  // Every fake worker appended to the same file from the same snapshot: 8 of 9 merges conflict.
  assert.deepEqual(data.integration.merged, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(data.integration.conflicts.length, 8);
  assert.equal(data.integration.testsPass, true);
  const log = spawnSync("git", ["--git-dir", join(lab, "shortlinks.git"), "show", "factory/integration:FACTORY_LOG.md"], { encoding: "utf8" }).stdout;
  for (let i = 1; i <= 9; i++) assert.match(log, new RegExp(`- #${i} `), `integration keeps #${i}`);
  assert.doesNotMatch(log, /<<<<<<<|>>>>>>>/);

  // The base branch is untouched.
  const mainLog = spawnSync("git", ["--git-dir", join(lab, "shortlinks.git"), "log", "--oneline", "main"], { encoding: "utf8" }).stdout.trim().split("\n");
  assert.equal(mainLog.length, 1);

  // Ledger artifacts.
  for (const f of ["events.jsonl", "report.md"]) assert.ok(existsSync(join(runsDir, runId, f)), f);
  assert.equal(readdirSync(join(runsDir, runId, "prs")).length, 9);

  // Claims persist: a second run has nothing to do.
  const again = node([FACTORY, "plan"], lab);
  assert.match(again.stdout, /0 issue\(s\) to work/);
});

test("shared sandbox reproduces cross-contamination", { timeout: 900_000 }, () => {
  const lab = join(mkdtempSync(join(tmpdir(), "sf-shared-")), "lab");
  assert.equal(node([join(ROOT, "codelab", "scripts", "seed.mjs"), "local", lab]).status, 0);
  const run = node([FACTORY, "run", "--yes", "--sandbox", "shared", "--issues", "1,2,3", "--no-integrate", "--no-review"], lab);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  // In one shared checkout, lanes either collide outright (git lock, clobbered checkout) or produce
  // branches that carry other issues' changes. Which one happens depends on timing; one always does.
  const show = (b) => spawnSync("git", ["--git-dir", join(lab, "shortlinks.git"), "show", `${b}:FACTORY_LOG.md`], { encoding: "utf8" }).stdout;
  const contaminated = ["factory/issue-1", "factory/issue-2", "factory/issue-3"].map(show).filter((t) => (t.match(/^- #/gm) ?? []).length > 1);
  const runsDir = join(lab, ".factory", "runs");
  const outcomes = JSON.parse(readFileSync(join(runsDir, readdirSync(runsDir)[0], "run.json"), "utf8")).outcomes;
  const collided = outcomes.filter((o) => o.stage === "error" || o.stage === "rejected");
  assert.ok(contaminated.length + collided.length >= 1, "shared folder must contaminate a branch or make a lane collide");
});
