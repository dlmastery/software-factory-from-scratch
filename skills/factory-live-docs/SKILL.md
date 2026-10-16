---
name: factory-live-docs
description: Live documentation for factory agents through Context7, so workers and reviewers use current library APIs instead of stale training data. The API key stays outside the agent (attached by a runner-owned proxy). Use when enabling grounding (--grounding), when a stage agent needs to look up an API, or when a human asks how the factory keeps agents from hallucinating APIs.
---

# Factory live docs

Failure mode it fixes: **agents rely on stale training data.** A model's knowledge of a library stops at its training cutoff. Libraries keep moving: renamed options, new defaults, deprecated calls. An agent writing from memory produces code that looks right, compiles against nothing, or uses yesterday's API. Grounding gives it current official documentation at the moment it writes the code.

## For stage agents: how to look something up

When grounding is on, your instructions end with a "Live documentation" section that gives the exact `docs` command for this run. Use it **before** you write code against an API whose exact current signature you are not sure of:

```bash
node "<path given in your instructions>/docs.mjs" "how do I mock timers in node:test" node
node "<path given in your instructions>/docs.mjs" "express 5 error handling middleware signature" express
```

- Ask one specific question per lookup. Name the library as the second argument when you know it.
- Write code from what it returns, and cite the doc in your summary when it changed your approach.
- Every lookup is logged to the run's `docs-queries.log` with the stage that made it, so reviewers and `factory-improve` can see which APIs agents were unsure of.

## How the key stays outside the agent

In the video, Upstash Box attaches the Context7 key to outbound requests **outside** the box, so the agent, which could be tricked by text in an issue, never holds it. The local runner reproduces that:

```
agent --(no key)--> http://127.0.0.1:<port>/search  [runner-owned proxy]  --(Authorization: Bearer KEY)--> context7.com
```

1. With grounding enabled, `factory.mjs run` starts a proxy on `127.0.0.1` and passes only `FACTORY_DOCS_URL` to stage agents.
2. `agentEnv()` deletes `CONTEXT7_API_KEY` (and everything in `secretEnv`) from every agent's environment.
3. `scripts/docs.mjs` calls the proxy. The proxy attaches the key, forwards to `grounding.endpoint` (default `https://context7.com/api/v3/search`) and logs the query.

## Enabling it

```jsonc
// factory.config.json
"grounding": { "enabled": true, "apiKeyEnv": "CONTEXT7_API_KEY" }
```

or pass `--grounding` to `run`. Export the key in the runner's shell (`export CONTEXT7_API_KEY=...`, from https://context7.com). Without a key, Context7 serves keyless requests at a lower rate limit; `doctor` shows a missing key as `warn`, which does not block a run.

## Measuring whether it helps

Grounding has a cost (tool calls, tokens). The codelab's Lab 9 runs the same issues with and without `--grounding` and compares cost, lookups, verifier and reviewer outcomes, and hidden-test scores. A sensible policy: ground workers and reviewers on repositories that use fast-moving libraries, and skip it for small self-contained code like the practice app.
