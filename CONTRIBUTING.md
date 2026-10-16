# Contributing

Contributions that make the factory more correct, more teachable, or easier to extend are welcome.

## Ground rules

1. **Gates are not negotiable.** No change may let agents merge, push, read secrets, skip the verifier, or bypass the reviewer. Changes that loosen a gate need a very good reason, discussed in an issue first.
2. **Orchestration lives in code, judgment lives in skills.** If a rule must hold every time, enforce it in the runner (`skills/software-factory/scripts/lib/`). If it needs judgment, write it into the stage skill.
3. **Zero runtime dependencies.** The runner uses only Node 22 built-ins, so students can run it anywhere without an install step.
4. **Evidence for behavior changes.** For changes to stage skills, include the trace excerpt that motivated it and, ideally, before/after numbers from a codelab run.

## Before opening a pull request

```bash
npm test                 # unit tests + fake-agent end-to-end runs
npm run test:practice    # the practice app's own tests
npm run check:hidden     # every hidden test fails on the starting app and passes on the reference
```

All three run in CI on Linux, macOS and Windows.

## Adding things

- **A stage, sandbox backend or issue source:** see "Extending" in [docs/architecture.md](docs/architecture.md).
- **A codelab lab:** follow the existing shape: goal, steps with exact commands, checkpoint, questions, stretch. Keep Labs 0 to 5 free to run (fake agent).
- **A skill:** folder name equals the `name` in its frontmatter; the description says what it does and when to use it (the unit tests check both).
