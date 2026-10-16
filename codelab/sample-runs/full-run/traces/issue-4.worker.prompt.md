Issue #4: HEAD requests are counted as clicks
Labels: bug

Link previewers and uptime checkers send `HEAD` requests, and every one of them increments the click counter.

Expected: `HEAD /:slug` still answers 302 with the `Location` header, but it does not count as a click. Only `GET` counts.
---
Acceptance criteria from triage:
- HEAD /:slug for an existing slug returns 302 with the Location header set to the stored URL
- HEAD /:slug does not increment the link's click count (GET /stats/:slug clicks unchanged afterwards)
- GET /:slug still returns 302 with Location and increments clicks by 1 per request
- Mixed sequence: after one GET and one HEAD, stats show clicks === 1
- HEAD /:unknown-slug still returns 404
- Existing tests continue to pass

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.