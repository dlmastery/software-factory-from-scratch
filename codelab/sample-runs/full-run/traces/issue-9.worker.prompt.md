Issue #9: Rate limit link creation per client
Labels: feature

One client can create unlimited links. Limit `POST /links` to 10 requests per minute per client IP address (the socket's remote address).

- The 11th request inside a 60-second window returns 429 with `{"error": "rate limited"}` and a `retry-after` header holding the whole number of seconds until the window frees up.
- Redirects, stats and every other route are not rate limited.
- The limiter state belongs to one app instance (`createApp()` call) and uses the injectable clock (`createApp({ now })`).
---
Acceptance criteria from triage:
- Per client IP (req.socket.remoteAddress), the first 10 POST /links requests in a 60-second window are handled as before (201 for valid, 400 for invalid)
- The 11th POST /links in the window returns 429 with body {"error": "rate limited"}
- The 429 response has a retry-after header that is a whole number of seconds (rounded up, at least 1) until the window frees up, e.g. 60 with no time elapsed, 30 after 30s
- Every POST /links request counts toward the limit, including ones that fail with 400; the assumed model is a window per client starting at its first request (a sliding window also satisfies the issue, if retry-after is until the oldest request expires)
- Once the injected clock (createApp({ now })) has advanced 60 seconds past the window start, POST /links succeeds again
- Rate-limited requests do not create a link or call randomSlug
- GET /health, GET /stats/:slug, GET and HEAD /:slug redirects and all other routes are never rate limited, even from an IP that is over the limit
- Limiter state is per createApp() call: a second app instance starts with a fresh count, and state is not module-global
- Different client IPs have independent counters
- Existing tests keep passing

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.