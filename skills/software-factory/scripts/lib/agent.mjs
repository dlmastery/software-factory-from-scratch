// Stage agents.
//
// Each stage is one headless Claude Code process (`claude -p`) running inside that stage's sandbox:
//   - the stage's SKILL.md body is appended to the system prompt (the skill IS the stage contract),
//   - the task (issue text, diff instructions) arrives on stdin,
//   - `--json-schema` forces a typed handoff, which the runner validates again,
//   - `--allowedTools` + `--permission-mode dontAsk` deny every tool the stage was not given,
//   - `--max-budget-usd` caps spend per invocation.
// The "fake" agent is a scripted stand-in with the same interface. It costs nothing and makes the
// plumbing (claims, sandboxes, ledgers, conflicts, integration) observable before real agents run.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./proc.mjs";
import { assertValid, loadSchema } from "./schema.mjs";

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const STAGE_SKILL = {
  triage: "factory-triage",
  worker: "factory-worker",
  reviewer: "factory-reviewer",
  integrator: "factory-integrator",
};

const STAGE_SCHEMA = {
  triage: "triage",
  worker: "work-report",
  reviewer: "review",
  integrator: "integration",
};

/** The body of a stage skill (frontmatter removed): the role contract for that stage's agent. */
export function stageContract(stage) {
  const file = join(SKILLS_DIR, STAGE_SKILL[stage], "SKILL.md");
  return readFileSync(file, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

/**
 * Run one stage agent. Returns { result, costUsd, turns, seconds, denied }.
 * Throws when the agent fails, times out, or returns something that breaks the stage contract.
 */
export async function runStage({ cfg, stage, sandbox, prompt, traceDir, traceName, env = {}, extraContract = "" }) {
  const schema = loadSchema(STAGE_SCHEMA[stage]);
  const t0 = Date.now();
  const trace = (suffix, content) => traceDir && writeFileSync(join(traceDir, `${traceName}.${suffix}`), content.endsWith("\n") ? content : `${content}\n`);
  trace("prompt.md", prompt);

  if (cfg.agent === "fake") {
    const result = await fakeAgent(stage, sandbox, prompt);
    trace("result.json", JSON.stringify({ fake: true, result }, null, 2));
    return { result: assertValid(schema, result, `${stage} handoff`), costUsd: 0, turns: 0, seconds: secs(t0), denied: [] };
  }

  const contractFile = join(traceDir, `${traceName}.contract.md`);
  writeFileSync(contractFile, stageContract(stage) + (extraContract ? `\n\n${extraContract}` : ""));

  const args = [
    "-p",
    "--output-format", "json",
    "--json-schema", JSON.stringify({ ...schema, $schema: undefined }), // the CLI rejects a $schema meta-reference
    "--model", cfg.model,
    "--max-budget-usd", String(cfg.budgets[stage]),
    "--permission-mode", "dontAsk",
    "--allowedTools", cfg.tools[stage].join(","),
    "--append-system-prompt-file", contractFile,
    "--no-session-persistence",
  ];
  if (cfg.isolateAgentConfig) args.push("--setting-sources", "project", "--strict-mcp-config");

  const r = await run(cfg.claudeBin, args, {
    cwd: sandbox.dir,
    input: prompt,
    env: agentEnv(cfg, env),
    timeoutMs: cfg.timeouts[stage] * 1000,
  });
  trace("output.json", r.stdout || r.stderr);

  if (r.timedOut) throw new Error(`${stage} agent timed out after ${cfg.timeouts[stage]}s`);
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw new Error(`${stage} agent produced no JSON result (exit ${r.code}): ${(r.stderr || r.stdout).slice(-400)}`);
  }
  const costUsd = Number(out.total_cost_usd ?? 0);
  if (out.is_error || out.structured_output === undefined) {
    const err = new Error(`${stage} agent ended without a valid handoff (${out.subtype ?? "error"}): ${String(out.result ?? "").slice(0, 300)}`);
    err.costUsd = costUsd;
    throw err;
  }
  let result;
  try {
    result = assertValid(schema, out.structured_output, `${stage} handoff`);
  } catch (err) {
    err.costUsd = costUsd; // the tokens were spent even though the handoff is unusable
    throw err;
  }
  return {
    result,
    costUsd,
    turns: out.num_turns ?? 0,
    seconds: secs(t0),
    denied: (out.permission_denials ?? []).map((d) => `${d.tool_name ?? "?"} ${JSON.stringify(d.tool_input ?? {}).slice(0, 120)}`),
  };
}

/** The environment a stage agent sees: the runner's environment minus every secret. */
export function agentEnv(cfg, extra = {}) {
  const env = { ...process.env };
  for (const name of cfg.secretEnv) delete env[name];
  if (cfg.grounding?.apiKeyEnv) delete env[cfg.grounding.apiKeyEnv];
  return { ...env, ...extra };
}

const secs = (t0) => Math.round((Date.now() - t0) / 100) / 10;

// ---- The fake agent -----------------------------------------------------------------------------

async function fakeAgent(stage, sandbox, prompt) {
  await new Promise((r) => setTimeout(r, 150 + Math.floor(Math.random() * 350)));
  const id = Number(prompt.match(/Issue #(\d+)/)?.[1] ?? 0);
  const title = prompt.match(/Issue #\d+: (.*)/)?.[1] ?? "untitled";
  switch (stage) {
    case "triage": {
      // Prompt layout (see prompts.mjs): "Issue #N: title", "Labels: ...", blank line, body, "---", instructions.
      const body = prompt.split("\n---\n")[0].split("\n").slice(3).join("\n");
      const vague = body.trim().length < 160 || /\b(not sure|maybe|kind of|would be nice)\b/i.test(body);
      return vague
        ? { actionable: false, kind: "unclear", reason: "The issue does not state a concrete, testable outcome.", acceptanceCriteria: [] }
        : { actionable: true, kind: /bug|crash|500|wrong|broken|counted|collide|accepted/i.test(title) ? "bug" : "feature", reason: "The issue names the expected behavior precisely enough to test.", acceptanceCriteria: [`Issue #${id} behaves as described`] };
    }
    case "worker": {
      // Every fake worker appends to the same file from the same snapshot, exactly like nine real
      // workers adding tests to one shared test file. Integration will conflict, by design.
      const file = join(sandbox.dir, "FACTORY_LOG.md");
      if (!existsSync(file)) writeFileSync(file, "# Factory log\n\nOne line per change the factory made.\n");
      appendFileSync(file, `- #${id} ${title}\n`);
      return { status: "done", summary: `Fake change for issue #${id}: recorded it in FACTORY_LOG.md.`, filesChanged: ["FACTORY_LOG.md"], testsAdded: false, testsPass: true, blockedReason: "" };
    }
    case "reviewer":
      return { verdict: "approve", issuesFound: [], riskNotes: "Fake review: no real analysis was done." };
    case "integrator": {
      // Resolve by keeping both sides of every conflict, in order.
      const files = (await sandbox.git(["diff", "--name-only", "--diff-filter=U"])).stdout.trim().split("\n").filter(Boolean);
      for (const f of files) {
        const p = join(sandbox.dir, f);
        writeFileSync(p, readFileSync(p, "utf8").replace(/<<<<<<< [^\n]*\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\n]*\n/g, "$1$2"));
        await sandbox.git(["add", f]);
      }
      return { resolved: true, testsPass: true, summary: `Kept both sides in ${files.join(", ") || "no files"}.` };
    }
  }
  throw new Error(`unknown stage ${stage}`);
}
