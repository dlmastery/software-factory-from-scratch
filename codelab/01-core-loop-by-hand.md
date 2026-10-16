# Lab 1: The core loop by hand

**Goal:** feel every arrow of the loop **issue -> agent -> independent check -> human merge** by doing it yourself for one issue, before any automation exists.

![The core loop](../infographics/01-core-loop.png)

You play the factory for issue **#3** ("GET /stats/:slug returns 500 for an unknown slug").

## 1. The work order

```bash
cd ~/factory-lab
node -e "const i=require('./issues.json').find(i=>i.id===3); console.log(i.title+'\n\n'+i.body)"
```

Write down, in one line each, the acceptance criteria you would hand to a worker. (This is triage. You will compare your list with the triage agent's in Lab 6.)

## 2. The machinist: a worker in its own checkout

```bash
git clone -q shortlinks.git work-3 && cd work-3
git checkout -b factory/issue-3
```

You are now in `~/factory-lab/work-3`. Option A, with an agent (about $0.20 to $0.40). The worker gets the stage skill's text as its system prompt, as in the factory:

```bash
# The contract: the factory-worker skill without its frontmatter. Kept OUTSIDE the checkout (../) so it is never committed.
node -e "const os=require('os'),fs=require('fs');process.stdout.write(fs.readFileSync(os.homedir()+'/software-factory-from-scratch/skills/factory-worker/SKILL.md','utf8').replace(/^---[\s\S]*?---/,''))" > ../worker-contract.md

# The task: the issue, plus what the runner would add.
cat > ../task-3.md <<'EOF'
Issue #3: GET /stats/:slug returns 500 for an unknown slug

Requesting stats for a slug that does not exist crashes the handler and returns 500.
Expected: 404 with {"error": "not found"}, the same response the redirect route gives for an unknown slug.
---
Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, node. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit.
EOF

claude -p --append-system-prompt-file ../worker-contract.md \
  --allowedTools "Read,Edit,Write,Glob,Grep,Bash(npm),Bash(npm *),Bash(node *),PowerShell(npm *),PowerShell(node *)" \
  --permission-mode dontAsk --max-budget-usd 1 < ../task-3.md
```

The agent may only use the tools you listed; anything else is denied without asking (`--permission-mode dontAsk`). This is how the factory starts each stage, with two simplifications: the factory's worker may also run `npx`, `git diff`, `git status` and `ls`, and it must return a JSON handoff (`--json-schema`).

Option B, no agent: fix it yourself. Edit `src/app.js` so the stats route returns `404 {"error":"not found"}` for unknown slugs, and add a test in `test/stats.test.js`.

Either way, look at what changed and commit it as the factory's runner would:

```bash
git status && git diff
npm test
git add -A && git commit -qm "fix: stats for unknown slug (#3)" && git push -q origin factory/issue-3
cd ..
```

## 3. The inspector: verify on a clean copy

Never trust the worker's checkout, and never trust its word. Verify the branch **as pushed**, on a fresh clone:

```bash
node ~/software-factory-from-scratch/skills/factory-verifier/scripts/verify-branch.mjs shortlinks.git factory/issue-3 --test "npm test"
```

The last line is the verdict: `{"branch":"factory/issue-3","ok":true,"flaky":false,...}`.

**Experiment: how an honest "tests passed" goes wrong.** Do this on a separate branch, so `factory/issue-3` stays good for the rest of the lab:

```bash
cd work-3
git checkout -q -b factory/issue-3-experiment
cat > test/fixtures.js <<'EOF'
export const SAMPLE_URL = "https://example.com/fixture";
EOF
cat > test/fixture.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_URL } from "./fixtures.js";
import { start } from "./helpers.js";

test("a fixture url can be shortened", async () => {
  const app = await start();
  assert.equal((await app.post("/links", { url: SAMPLE_URL })).status, 201);
  await app.close();
});
EOF
npm test                                        # passes: fixtures.js is on your disk
git add test/fixture.test.js                    # ...but you forget to add fixtures.js
git commit -qm "add fixture test" && git push -q origin factory/issue-3-experiment
cd ..
node ~/software-factory-from-scratch/skills/factory-verifier/scripts/verify-branch.mjs shortlinks.git factory/issue-3-experiment --test "npm test"
```

Your local `npm test` passed; the clean copy fails (`"ok":false`, with an `ERR_MODULE_NOT_FOUND` stack trace in the output: `test/fixtures.js` was never committed). Nobody lied. The worker's environment simply was not the branch. That is exactly how an honest agent reports "tests passed" when an independent run fails, and why the verifier only ever trusts a fresh copy of what was pushed.

## 4. A second inspector: review the diff

```bash
git --git-dir=shortlinks.git diff main factory/issue-3
```

Read it as a reviewer: does it do what the issue says, for every case? Would you merge it? (Optional: in Claude Code, inside `work-3`, run `/factory-reviewer` and ask it to review the branch against main.)

## 5. The foreman: the human merge

In this lab the "pull request" is just the branch. You are the only one who may merge:

```bash
git clone -q shortlinks.git merge-3 && cd merge-3
git merge --no-ff origin/factory/issue-3 -m "Merge #3" && npm test
cd .. && rm -rf merge-3     # don't push: keep main pristine for the next labs
```

## Checkpoint

- `verify-branch.mjs` printed `"ok":true` for your branch.
- You can state, for each of the four steps, who did it and why it could not be the same actor as the step before.

## Questions

1. The worker ran `npm test` and it passed. Why run it again on a clean clone? List three concrete ways the two runs can disagree.
2. Your verifier is a script, not an agent. What would be lost if an agent ran the tests and reported back?
3. Now imagine nine more issues and five workers at once, all in `work-3`. Predict what breaks. (Lab 2 checks your prediction.)

Clean up (from `~/factory-lab`): `rm -rf work-3 worker-contract.md task-3.md`. The branches you pushed stay on the remote; later labs overwrite `factory/issue-3`. To start completely fresh, see "Start over" in the [cheat sheet](cheatsheet.md).
