Issue #9: Rate limit link creation per client
Labels: feature

One client can create unlimited links. Limit `POST /links` to 10 requests per minute per client IP address (the socket's remote address).

- The 11th request inside a 60-second window returns 429 with `{"error": "rate limited"}` and a `retry-after` header holding the whole number of seconds until the window frees up.
- Redirects, stats and every other route are not rate limited.
- The limiter state belongs to one app instance (`createApp()` call) and uses the injectable clock (`createApp({ now })`).
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.