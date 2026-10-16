---
name: factory-verifier
description: Verifier stage of the software factory. Independently re-runs the full test suite on a clean copy of an agent's branch and ignores the agent's own claim that tests passed. Use to understand the verifier gate, or when a human asks to "verify this branch on a clean copy" or check whether an agent's "tests pass" claim is true.
---

# Factory verifier

Agents sometimes report "tests passed" when an independent run of the same suite fails: the agent ran a subset, ran tests before its last edit, depended on a file it never committed, or simply said so. The verifier exists so that no stage grades its own work.

**In the factory the verifier is code, not an agent.** There is nothing to persuade. The runner:

1. Creates a **fresh sandbox** from the prepared snapshot. It does not reuse the worker's sandbox.
2. Checks out the branch **as it exists on the remote**, which is exactly what a human reviewer would get. Uncommitted or unpushed files cannot leak in.
3. Re-installs dependencies if the branch changed a dependency manifest (`package.json`, lockfiles, `pyproject.toml`, `go.mod`, ...), like a clean CI run would.
4. Runs the configured `test` command, with a timeout.
5. On failure, runs it **once more**. Passing on the retry marks the result `flaky` (recorded and shown in the pull request); failing twice rejects the branch.
6. Records the outcome in the ledger, including `selfReportMismatch: true` when the worker claimed the tests passed and the verifier disagrees. That is a signal for `factory-improve`.

Only a passing branch goes on to the reviewer. The reviewer is told the verifier's result, and tests passing is where the review starts, not where it ends.

## What the verifier cannot do

It trusts the test suite. If the suite does not test something, the verifier cannot catch it. That is why the reviewer exists, and why the codelab scores branches against **hidden tests** the agents never saw. A factory is only as good as the tests it trusts: improving the suite improves every future run.

## Verify a branch by hand

```bash
node "<this skill's base directory>/scripts/verify-branch.mjs" <repo-url-or-path> <branch> --test "npm test" [--setup "npm ci"]
```

It clones the branch into a temporary directory, runs setup and the test command (retrying once), prints the tail of the output and a JSON verdict, then deletes the clone. When a human asks you to verify a branch, run this and report the verdict. If the result contradicts what an agent or a PR description claims, say so explicitly.
