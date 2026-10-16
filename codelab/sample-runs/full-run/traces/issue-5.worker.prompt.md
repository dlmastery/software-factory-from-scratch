Issue #5: Support custom slugs
Labels: feature

Let callers choose their slug: `POST /links` with `{"url": "...", "slug": "my-launch"}`.

- A custom slug must match `^[a-z0-9-]{3,32}$`; otherwise return 400 with `{"error": "invalid slug"}`.
- If the slug is already taken, return 409 with `{"error": "slug taken"}` and leave the existing link untouched.
- Without `slug`, keep generating a random one as today.
- The response is the usual `201 { slug, url, shortUrl }`.
---
Acceptance criteria from triage:
- POST /links with {url, slug: "my-launch"} returns 201 with {slug: "my-launch", url, shortUrl: "/my-launch"}
- The created custom-slug link redirects (GET /my-launch -> 302 to url)
- A slug not matching ^[a-z0-9-]{3,32}$ returns 400 with {"error": "invalid slug"} (e.g. uppercase, underscore, spaces, 2 chars, 33 chars, empty string)
- Boundary lengths 3 and 32 chars are accepted
- A non-string slug (number, null, object) returns 400 {"error": "invalid slug"}
- If the slug already exists, return 409 with {"error": "slug taken"} and the existing link's url, clicks and createdAt are unchanged
- Without a slug field, a random slug is generated via randomSlug as before and returns 201
- An invalid url still returns 400 {"error": "invalid url"}; the url check takes precedence over the slug check
- A taken slug does not create a second link or overwrite the original url

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.