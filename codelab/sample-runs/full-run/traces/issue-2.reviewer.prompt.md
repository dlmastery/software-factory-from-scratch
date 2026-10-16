Issue #2: URLs without an http(s) scheme are accepted
Labels: bug, security

`POST /links` with `{"url": "example.com"}` returns 201, and the redirect then sends `Location: example.com`, which browsers treat as a relative path. Worse, `javascript:alert(1)` is accepted too.

Expected: only absolute `http:` and `https:` URLs are accepted. Anything else (no scheme, `javascript:`, `ftp:`, `data:`, `file:`) returns 400 with `{"error": "invalid url"}`.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.