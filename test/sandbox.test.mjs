// Regression tests for the sandbox's security properties.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { DEFAULTS } from "../skills/software-factory/scripts/lib/config.mjs";
import { LocalSandboxes } from "../skills/software-factory/scripts/lib/sandbox.mjs";

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, stdio: "pipe" }).toString();

/** A bare "remote" with one commit containing test/a.test.js, and sandboxes over it. */
async function setup(extra = {}) {
  const root = mkdtempSync(join(tmpdir(), "sf-sandbox-"));
  const wc = join(root, "wc");
  mkdirSync(join(wc, "test"), { recursive: true });
  writeFileSync(join(wc, "test", "a.test.js"), "// a test\n");
  git(wc, "init", "-q", "-b", "main");
  git(wc, "add", "-A");
  git(wc, "commit", "-q", "-m", "init");
  git(root, "clone", "-q", "--bare", wc, "remote.git");
  const cfg = { ...DEFAULTS, repo: join(root, "remote.git"), keepSandboxes: false, ...extra };
  const boxes = new LocalSandboxes(cfg, join(root, "run"));
  await boxes.prepare();
  return { root, cfg, boxes };
}

test("renaming a test file away counts as deleting it", async () => {
  const { boxes } = await setup();
  const box = await boxes.create("worker");
  git(box.dir, "mv", "test/a.test.js", "test/a.test.js.disabled");
  const commit = await box.commitAndPush("factory/issue-1", "rename");
  assert.ok(commit.deleted.includes("test/a.test.js"), `deleted: ${commit.deleted}`);
});

test("git hooks planted by an agent never run", async () => {
  const { root, boxes } = await setup();
  const box = await boxes.create("worker");
  const marker = join(root, "hook-ran");
  const hook = join(box.dir, ".git", "hooks", "pre-commit");
  writeFileSync(hook, `#!/bin/sh\necho ran > "${marker.replace(/\\/g, "/")}"\n`, { mode: 0o755 });
  writeFileSync(join(box.dir, "change.txt"), "x\n");
  const commit = await box.commitAndPush("factory/issue-2", "with hook");
  assert.equal(commit.pushed, true);
  assert.equal(existsSync(marker), false, "pre-commit hook must not run");
});

test("test and setup commands run without the runner's secrets", async () => {
  process.env.GH_TOKEN = "secret-should-not-leak";
  const probe = `node -e "process.exit(process.env.GH_TOKEN ? 3 : 0)"`;
  const { boxes } = await setup({ test: probe, setup: probe });
  const box = await boxes.create("verify");
  await box.setup(); // throws if the secret is visible
  const r = await box.test();
  assert.equal(r.ok, true, r.output);
});
