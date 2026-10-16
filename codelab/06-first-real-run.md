# Lab 6: First real run

**Goal:** replace the stand-in agents with real Claude Code agents, run the whole backlog, and read what they did: the decisions, the handoffs, the time and the money.

## 1. Switch to real agents

Edit `~/factory-lab/factory.config.json`: set `"agent": "claude"`. Keep `"model": "sonnet"`. Release the claims left from the fake runs:

```bash
cd ~/factory-lab
node "$SF" release --issues 1,2,3,4,5,6,7,8,9,10
node "$SF" doctor           # now also checks the claude CLI
```

## 2. Start small: three issues

Pick one easy bug, one subtle feature and the vague one:

```bash
node "$SF" plan --issues 3,8,10
node "$SF" run --issues 3,8,10 --concurrency 3
```

`plan` prints the **budget ceiling** before anything starts. Each stage invocation is hard-capped (`budgets` in the config, passed to `claude --max-budget-usd`), so the ceiling is the most a run can cost, not an estimate. Answer `y`.

While it runs, open the newest run's `traces/` folder and watch the files appear: `issue-3.triage.prompt.md`, `issue-3.triage.contract.md`, `issue-3.triage.output.json`, then the worker's, then the reviewer's.

## 3. Read the triage decisions

```bash
RUN=$(ls .factory/runs | tail -1)
node -e "const d=require('./.factory/runs/$RUN/run.json'); for (const o of d.outcomes) console.log('#'+o.issue, JSON.stringify(o.triage, null, 1))"
```

Compare the acceptance criteria for #3 with the ones you wrote in Lab 1. #10 should be `actionable: false` with a reason that tells a human what to add, for example:

> Does not say which stats to add, what is wrong with the current ones, or whether a dashboard is wanted ("maybe more data, maybe a dashboard, not sure"), so there is no concrete, testable outcome.

## 4. Read one agent call end to end

```bash
cd .factory/runs/$RUN/traces
cat issue-8.worker.prompt.md       # the task
cat issue-8.worker.contract.md     # the factory-worker skill, as the agent received it
node -e "const o=require('./issue-8.worker.output.json'); console.log(JSON.stringify({result:o.structured_output, cost:o.total_cost_usd, turns:o.num_turns, denied:o.permission_denials}, null, 1))"
```

`output.json` is the raw `claude -p --output-format json` result: the typed handoff (`structured_output`), the cost, the number of turns and any `permission_denials`.

## 5. The whole backlog

```bash
cd ~/factory-lab
node "$SF" release --issues 3,8,10
node "$SF" run --yes --concurrency 5
```

### Reference: a measured run of this repository

The run below was recorded while building this codelab (Windows 11, `sonnet`, 5 lanes, local sandboxes). Its full ledger is in [`sample-runs/full-run/`](sample-runs/full-run/): `run.json`, `report.md`, `events.jsonl`, every PR body and all 96 trace files. Compare it with the video's run on the same kind of app:

| | This repository | The video (Upstash Box) |
|---|---|---|
| Issues | 10 (4 bugs, 5 features, 1 vague) | 10 (4 bugs, 5 features, 1 vague) |
| Lanes | 5 | 5 |
| Triaged out | 1 (#10) | 1 (#10) |
| PRs (verifier pass + reviewer approve) | 9 | 9 |
| Hidden tests, per branch | 9/9 | 9/9 |
| Factory wall clock | 6 min 14 s | 4 min 34 s |
| Model cost, lanes | $1.90 | $3.67 |
| Branches conflicting at integration | 4 of 9 (all in `src/app.js`) | 7 of 9 (shared test file) |
| Integrator cost | $0.42 | $6.37 |
| Hidden tests on the integrated tree | 9/9 | all pass (24 tests) |
| Sandbox compute | your laptop | ~$0.01 |

Average stage times in this run: triage 38 s, worker 75 s, verifier 7 s, reviewer 45 s. Per issue, $0.17 to $0.25. Your numbers will differ; the shape should not.

Why fewer conflicts here? The worker contract asks for a **new test file per issue** (`test/expiry.test.js`, `test/rate-limit.test.js`, ...) instead of appending to the shared `test/basic.test.js`. Every remaining conflict is in `src/app.js`, where every route lives. Lab 8 tests this explanation.

## Checkpoint

- Your run ends with 9 `ready_for_human` and #10 `triaged_out`, or you can explain from the ledger why it did not.
- You filled in your own column of the table above.

## Questions

1. Which stage costs the most per issue, and which takes the longest? Are they the same stage? Why?
2. Find a reviewer's `riskNotes` in `run.json` that a human merger should read before merging (hint: look at #9 and how its window works). Would you merge it? What would you ask for?
3. Did any worker's self-report disagree with the verifier (`selfReportMismatch`)? Did any agent hit a denied tool (`deniedTools`)? If so, quote the trace.
