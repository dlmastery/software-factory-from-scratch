Issue #6: Links that expire
Labels: feature

Accept an optional `expiresInSeconds` on `POST /links`. It must be a positive integer; anything else returns 400 with `{"error": "invalid expiresInSeconds"}`.

Once the link is `expiresInSeconds` seconds old, `GET /:slug` returns 410 with `{"error": "expired"}` instead of redirecting, and that visit is not counted as a click. Links without the field never expire. Use the injectable clock (`createApp({ now })`) for all time checks so tests can move time forward.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.