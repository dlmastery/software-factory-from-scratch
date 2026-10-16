// Sandboxes fix failure mode "agents overwrite one another's files".
//
// prepare() clones the repository once, runs `setup`, and keeps the result as a snapshot.
// Every stage then gets its own copy of that snapshot, works in it, and the copy is thrown away.
// That mirrors the video's Upstash Box flow (one base box -> snapshot -> one box per stage) on a
// single machine. A local copy isolates FILES, not the network or the OS user: see the
// factory-sandbox skill for container and cloud (Upstash Box) backends with real isolation.
//
// Code written by agents runs here too (tests, npm lifecycle scripts, anything a worker left in the
// tree), so every command the runner executes inside a sandbox gets the AGENT environment (no secrets),
// and git runs with hooks disabled: a worker cannot plant .git/hooks/pre-commit and have the runner,
// which holds the push credentials, execute it.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentEnv } from "./agent.mjs";
import { must, run, sh, tail } from "./proc.mjs";

// A hooks directory that never exists: git then runs no hooks at all.
const NO_HOOKS = join(tmpdir(), "software-factory-no-hooks-do-not-create");
const GIT = ["-c", "user.name=factory-bot", "-c", "user.email=factory-bot@users.noreply.github.com", "-c", `core.hooksPath=${NO_HOOKS}`, "-c", "core.autocrlf=false"];

export class LocalSandboxes {
  constructor(cfg, runDir) {
    this.cfg = cfg;
    this.root = join(runDir, "boxes");
    this.snapshot = join(runDir, "snapshot");
    this.shared = cfg.sandbox === "shared";
  }

  /** Clone + setup once. Every sandbox starts from this exact state. */
  async prepare(log = () => {}) {
    mkdirSync(this.root, { recursive: true });
    await must("git", [...GIT, "clone", "--quiet", "-c", "core.autocrlf=false", "--branch", this.cfg.baseBranch, this.cfg.repo, this.snapshot], { timeoutMs: 10 * 60_000 });
    if (this.cfg.setup) {
      log(`setup: ${this.cfg.setup}`);
      const r = await sh(this.cfg.setup, { cwd: this.snapshot, env: agentEnv(this.cfg), timeoutMs: this.cfg.testTimeoutSeconds * 1000 });
      if (r.code !== 0) throw new Error(`setup failed in snapshot:\n${tail(r.stdout + r.stderr, 20)}`);
    }
    if (this.shared) cpSync(this.snapshot, join(this.root, "shared"), { recursive: true });
  }

  /** A fresh sandbox for one stage. In "shared" mode every caller gets the same directory unless `fresh`. */
  async create(label, { fresh = false } = {}) {
    const shared = this.shared && !fresh;
    const dir = shared ? join(this.root, "shared") : join(this.root, label);
    if (!shared) {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
      cpSync(this.snapshot, dir, { recursive: true });
    }
    return new Sandbox(this.cfg, dir, label, shared);
  }

  async cleanup() {
    if (this.cfg.keepSandboxes) return;
    rmSync(this.root, { recursive: true, force: true, maxRetries: 5 });
  }
}

/**
 * One stage's sandbox. This is the whole interface the pipeline uses, so another backend
 * (container, cloud sandbox) implements the same methods. See skills/factory-sandbox/SKILL.md.
 */
export class Sandbox {
  constructor(cfg, dir, label, shared) {
    this.cfg = cfg;
    this.dir = dir;
    this.label = label;
    this.shared = shared;
  }

  /** git in this sandbox. Resolves { code, stdout, stderr } and never throws on a non-zero exit. */
  git(args, opts = {}) {
    return run("git", [...GIT, ...args], { cwd: this.dir, timeoutMs: 5 * 60_000, ...opts });
  }

  /** git in this sandbox; throws with git's output on a non-zero exit. */
  gitMust(args, opts = {}) {
    return must("git", [...GIT, ...args], { cwd: this.dir, timeoutMs: 5 * 60_000, ...opts });
  }

  /** Run the configured test command, without secrets. Returns { ok, output, timedOut }. */
  async test() {
    const r = await sh(this.cfg.test, { cwd: this.dir, env: agentEnv(this.cfg), timeoutMs: this.cfg.testTimeoutSeconds * 1000 });
    return { ok: r.code === 0 && !r.timedOut, output: tail(r.stdout + r.stderr, 60), timedOut: r.timedOut };
  }

  async setup() {
    if (!this.cfg.setup) return;
    const r = await sh(this.cfg.setup, { cwd: this.dir, env: agentEnv(this.cfg), timeoutMs: this.cfg.testTimeoutSeconds * 1000 });
    if (r.code !== 0) throw new Error(`setup failed in ${this.label}:\n${tail(r.stdout + r.stderr, 20)}`);
  }

  async status() {
    return (await this.git(["status", "--porcelain"])).stdout.trim();
  }

  /**
   * Commit whatever the worker changed onto `branch` and push it. The runner commits, never the agent,
   * so every branch has the same shape and an agent cannot rewrite history.
   * Returns { pushed, files, deleted }; pushed is false when there was nothing to commit.
   * Renames are reported as a deletion plus an addition, so renaming a test away counts as deleting it.
   */
  async commitAndPush(branch, message) {
    await this.gitMust(["checkout", "-q", "-B", branch]);
    await this.gitMust(["add", "-A"]);
    const staged = (await this.git(["diff", "--cached", "--name-status", "--no-renames"])).stdout.trim();
    if (!staged) return { pushed: false, files: [], deleted: [] };
    const rows = staged.split("\n").map((l) => l.split("\t"));
    const files = rows.map((r) => r.at(-1));
    const deleted = rows.filter((r) => r[0] === "D").map((r) => r[1]);
    await this.gitMust(["commit", "-q", "--no-verify", "-m", message]);
    await this.gitMust(["push", "-q", "--no-verify", "--force", "origin", `HEAD:refs/heads/${branch}`]);
    return { pushed: true, files, deleted };
  }

  /** Check out a branch exactly as it exists on origin (what a human reviewer would see). */
  async checkout(branch) {
    await this.gitMust(["fetch", "-q", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
    await this.gitMust(["checkout", "-q", "-B", branch, `origin/${branch}`]);
  }

  /** Files that differ between the base branch and HEAD. */
  async changedFiles() {
    const r = await this.git(["diff", "--name-only", `origin/${this.cfg.baseBranch}...HEAD`]);
    return r.stdout.trim().split("\n").filter(Boolean);
  }

  /** Throw the sandbox away. Shared sandboxes and --keep-sandboxes are left in place. */
  async destroy() {
    if (this.shared || this.cfg.keepSandboxes) return;
    rmSync(this.dir, { recursive: true, force: true, maxRetries: 5 });
  }
}
