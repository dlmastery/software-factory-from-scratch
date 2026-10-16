# Glossary

| Term | Meaning in this codelab |
|---|---|
| **Software factory** | A system that turns a backlog of issues into verified, reviewed pull requests with agents, under process constraints, with a human merging |
| **Inner loop** | One issue through the line: claim -> triage -> worker -> verifier -> reviewer -> pull request -> human merge |
| **Outer loop** | Improving the factory itself from the traces of its runs (the `factory-improve` skill, Lab 11) |
| **Lane** | One concurrent worker slot. `--concurrency 5` = five issues in flight at once |
| **Runner** | `factory.mjs` and `lib/*.mjs`: the deterministic program that orchestrates everything. It holds credentials and runs every gate |
| **Stage** | One step of the line. Triage, worker, reviewer and integrator are agents; claim, verifier, guards and PR creation are code |
| **Stage agent** | A fresh headless `claude -p` process for one stage of one issue, with its own sandbox, tool allowlist, budget and output schema |
| **Skill** | A folder with a `SKILL.md` that Claude Code can load. Here, each stage skill is also the **contract** given to that stage's agent |
| **Contract** | The stage skill's body, appended to the agent's system prompt: role, rules, output format. Saved per call as `traces/*.contract.md` |
| **Task prompt** | What a stage works on this time (the issue, criteria, test command, allowed commands). Saved as `traces/*.prompt.md` |
| **Handoff** | The single typed JSON object a stage returns, e.g. `{verdict, issuesFound, riskNotes}` |
| **Schema** | The JSON Schema a handoff must match (`skills/software-factory/schemas/`). Enforced at generation (`--json-schema`) and again at the boundary |
| **Claim** | Marking an issue as taken before work starts: the `factory:claimed` label on GitHub, or a `.factory/claims/issue-N/` directory locally |
| **Snapshot** | The clone of the base branch with dependencies installed, prepared once per run. Every sandbox starts as a copy of it |
| **Sandbox** | The isolated working copy one stage runs in, thrown away afterwards. Locally: a directory under `.factory/runs/<id>/boxes/` |
| **Verifier** | Runner code that runs the test command on a fresh copy of the pushed branch, retrying once. Never an agent |
| **Self-report mismatch** | The worker said tests pass; the verifier disagrees. Recorded as `selfReportMismatch` |
| **Guard** | A deterministic rule that rejects a branch: deleting a protected (test) file, or a reviewer changing the working tree |
| **Integrator** | Merges all ready branches one at a time into `factory/integration`, with an agent resolving conflicts and tests after each merge |
| **Hidden tests** | `codelab/hidden-tests/`: tests the agents never see, used only to score what the factory actually delivered |
| **Ledger** | `.factory/runs/<run-id>/`: everything a run did (`run.json`, `events.jsonl`, `traces/`, `prs/`, `report.md`) |
| **Budget ceiling** | The most a run can spend: per-stage `--max-budget-usd` caps times the number of stages. Shown by `plan` before the go-ahead |
| **Grounding / live docs** | Agents looking up current documentation (Context7) instead of relying on training data |
| **Fake agent** | `--agent fake`: scripted stand-ins with the same interface as real agents. Free; used to learn the plumbing |
| **Shared sandbox** | `--sandbox shared`: every stage in one checkout. Exists only to reproduce the failure modes (Lab 2) |
