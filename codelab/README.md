# Codelab: build and run a software factory from scratch

You will build an understanding of a **software factory**, a system that turns a backlog of GitHub issues into verified, reviewed pull requests, by running one, breaking it on purpose, reading its traces, and improving it. By the end you can explain every design decision in it and defend each one with evidence from your own runs.

The factory here is made only of Claude Code **skills** (in `../skills/`). One workflow skill, `/software-factory`, is triggered by a human and drives a small deterministic runner. Each stage of the line (triage, worker, verifier, reviewer, integrator) is a skill that becomes the contract for one headless agent working in its own sandbox.

![The core loop](../infographics/01-core-loop.png)

## Who this is for

Software engineers and students who can use git, a terminal and Node.js. No prior agent experience needed. Labs 0 to 5 cost **nothing**: they use a scripted stand-in agent (`--agent fake`). Real model spend starts in Lab 6 and stays around a few dollars for the whole codelab.

## Background: the video

The codelab follows the video [**Build a Self-Improving Software Factory**](https://youtu.be/hO4ft4tGOJI) (Prompt Engineering, about 20 minutes). Watching it first is recommended but not required. It builds the same factory on Upstash Box cloud sandboxes and runs it on a URL shortener with ten issues. Several labs compare your numbers with **the video's measured run**: 10 issues in 4 min 34 s, 9 pull requests, 9/9 hidden tests passed, 7 of 9 branches conflicting at integration, $3.67 of model cost plus $6.37 for integration. The [repository README](../README.md#the-story-in-eight-frames) tells the story in eight diagrams.

## Learning outcomes

After the codelab you can:

1. Explain the core loop **issue -> isolated agent -> independent check -> human merge**, and why each arrow exists.
2. Reproduce the four failure modes of parallel agents (overwritten files, double work, false "tests passed", conflicting PR floods) and name the structural fix for each.
3. Read a run ledger and follow one issue through every stage, handoff and cost.
4. Explain why the verifier is code rather than an agent, and why the reviewer still matters when all tests pass.
5. Run the factory on a real repository, score its output against hidden tests, and integrate conflicting branches.
6. Keep secrets outside agent environments, and say what a local sandbox does and does not isolate.
7. Close the outer loop: turn traces into a reviewed, measured improvement to the factory.

## Labs

| # | Lab | You will | Time | Cost |
|---|---|---|---|---|
| 0 | [Setup](00-setup.md) | Install, seed your practice repo, run `doctor` | 15 min | $0 |
| 1 | [The core loop by hand](01-core-loop-by-hand.md) | Be the factory for one issue: worker, verifier, reviewer, human | 30 min | ~$0.40 (optional) |
| 2 | [Break it: one shared folder](02-break-it-shared-folder.md) | Reproduce the parallel-agent failure modes | 20 min | $0 |
| 3 | [Anatomy of a run](03-anatomy-of-a-run.md) | Dry-run the whole line; trace one issue through the ledger | 30 min | $0 |
| 4 | [Claims](04-claims.md) | Make two runs compete for the same issues | 20 min | $0 |
| 5 | [Typed handoffs and stage skills](05-handoffs-and-skills.md) | Change a contract; watch the boundary reject a bad handoff | 30 min | $0 |
| 6 | [First real run](06-first-real-run.md) | Real agents on 3, then 10 issues; read traces and costs | 45 min | ~$3 |
| 7 | [Quality gates and hidden tests](07-quality-gates.md) | Score against tests the agents never saw; study the ordering trap | 30 min | ~$1 |
| 8 | [Integration](08-integration.md) | Make branches collide; let the integrator merge them | 30 min | ~$1-6 |
| 9 | [Live docs, keys outside the agent](09-live-docs.md) | Ground agents with Context7 through a key-holding proxy | 20 min | ~$1 |
| 10 | [On GitHub, triggered by a human](10-github.md) | Real issues, labels, PRs, a human merge, an Actions trigger | 30 min | ~$3 |
| 11 | [The outer loop (capstone)](11-outer-loop.md) | Turn traces into a measured improvement | 45 min | ~$3 |

Keep these open while you work: the [cheat sheet](cheatsheet.md) (every command and where every file is) and the [glossary](glossary.md).

Instructors: see [instructor/README.md](instructor/README.md) for the schedule, answer key, grading rubric and common pitfalls.

## What is in this folder

| Path | What it is |
|---|---|
| `practice-app/` | **shortlinks**, a tiny URL shortener (Node 22, no dependencies) with real bugs and missing features |
| `issues.json` | The 10 issues: 4 bugs, 5 features, 1 deliberately vague request |
| `hidden-tests/` | One test per actionable issue, kept away from the agents, used only for scoring |
| `scripts/seed.mjs` | Creates your copy: a local bare repo (Labs 0-9) or a private GitHub repo (Lab 10) |
| `scripts/score.mjs` | Runs the hidden tests against every factory branch and the integration branch |
| `instructor/` | Reference solution, a sanity check that every issue is real and solvable, teaching notes |

## Conventions

All commands are bash. On macOS and Linux use your normal terminal; **on Windows use Git Bash** (installed with [Git for Windows](https://git-scm.com/download/win)), not PowerShell or cmd. The labs use `$(...)`, `for` loops, `grep` and `&`, which only bash has. The factory itself runs on all three systems (CI tests Linux, macOS and Windows).

The repository is assumed to be cloned into your home directory (`~/software-factory-from-scratch`), and every lab starts in your lab directory (`~/factory-lab`, created in Lab 0) with `$SF` pointing at the runner:

```bash
export SF="$HOME/software-factory-from-scratch/skills/software-factory/scripts/factory.mjs"
node "$SF" help
```

Put that `export` line in your `~/.bashrc` so every new terminal has it.

**Finding a run.** Several labs need "the run you just made". Runs are directories named by start time under `.factory/runs/`, so the newest is `ls .factory/runs | tail -1`. When a lab needs a *specific* earlier run (for example your Lab 6 run), it says so: find its id in the run's printed header (`run 2026-...`) or with `ls .factory/runs`.

Each lab ends with a **checkpoint** (what you should see), **questions** to answer in your notes, and optional **stretch** tasks.
