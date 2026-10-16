# Changelog

## 1.0.0 (2026-10-16)

First release.

- **Skills:** `software-factory` (human-triggered workflow), `factory-triage`, `factory-worker`, `factory-verifier`, `factory-reviewer`, `factory-integrator`, `factory-claims`, `factory-sandbox`, `factory-live-docs`, `factory-report`, `factory-improve`.
- **Runner:** zero-dependency Node 22 CLI (`init`, `doctor`, `plan`, `run`, `integrate`, `report`, `stats`, `release`). Typed handoffs with JSON Schema enforced by `claude --json-schema` and re-validated at the boundary. Stage tool allowlists, spend caps and timeouts. GitHub label and atomic directory claims. Local snapshot sandboxes and a deliberately broken `shared` mode for teaching. Verifier as code with a flaky-test retry. Reviewer tree guard and deleted-test guard. Sequential integrator. Context7 docs proxy that keeps the key out of agents. Full run ledgers.
- **Codelab:** 12 labs, the `shortlinks` practice app, 10 issues, 9 hidden tests, a reference solution, seed and score scripts, two sample ledgers from real runs, an instructor guide with an answer key and rubric.
- **Infographics:** the video's story in eight frames.
- **Outer-loop fix found while building it:** worker shell commands chained with `&&`, pipes and heredocs were denied by Claude Code's permission rules, so workers reported `blocked` with correct fixes. Fixed with tool rules for Bash and PowerShell (bare and with arguments), a worker contract rule (Edit/Write for files, one plain command per call, tool denial is not `blocked`), and allowed prefixes listed in every task prompt. Measured: 4 of 9 workers blocked before, 0 of 9 after; 9/9 hidden tests.
