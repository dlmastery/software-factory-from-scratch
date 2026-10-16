#!/usr/bin/env node
// Score the factory's branches against the hidden tests the agents never saw.
//
//   node codelab/scripts/score.mjs <repo> [--prefix factory] [--integration factory/integration]
//
// <repo> is the git URL or local path the factory pushed to (e.g. factory-lab/shortlinks.git).
// For each branch <prefix>/issue-N it runs hidden-tests/hNN.test.js on a clean clone of that branch.
// With --integration it also runs every hidden test on the combined integration branch.
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { prefix: { type: "string", default: "factory" }, integration: { type: "string" } },
});
const repo = positionals[0];
if (!repo) {
  console.error("usage: node score.mjs <repo> [--prefix factory] [--integration factory/integration]");
  process.exit(2);
}
const HIDDEN = join(import.meta.dirname, "..", "hidden-tests");

const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });
const heads = git(["ls-remote", "--heads", repo]).stdout.split("\n").map((l) => l.split("refs/heads/")[1]).filter(Boolean);
const branches = heads.map((b) => ({ b, m: b.match(new RegExp(`^${opts.prefix}/issue-(\\d+)$`)) })).filter((x) => x.m).map((x) => ({ branch: x.b, issue: Number(x.m[1]) })).sort((a, b) => a.issue - b.issue);

function runHidden(branch, files) {
  const dir = mkdtempSync(join(tmpdir(), "score-"));
  try {
    const clone = git(["clone", "-q", "--depth", "1", "--branch", branch, repo, dir]);
    if (clone.status !== 0) return files.map((f) => ({ f, pass: false, note: "clone failed" }));
    cpSync(HIDDEN, join(dir, "hidden-test"), { recursive: true });
    return files.map((f) => {
      const r = spawnSync(process.execPath, ["--test", join("hidden-test", f)], { cwd: dir, encoding: "utf8", timeout: 120_000 });
      const failing = (r.stdout.match(/^not ok \d+ - (.*)$/gm) ?? []).map((l) => l.replace(/^not ok \d+ - /, ""));
      return { f, pass: r.status === 0, note: failing.slice(0, 2).join("; ") };
    });
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}

const file = (n) => `h${String(n).padStart(2, "0")}.test.js`;
let passed = 0;
console.log(`Hidden tests against ${branches.length} factory branch(es) in ${repo}\n`);
for (const { branch, issue } of branches) {
  if (!existsSync(join(HIDDEN, file(issue)))) {
    console.log(`  #${issue}  ${branch}  (no hidden test for this issue)`);
    continue;
  }
  const [r] = runHidden(branch, [file(issue)]);
  if (r.pass) passed++;
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  #${issue}  ${branch}${r.note ? `   ${r.note}` : ""}`);
}
console.log(`\n${passed}/${branches.length} branches pass their hidden test.`);

if (opts.integration) {
  if (!heads.includes(opts.integration)) {
    console.log(`\nNo branch ${opts.integration} yet.`);
  } else {
    const issues = branches.map((b) => b.issue).filter((n) => existsSync(join(HIDDEN, file(n))));
    const results = runHidden(opts.integration, issues.map(file));
    const ok = results.filter((r) => r.pass).length;
    console.log(`\nIntegration branch ${opts.integration}: ${ok}/${results.length} hidden tests pass on the combined tree.`);
    for (const r of results.filter((x) => !x.pass)) console.log(`  FAIL  ${r.f}   ${r.note}`);
  }
}
