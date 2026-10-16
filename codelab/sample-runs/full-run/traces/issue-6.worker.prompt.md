Issue #6: Links that expire
Labels: feature

Accept an optional `expiresInSeconds` on `POST /links`. It must be a positive integer; anything else returns 400 with `{"error": "invalid expiresInSeconds"}`.

Once the link is `expiresInSeconds` seconds old, `GET /:slug` returns 410 with `{"error": "expired"}` instead of redirecting, and that visit is not counted as a click. Links without the field never expire. Use the injectable clock (`createApp({ now })`) for all time checks so tests can move time forward.
---
Acceptance criteria from triage:
- POST /links accepts an optional expiresInSeconds; when absent, the link never expires and behavior is unchanged (201 as before)
- POST /links with expiresInSeconds that is not a positive integer (0, negative, fractional like 1.5, string like "60", null, NaN/non-number, boolean, array/object) returns 400 with body {"error": "invalid expiresInSeconds"} and creates no link
- POST /links with a valid positive integer expiresInSeconds returns 201 with the same response shape as before
- GET /:slug before the link is expiresInSeconds seconds old still returns 302 with the location header and increments clicks
- GET /:slug once the link is exactly expiresInSeconds seconds old (boundary: now - createdAt >= expiresInSeconds*1000) or older returns 410 with body {"error": "expired"} and no location header
- An expired visit does not increment the click count (GET /stats/<slug> clicks unchanged after expired visits)
- HEAD /:slug on an expired link also returns 410, since HEAD shares the redirect route
- All expiry checks and createdAt use the injected now() clock, not Date.now() directly, so tests can advance time
- Links without expiresInSeconds still redirect after any amount of time
- Unknown slug still returns 404 {"error": "not found"}; validation of url still returns 400 {"error": "invalid url"} (invalid url checked as before)

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.