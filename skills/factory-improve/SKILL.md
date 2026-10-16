---
name: factory-improve
description: Outer loop of the software factory. Mines run ledgers and traces for recurring failures (triage misses, reviewer findings, verifier rejections, self-report mismatches, conflict hotspots, denied tools, cost outliers) and proposes concrete, reviewable edits to stage skills, the config, or the target repo's tests, so the factory improves from its own traces. Use after one or more factory runs, or when a human asks to "improve the factory" or "learn from the last runs".
---

# Factory improve (the outer loop)

The factory is the inner loop: issue, isolated agent, independent check, human merge. Every run leaves traces. This skill is the outer loop: it reads those traces and proposes changes to the factory itself. Over time that makes the factory self-improving, while a human still approves every change to how it works.

## Rules

- **Evidence first.** Every proposal cites the runs and issues it comes from (run id and issue number) and quotes the trace lines that show the problem.
- **One change, one reason.** Small, targeted edits a human can review in a minute. No rewrites of whole skills.
- **Never weaken a gate** to raise the pass rate: no dropping the reviewer, no loosening the verifier, no deleting hidden or existing tests, no raising budgets just to make failures go away. Improvements make the work better, not the bar lower.
- **Propose, don't apply.** Present the changes as a diff for the human. Apply them only when the human approves, on a branch, with the evidence in the commit message.
- **Measure.** Every proposal names the metric that should move (for example "fewer reviewer rejections for ordering bugs") and how the next run will show it.

## Procedure

1. **Collect.** `node "<software-factory skill dir>/scripts/factory.mjs" stats --agent claude` gives totals across the runs made with real agents (leave out `--agent claude` only if the human asks to include fake dry runs): outcomes by stage, rejections by gate, self-report mismatches, reviewer findings, triage rejections, errors, denied tools, conflict hotspots, cost. For anything interesting, open the run's `run.json` and the matching files in `traces/`.
2. **Find patterns,** not single events. Look for:

   | Signal | Likely fix |
   |---|---|
   | Reviewer keeps finding the same class of bug (ordering, boundaries, time) | Add that check to `factory-worker` rules, so workers test for it up front |
   | `selfReportMismatch` recurs | Tighten `factory-worker` rule 5 (run the exact test command after the last edit), or fix a test command that behaves differently in a fresh copy |
   | Verifier rejects with environment errors (missing deps, ports, timeouts) | Fix `setup`, `test`, `testTimeoutSeconds` in the config, or make the tests hermetic |
   | Triage accepts issues that end up `blocked` or rejected | Sharpen the actionable criteria in `factory-triage` |
   | Triage rejects issues humans consider clear | Loosen the criteria, or add an example to `factory-triage` |
   | One file in every conflict (`conflictHotspots`) | Workers write per-issue test files; or split the hotspot file in the target repo |
   | `deniedTools` shows a stage needs a tool | Grant the narrowest rule in `tools.<stage>` (for example `Bash(npm run lint)`), never a wildcard |
   | `error` from timeouts or contract violations | Adjust `timeouts.<stage>`, or clarify the output contract section of the stage skill |
   | Cost outliers | Find what the expensive issues have in common: scope (triage should split them), missing docs (grounding), flaky tests |
   | Hidden-test failures on approved branches (codelab) | The reviewer missed it: add the missed check to `factory-reviewer` step 4 |

3. **Propose.** For each pattern: the evidence, the change (a unified diff against the skill or config file), the expected effect, and the metric to watch.
4. **Route, don't only tune.** Some fixes are routing rules rather than prompts: a different `model` for the worker on large issues, grounding only for repositories with fast-moving dependencies, a lower `concurrency` when conflict hotspots dominate. Propose those as config changes.
5. **Close the loop.** After the human applies changes and the factory runs again, compare `stats` before and after and report whether the metric moved. Keep a short changelog in the factory repository (for example `IMPROVEMENTS.md`: date, change, evidence, result).

## Where the knobs are

- Stage behavior: `skills/factory-triage|factory-worker|factory-reviewer|factory-integrator/SKILL.md` (each stage agent receives this text as its contract)
- Handoff shapes: `skills/software-factory/schemas/*.schema.json` (change the runner if you add required fields)
- Run settings: the target repo's `factory.config.json` (`model`, `budgets`, `timeouts`, `tools`, `concurrency`, `grounding`, `protectedPaths`)
- The target repository itself: better tests make every gate stronger.
