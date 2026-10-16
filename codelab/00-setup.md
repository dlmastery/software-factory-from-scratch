# Lab 0: Setup

**Goal:** a working toolchain, your own copy of the practice repository, and a green `doctor`.

## 1. Prerequisites

| Tool | Version | Check | Needed from |
|---|---|---|---|
| Node.js | 22 or later | `node --version` | Lab 0 |
| bash | macOS/Linux terminal, or Git Bash on Windows | `bash --version` | Lab 0 |
| git | any recent, with your identity set | `git --version`, `git config user.email` | Lab 0 |
| Claude Code | current | `claude --version` | Lab 1 (optional) / Lab 6 |
| GitHub CLI | current, logged in | `gh auth status` | Lab 10 |

Claude Code: install from https://code.claude.com and sign in (`claude`, then follow the login). Headless runs (`claude -p`) use the same login, or `ANTHROPIC_API_KEY` if you set one.

If `git config user.email` prints nothing, set your identity once (Lab 1 commits by hand):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 2. Get the repository

```bash
cd ~
git clone https://github.com/dlmastery/software-factory-from-scratch
cd software-factory-from-scratch
npm test        # the factory's own tests: unit tests + two fake-agent end-to-end runs (about 2 minutes)
```

`npm test` needs no network and no model. If it passes, your machine can run the factory.

## 3. Install the skills into Claude Code

Pick one:

```bash
# A. As a plugin (namespaced: /software-factory:software-factory)
claude
> /plugin marketplace add dlmastery/software-factory-from-scratch
> /plugin install software-factory@software-factory-from-scratch

# B. As personal skills (short names: /software-factory)
node scripts/install-skills.mjs
```

Then, in Claude Code, type `/` and check that `software-factory` is listed. You only need this for the skill-driven parts (Labs 1, 6, 10, 11); the runner also works directly from the terminal.

## 4. Seed your practice repository

```bash
cd ~
node ~/software-factory-from-scratch/codelab/scripts/seed.mjs local factory-lab
cd ~/factory-lab
ls
```

You now have:

```
factory-lab/
  shortlinks.git        a bare git repo: the "remote" the factory pushes branches to
  issues.json           the 10 issues: the work queue
  factory.config.json   the factory's settings (agent "fake" for now)
```

Using a local bare repo means nothing leaves your machine until Lab 10.

## 5. Point `$SF` at the runner and run `doctor`

```bash
export SF="$HOME/software-factory-from-scratch/skills/software-factory/scripts/factory.mjs"
echo 'export SF="$HOME/software-factory-from-scratch/skills/software-factory/scripts/factory.mjs"' >> ~/.bashrc   # once only
node "$SF" doctor
```

(The `echo` line makes `$SF` available in every new terminal. Run it only once. Git Bash may print a one-time notice about creating `~/.bash_profile` the next time it starts; that is expected.)

Windows: run every command in **Git Bash**, not PowerShell (see the conventions in the [codelab README](README.md#conventions)).

## Checkpoint

```
ok   node 22.x
ok   git
ok   config factory.config.json
ok   issues file .../factory-lab/issues.json
ok   repo .../factory-lab/shortlinks.git has main
ok   test command "npm test"

Ready. Next: node factory.mjs plan
```

## Read before Lab 1

1. Skim `codelab/practice-app/src/app.js` (about 70 lines). Find the bug behind issue #3 just by reading.
2. Read `issues.json`. Which issue would *you* refuse to work on without asking someone, and why?
3. Open `factory.config.json`. Which setting decides what "the tests pass" means?
