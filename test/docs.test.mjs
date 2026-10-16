// Documentation stays honest: every relative link resolves, and every runner command and flag
// mentioned in the docs exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (["node_modules", ".git", "sample-runs"].includes(name)) return [];
    if (statSync(p).isDirectory()) return markdownFiles(p);
    return name.endsWith(".md") ? [p] : [];
  });
}

test("every relative link in the documentation resolves", () => {
  const broken = [];
  for (const file of markdownFiles(ROOT)) {
    const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = target.split("#")[0];
      if (path && !existsSync(join(dirname(file), path))) broken.push(`${relative(ROOT, file)} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("runner commands and flags used in the docs exist", () => {
  const runner = readFileSync(join(ROOT, "skills/software-factory/scripts/factory.mjs"), "utf8");
  const commands = new Set(runner.match(/const commands = \{([^}]*)\}/)[1].split(",").map((s) => s.split(":")[0].trim()));
  const flags = new Set([...runner.matchAll(/^\s+"?([a-z-]+)"?: \{ type: "(?:string|boolean)"/gm)].map((m) => m[1]));
  const problems = [];
  for (const file of markdownFiles(ROOT)) {
    const text = readFileSync(file, "utf8");
    for (const [, cmd, rest] of text.matchAll(/(?:\$SF|\$env:SF|factory\.mjs)"? ([a-z]+)([^\n`|]*)/g)) {
      if (!commands.has(cmd) && !["help"].includes(cmd)) problems.push(`${relative(ROOT, file)}: unknown command "${cmd}"`);
      for (const [, flag] of rest.matchAll(/--([a-z-]+)/g)) {
        if (!flags.has(flag)) problems.push(`${relative(ROOT, file)}: unknown flag --${flag} (after "${cmd}")`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
