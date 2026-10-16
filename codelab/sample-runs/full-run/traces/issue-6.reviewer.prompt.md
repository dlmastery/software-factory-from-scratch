Issue #6: Links that expire
Labels: feature

Accept an optional `expiresInSeconds` on `POST /links`. It must be a positive integer; anything else returns 400 with `{"error": "invalid expiresInSeconds"}`.

Once the link is `expiresInSeconds` seconds old, `GET /:slug` returns 410 with `{"error": "expired"}` instead of redirecting, and that visit is not counted as a click. Links without the field never expire. Use the injectable clock (`createApp({ now })`) for all time checks so tests can move time forward.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.