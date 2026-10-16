Issue #7: Delete a link
Labels: feature

Add `DELETE /links/:slug`.

- 204 with an empty body when the link existed.
- 404 with `{"error": "not found"}` otherwise.
- After deletion, `GET /:slug` and `GET /stats/:slug` both return 404.
---
Acceptance criteria from triage:
- DELETE /links/:slug for an existing slug returns 204 with an empty body
- DELETE /links/:slug for an unknown slug returns 404 with body {"error": "not found"}
- Deleting the same slug a second time returns 404 {"error": "not found"}
- After deletion, GET /:slug returns 404 {"error": "not found"}
- After deletion, GET /stats/:slug returns 404 {"error": "not found"} (currently the stats route throws a 500 on a missing link, so it needs a not-found check)
- GET /stats/<unknown slug> returns 404 {"error": "not found"} rather than 500
- Other links and their stats are unaffected by a deletion
- Existing routes (POST /links, GET /health, redirect, stats for existing slug) keep their behavior

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.