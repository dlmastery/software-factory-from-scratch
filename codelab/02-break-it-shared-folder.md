# Lab 2: Break it: one shared folder

**Goal:** reproduce what happens when many agents share one workspace, so the five fixes in the rest of the codelab are answers to problems you have seen, not rules you were told.

![Parallel failures](../infographics/02-parallel-failures.png)

The runner has a deliberately bad mode, `--sandbox shared`: every stage of every lane uses **one** checkout. The fake agent appends one line per issue to `FACTORY_LOG.md`, standing in for a real change.

## 1. Run three lanes in one folder

```bash
cd ~/factory-lab
node "$SF" run --yes --sandbox shared --issues 1,2,3,4,5,6 --concurrency 3 --no-integrate --keep-sandboxes
```

## 2. Inspect the branches

Each branch should contain exactly one issue's change. Does it?

```bash
for n in 1 2 3 4 5 6; do
  echo "== factory/issue-$n"
  git --git-dir=shortlinks.git show factory/issue-$n:FACTORY_LOG.md | grep '^- #'
done
```

You will see branches carrying other issues' lines: **files overwritten / work mixed** (failure A). Some branches may not exist at all. The results change from run to run, because they depend on which lane touched the folder when. Now read the report table, or the outcomes:

```bash
RUN=$(ls .factory/runs | tail -1)
node -e "for (const o of require('./.factory/runs/$RUN/run.json').outcomes) console.log('#'+o.issue, o.stage, (o.error||'').split('\n')[0])"
```

Two runs recorded while writing this lab produced, between them:

```
#1 error git checkout failed: fatal: Unable to create '.../boxes/shared/.git/index.lock': File exists.
#2 error git commit failed: no changes added to commit
#3 error git checkout failed: error: Your local changes to the following files would be overwritten by checkout: FACTORY_LOG.md
#4 rejected
#5 ready_for_human
#6 ready_for_human      (its branch also carries the commits of #3 and #4)
```

Each line is a different collision:

- **`index.lock: File exists`**: two lanes ran git in the same repository at the same moment; git's own lock refused the second.
- **`no changes added to commit`**: another lane had already committed this lane's edit (on its own branch). The work was not lost; it went to the wrong issue.
- **`Your local changes ... would be overwritten`**: a verifier tried to check out a branch while a worker had uncommitted edits in the same folder.
- **`ready_for_human` with extra commits**: the worst case. Every gate passed, and the branch still carries other issues' work. Look at the commit history of a late branch:

```bash
git --git-dir=shortlinks.git log --oneline main..factory/issue-6
```

One "fix" commit per issue was expected. Instead, later branches are stacked on earlier ones because all lanes moved the same `HEAD`.

## 3. Compare with isolated sandboxes

```bash
node "$SF" release --issues 1,2,3,4,5,6
node "$SF" run --yes --issues 1,2,3,4,5,6 --concurrency 3 --no-integrate
for n in 1 2 3 4 5 6; do git --git-dir=shortlinks.git show factory/issue-$n:FACTORY_LOG.md | grep -c '^- #'; done
```

Every branch now has exactly one line: **one sandbox per stage** fixes failure A.

## 4. The other three failure modes, in this repo

| Failure | Where you will meet it |
|---|---|
| B. Same issue picked twice | Lab 4: two runs at once without claims vs with claims |
| C. False "tests passed" | Lab 1 step 3 (the uncommitted helper), and `selfReportMismatch` in real ledgers (Lab 6) |
| D. Flood of conflicting PRs | Right now: the six isolated branches each add a line at the same spot. Try merging two of them by hand (`git merge`) in a scratch clone. Lab 8 automates this |

## Checkpoint

- In shared mode, at least one branch contains more than one issue's line, or a lane failed on a git collision.
- In local mode, every branch contains exactly one.

## Questions

1. Some lanes failed loudly (git errors), but others reported `ready_for_human` with contaminated branches. Which kind of failure is more dangerous, and why?
2. Would a lock around the shared folder fix it? What would it cost you?
3. A local sandbox copy isolates files. Name two things it does **not** isolate. (Read `skills/factory-sandbox/SKILL.md`.)

## Stretch

Read `LocalSandboxes.create()` in `skills/software-factory/scripts/lib/sandbox.mjs`. The whole isolation layer for this machine (`prepare()` and `create()`) is about 25 lines. What would you change to make it a git worktree per stage instead of a copy, and what would you lose?

Reset: `node "$SF" release --issues 1,2,3,4,5,6`. Shared mode left extra branches on the remote; that is fine, later runs overwrite them.
