#!/usr/bin/env node
// Verify a branch on a clean copy, the way the factory's verifier does.
//
//   node verify-branch.mjs <repo-url-or-path> <branch> --test "npm test" [--setup "npm ci"] [--timeout 600]
//
// Prints the tail of the test output and a JSON verdict: { branch, ok, flaky, seconds }.
// Exit code 0 when the tests pass (on the first run or the retry), 1 otherwise.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: { test: { type: "string" }, setup: { type: "string" }, timeout: { type: "string", default: "600" } },
});
const [repo, branch] = positionals;
if (!repo || !branch || !o.test) {
  console.error('usage: node verify-branch.mjs <repo> <branch> --test "npm test" [--setup "npm ci"] [--timeout 600]');
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), "verify-"));
const timeout = Number(o.timeout) * 1000;
const shell = (cmd) => spawnSync(cmd, { cwd: dir, shell: true, encoding: "utf8", timeout, maxBuffer: 64 << 20 });
const t0 = Date.now();
let verdict;
try {
  const clone = spawnSync("git", ["clone", "-q", "--depth", "1", "--branch", branch, repo, dir], { encoding: "utf8" });
  if (clone.status !== 0) throw new Error(`clone failed: ${clone.stderr.trim()}`);
  if (o.setup) {
    const s = shell(o.setup);
    if (s.status !== 0) throw new Error(`setup failed:\n${(s.stdout + s.stderr).trim().split("\n").slice(-20).join("\n")}`);
  }
  let r = shell(o.test);
  let flaky = false;
  if (r.status !== 0) {
    const retry = shell(o.test);
    if (retry.status === 0) {
      r = retry;
      flaky = true;
    }
  }
  console.log((r.stdout + r.stderr).trim().split("\n").slice(-30).join("\n"));
  verdict = { branch, ok: r.status === 0, flaky, seconds: Math.round((Date.now() - t0) / 1000) };
} catch (err) {
  console.error(err.message);
  verdict = { branch, ok: false, flaky: false, seconds: Math.round((Date.now() - t0) / 1000), error: err.message.split("\n")[0] };
} finally {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}
console.log(`\n${JSON.stringify(verdict)}`);
process.exit(verdict.ok ? 0 : 1);
