Issue #4: HEAD requests are counted as clicks
Labels: bug

Link previewers and uptime checkers send `HEAD` requests, and every one of them increments the click counter.

Expected: `HEAD /:slug` still answers 302 with the `Location` header, but it does not count as a click. Only `GET` counts.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.