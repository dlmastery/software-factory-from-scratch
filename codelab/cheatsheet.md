# Cheat sheet

```bash
export SF="$HOME/software-factory-from-scratch/skills/software-factory/scripts/factory.mjs"
cd ~/factory-lab
```

## Run the factory

| Do this | Command |
|---|---|
| Check everything is ready | `node "$SF" doctor` |
| See what a run would do and its budget ceiling | `node "$SF" plan [--issues 3,8]` |
| Run (asks first) | `node "$SF" run [--issues 3,8] [--concurrency 5]` |
| Run without asking | `node "$SF" run --yes ...` |
| Free dry run | `... --agent fake` |
| Real agents | `... --agent claude` (or `"agent": "claude"` in `factory.config.json`) |
| Skip review / integration | `... --no-review` / `... --no-integrate` |
| Live docs | `... --grounding` |
| Keep sandboxes to inspect | `... --keep-sandboxes` |
| Reproduce the failure modes | `... --sandbox shared` |
| Re-run only integration | `node "$SF" integrate --run <id>` |
| Make issues workable again | `node "$SF" release --issues 1,2,3` |
| Report for a run | `node "$SF" report [--run <id>] [--json]` |
| Totals for the outer loop | `node "$SF" stats --agent claude` |

## Score and verify

| Do this | Command |
|---|---|
| Hidden tests on every branch + integration | `node ~/software-factory-from-scratch/codelab/scripts/score.mjs shortlinks.git --integration factory/integration` |
| Verify one branch on a clean copy | `node ~/software-factory-from-scratch/skills/factory-verifier/scripts/verify-branch.mjs shortlinks.git factory/issue-3 --test "npm test"` |
| Look at a branch's diff | `git --git-dir=shortlinks.git diff main factory/issue-3` |
| Read a file on a branch | `git --git-dir=shortlinks.git show factory/issue-3:src/app.js` |

## Where things are

| What | Where |
|---|---|
| Newest run | `.factory/runs/$(ls .factory/runs \| tail -1)/` |
| Outcomes, costs, timings | `<run>/run.json` |
| Event order | `<run>/events.jsonl` |
| What an agent was asked / told / returned | `<run>/traces/issue-N.<stage>.prompt.md` / `.contract.md` / `.output.json` |
| Fake-agent handoffs | `<run>/traces/issue-N.<stage>.result.json` |
| Integrator calls | `<run>/traces/integrate-N.*` |
| PR bodies | `<run>/prs/issue-N.md` |
| Claims (local) | `.factory/claims/issue-N/` |
| Stage contracts | `~/software-factory-from-scratch/skills/factory-*/SKILL.md` |
| Handoff schemas | `~/software-factory-from-scratch/skills/software-factory/schemas/` |
| Pipeline code | `~/software-factory-from-scratch/skills/software-factory/scripts/lib/pipeline.mjs` |

## Outcome stages

`ready_for_human` (PR opened) · `triaged_out` (not concrete/testable) · `blocked` (worker: cannot build as written) · `no_changes` · `rejected` (`rejectedBy`: `verifier`, `reviewer` or `guard`) · `error` (crash, timeout, contract violation)

## Start over

```bash
rm -rf ~/factory-lab && node ~/software-factory-from-scratch/codelab/scripts/seed.mjs local ~/factory-lab
```
