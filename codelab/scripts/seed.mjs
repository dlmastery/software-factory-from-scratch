#!/usr/bin/env node
// Create your own copy of the practice repository, with its 10 issues.
//
//   node codelab/scripts/seed.mjs local [dir]          a local bare git repo + issues file (no GitHub needed)
//   node codelab/scripts/seed.mjs github owner/repo    a PRIVATE GitHub repo with the 10 issues filed
//
// Both write a factory.config.json next to the copy, ready for `factory.mjs doctor`.
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const HERE = import.meta.dirname;
const APP = join(HERE, "..", "practice-app");
const ISSUES = join(HERE, "..", "issues.json");
const [mode, target] = process.argv.slice(2);

const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString();

/** A fresh one-commit history of the practice app on `main`. */
function freshWorkingCopy() {
  const dir = mkdtempSync(join(tmpdir(), "shortlinks-"));
  cpSync(APP, dir, { recursive: true, filter: (src) => !/node_modules|hidden-test/.test(src) });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "core.autocrlf", "false");
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=codelab", "-c", "user.email=codelab@example.com", "commit", "-q", "-m", "shortlinks: initial version");
  return dir;
}

if (mode === "local") {
  const root = resolve(target ?? "factory-lab");
  const bare = join(root, "shortlinks.git");
  if (existsSync(bare)) {
    console.error(`${bare} already exists. Delete ${root} to start over.`);
    process.exit(1);
  }
  mkdirSync(root, { recursive: true });
  const wc = freshWorkingCopy();
  git(root, "clone", "-q", "--bare", wc, bare);
  rmSync(wc, { recursive: true, force: true });
  cpSync(ISSUES, join(root, "issues.json"));
  writeFileSync(join(root, "factory.config.json"), JSON.stringify({
    issues: "file:issues.json",
    repo: "shortlinks.git",
    baseBranch: "main",
    concurrency: 3,
    setup: "",
    test: "npm test",
    agent: "fake",
    model: "sonnet",
    integrate: { auto: true, into: "factory/integration" },
  }, null, 2) + "\n");
  console.log(`Created ${root}
  shortlinks.git        the "remote" the factory pushes branches to
  issues.json           the 10 issues (the work queue)
  factory.config.json   agent "fake" to start; switch to "claude" in Lab 6

Next:
  cd "${root.replace(/\\/g, "/")}"
  node "$SF" doctor`);
} else if (mode === "github") {
  if (!/^[\w.-]+\/[\w.-]+$/.test(target ?? "")) {
    console.error("usage: node seed.mjs github owner/repo");
    process.exit(2);
  }
  try {
    execFileSync("gh", ["repo", "view", target], { stdio: "ignore" });
    console.error(`${target} already exists; not touching it.`);
    process.exit(1);
  } catch {
    // does not exist yet: good
  }
  const wc = freshWorkingCopy();
  execFileSync("gh", ["repo", "create", target, "--private", "--source", wc, "--remote", "origin", "--push"], { stdio: "inherit" });
  execFileSync("gh", ["label", "create", "factory", "--repo", target, "--color", "0E8A16", "--description", "Work for the software factory"], { stdio: "ignore" });
  const issues = JSON.parse((await import("node:fs")).readFileSync(ISSUES, "utf8"));
  for (const l of new Set(issues.flatMap((i) => i.labels))) {
    try {
      execFileSync("gh", ["label", "create", l, "--repo", target], { stdio: "ignore" });
    } catch {
      // label exists already (GitHub creates bug/enhancement by default)
    }
  }
  for (const i of issues) {
    execFileSync("gh", ["issue", "create", "--repo", target, "--title", i.title, "--body", i.body, "--label", ["factory", ...i.labels].join(",")], { stdio: "inherit" });
  }
  rmSync(wc, { recursive: true, force: true });
  const root = resolve(target.split("/")[1] + "-factory");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "factory.config.json"), JSON.stringify({
    issues: `gh:${target}`,
    label: "factory",
    baseBranch: "main",
    concurrency: 5,
    setup: "",
    test: "npm test",
    agent: "claude",
    model: "sonnet",
    integrate: { auto: true, into: "factory/integration" },
  }, null, 2) + "\n");
  console.log(`\nCreated https://github.com/${target} (private) with ${issues.length} issues labelled "factory".
GitHub numbers the issues #1..#${issues.length} in order, so the hidden tests line up.
Config: ${join(root, "factory.config.json")}`);
} else {
  console.error("usage: node seed.mjs local [dir] | github owner/repo");
  process.exit(2);
}
