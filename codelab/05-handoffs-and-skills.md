# Lab 5: Typed handoffs and stage skills

**Goal:** understand the two things every stage agent is given, a **skill** (how to behave) and a **schema** (what to hand over), and see the boundary reject a bad handoff.

## 1. Skill = contract

Each stage agent is a fresh `claude -p` process. The runner appends the stage skill's body to its system prompt (`--append-system-prompt-file`) and sends the task on stdin. Compare them for the worker of issue #3. Two runs competed in Lab 4 and only one of them won #3, so go to the newest run that has a worker trace for #3:

```bash
cd "$(dirname "$(ls -d ~/factory-lab/.factory/runs/*/traces/issue-3.worker.prompt.md | tail -1)")"
cat issue-3.worker.prompt.md        # the task: WHAT to work on this time
cat ~/software-factory-from-scratch/skills/factory-worker/SKILL.md   # the contract: HOW to work, every time
```

(With the fake agent there is no `.contract.md` trace; with real agents, Lab 6, you will find `issue-3.worker.contract.md` next to the prompt: the exact text the agent received.)

The same skill also works when a human invokes it inside Claude Code (`/factory-worker`, `/factory-reviewer`). One source of truth for people and for the factory.

## 2. Schema = typed handoff

```bash
cat ~/software-factory-from-scratch/skills/software-factory/schemas/triage.schema.json
```

Stages never pass chat history to each other. They pass one JSON object, checked twice:

1. **At generation:** the runner passes the schema to `claude --json-schema`, so the model must produce a matching object.
2. **At the boundary:** the runner validates it again (`assertValid` in `lib/schema.mjs`) before the next stage may read it. A stage that breaks its contract ends that issue as `error`; it never leaks malformed data downstream.

## 3. Break a contract on purpose

Add a required field to the triage contract, without teaching anyone to produce it:

```bash
cd ~/software-factory-from-scratch
node -e "
const f='skills/software-factory/schemas/triage.schema.json', s=JSON.parse(require('fs').readFileSync(f));
s.properties.riskLevel={type:'string',enum:['low','medium','high']}; s.required.push('riskLevel');
require('fs').writeFileSync(f, JSON.stringify(s,null,2));"
cd ~/factory-lab && node "$SF" release --issues 3 && node "$SF" run --yes --issues 3
```

The fake triage agent does not produce `riskLevel`, so the log shows:

```
#3 error: triage handoff does not match its contract:   $.riskLevel: required
```

The full error, listing every violated rule, is in the ledger:

```bash
RUN=$(ls .factory/runs | tail -1)
node -e "console.log(require('./.factory/runs/$RUN/run.json').outcomes.find(o => o.issue === 3).error)"
```

Nothing downstream ran: this run wrote only triage traces, and made no commit or push (any `factory/issue-3` branch on the remote is left over from an earlier lab). Restore the schema:

```bash
git -C ~/software-factory-from-scratch checkout -- skills/software-factory/schemas/triage.schema.json
```

## 4. Do it properly (exercise)

Add `riskLevel` for real:

1. the schema (required, enum `low|medium|high`),
2. `factory-triage/SKILL.md`: define what each level means and add it to the output example,
3. the fake agent's triage branch in `lib/agent.mjs`, so dry runs still work,
4. somewhere it is used: for example, show it in the PR body (`prBody` in `lib/pipeline.mjs`).

Run `npm test` in the repository, then a fake run. In Lab 6, real agents will fill it in from your skill text alone.

## Checkpoint

- You saw `$.riskLevel: required` stop issue #3 at the boundary.
- After the exercise, `npm test` passes and the PR bodies show a risk level.

## Questions

1. Why typed objects instead of passing each stage the previous stage's whole transcript?
2. The worker's `testsPass` is in its handoff, but the verifier ignores it. Why keep the field at all? (Find `selfReportMismatch` in `pipeline.mjs`.)
3. What belongs in a skill, and what belongs in the runner? Classify: "never delete tests", "run tests twice on failure", "prefer a new test file", "reviewer may not modify files".
