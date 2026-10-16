---
name: factory-claims
description: Claim mechanism of the software factory, which stops two lanes or two runs from working the same issue. Explains GitHub label claims (factory:claimed) and directory claims, how to inspect them, and how to release stuck ones. Use when an issue is unexpectedly skipped, when a human asks "why didn't the factory pick up #N", or to release claims for a retry.
---

# Factory claims

Failure mode it fixes: **two agents pick the same issue.** Without a claim, two lanes (or two factory runs started by two people, or a cron job overlapping a manual run) build the same issue twice. Best case that wastes tokens; worst case it opens two competing pull requests.

## How claiming works

Before any agent touches an issue, the runner claims it. Only the lane that wins the claim works it; every other lane logs `#N already claimed, skipping`.

| Issue source | Claim | Atomic? | Visible to |
|---|---|---|---|
| `gh:owner/repo` | adds the label `factory:claimed` (configurable: `claims.label`) after re-reading the issue's labels | No: two runners checking at the same instant can both win | everyone, in the GitHub issue list |
| `file:issues.json` | creates the directory `.factory/claims/issue-N/` (holds an `owner` file) | Yes: `mkdir` fails if the directory exists | anyone with the working directory |

Inside one run, lanes share an in-memory set as well, so a single run never double-claims even on GitHub.

**The GitHub race.** A label check followed by a label write is a read-then-write, not a lock. Two runners can both read "unclaimed" before either writes. The factory's answer is operational: schedule at most one run per repository at a time (a cron interval longer than a run, or a CI `concurrency` group). If you need a hard lock across machines, use an atomic store, for example a Redis `SET key owner NX EX 86400` (the original video's code includes one). Lab 4 of the codelab reproduces the race.

## Claims persist on purpose

A claim is not removed when a run ends, whatever the outcome. That stops the next scheduled run from immediately repeating a failure (re-triaging a vague issue, re-building a rejected change) and burning budget on it. A human decides what to retry:

```bash
node "<software-factory skill dir>/scripts/factory.mjs" plan                 # shows which issues are claimed
node "<software-factory skill dir>/scripts/factory.mjs" release --issues 3,8 # remove the claims
```

On GitHub you can also remove the label in the web UI, or with `gh issue edit 3 --remove-label factory:claimed`.

Typical reasons to release: the issue text was rewritten after triage rejected it, a stage skill or the test suite was improved after a rejection, or a run crashed mid-way.

## Answering "why was #N skipped?"

1. Run `plan`: is #N listed as claimed?
2. Find the run that claimed it: `grep -l '"issue": N' .factory/runs/*/run.json`, or read `events.jsonl` for `claimed` events with that issue.
3. Report that run's outcome for #N (triaged out, rejected, error, or ready for human) and recommend either fixing the cause and releasing, or leaving it claimed.
