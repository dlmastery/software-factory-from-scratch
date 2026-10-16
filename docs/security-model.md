# Security model

A software factory runs code-writing agents unattended on text written by other people (issue bodies, comments, dependency docs). Treat every stage agent as **capable and possibly misled**. The design goal is that a misled agent can, at worst, produce a bad branch that a gate or a human rejects.

## Trust boundaries

| Actor | Trusted with | Not trusted with |
|---|---|---|
| Human | Starting runs, merging PRs, approving changes to the factory | (nothing hidden) |
| Runner (`factory.mjs`) | Git credentials, `gh` auth, docs key, claims, commits, pushes, PR creation, the verifier | Judgment calls |
| Stage agents | Reading the repo, editing their own sandbox (worker, integrator), returning a typed handoff | Secrets, pushing, merging, the network beyond what the backend allows, other stages' sandboxes |

## Controls in this repository

| Control | Mechanism | File |
|---|---|---|
| Only humans start the factory | `disable-model-invocation: true` on the workflow skill; `run` asks for confirmation unless `--yes` | `skills/software-factory/SKILL.md`, `factory.mjs` |
| Only humans merge | No code path merges into `baseBranch`; the config rejects `integrate.into == baseBranch`; the skill forbids merging, approving or auto-merge | `lib/pipeline.mjs`, `lib/config.mjs` |
| Least privilege per stage | `--allowedTools` allowlist + `--permission-mode dontAsk`; triage and reviewer have no write tools | `DEFAULTS.tools` |
| No secrets in agents | `agentEnv()` strips `secretEnv` and the docs key | `lib/agent.mjs` |
| Keys attached outside the agent | Local docs proxy adds the Context7 key; agents only get its URL | `lib/docs-proxy.mjs` |
| Agents cannot push or rewrite history | The runner commits and pushes; agents have no `git commit`/`git push` rules | `lib/sandbox.mjs` |
| Reviewer cannot change what it reviews | Working tree compared before and after; review discarded on change | `handleIssue()` |
| Tests cannot be deleted to pass | Branches deleting `protectedPaths` files are rejected | `handleIssue()` |
| Spend is bounded | `--max-budget-usd` per stage invocation; `plan` shows the run's ceiling before the go-ahead | `lib/agent.mjs`, `factory.mjs` |
| Runaway processes are bounded | Per-stage timeouts kill the whole process tree | `lib/proc.mjs` |
| No personal config in agents | `--setting-sources project --strict-mcp-config` | `isolateAgentConfig` |
| Everything is auditable | Prompts, contracts, raw outputs, events, costs per run | `.factory/runs/<id>/` |

## What the local backend does not protect against

`sandbox: "local"` copies directories on your machine. It isolates **files and git state between stages**. It does not isolate:

- **the network:** an agent with `Bash(node *)` can make HTTP requests,
- **the filesystem outside the sandbox:** tool permissions limit what agents try, but a determined process running as your user can read what you can read,
- **CPU, memory and disk.**

Note that `Bash(node *)` and `Bash(npm *)` effectively allow running arbitrary code (any script in the repo, any `npm` lifecycle script). The allowlist narrows what an agent does by default; it is not a sandbox.

Use the local backend for trusted repositories and the codelab. For untrusted issue authors, untrusted code, or anything near production credentials, run stages in a real sandbox with an egress allowlist and secrets attached from outside: see `skills/factory-sandbox/SKILL.md` and its Upstash Box and container guides.

## Prompt injection

Issue bodies are untrusted input to triage, worker and reviewer. Mitigations here:

- the worst an injected worker can do is push a bad branch, which still has to pass the verifier, the reviewer and a human;
- agents hold no secrets and cannot push, merge, or reach other sandboxes' files through their tools;
- the reviewer is a separate agent with a skeptical contract, and its verdict must agree with the verifier's tests;
- on GitHub, eligibility requires the `factory` label, so only people who can label issues decide what enters the factory.

Recommended for public repositories: let only maintainers apply the `factory` label, use a real sandbox backend with egress restrictions, and keep `concurrency` and budgets modest.

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md).
