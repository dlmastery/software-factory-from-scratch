Issue #3: GET /stats/:slug returns 500 for an unknown slug
Labels: bug

Requesting stats for a slug that does not exist crashes the handler and returns 500.

Expected: 404 with `{"error": "not found"}`, the same response the redirect route gives for an unknown slug.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.