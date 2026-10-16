Issue #4: HEAD requests are counted as clicks
Labels: bug

Link previewers and uptime checkers send `HEAD` requests, and every one of them increments the click counter.

Expected: `HEAD /:slug` still answers 302 with the `Location` header, but it does not count as a click. Only `GET` counts.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.