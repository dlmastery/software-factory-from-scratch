# Lab 10: On GitHub, triggered by a human

**Goal:** run the factory against real GitHub issues, so that claims are labels and handoffs end as real pull requests, then merge one yourself and trigger a run from GitHub Actions.

## 1. Seed a private GitHub repository

```bash
gh auth status                      # must be logged in, with the repo scope
cd ~
node ~/software-factory-from-scratch/codelab/scripts/seed.mjs github <your-user>/shortlinks
cd ~/shortlinks-factory
cat factory.config.json
```

This creates a **private** repository with the practice app on `main`, a `factory` label, and the 10 issues as #1 to #10, so the hidden tests line up with issue numbers. The config uses `"issues": "gh:<your-user>/shortlinks"`: only open issues with the `factory` label are eligible.

## 2. Start it the human way: `/software-factory`

Open Claude Code in `~/shortlinks-factory` and type:

```
/software-factory run --issues 1,3,8,10
```

(`/software-factory:software-factory` if you installed the plugin.) The skill is human-only (`disable-model-invocation: true`): Claude cannot start a factory on its own initiative. Watch it follow the procedure in `skills/software-factory/SKILL.md`: `doctor`, then `plan`, then a question asking for your go-ahead with the budget ceiling, then the run, then the hand-over report.

While it runs, open the repository's issue list in a browser. Watch the `factory:claimed` labels appear, then the `factory/issue-N` branches, then the pull requests.

## 3. Read a pull request like the foreman

Open one of the PRs. The body has a gate table (triage, worker self-report, verifier, reviewer), the reviewer's risk notes, and `Closes #N`. Review the diff yourself. Then, and only then:

```bash
gh pr merge <number> --repo <your-user>/shortlinks --squash
```

You pressed the button. The factory never does, and nothing in the skills or the runner can.

## 4. Score and integrate

```bash
node ~/software-factory-from-scratch/codelab/scripts/score.mjs https://github.com/<your-user>/shortlinks.git --integration factory/integration
```

Note that the integration branch is built from `main` at run time. If you merged a PR in step 3 before the integrator ran, that issue's branch merges trivially.

## 5. Trigger from GitHub Actions (optional)

Copy `.github/workflows/factory.yml` from the skills repository into your `shortlinks` repository, commit `factory.config.json` there too (with `"agent": "claude"`), add the secret `ANTHROPIC_API_KEY` (Settings > Secrets and variables > Actions), and run the workflow from the Actions tab with an issue list. The run is still started by a human (`workflow_dispatch`), runs one at a time per repository (`concurrency`), uploads its ledger as an artifact, and opens PRs without merging them.

## Checkpoint

- Issues show `factory:claimed`; PRs exist for the accepted issues; #10 has no PR.
- You merged exactly one PR by hand.

## Questions

1. What can a person watching only the GitHub UI learn about the run? What can only the ledger tell them?
2. The runner pushes with your git credentials and opens PRs with `gh`. The agents have neither. Find the two places in the code that make that true.
3. Suppose you schedule this workflow hourly instead of `workflow_dispatch`. What would you change first (claims, budgets, concurrency, notifications), and why?

Cleanup: `gh repo delete <your-user>/shortlinks --yes` when you are done (it needs the `delete_repo` scope).
