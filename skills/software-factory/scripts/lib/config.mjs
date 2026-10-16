// Factory configuration: one JSON file (factory.config.json) merged over these defaults.
// Every knob a student might want to turn lives here, so the pipeline code stays free of magic values.
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

// Shell permission rules for one command prefix, for both shells Claude Code may use (Bash everywhere,
// PowerShell on Windows). Each prefix matches the bare command and the command with arguments.
// A compound command (a && b, pipes, heredocs) must match for EVERY part, so agents are told to run one
// command per call and to edit files with Edit/Write.
function shell(prefixes) {
  return prefixes.flatMap((p) => [`Bash(${p})`, `Bash(${p} *)`, `PowerShell(${p})`, `PowerShell(${p} *)`]);
}

export const DEFAULTS = {
  // Where work comes from: "gh:owner/repo" (GitHub issues) or "file:path/to/issues.json".
  issues: "",
  // Only GitHub issues carrying this label are eligible. Empty string = every open issue.
  label: "factory",
  // The repository the agents change: a git URL or a local path (a bare repo works well for labs).
  // Defaults to https://github.com/<owner>/<repo>.git when `issues` is a gh: source.
  repo: "",
  baseBranch: "main",
  branchPrefix: "factory",
  // Lanes: how many issues move through the pipeline at the same time.
  concurrency: 3,
  // "local" = every stage gets its own copy of a prepared snapshot (the factory's isolation).
  // "shared" = every stage uses ONE checkout. Only for reproducing the failure modes in the codelab.
  sandbox: "local",
  keepSandboxes: false,
  // Commands run inside sandboxes. `setup` runs once in the snapshot (and again if a branch changes
  // dependency manifests); `test` is what the verifier and integrator trust.
  setup: "",
  test: "npm test",
  testTimeoutSeconds: 600,
  // "claude" runs `claude -p` per stage. "fake" runs a scripted stand-in that costs nothing: use it to
  // learn and test the plumbing (claims, sandboxes, handoffs, ledgers, integration) before spending tokens.
  agent: "claude",
  claudeBin: "claude",
  model: "sonnet",
  // Hard ceilings per stage invocation, in USD (passed to `claude --max-budget-usd`).
  budgets: { triage: 0.5, worker: 3, reviewer: 1.5, integrator: 2 },
  timeouts: { triage: 180, worker: 1200, reviewer: 600, integrator: 900 },
  // Load only the target repo's project settings in stage agents (not your personal hooks, plugins
  // or MCP servers). Keeps stage agents small, fast and reproducible.
  isolateAgentConfig: true,
  // Tools each stage may use (Claude Code permission rules). Anything else is denied.
  tools: {
    triage: ["Read", "Glob", "Grep"],
    worker: ["Read", "Edit", "Write", "Glob", "Grep", ...shell(["npm", "npx", "node", "git diff", "git status", "ls"])],
    reviewer: ["Read", "Glob", "Grep", ...shell(["git diff", "git log", "git show", "npm test", "node"])],
    integrator: ["Read", "Edit", "Write", "Glob", "Grep", ...shell(["npm", "node", "git diff", "git status", "git add", "ls"])],
  },
  // Environment variables stage agents never see. The runner keeps them for its own git/gh calls.
  secretEnv: ["GH_TOKEN", "GITHUB_TOKEN", "CONTEXT7_API_KEY", "UPSTASH_BOX_API_KEY", "NPM_TOKEN"],
  // Live documentation (Context7). The key stays in the runner; agents reach Context7 through a
  // local proxy that attaches it, so the key never enters an agent's environment.
  grounding: { enabled: false, apiKeyEnv: "CONTEXT7_API_KEY", endpoint: "https://context7.com/api/v3/search" },
  claims: { label: "factory:claimed" },
  review: { enabled: true },
  // A worker may not delete files matching these patterns (deleting a failing test is not a fix).
  protectedPaths: ["test/", "tests/", "__tests__/", "spec/", ".test.", ".spec."],
  integrate: { auto: true, into: "factory/integration" },
  pr: { draft: false, labels: ["factory"] },
  // Where run ledgers, traces and sandboxes live, relative to the config file.
  runsDir: ".factory/runs",
};

/** Load factory.config.json (or the given path) and merge it over DEFAULTS. */
export function loadConfig(path = "factory.config.json", overrides = {}) {
  const file = resolve(path);
  if (!existsSync(file)) {
    throw new Error(`No config at ${file}. Create one with: node factory.mjs init`);
  }
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const cfg = merge(merge(DEFAULTS, raw), overrides);
  cfg.configDir = dirname(file);
  cfg.runsDir = absolute(cfg.configDir, cfg.runsDir);

  const source = parseIssueSource(cfg.issues, cfg.configDir);
  cfg.source = source;
  if (!cfg.repo && source.kind === "gh") cfg.repo = `https://github.com/${source.repo}.git`;
  if (cfg.repo && looksLocal(cfg.repo)) cfg.repo = absolute(cfg.configDir, cfg.repo);

  const problems = check(cfg);
  if (problems.length) throw new Error(`Invalid config ${file}:\n  ${problems.join("\n  ")}`);
  return cfg;
}

export function parseIssueSource(spec, baseDir = ".") {
  if (typeof spec !== "string" || !spec) return { kind: "none" };
  if (spec.startsWith("gh:")) return { kind: "gh", repo: spec.slice(3) };
  if (spec.startsWith("file:")) return { kind: "file", path: absolute(baseDir, spec.slice(5)) };
  return { kind: "invalid", spec };
}

function check(cfg) {
  const p = [];
  if (cfg.source.kind === "none") p.push(`"issues" is required: "gh:owner/repo" or "file:path/to/issues.json"`);
  if (cfg.source.kind === "invalid") p.push(`"issues" must start with gh: or file: (got ${JSON.stringify(cfg.source.spec)})`);
  if (cfg.source.kind === "gh" && !/^[\w.-]+\/[\w.-]+$/.test(cfg.source.repo)) p.push(`"issues": gh source must be gh:owner/repo`);
  if (!cfg.repo) p.push(`"repo" is required for file: issue sources (a git URL or local path)`);
  if (!Number.isInteger(cfg.concurrency) || cfg.concurrency < 1 || cfg.concurrency > 16) p.push(`"concurrency" must be an integer from 1 to 16`);
  if (!["local", "shared"].includes(cfg.sandbox)) p.push(`"sandbox" must be "local" or "shared"`);
  if (!["claude", "fake"].includes(cfg.agent)) p.push(`"agent" must be "claude" or "fake"`);
  if (!cfg.test) p.push(`"test" (the command the verifier trusts) is required`);
  if (cfg.integrate.into === cfg.baseBranch) p.push(`"integrate.into" must not be the base branch: the factory never writes to ${cfg.baseBranch}`);
  for (const stage of ["triage", "worker", "reviewer", "integrator"]) {
    if (!(cfg.budgets[stage] > 0)) p.push(`"budgets.${stage}" must be a positive number of USD`);
    if (!(cfg.timeouts[stage] > 0)) p.push(`"timeouts.${stage}" must be a positive number of seconds`);
  }
  return p;
}

function merge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra ?? {})) {
    out[k] = isPlain(v) && isPlain(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const looksLocal = (repo) => !/^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(repo);
const absolute = (base, p) => (isAbsolute(p) ? p : resolve(base, p));
