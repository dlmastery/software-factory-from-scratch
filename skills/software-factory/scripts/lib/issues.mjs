// Issue sources and claims.
//
// Claims fix failure mode "two agents pick the same issue". On GitHub the issue's labels are the
// queue: a lane adds `factory:claimed` before working and skips issues that already carry it.
// For file sources a claim is a directory created with mkdir, which is atomic on every OS.
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { must, run } from "./proc.mjs";

/** Load open issues: [{ id, title, body, labels }] sorted by id. */
export async function loadIssues(cfg) {
  if (cfg.source.kind === "file") {
    const list = JSON.parse(readFileSync(cfg.source.path, "utf8"));
    return list.map(normalize).sort((a, b) => a.id - b.id);
  }
  const args = ["issue", "list", "--repo", cfg.source.repo, "--state", "open", "--limit", "200", "--json", "number,title,body,labels"];
  if (cfg.label) args.push("--label", cfg.label);
  const r = await must("gh", args);
  return JSON.parse(r.stdout)
    .map((i) => normalize({ id: i.number, title: i.title, body: i.body, labels: i.labels.map((l) => l.name) }))
    .sort((a, b) => a.id - b.id);
}

function normalize(i) {
  return { id: Number(i.id), title: String(i.title ?? ""), body: String(i.body ?? ""), labels: [...(i.labels ?? [])] };
}

/** Pick the claim store that matches the issue source. */
export function claimStore(cfg) {
  return cfg.source.kind === "gh" ? new GitHubLabelClaims(cfg) : new DirectoryClaims(join(cfg.runsDir, "..", "claims"));
}

/**
 * GitHub label claims. Visible to humans in the issue list and survives across runs and machines.
 * Not atomic between two runners that check at the same instant, so schedule one factory run at a time
 * per repository (the codelab's Lab 4 shows the race).
 */
export class GitHubLabelClaims {
  constructor(cfg) {
    this.repo = cfg.source.repo;
    this.label = cfg.claims.label;
    this.mine = new Set();
  }
  async ensureLabel() {
    await run("gh", ["label", "create", this.label, "--repo", this.repo, "--color", "FBCA04", "--description", "Claimed by the software factory"]);
  }
  async isClaimed(issue) {
    return issue.labels.includes(this.label);
  }
  async claim(issue) {
    if (this.mine.has(issue.id)) return false;
    // Re-read labels right before claiming: another run may have claimed it since we listed issues.
    const r = await must("gh", ["issue", "view", String(issue.id), "--repo", this.repo, "--json", "labels"]);
    if (JSON.parse(r.stdout).labels.some((l) => l.name === this.label)) return false;
    await must("gh", ["issue", "edit", String(issue.id), "--repo", this.repo, "--add-label", this.label]);
    this.mine.add(issue.id);
    return true;
  }
  async release(id) {
    await must("gh", ["issue", "edit", String(id), "--repo", this.repo, "--remove-label", this.label]);
  }
}

/** Directory claims for file-based issue sources: claims/issue-<id>/ exists = claimed. */
export class DirectoryClaims {
  constructor(dir) {
    this.dir = dir;
  }
  async ensureLabel() {
    mkdirSync(this.dir, { recursive: true });
  }
  async isClaimed(issue) {
    return existsSync(join(this.dir, `issue-${issue.id}`));
  }
  async claim(issue, owner = "factory") {
    mkdirSync(this.dir, { recursive: true });
    try {
      mkdirSync(join(this.dir, `issue-${issue.id}`)); // atomic: fails if another lane got there first
    } catch (err) {
      if (err.code === "EEXIST") return false;
      throw err;
    }
    writeFileSync(join(this.dir, `issue-${issue.id}`, "owner"), `${owner}\n${new Date().toISOString()}\n`);
    return true;
  }
  async release(id) {
    rmSync(join(this.dir, `issue-${id}`), { recursive: true, force: true });
  }
}
