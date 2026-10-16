// The run ledger: everything the factory did, as files a human (or the factory-improve skill) can read.
//
//   <runsDir>/<runId>/run.json        outcomes, timings, costs, totals (rewritten as the run progresses)
//   <runsDir>/<runId>/events.jsonl    one line per event, in order
//   <runsDir>/<runId>/traces/         every prompt, stage contract and raw agent output
//   <runsDir>/<runId>/prs/            pull request bodies (and, for local repos, the "PRs" themselves)
//   <runsDir>/<runId>/report.md       the human summary
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class Ledger {
  constructor(runsDir, runId) {
    this.runId = runId;
    this.dir = join(runsDir, runId);
    this.traces = join(this.dir, "traces");
    this.prs = join(this.dir, "prs");
    mkdirSync(this.traces, { recursive: true });
    mkdirSync(this.prs, { recursive: true });
    this.data = existsSync(join(this.dir, "run.json"))
      ? JSON.parse(readFileSync(join(this.dir, "run.json"), "utf8"))
      : { runId, startedAt: new Date().toISOString(), outcomes: [] };
  }

  event(type, fields = {}) {
    appendFileSync(join(this.dir, "events.jsonl"), JSON.stringify({ at: new Date().toISOString(), type, ...fields }) + "\n");
  }

  set(fields) {
    Object.assign(this.data, fields);
    this.save();
  }

  outcome(o) {
    this.data.outcomes = this.data.outcomes.filter((x) => x.issue !== o.issue).concat(o).sort((a, b) => a.issue - b.issue);
    this.save();
  }

  save() {
    const outcomes = this.data.outcomes;
    this.data.totals = {
      issues: outcomes.length,
      byStage: outcomes.reduce((m, o) => ({ ...m, [o.stage]: (m[o.stage] ?? 0) + 1 }), {}),
      costUsd: round(outcomes.reduce((s, o) => s + (o.costUsd ?? 0), 0) + (this.data.integration?.costUsd ?? 0)),
    };
    writeFileSync(join(this.dir, "run.json"), JSON.stringify(this.data, null, 2));
  }
}

/** Run ids sort by time: 2026-10-15T17-42-03Z-ab12 */
export function newRunId() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
}

export function listRuns(runsDir) {
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir).filter((d) => existsSync(join(runsDir, d, "run.json"))).sort();
}

export function readRun(runsDir, runId) {
  const runs = listRuns(runsDir);
  const id = !runId || runId === "latest" ? runs.at(-1) : runId;
  if (!id || !runs.includes(id)) throw new Error(runId && runId !== "latest" ? `no run ${runId} in ${runsDir}` : `no runs yet in ${runsDir}`);
  return JSON.parse(readFileSync(join(runsDir, id, "run.json"), "utf8"));
}

export const round = (n) => Math.round(n * 100) / 100;
