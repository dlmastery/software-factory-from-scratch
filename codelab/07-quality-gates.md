# Lab 7: Quality gates and hidden tests

**Goal:** measure the factory's output against tests the agents never saw, understand what each gate catches, and study the trap that only a reviewer caught in the video.

![Quality gates](../infographics/06-quality-gates.png)

**Requires:** the branches from your real Lab 6 run (`factory/issue-1` ... `factory/issue-9` built by Claude agents). Fake-agent branches contain no code changes, so sections 2 and 3 have nothing to look at. If you skipped Lab 6, run at least `node "$SF" release --issues 8 && node "$SF" run --yes --agent claude --issues 8` first (about $0.30).

## 1. Score your run against the hidden tests

```bash
cd ~/factory-lab
node ~/software-factory-from-scratch/codelab/scripts/score.mjs shortlinks.git --integration factory/integration
```

For each `factory/issue-N` branch, `score.mjs` clones it fresh, copies in `hidden-tests/hNN.test.js` and runs it. The agents never saw these files. They check exactly what each issue says, including edge cases a hurried implementation skips: `//example.com` and `file:` URLs (#2), expiry exactly at the deadline (#6), a limit of `2.5` (#8), `retry-after` within 1 to 60 (#9).

Hidden tests measure what the factory actually delivered, independent of what its own gates said.

## 2. The ordering trap (issue #8)

Read `hidden-tests/h08.test.js`. It creates seven links **in the same millisecond** (`now: () => 1_700_000_000_000`) with slugs that are **not** in alphabetical order: `zulu01, alpha2, mike03, ...`. Then it pages through `GET /links?limit=3`.

An implementation that sorts by `createdAt` and breaks ties by slug returns `alpha2, bravo4, echo06, ...`. That is wrong, yet it passes any test whose slugs happen to be generated in sorted order, or whose clock moves between creations. That is exactly what happened in the video's rehearsal run: worker tests, verifier and hidden test all passed, and only the reviewer rejected the change.

Look at how your #8 worker kept creation order:

```bash
git --git-dir=shortlinks.git diff main factory/issue-8 -- src/
```

In the reference run (`sample-runs/full-run/`), the reviewer's notes for #8 begin: *"Creation order comes from a per-store sequence number, so slugs created in the same millisecond keep..."*. It checked exactly this case. Now read the reviewer contract's step 4, "Hunt for what tests miss", in `skills/factory-reviewer/SKILL.md`: ordering and ties come first.

## 3. Plant the bug and see who catches it

Make a branch that has the bug, then put it through the verifier and a reviewer:

```bash
git clone -q shortlinks.git trap && cd trap
git checkout -q -b factory/issue-8-trap origin/factory/issue-8
```

Find where the `GET /links` route collects the links, before it slices out a page. It reads all links in creation order, often `store.all()` or a list kept by the store (`grep -n "all()" src/*.js` helps). Sort that list with the "obvious" comparator:

```js
.sort((a, b) => a.createdAt - b.createdAt || a.slug.localeCompare(b.slug))
```

That is: by creation time, ties broken by slug. Then:

```bash
npm test                                   # the worker's own tests: do they still pass?
git commit -qam "trap: sort ties by slug" && git push -q origin factory/issue-8-trap && cd ..
node ~/software-factory-from-scratch/skills/factory-verifier/scripts/verify-branch.mjs shortlinks.git factory/issue-8-trap --test "npm test"
```

Then ask a reviewer. In Claude Code, inside `trap/`, run `/factory-reviewer` and ask it to review `factory/issue-8-trap` against `main` for issue #8. Finally, run the hidden test:

```bash
cd trap && mkdir -p hidden-test && cp ~/software-factory-from-scratch/codelab/hidden-tests/h08.test.js hidden-test/ && node --test hidden-test/h08.test.js ; cd ..
```

Record which of the three caught it: the worker's tests, the reviewer, the hidden test.

## 4. What does the reviewer buy? (optional, ~$1)

```bash
node "$SF" release --issues 5,6,8,9
node "$SF" run --yes --issues 5,6,8,9 --no-review --no-integrate
node ~/software-factory-from-scratch/codelab/scripts/score.mjs shortlinks.git
```

On a small, well-specified app, the workers often pass the hidden tests without review. That is a real result: the reviewer's value grows with how subtle the code is and how weak the tests are. It is also why the factory keeps both gates: you do not know in advance which change is the subtle one.

Clean up the experiment (from `~/factory-lab`):

```bash
rm -rf trap
git --git-dir=shortlinks.git branch -D factory/issue-8-trap
```

## Checkpoint

- You have a hidden-test score for every branch and for the integration branch.
- For the planted bug, you know which gate caught it and which did not.

## Questions

1. The verifier runs the repository's tests. The hidden tests are better tests. What is the cheapest way to make the factory's own gates closer to the hidden tests? (Think about which file to improve, not which prompt.)
2. Why is a reviewer that **cannot modify files** more trustworthy than one that can?
3. The video's summary: "quality remains a function of the existing test suite and the reviewer's attention." Agree or disagree, with one example from your runs.
