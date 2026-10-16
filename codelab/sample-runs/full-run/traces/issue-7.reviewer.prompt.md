Issue #7: Delete a link
Labels: feature

Add `DELETE /links/:slug`.

- 204 with an empty body when the link existed.
- 404 with `{"error": "not found"}` otherwise.
- After deletion, `GET /:slug` and `GET /stats/:slug` both return 404.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.