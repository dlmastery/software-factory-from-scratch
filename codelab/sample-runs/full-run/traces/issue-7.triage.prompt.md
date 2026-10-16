Issue #7: Delete a link
Labels: feature

Add `DELETE /links/:slug`.

- 204 with an empty body when the link existed.
- 404 with `{"error": "not found"}` otherwise.
- After deletion, `GET /:slug` and `GET /stats/:slug` both return 404.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.