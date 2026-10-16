Issue #3: GET /stats/:slug returns 500 for an unknown slug
Labels: bug

Requesting stats for a slug that does not exist crashes the handler and returns 500.

Expected: 404 with `{"error": "not found"}`, the same response the redirect route gives for an unknown slug.
---
Acceptance criteria from triage:
- GET /stats/<unknown-slug> returns status 404
- The response body is {"error": "not found"}
- The response is identical to the redirect route's response for an unknown slug
- GET /stats/<existing-slug> still returns { slug, url, clicks, createdAt } with unchanged values
- Add a test covering the unknown-slug stats case

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Make it pass before you report. Do not commit; the factory commits for you.