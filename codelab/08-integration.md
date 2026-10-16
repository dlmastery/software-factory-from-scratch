# Lab 8: Integration

**Goal:** see why branches that each pass every gate still collide, watch the integrator merge them one at a time, and test a hypothesis about what causes conflicts.

![The measured run](../infographics/07-measured-run.png)

## 1. Why verified branches conflict

Every worker starts from the **same snapshot** of `main`. Nine workers that each add a route to `src/app.js`, or a block of tests to `test/basic.test.js`, edit the same lines of the same files. Each branch is fine alone. Together they conflict. In the video, 7 of 9 conflicted, mostly in a shared test file.

## 2. Read your integration

From your full Lab 6 run (not a later partial one, which may have no integration):

```bash
cd ~/factory-lab
ls .factory/runs                      # find your full Lab 6 run (the one with all 10 issues)
RUN=<your Lab 6 run id>               # e.g. RUN=2026-10-16T01-23-36Z-snwl
node -e "const d=require('./.factory/runs/$RUN/run.json'); console.log(JSON.stringify(d.integration, null, 1))"
git --git-dir=shortlinks.git log --oneline --graph main..factory/integration | head -40
```

(The `factory/integration` branch always holds the most recent integration. If you ran the optional part of Lab 7, it holds that one; the ledger of `$RUN` still describes your Lab 6 integration.)

The integrator, in its own sandbox:

1. checks out `factory/integration` from `main`,
2. merges each ready branch **in issue order** (`git merge --no-ff`),
3. on a conflict, runs the integrator agent with the `factory-integrator` contract: keep both sides, never drop a test, stage files, do not commit,
4. checks that no unmerged paths and no conflict markers remain, commits, and **re-runs the tests**,
5. pushes after every merge, and stops at the first failure.

Read one resolution: `traces/integrate-<N>.output.json` and `git --git-dir=shortlinks.git show <merge-commit>`.

## 3. Test a hypothesis: the shared test file

Hypothesis: most conflicts in the video came from workers appending to one shared test file. This repository's worker contract says *"Prefer adding a new test file for your issue"* (rule 3). In the reference run, 4 of 9 branches conflicted, all in `src/app.js` and none in tests.

Remove that sentence from `skills/factory-worker/SKILL.md` and replace it with: *"Add your tests to test/basic.test.js."* Then:

```bash
node "$SF" release --issues 1,2,3,4,5,6,7,8,9
node "$SF" run --yes --concurrency 5
```

| | Per-issue test files | One shared test file |
|---|---|---|
| Branches conflicting | 4 of 9 (reference run) | |
| Files in conflict | `src/app.js` | |
| Integrator cost | $0.42 (reference run) | |
| Hidden tests on the integrated tree | 9/9 | |

Restore the original sentence afterwards: `git -C ~/software-factory-from-scratch checkout -- skills/factory-worker/SKILL.md`.

## 4. Integrate again without re-running the lanes

The integrator can be re-run on its own. It merges the branches that run marked ready, as they exist on the remote **now**: later runs overwrite `factory/issue-N`, so after step 3 this integrates the shared-test-file versions.

```bash
node "$SF" integrate --run $RUN
```

## Checkpoint

- You can explain each conflict in your run: which two issues, which file, how it was resolved.
- You filled in the hypothesis table.

## Questions

1. The integrator merges in issue order. Propose a better order (for example, smallest diff first, or least overlap first). What would it change?
2. When two branches truly contradict each other, the integrator must report `resolved: false` rather than choose. Why not let it choose?
3. Integration cost the video more than building ($6.37 vs $3.67). What does that tell you about how to size a factory's batch, and which issues to run together?
4. What change to the **target repository** (not the factory) would reduce conflicts the most? (Look at where every route lives.)
