Issue #5: Support custom slugs
Labels: feature

Let callers choose their slug: `POST /links` with `{"url": "...", "slug": "my-launch"}`.

- A custom slug must match `^[a-z0-9-]{3,32}$`; otherwise return 400 with `{"error": "invalid slug"}`.
- If the slug is already taken, return 409 with `{"error": "slug taken"}` and leave the existing link untouched.
- Without `slug`, keep generating a random one as today.
- The response is the usual `201 { slug, url, shortUrl }`.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.