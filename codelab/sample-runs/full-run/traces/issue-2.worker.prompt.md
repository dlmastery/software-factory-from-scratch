Issue #2: URLs without an http(s) scheme are accepted
Labels: bug, security

`POST /links` with `{"url": "example.com"}` returns 201, and the redirect then sends `Location: example.com`, which browsers treat as a relative path. Worse, `javascript:alert(1)` is accepted too.

Expected: only absolute `http:` and `https:` URLs are accepted. Anything else (no scheme, `javascript:`, `ftp:`, `data:`, `file:`) returns 400 with `{"error": "invalid url"}`.
---
Acceptance criteria from triage:
- POST /links with {"url":"https://example.com/docs"} still returns 201
- POST /links with {"url":"http://example.com"} returns 201
- POST /links with {"url":"example.com"} returns 400 with body {"error":"invalid url"}
- POST /links with {"url":"javascript:alert(1)"} returns 400 with {"error":"invalid url"}
- POST /links with ftp:, data:, and file: URLs each return 400 with {"error":"invalid url"}
- Empty string, missing, and non-string url values still return 400 {"error":"invalid url"}
- Scheme check is case-insensitive (e.g. HTTPS://example.com is accepted, JavaScript:alert(1) is rejected)
- Rejected URLs are not stored (no link is created)

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.