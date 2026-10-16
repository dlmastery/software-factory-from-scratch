#!/usr/bin/env node
// Instructor sanity check: every hidden test must FAIL on the starting practice app (the issue is real)
// and PASS on the reference solution (the issue is solvable as written).
//
//   node codelab/instructor/check-hidden-tests.mjs
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CODELAB = join(import.meta.dirname, "..");
const hidden = readdirSync(join(CODELAB, "hidden-tests")).filter((f) => f.endsWith(".test.js")).sort();

function results(appDir) {
  const dir = mkdtempSync(join(tmpdir(), "hidden-check-"));
  try {
    cpSync(appDir, dir, { recursive: true });
    cpSync(join(CODELAB, "hidden-tests"), join(dir, "hidden-test"), { recursive: true });
    const own = spawnSync(process.execPath, ["--test", "test/**/*.test.js"], { cwd: dir, encoding: "utf8", timeout: 120_000 }).status === 0;
    const perTest = Object.fromEntries(
      hidden.map((f) => [f, spawnSync(process.execPath, ["--test", join("hidden-test", f)], { cwd: dir, encoding: "utf8", timeout: 120_000 }).status === 0]),
    );
    return { own, perTest };
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}

const base = results(join(CODELAB, "practice-app"));
const ref = results(join(CODELAB, "instructor", "reference"));
let ok = base.own && ref.own;
console.log(`own tests: practice-app ${base.own ? "pass" : "FAIL"}, reference ${ref.own ? "pass" : "FAIL"}\n`);
console.log("hidden test        practice-app   reference");
for (const f of hidden) {
  const good = !base.perTest[f] && ref.perTest[f];
  ok &&= good;
  console.log(`${f.padEnd(18)} ${(base.perTest[f] ? "pass (!)" : "fail").padEnd(14)} ${ref.perTest[f] ? "pass" : "FAIL (!)"}`);
}
console.log(ok ? "\nOK: every issue is real and solvable." : "\nPROBLEM: see the rows marked (!).");
process.exit(ok ? 0 : 1);
