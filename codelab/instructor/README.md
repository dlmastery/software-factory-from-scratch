# Instructor guide

## Formats

| Format | Labs | Notes |
|---|---|---|
| 90-minute workshop | 0, 2, 3, 6 (3 issues), 7 | Students pair; instructor demos Lab 1 live |
| Half day (3.5 h) | 0 to 8 | Break after Lab 5. Lab 8 with fake agent if budget is tight |
| Full day / two sessions | 0 to 11 | Lab 11 capstone as homework, presented next session |
| Semester module (2 weeks) | All + capstone on a repository of the student's choice | Grade with the rubric below |

## Before class

1. `npm test` and `npm run check:hidden` in this repository on the machine image students will use (Windows, macOS and Linux are covered by CI).
2. Decide on model access: each student's own Claude login, or a shared `ANTHROPIC_API_KEY` with a spend cap. Labs 0 to 5 need none.
3. Budget per student for Labs 6 to 11: about $10 to $15 with the default `sonnet` model. Lower `budgets.*` in `factory.config.json` to cap it harder.
4. For Lab 10, students need a GitHub account with the `gh` CLI logged in. Repositories are private and can be deleted afterwards.

## Answer key (abridged)

**Lab 0.** Issue #10 is the one to refuse: no testable outcome. The `test` setting defines "the tests pass".

**Lab 1.** Clean-copy and local runs disagree because of: uncommitted or untracked files; local `node_modules` or env vars; running a subset of tests; editing after the last test run; machine-specific state (ports, time zones). An agent-run verifier would reintroduce self-reporting, could be persuaded by text in the issue or code, and would cost tokens for a deterministic check.

**Lab 2.** The loud failures (git lock errors, clobbered checkouts) are annoying but safe; the dangerous ones are lanes that report ready_for_human with contaminated branches, because every signal says success and the corruption reaches a human reviewer. A lock serializes the lanes and throws away the parallelism; it also does not fix cross-contamination of branches that share a `HEAD`. A local copy does not isolate the network, the OS user and other files, or CPU/memory.

**Lab 3.** Agents: triage, worker, reviewer, integrator. Code: claim, sandboxes, commit/push, verifier, guards, PR, integration loop. The runner commits so agents cannot rewrite history, push elsewhere, or produce inconsistent branches, and so they need no git credentials. The fake run: a real reviewer would catch "no change for the issue"; only tests (hidden or better visible ones) catch subtle wrong behavior.

**Lab 4.** `NX` = set only if absent (atomic claim); `EX` = expiry, so a crashed runner's claim does not block the issue forever. A crashed run leaves #5 claimed with no outcome; an operator reads the ledger and releases it. Automatic expiry risks two runs working the same issue if a run is merely slow.

**Lab 5.** Typed objects: small, inspectable, validated, cheap; transcripts leak context, cost tokens and invite the next stage to trust the previous one's reasoning. `testsPass` is kept to detect self-report mismatches. Classification: "never delete tests" both (skill rule + runner guard); "run tests twice" runner; "prefer a new test file" skill; "reviewer may not modify" both (skill rule + runner tree check).

**Lab 6.** See the measured table in the lab. Expected: #10 triaged out, nine PRs; costs about $0.15 to $0.40 per issue with `sonnet` (the reference run: $0.17 to $0.25, $1.90 for nine issues plus $0.42 integration).

**Lab 7.** Reviewer catches: logic missing for a named edge case, wrong ordering, validation gaps, behavior changes outside scope. Only tests catch: subtle numeric/boundary errors the reviewer did not think of. `--no-review` typically still passes most hidden tests on this small app, which is itself a lesson: the value of review grows with the subtlety of the code.

**Lab 8.** Conflicts concentrate in `src/app.js` (every route lives there) and any shared test file. Per-issue test files remove the test-file conflicts but not `src/app.js` ones. Integration cost scales with overlap, not with issue count.

**Lab 9.** Proxy limits: rate per caller, response size, an allowlist of upstream hosts, query length. Egress allowlists close the direct-call gap. Other secrets: package registry tokens (registry proxy or platform-attached header), cloud credentials (short-lived tokens issued to the runner, never to agents).

**Lab 10.** GitHub UI shows claims, branches, PRs and gate tables; only the ledger shows prompts, contracts, costs per stage, denied tools and timings. The runner holds credentials: `agentEnv()` strips tokens, and only `commitAndPush`/`openPullRequest` talk to the remote. For hourly runs: concurrency group first (claim race), then budgets and alerting.

**Lab 11.** Humans approve factory changes because an automated loop optimizing a pass rate will find ways to lower the bar. Examples of "better pass rate, worse factory": deleting the reviewer, accepting `blocked` as success, loosening triage, weakening tests. The skill forbids weakening gates and requires evidence and a metric.

## Grading rubric (capstone)

| Criterion | Excellent (4) | Adequate (2) | Missing (0) |
|---|---|---|---|
| Measured run | Complete table, compared with the video, differences explained | Table without analysis | None |
| Evidence | Quotes traces/ledger with run ids; pattern across several issues | One anecdote | Claims without evidence |
| Improvement | One targeted change; before/after measured on the same issues; no gate loosened | Change applied, weak measurement | No change, or a gate loosened |
| Judgment | Clear, numbers-backed view of when a factory pays off (volume, overlap, test quality) | Generic pros/cons | None |
| Communication | One page, scannable, reproducible commands | Long or hard to reproduce | Unclear |

## Common pitfalls

- **Windows line endings.** Use the seed script (it disables `core.autocrlf` for the practice repo); the runner clones with `core.autocrlf=false`.
- **Forgetting `release`.** Claims persist; `plan` shows them.
- **Running two labs in the same directory with different configs.** One `factory-lab` per student; reseed to reset (`rm -rf ~/factory-lab` then Lab 0 step 4).
- **Interpreting the fake run as success.** Lab 3's 0/9 hidden-test score is the point.
- **Raising budgets to make errors go away.** Read the trace first (Lab 11).

## Files

- `reference/`: a solution resolving all nine actionable issues. Not given to students before Lab 7.
- `check-hidden-tests.mjs`: proves every hidden test fails on the starting app and passes on the reference (`npm run check:hidden`).
