---
name: software-factory
description: Start and supervise the software factory, which turns a repository's open GitHub issues into verified, review-approved pull requests (claim, triage, worker, verifier, reviewer, integrator) with every stage in its own sandbox and a human doing the merge. Human-triggered only, with /software-factory.
argument-hint: "[run | plan | doctor | integrate | report | stats | release] [--issues 1,2,3] [--config path] [--agent fake|claude] [--concurrency N] [--grounding]"
disable-model-invocation: true
---

# Software factory (workflow)

A human started the factory. Run it the way a careful shift supervisor would: check the line, show the plan, get a go-ahead, run it, then report what is ready for human review. **You never merge anything, never push to the base branch, and never loosen a quality gate to get a green result.**

Arguments from the human: `$ARGUMENTS` (empty means `run`).

## The runner

All orchestration is deterministic code, not prompts. The runner is `scripts/factory.mjs` inside this skill's base directory (the directory containing this file). Call it with Node 22+:

```bash
node "<this skill's base directory>/scripts/factory.mjs" <command> [flags]
```

| Command | What it does |
|---|---|
| `init` | Writes `factory.config.json` for the repository in the current directory |
| `doctor` | Checks Node, git, gh and its auth, claude, the config, and that the repository and base branch are reachable |
| `plan` | Lists the issues a run would take, which are already claimed, and the budget ceiling. Starts nothing |
| `run` | Runs the factory: claim, triage, worker, verifier, reviewer, then a pull request per issue; then the integrator |
| `integrate [--run ID]` | Re-runs only the integrator for a run's ready branches |
| `report [--run ID]` | Prints and saves the run report (`latest` by default) |
| `stats` | JSON totals across all runs: input for the `factory-improve` skill |
| `release --issues 1,2` | Removes claims so issues can be worked again |

Useful flags: `--issues 1,3,5`, `--concurrency N`, `--agent fake` (zero-cost scripted agents for learning and dry runs), `--grounding` (live docs, see `factory-live-docs`), `--no-integrate`, `--keep-sandboxes`, `--config <path>`.

## Procedure

### 1. Configuration

Work in the directory that holds `factory.config.json` (or use `--config`). If there is none:

1. Run `init`. It guesses `issues` from the git remote and `setup`/`test` from `package.json`.
2. Show the human the file and confirm with them: the issue source (`gh:owner/repo` or `file:issues.json`), the eligibility `label` (default `factory`), `test` (the command the verifier will trust), `setup`, `concurrency`, `model` and `budgets`.

Settings reference: `docs/configuration.md` in the repository this skill ships in.

### 2. Preflight

Run `doctor`. Fix every FAIL with the human before going on; do not work around a failing check. Typical fixes: `gh auth login`, a wrong repo or base branch, a missing test command.

### 3. Plan, then a go-ahead

Run `plan` with the human's flags. Show them:

- the issues that will be worked, and the ones skipped because they are already claimed,
- the agent and model, the number of lanes, and the budget **ceiling**,
- what will happen on GitHub: a `factory:claimed` label on each issue, one `factory/issue-N` branch and one pull request per accepted issue, and an integration branch (`factory/integration` by default).

Ask for an explicit go-ahead. Skip this question only if the human's arguments include `--yes`.

### 4. Run

Start `run --yes` with the same flags. It takes minutes, so run it in the background and relay progress: each lane logs one line per stage (`#3 triage`, `#3 worker`, `#3 verifier`, `#3 reviewer`, `#3 ready for human`). Do not interrupt a run to "help" a stage; the runner already handles failures per issue, and one issue's failure never stops another lane.

If the run itself crashes (not a single issue), read the error, fix the cause with the human, and run again. Claimed issues are skipped on the next run; use `release` for issues that should be retried.

### 5. Report and hand over

When it finishes, the runner prints the report and writes `report.md` into the run's ledger directory (`.factory/runs/<run-id>/`). Give the human:

1. **Ready for human review:** each pull request with its issue, verifier result and reviewer notes.
2. **Not built, and why:** triaged out (with triage's reason, so the issue can be rewritten), blocked, rejected by the verifier (tests fail on a clean copy) or by the reviewer (with the issues found), or errors.
3. **Integration:** how many branches merged into the integration branch, how many needed conflict resolution, and whether the combined tree passes the tests. The integration branch is a preview of everything merged together; the human can merge PRs individually or review the integration branch.
4. **Cost and time:** model cost per issue and in total, wall-clock time.
5. **Anything suspicious in the ledger:** a `selfReportMismatch` (a worker said tests passed and the verifier disagreed), denied tool calls, flaky tests.

Then stop. Merging is the human's decision.

To make the factory better from what this run taught, suggest the `factory-improve` skill.

## Guardrails

- The base branch is read-only for the factory. Integration goes to `integrate.into`, never to `baseBranch` (the config refuses it).
- Never merge a pull request, approve one on GitHub, or enable auto-merge.
- Never edit a factory branch by hand to make a gate pass. If something needs fixing, fix the issue text, a stage skill, or the config, release the claim, and run again.
- Secrets stay with the runner. Stage agents get an environment without `GH_TOKEN`, `GITHUB_TOKEN`, the Context7 key or other secrets listed in `secretEnv`.
- `sandbox: "shared"` exists only to reproduce the failure modes in the codelab. Do not use it for real work.

## What each stage is

Each stage agent is a headless Claude Code process in its own sandbox. Its system prompt includes the stage skill's instructions, and its output must match a JSON Schema in `schemas/`:

| Stage | Skill | Handoff | Runs in |
|---|---|---|---|
| Claim | `factory-claims` | label or claim directory | runner |
| Triage | `factory-triage` | `triage.schema.json` | sandbox 1 (read-only tools) |
| Worker | `factory-worker` | `work-report.schema.json` | sandbox 2 |
| Verifier | `factory-verifier` | test result (code, not an agent) | sandbox 3, a fresh copy |
| Reviewer | `factory-reviewer` | `review.schema.json` | sandbox 3 (read-only tools) |
| Integrator | `factory-integrator` | `integration.schema.json` | its own sandbox |

Sandboxes and their limits: `factory-sandbox`. Run ledgers: `factory-report`.
