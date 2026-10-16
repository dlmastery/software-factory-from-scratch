Issue #5: Support custom slugs
Labels: feature

Let callers choose their slug: `POST /links` with `{"url": "...", "slug": "my-launch"}`.

- A custom slug must match `^[a-z0-9-]{3,32}$`; otherwise return 400 with `{"error": "invalid slug"}`.
- If the slug is already taken, return 409 with `{"error": "slug taken"}` and leave the existing link untouched.
- Without `slug`, keep generating a random one as today.
- The response is the usual `201 { slug, url, shortUrl }`.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.