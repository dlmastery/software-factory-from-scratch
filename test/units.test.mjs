import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSchema, validate } from "../skills/software-factory/scripts/lib/schema.mjs";
import { loadConfig } from "../skills/software-factory/scripts/lib/config.mjs";
import { DirectoryClaims } from "../skills/software-factory/scripts/lib/issues.mjs";
import { agentEnv, stageContract } from "../skills/software-factory/scripts/lib/agent.mjs";

const ROOT = join(import.meta.dirname, "..");

test("stage handoffs are validated against their schemas", () => {
  const triage = loadSchema("triage");
  assert.deepEqual(validate(triage, { actionable: true, kind: "bug", reason: "clear", acceptanceCriteria: ["x"] }), []);
  assert.ok(validate(triage, { actionable: "yes", kind: "bug", reason: "r", acceptanceCriteria: [] }).some((p) => p.includes("$.actionable")));
  assert.ok(validate(triage, { actionable: true, kind: "epic", reason: "r", acceptanceCriteria: [] }).some((p) => p.includes("expected one of")));
  assert.ok(validate(triage, { actionable: true, kind: "bug", reason: "r" }).some((p) => p.includes("acceptanceCriteria: required")));
  assert.ok(validate(triage, { actionable: true, kind: "bug", reason: "r", acceptanceCriteria: [], extra: 1 }).some((p) => p.includes("not allowed")));
  const review = loadSchema("review");
  assert.ok(validate(review, { verdict: "approve", issuesFound: [3], riskNotes: "" }).some((p) => p.includes("$.issuesFound[0]")));
});

test("every schema requires every property it declares (structured output friendly)", () => {
  for (const name of ["triage", "work-report", "review", "integration"]) {
    const s = loadSchema(name);
    assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), name);
    assert.equal(s.additionalProperties, false, name);
  }
});

test("config: defaults, validation and the base-branch guard", () => {
  const dir = mkdtempSync(join(tmpdir(), "cfg-"));
  const file = join(dir, "factory.config.json");
  writeFileSync(file, JSON.stringify({ issues: "gh:octo/demo" }));
  const cfg = loadConfig(file);
  assert.equal(cfg.repo, "https://github.com/octo/demo.git");
  assert.equal(cfg.concurrency, 3);
  assert.deepEqual(cfg.tools.triage, ["Read", "Glob", "Grep"]);

  writeFileSync(file, JSON.stringify({ issues: "gh:octo/demo", integrate: { into: "main" } }));
  assert.throws(() => loadConfig(file), /never writes to main/);
  writeFileSync(file, JSON.stringify({ issues: "jira:X" }));
  assert.throws(() => loadConfig(file), /must start with gh: or file:/);
  writeFileSync(file, JSON.stringify({ issues: "file:issues.json" }));
  assert.throws(() => loadConfig(file), /"repo" is required/);
});

test("directory claims are exclusive and releasable", async () => {
  const claims = new DirectoryClaims(mkdtempSync(join(tmpdir(), "claims-")));
  const issue = { id: 7, labels: [] };
  const results = await Promise.all([claims.claim(issue, "a"), claims.claim(issue, "b"), claims.claim(issue, "c")]);
  assert.equal(results.filter(Boolean).length, 1, "exactly one lane wins");
  assert.equal(await claims.isClaimed(issue), true);
  await claims.release(7);
  assert.equal(await claims.isClaimed(issue), false);
});

test("agents never see secrets", () => {
  process.env.GH_TOKEN = "secret-gh";
  process.env.CONTEXT7_API_KEY = "secret-c7";
  const env = agentEnv({ secretEnv: ["GH_TOKEN"], grounding: { apiKeyEnv: "CONTEXT7_API_KEY" } }, { FACTORY_DOCS_URL: "http://127.0.0.1:1" });
  assert.equal(env.GH_TOKEN, undefined);
  assert.equal(env.CONTEXT7_API_KEY, undefined);
  assert.equal(env.FACTORY_DOCS_URL, "http://127.0.0.1:1");
});

test("every stage skill exists, has frontmatter, and yields a contract", () => {
  for (const stage of ["triage", "worker", "reviewer", "integrator"]) {
    const contract = stageContract(stage);
    assert.ok(contract.length > 500, `${stage} contract is substantial`);
    assert.ok(!contract.startsWith("---"), `${stage} frontmatter stripped`);
    assert.match(contract, /Output contract/);
  }
});

test("every skill has a valid SKILL.md (name matches folder, description present)", () => {
  const skills = readdirSync(join(ROOT, "skills"));
  assert.ok(skills.length >= 10);
  for (const s of skills) {
    const md = readFileSync(join(ROOT, "skills", s, "SKILL.md"), "utf8");
    const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fm, `${s} has frontmatter`);
    assert.match(fm[1], new RegExp(`^name: ${s}$`, "m"), `${s} name matches folder`);
    const desc = fm[1].match(/^description: (.+)$/m);
    assert.ok(desc && desc[1].length > 80 && desc[1].length <= 1024, `${s} description length`);
  }
  const workflow = readFileSync(join(ROOT, "skills", "software-factory", "SKILL.md"), "utf8");
  assert.match(workflow, /disable-model-invocation: true/, "only a human can start the factory");
});

test("plugin and marketplace manifests are consistent", () => {
  const plugin = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"));
  const market = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf8"));
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].version, plugin.version);
  assert.ok(existsSync(join(ROOT, "LICENSE")));
});
