Issue #3: GET /stats/:slug returns 500 for an unknown slug
Labels: bug

Requesting stats for a slug that does not exist crashes the handler and returns 500.

Expected: 404 with `{"error": "not found"}`, the same response the redirect route gives for an unknown slug.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.