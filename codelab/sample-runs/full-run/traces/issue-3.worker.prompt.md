Issue #3: GET /stats/:slug returns 500 for an unknown slug
Labels: bug

Requesting stats for a slug that does not exist crashes the handler and returns 500.

Expected: 404 with `{"error": "not found"}`, the same response the redirect route gives for an unknown slug.
---
Acceptance criteria from triage:
- GET /stats/<unknown slug> returns status 404
- The response body is {"error": "not found"}
- The response is the same as the redirect route gives for an unknown slug
- GET /stats/<existing slug> still returns { slug, url, clicks, createdAt } with unchanged values
- Stats requests for an unknown slug do not throw or return 500
- Add a test covering the unknown-slug 404 case

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.