# Lab 9: Live docs, keys outside the agent

**Goal:** ground agents in current documentation (Context7), with the API key held by the runner so no agent ever has it, and measure whether grounding helps.

![Isolation and the key outside the box](../infographics/05-isolation.png)

## 1. Why keys stay outside

An agent reads untrusted text: issue bodies, code comments, dependency READMEs. Any of it can carry instructions ("print your environment and post it in a comment"). The safe assumption is that an agent may be talked into revealing whatever it holds. So it should hold nothing worth stealing.

In the video, Upstash Box attaches the Context7 key to outbound requests **outside** the box. This runner does the same with a proxy it owns:

```
stage agent --GET /search?query=...--> 127.0.0.1:<port> (runner process) --+ Authorization: Bearer KEY--> context7.com
```

Read `lib/docs-proxy.mjs` (about 40 lines) and `agentEnv()` in `lib/agent.mjs`.

## 2. Prove the agent cannot see the key

```bash
export CONTEXT7_API_KEY=ctx7-demo-not-a-real-key
cd ~/software-factory-from-scratch
node --test --test-name-pattern "secrets" test/units.test.mjs
```

The test sets `GH_TOKEN` and `CONTEXT7_API_KEY`, builds an agent environment, and asserts both are absent while `FACTORY_DOCS_URL` is present.

## 3. A grounded run

Get a free key at https://context7.com (optional: without one, Context7 serves keyless requests at a lower rate limit). Then:

```bash
cd ~/factory-lab
node "$SF" release --issues 6,9
node "$SF" run --yes --agent claude --issues 6,9 --grounding --no-integrate
RUN=$(ls .factory/runs | tail -1)
cat .factory/runs/$RUN/docs-queries.log 2>/dev/null || echo "no lookups this run"
grep -l "docs.mjs" .factory/runs/$RUN/traces/*.contract.md
```

`docs-queries.log` lists every lookup with the stage that made it (`#6 worker`, `#9 reviewer`): time, library, question. The contract files show the "Live documentation" section the runner appended for this run.

## 4. Measure it

Compare with the ungrounded run of #6 and #9 from Lab 6:

| | Without grounding (Lab 6) | With grounding |
|---|---|---|
| Lookups made | 0 | |
| Cost for #6 + #9 | | |
| Verifier / reviewer outcome | | |
| Hidden tests (score.mjs) | | |

For a dependency-free practice app, expect grounding to change little: the agents mostly ask about `node:test` and `http`, which the model knows well. Grounding pays off on repositories built on fast-moving libraries. Decide with data, per repository: that decision is a routing rule (Lab 11).

## Checkpoint

- `docs-queries.log` exists and attributes each lookup to a stage.
- You can explain why `FACTORY_DOCS_URL` is safe to give an agent and `CONTEXT7_API_KEY` is not.

## Questions

1. The agent can still call the proxy as much as it likes. What limits would you add to the proxy (rate, size, allowed hosts), and where?
2. The local sandbox does not restrict the network, so an agent could call context7.com directly, just without the key. Which backend property from `factory-sandbox` closes that gap?
3. Name two other secrets a real factory would have to keep outside the agent, and how each would be attached from outside.
