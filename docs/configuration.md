# Configuration

The factory reads `factory.config.json` from the current directory (or `--config <path>`) and merges it over the defaults in `skills/software-factory/scripts/lib/config.mjs`. Relative paths are resolved against the config file's directory. `node factory.mjs init` writes a starter file; `node factory.mjs doctor` validates it.

## Minimal configs

GitHub repository:

```json
{
  "issues": "gh:your-org/your-repo",
  "setup": "npm ci --no-audit --no-fund",
  "test": "npm test"
}
```

Local practice repository (a minimal equivalent of what `codelab/scripts/seed.mjs local` writes):

```json
{
  "issues": "file:issues.json",
  "repo": "shortlinks.git",
  "test": "npm test",
  "agent": "fake"
}
```

## All settings

| Key | Default | Meaning |
|---|---|---|
| `issues` | (required) | Work source. `gh:owner/repo` reads open GitHub issues; `file:path.json` reads `[{id, title, body, labels}]` |
| `label` | `"factory"` | GitHub only: only issues with this label are eligible. `""` means every open issue |
| `repo` | `https://github.com/<owner>/<repo>.git` for gh sources | The repository agents change and branches are pushed to: a URL or a local path |
| `baseBranch` | `"main"` | Snapshot source and PR target. Never written by the factory |
| `branchPrefix` | `"factory"` | Branches are `<prefix>/issue-<n>` |
| `concurrency` | `3` | Lanes, 1 to 16 |
| `sandbox` | `"local"` | `"local"`: one copy of the snapshot per stage. `"shared"`: one checkout for everything, only to reproduce failure modes |
| `keepSandboxes` | `false` | Keep stage directories after the run, for inspection |
| `setup` | `""` | Runs once in the snapshot, and again in the verifier if a branch changes a dependency manifest |
| `test` | `"npm test"` | The command the verifier and integrator trust. Exit code 0 means pass |
| `testTimeoutSeconds` | `600` | Timeout for `setup` and `test` |
| `agent` | `"claude"` | `"claude"`: real stage agents. `"fake"`: scripted, zero-cost stand-ins |
| `claudeBin` | `"claude"` | Path to the Claude Code CLI |
| `model` | `"sonnet"` | Model alias or full name for all stage agents |
| `budgets.<stage>` | triage 0.5, worker 3, reviewer 1.5, integrator 2 | USD ceiling per agent invocation (`--max-budget-usd`) |
| `timeouts.<stage>` | triage 180, worker 1200, reviewer 600, integrator 900 | Seconds before the stage process is killed |
| `isolateAgentConfig` | `true` | Stage agents load only the target repo's project settings, no personal hooks, plugins or MCP servers |
| `tools.<stage>` | see below | Claude Code permission rules for each stage. Everything else is denied |
| `secretEnv` | `GH_TOKEN, GITHUB_TOKEN, CONTEXT7_API_KEY, UPSTASH_BOX_API_KEY, NPM_TOKEN` | Removed from every agent's environment |
| `grounding.enabled` | `false` | Live docs for workers and reviewers (`--grounding`) |
| `grounding.apiKeyEnv` | `"CONTEXT7_API_KEY"` | Env var holding the docs key (runner only) |
| `grounding.endpoint` | `"https://context7.com/api/v3/search"` | Upstream the docs proxy forwards to |
| `claims.label` | `"factory:claimed"` | GitHub claim label |
| `review.enabled` | `true` | Run the reviewer stage (`--no-review` to compare in the codelab) |
| `protectedPaths` | `test/`, `tests/`, `__tests__/`, `spec/`, `.test.`, `.spec.` | A worker branch that deletes a matching file is rejected |
| `integrate.auto` | `true` | Run the integrator after the lanes when 2 or more PRs are ready |
| `integrate.into` | `"factory/integration"` | Integration branch. Must differ from `baseBranch` |
| `pr.draft` | `false` | Open PRs as drafts |
| `pr.labels` | `["factory"]` | Labels added to PRs |
| `runsDir` | `".factory/runs"` | Ledgers, traces and temporary sandboxes. File-source claims live next to it, in `<runsDir>/../claims`. Add `.factory/` to the target repo's `.gitignore` |

### Default tool rules

Each command prefix is allowed bare and with arguments, for both Bash and PowerShell (Windows): `Bash(npm)`, `Bash(npm *)`, `PowerShell(npm)`, `PowerShell(npm *)`.

| Stage | Tools | Shell prefixes |
|---|---|---|
| triage | Read, Glob, Grep | none |
| worker | Read, Edit, Write, Glob, Grep | `npm`, `npx`, `node`, `git diff`, `git status`, `ls` |
| reviewer | Read, Glob, Grep | `git diff`, `git log`, `git show`, `npm test`, `node` |
| integrator | Read, Edit, Write, Glob, Grep | `npm`, `node`, `git diff`, `git status`, `git add`, `ls` |

A compound shell command (`a && b`, `a | b`) is allowed only if every part matches, so the stage contracts tell agents to run one plain command per call and to edit files with Edit and Write. Task prompts list each stage's allowed prefixes.

Other stacks: replace the prefixes, for example a Python worker with `"Bash(pytest *)", "Bash(python -m pytest *)", "Bash(uv run *)"`, and set `setup`/`test` accordingly.

## Command-line overrides

`--concurrency N`, `--agent fake|claude`, `--sandbox local|shared`, `--model <m>`, `--grounding`, `--no-review`, `--no-integrate`, `--keep-sandboxes`, `--issues 1,2,3`, `--yes`, `--run <id>` (for `integrate`/`report`), `--json` (for `report`).
