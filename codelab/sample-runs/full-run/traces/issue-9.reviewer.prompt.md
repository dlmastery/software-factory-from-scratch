Issue #9: Rate limit link creation per client
Labels: feature

One client can create unlimited links. Limit `POST /links` to 10 requests per minute per client IP address (the socket's remote address).

- The 11th request inside a 60-second window returns 429 with `{"error": "rate limited"}` and a `retry-after` header holding the whole number of seconds until the window frees up.
- Redirects, stats and every other route are not rate limited.
- The limiter state belongs to one app instance (`createApp()` call) and uses the injectable clock (`createApp({ now })`).
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.