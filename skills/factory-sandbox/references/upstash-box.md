# Backend guide: Upstash Box

The video's factory runs every stage in an [Upstash Box](https://upstash.com/box): a cloud sandbox with Claude Code built in. This guide maps the box primitives the video uses onto the factory's sandbox interface. It is a design guide with code sketches, not a tested drop-in: check the current `@upstash/box` API and pricing before you build on it. The original implementation is MIT-licensed at [PromtEngineer/software-factory](https://github.com/PromtEngineer/software-factory) (`src/upstash.ts`, `src/integrate.ts`).

## Mapping

| Factory interface | Upstash Box (as used in the video) |
|---|---|
| `prepare()` | `Box.create(config)` -> `box.git.clone({ repo, branch })` -> `box.exec.command(setup)` -> `box.snapshot({ name })` |
| `create(label)` | `Box.fromSnapshot(snapshotId, config)` |
| agent stage | `box.agent.run({ prompt, responseSchema, options: { maxBudgetUsd, maxTurns }, timeout, onToolUse })` (Claude Code runs inside the box) |
| `test()` / `setup()` | `box.exec.command(cmd)` |
| `commitAndPush()` | `box.git.exec({ args: ["checkout", "-B", branch] })`, `box.git.commit`, `box.git.push({ branch })` |
| `checkout(branch)` | `box.git.exec({ args: ["fetch", "origin", branch] })` + checkout `FETCH_HEAD` |
| PR | `box.git.createPR({ title, body, base })`, or `gh` from the runner |
| destroy | `box.delete()`; snapshots: `deleteSnapshot(id)` |

## Config sketch

```ts
const config = {
  runtime: "node",
  size: "small",
  name: label,
  labels: ["factory"],
  git: { token: GITHUB_TOKEN, userName: "factory-bot", userEmail: "factory-bot@users.noreply.github.com" },
  agent: { harness: Agent.ClaudeCode, model: ClaudeCode.Sonnet_5 },
  // Egress allowlist: only what the stage needs.
  networkPolicy: { mode: "custom", allowedDomains: ["registry.npmjs.org", "context7.com" /*, model endpoint */] },
  // The Context7 key is attached by the platform to requests leaving the box. It never exists inside it.
  attachHeaders: { "context7.com": { Authorization: `Bearer ${CONTEXT7_API_KEY}` } },
};
```

Inside the box, the `docs` command is a small script calling `https://context7.com/api/v3/search?query=...`. Because the platform attaches the header, the script needs no key. The factory's local proxy (`factory-live-docs`) reproduces exactly this property on one machine.

## Notes from the video's runs

- Stage boxes restore from one snapshot, so `npm ci` runs once per run, not once per stage.
- The integrator ran in one long-lived box, merging branches sequentially and pushing after every merge, so a failure never lost progress.
- Box compute for a whole day of runs was about $0.01. The model cost was $3.67 for the 10-issue run and $6.37 for integration.
- Confirm which domain the built-in agent uses to reach its model before turning on a strict egress allowlist. The video kept the allowlist optional until a smoke test confirmed it.

## Porting checklist

1. Implement the interface in `software-factory/scripts/lib/sandbox.mjs` as a new class, for example `UpstashSandboxes`.
2. Move agent execution into the box: replace the local `claude -p` spawn in `agent.mjs` with `box.agent.run`, passing the same JSON Schema and the stage skill text as the prompt preamble.
3. Keep every gate in the runner: the claim, the deleted-test guard, the verifier, the reviewer's clean-tree check, PR creation and integration order must not move into an agent.
4. Add `sandbox: "upstash"` to the config validation, construct the new backend in `factory.mjs` (`run` and `integrate`), and add the box API key to `secretEnv`.
5. Run the codelab's fake-agent dry run, then a 3-issue real run, then score against the hidden tests.
