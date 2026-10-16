# Troubleshooting

Start with `node factory.mjs doctor`. Then find the issue's outcome in `.factory/runs/<run-id>/run.json` and its raw agent output in `traces/`.

| Symptom | Cause | Fix |
|---|---|---|
| `doctor`: `repo ... has main` FAIL | Wrong `repo` or `baseBranch`, or no git credentials for it | `git ls-remote <repo>`; fix the config or your credentials |
| `doctor`: `gh auth` FAIL | GitHub CLI not logged in | `gh auth login` (needs the `repo` scope) |
| Every issue says `already claimed, skipping` | Claims from earlier runs persist by design | `plan` to see them; `release --issues 1,2,3` |
| `error: ... --json-schema is not a valid JSON Schema` | A schema uses a feature or a `$schema` reference the CLI rejects | Keep schemas to plain draft-07-style keywords; the runner strips `$schema` |
| `error: <stage> agent ended without a valid handoff (error_max_budget_usd)` | The stage hit `budgets.<stage>` | Look at the trace to see why it was expensive; raise the budget only if the work is legitimately bigger |
| `error: <stage> agent timed out` | `timeouts.<stage>` too low, or the agent got stuck on a hanging command | Look at the trace; hanging test commands are a common cause (see the next row) |
| Tests hang in the verifier | A test leaves a server, timer or socket open | Make tests close resources; `unref()` servers; set `testTimeoutSeconds` |
| Worker `blocked` saying shell tools were denied | The agent chained commands (`a && b`, pipes, heredocs) or used a shell with no rules | Contract rule 9 covers this; check `deniedTools` in `run.json`, and add a narrow rule to `tools.worker` if a legitimate command is missing |
| `deniedTools` in `run.json` | An agent tried a tool outside its stage's allowlist | Usually fine (the deny is the control working). If the stage genuinely needs it, add the narrowest rule |
| `selfReportMismatch: true` | The worker said tests pass; the clean-copy run failed | Uncommitted helper files, environment differences, or the worker ran a subset. See the verifier output in `run.json` |
| Verifier fails only on a clean copy because of dependencies | A branch added a dependency without updating the lockfile | Workers must use the package manager (contract rule 7); the verifier re-runs `setup` when manifests change |
| `rejected` by `guard: reviewer modified the working tree` | The reviewer (or a test it ran) wrote files | If tests write artifacts, add them to the target repo's `.gitignore` |
| Integration stops at `#N` with `unresolved conflicts` | The integrator agent could not keep both sides, or reported a genuine contradiction | Read `traces/integrate-N.output.json`; resolve by hand on the integration branch, or fix one PR |
| Integration stops with `tests fail after merging` | Two individually-correct changes break each other | The integration branch keeps everything before `#N`; fix the interaction in one PR and re-run `integrate` |
| Windows: `LF will be replaced by CRLF` warnings, or conflict markers not detected | `core.autocrlf=true` | Sandboxes clone with `core.autocrlf=false`; set it in your own clones of the practice repo too |
| Windows: `spawn claude ENOENT` | Claude Code not on `PATH` for Node | Set `"claudeBin"` to the full path of `claude.exe`. The runner spawns without a shell, so an npm-installed `claude.cmd` shim cannot be used: install Claude Code with the native installer |
| Stage agents load your personal hooks or MCP servers | `isolateAgentConfig` disabled | Leave it `true` (default) |
| Runs are slow before any agent starts | `setup` is heavy, or the snapshot copy is large | Copies include `node_modules`; for big repos consider a git-worktree or container backend (`factory-sandbox`) |
