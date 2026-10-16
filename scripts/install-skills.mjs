#!/usr/bin/env node
// Copy the factory's skills into a Claude Code skills directory (alternative to installing the plugin).
//
//   node scripts/install-skills.mjs            -> ~/.claude/skills        (all your projects)
//   node scripts/install-skills.mjs --project  -> ./.claude/skills        (this project only; commit it to share)
//   node scripts/install-skills.mjs --dir <path>
//
// All skills are copied together: the runner finds the stage skills and schemas next to itself.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { project: { type: "boolean" }, dir: { type: "string" }, force: { type: "boolean" } } });
const target = values.dir ? resolve(values.dir) : values.project ? resolve(".claude", "skills") : join(homedir(), ".claude", "skills");
const source = join(import.meta.dirname, "..", "skills");

mkdirSync(target, { recursive: true });
for (const skill of readdirSync(source)) {
  const dest = join(target, skill);
  if (existsSync(dest) && !values.force) {
    console.log(`skip    ${skill} (exists; use --force to overwrite)`);
    continue;
  }
  cpSync(join(source, skill), dest, { recursive: true, force: true });
  console.log(`install ${skill} -> ${dest}`);
}
console.log(`\nDone. In Claude Code, start the factory with: /software-factory`);
