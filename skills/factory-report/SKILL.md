---
name: factory-report
description: Read the software factory's run ledgers (run.json, events.jsonl, traces, PR bodies) and explain what a run did, what is ready for human review, why anything was rejected, and what it cost. Use when a human asks "what did the factory do", "why was #N rejected", "how much did that run cost", or wants a run summary for a team or a class.
---

# Factory report

Every factory run leaves a complete, file-based record. The factory is auditable because nothing important happens only in a chat transcript.

## Where things are

```
.factory/
  claims/issue-N/                 claims (file sources only; GitHub uses the factory:claimed label)
  runs/<run-id>/
    run.json                      outcomes per issue, timings, costs, totals, integration result
    events.jsonl                  ordered events: claimed, stage_start, stage_end, outcome, ...
    report.md                     the human summary the runner printed
    docs-queries.log              live-doc lookups (when grounding was on)
    prs/issue-N.md                each pull request's title and body
    traces/issue-N.<stage>.*      prompt.md (task), contract.md (stage skill text), output.json (raw `claude -p` result)
    traces/integrate-N.*          the integrator's call for the merge of issue N (same three files)
```

Runs made with `--agent fake` write `prompt.md` and `result.json` (the scripted handoff) and no contract. `run.json` records the agent in `config.agent`, so filter fake runs out before drawing conclusions (`stats --agent claude`).

`run-id` sorts by time; `latest` means the newest run.

## Outcome stages (`outcomes[].stage`)

| Stage | Meaning | Where to look for why |
|---|---|---|
| `ready_for_human` | Verifier passed, reviewer approved, PR opened | `pr`, `review.riskNotes` |
| `triaged_out` | Issue not concrete or testable enough | `triage.reason` |
| `blocked` | Worker could not resolve it as written | `work.blockedReason` |
| `no_changes` | Worker changed nothing | `work.summary` |
| `rejected` | A gate failed: `rejectedBy` is `verifier`, `reviewer` or `guard` | `verifier.output`, `review.issuesFound`, `guard` |
| `error` | A stage crashed, timed out or broke its output contract | `error`, then `traces/` |

Signals worth calling out: `selfReportMismatch` (the worker said tests pass and the verifier disagreed), `verifier.flaky`, `deniedTools` (an agent tried a tool its stage is not allowed), and `integration.conflicts` (which files collided).

## Commands

```bash
node "<software-factory skill dir>/scripts/factory.mjs" report                 # latest run, as a table
node "<software-factory skill dir>/scripts/factory.mjs" report --run <id> --json
node "<software-factory skill dir>/scripts/factory.mjs" stats                  # totals across all runs
```

## Writing a report for humans

Lead with what needs a human: the pull requests ready to merge, in issue order, each with one line from the work summary and any reviewer risk notes. Then what was not built and why, in plain words, with the action that would unblock it ("rewrite #10 with the stats you want; then `release --issues 10`"). Then integration status, then cost and time.

Cost framing that holds up (from the video's measured run): 10 issues in 4 min 34 s, 9 PRs, $3.67 of model cost for the run, $6.37 for integrating 9 branches of which 7 conflicted, and about $0.01 of sandbox compute. Integration can cost more than building when many lanes touch the same files, so report it separately.

For a classroom or team summary, include the ledger path so anyone can audit the details.
