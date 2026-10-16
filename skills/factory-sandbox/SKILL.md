---
name: factory-sandbox
description: Isolation layer of the software factory. One prepared snapshot, and every stage boots its own copy of it, so parallel agents can never overwrite each other's files. Covers the built-in local backend, its limits, and how to move stages into containers or cloud sandboxes (Upstash Box) with egress allowlists and secrets kept outside the sandbox. Use when choosing or hardening an isolation backend, or when a human asks how the factory isolates agents.
---

# Factory sandboxes

Failure mode it fixes: **agents overwrite one another's files.** Five agents editing one checkout see each other's half-finished edits, run tests against a mix of five changes, and commit each other's work. Lab 2 of the codelab reproduces it with `--sandbox shared`.

## The pattern

```
clone repo + setup (npm ci)  ->  SNAPSHOT
                                   |-> triage box    (copy) -> thrown away
                                   |-> worker box    (copy) -> branch pushed, thrown away
                                   |-> verifier box  (copy) -> tests + review, thrown away
                                   '-> integrator box(copy) -> integration branch pushed, thrown away
```

Every stage starts from the **same known state**, so there is no warm-up, no leftovers from a previous stage, and nothing one stage did can influence another except through what it pushed to the remote. The only channels between stages are the git remote and the typed JSON handoffs. That makes every stage reproducible and every handoff inspectable.

## The built-in backend: `sandbox: "local"`

`scripts/lib/sandbox.mjs` in the `software-factory` skill. `prepare()` clones `baseBranch` into `<run>/snapshot` and runs `setup` once. `create(label)` copies the snapshot to `<run>/boxes/<label>`. Sandboxes are deleted after each stage, unless you pass `--keep-sandboxes` to inspect them.

What it isolates: **files and git state.** What it does NOT isolate: the network, the OS user, the rest of your disk, CPU and memory. The agent's tool permissions are the remaining guard: each stage gets an explicit allowlist (`tools` in the config), the triage and review stages get no write tools, and everything else is denied (`--permission-mode dontAsk`). Secrets are stripped from the agent environment (`secretEnv`). That is good enough for a codelab and for trusted repositories on a developer machine. **It is not a security boundary for untrusted code or untrusted issue text.** For that, use a real sandbox.

## Real isolation: containers or cloud sandboxes

The pipeline talks to sandboxes through a small interface. A backend provides `prepare()`, `create(label, { fresh })` and `cleanup()`, and each sandbox it creates provides `dir`, `label`, `git(args)`, `gitMust(args)`, `test()`, `setup()`, `status()`, `commitAndPush(branch, msg)`, `checkout(branch)`, `changedFiles()` and `destroy()` (see the `Sandbox` class in `scripts/lib/sandbox.mjs`). `pipeline.mjs` uses nothing else.

Porting to a real sandbox touches three places, not one:

1. **`sandbox.mjs`:** a new backend class implementing the interface.
2. **`agent.mjs`:** `runStage()` starts `claude -p` on the host with `cwd` set to the sandbox. A remote or container backend must start it **inside** the sandbox instead (for example `docker exec -i ... claude -p ...`, or the platform's agent API). The arguments, the contract file, the schema and the validation stay the same.
3. **`factory.mjs` and `config.mjs`:** `run` and `integrate` construct `LocalSandboxes`, and the config accepts `sandbox: "local" | "shared"`. Add your backend's name and construct it there.

Keep every gate in the runner: claims, the deleted-test guard, the verifier, the reviewer's clean-tree check, PR creation and the integration order must never move into an agent or into the sandbox.

Properties to require from a production backend, as in the video's Upstash Box setup:

| Property | Why |
|---|---|
| **Snapshot + fast boot** | A stage box should start in seconds from a prepared snapshot (deps installed). Most wall-clock time should be the model, not setup. |
| **One box per stage** | The verifier must not inherit anything from the worker. |
| **Egress allowlist** | The agent can reach the model API, the package registry and the docs service, and nothing else. This blocks exfiltration and limits prompt-injection damage. |
| **Secrets attached outside the box** | API keys (docs, registry) are added to outbound requests by the platform, so they never exist inside the untrusted environment. |
| **Pause/resume, hard timeouts, deletion** | Long stages can be suspended; nothing outlives its run. |
| **Per-box labels and logs** | Every box maps to a run, issue and stage in the ledger. |

Backend guides in this skill:

- `references/upstash-box.md`: the video's backend (Upstash Box, Claude Code inside each box, snapshots, `attachHeaders` for the Context7 key, network policy).
- `references/containers.md`: a Docker or Podman backend for self-hosted isolation.

Cost note from the video's measured run: sandbox compute for the whole day was about $0.01. Boxes bill for active CPU, and agents spend most of their time waiting on the model, so isolation is close to free. The model is the cost.
