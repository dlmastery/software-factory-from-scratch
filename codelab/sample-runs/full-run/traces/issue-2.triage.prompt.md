Issue #2: URLs without an http(s) scheme are accepted
Labels: bug, security

`POST /links` with `{"url": "example.com"}` returns 201, and the redirect then sends `Location: example.com`, which browsers treat as a relative path. Worse, `javascript:alert(1)` is accepted too.

Expected: only absolute `http:` and `https:` URLs are accepted. Anything else (no scheme, `javascript:`, `ftp:`, `data:`, `file:`) returns 400 with `{"error": "invalid url"}`.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.