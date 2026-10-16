#!/usr/bin/env node
// docs "<question>" [library ...]  ->  current official documentation, via the factory's docs proxy.
//
// Stage agents run this instead of trusting what they remember. The runner starts a local proxy and
// passes its address in FACTORY_DOCS_URL; the proxy attaches the Context7 key, so this script (and the
// agent running it) never sees the key.
//
// Outside a factory run you can point it at Context7 directly for experiments:
//   FACTORY_DOCS_URL=https://context7.com/api/v3 node docs.mjs "node:test mock timers"
const [question, ...libraries] = process.argv.slice(2);
if (!question) {
  console.error('usage: node docs.mjs "<question>" [library ...]');
  process.exit(2);
}
const base = process.env.FACTORY_DOCS_URL;
if (!base) {
  console.error("FACTORY_DOCS_URL is not set: live docs are only available inside a factory run with grounding enabled.");
  process.exit(2);
}
const params = new URLSearchParams({ query: question });
for (const l of libraries) params.append("library", l);
try {
  const res = await fetch(`${base.replace(/\/$/, "")}/search?${params}`, {
    headers: { "x-factory-caller": process.env.FACTORY_CALLER ?? "manual" },
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`docs lookup failed (${res.status}): ${text.slice(0, 500)}`);
    process.exit(1);
  }
  const MAX = 12_000; // keep the agent's context small; ask a narrower question for more
  console.log(text.length > MAX ? `${text.slice(0, MAX)}\n\n[truncated: ask a narrower question for more]` : text);
} catch (err) {
  console.error(`docs lookup failed: ${err.message}`);
  process.exit(1);
}
