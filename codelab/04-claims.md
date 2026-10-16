# Lab 4: Claims

**Goal:** see two factory runs compete for the same issues, and understand what a claim guarantees and what it does not.

Failure mode B: **two agents pick the same issue.** It happens across lanes in one run, and across runs: two teammates start the factory, or a scheduled run overlaps a manual one.

## 1. Look at the claims from Lab 3

```bash
cd ~/factory-lab
node "$SF" plan          # claimed issues show "claimed, will skip"
ls .factory/claims
cat .factory/claims/issue-3/owner
```

For a `file:` issue source, a claim is a directory: `mkdir` either creates it or fails because it exists. That is atomic on every operating system, so exactly one claimant wins.

## 2. Two runs at once

Release everything, then start two runs at the same moment in two terminals (or with `&`):

```bash
node "$SF" release --issues 1,2,3,4,5,6,7,8,9,10
node "$SF" run --yes --no-integrate > run-a.log 2>&1 &
node "$SF" run --yes --no-integrate > run-b.log 2>&1 &
wait
grep -h "already claimed" run-a.log run-b.log | wc -l
grep -h "ready for human\|triaged out" run-a.log run-b.log | wc -l
```

Every issue is worked exactly once in total: 10 outcomes across both logs, and the rest are `already claimed, skipping`. Look at `.factory/runs/`: two new run directories (the newest two), each with the outcomes of the issues it won.

## 3. The GitHub version, and its race

With a `gh:` source, the claim is the label `factory:claimed`. Read `GitHubLabelClaims.claim()` in `skills/software-factory/scripts/lib/issues.mjs`:

1. read the issue's labels,
2. if `factory:claimed` is absent, add it.

That is a **read, then a write**. Two runners can both read "absent" before either writes, and both believe they own the issue. Draw the interleaving on paper: runner A reads, runner B reads, A writes, B writes.

The factory handles this operationally, the same way the video does: **at most one run per repository at a time.** The example GitHub Actions workflow (`.github/workflows/factory.yml`) enforces it with a `concurrency` group. Labels still matter: they make claims visible to humans in the issue list, and they survive across machines and runs.

## 4. Why claims persist

Run `plan` again: everything is claimed, even #10, which triage rejected. Claims are not removed when a run ends, whatever the outcome. Otherwise the next scheduled run would re-triage the same vague issue, or rebuild the same rejected change, and spend money repeating a failure. A human decides what to retry, with `release`.

## Checkpoint

- Across two simultaneous runs, each issue has exactly one outcome.
- You can explain why the label claim needs "one run per repo at a time" and the directory claim does not.

## Questions

1. Design an atomic claim for GitHub issues across machines. (Hint: the video's code has an Upstash Redis claim, `SET factory:claim:<n> <owner> NX EX 86400`. What does each of `NX` and `EX` buy you?)
2. A run crashes after claiming #5 but before triaging it. What happens on the next run? What should an operator do?
3. When would you want claims to expire automatically, and what is the risk?

Reset: `node "$SF" release --issues 1,2,3,4,5,6,7,8,9,10 && rm -f run-a.log run-b.log`.
