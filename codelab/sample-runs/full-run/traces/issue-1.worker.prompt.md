Issue #1: Random slugs can collide and overwrite existing links
Labels: bug

`POST /links` asks `randomSlug()` for a slug but never checks whether that slug is already taken. When the generator repeats itself, the new link silently replaces the old one, so an existing short URL starts pointing somewhere else.

Expected: creating a link must never overwrite an existing one. If the generated slug is taken, keep asking `randomSlug()` until it returns a free slug. The generator is injectable (`createApp({ randomSlug })`), so a test can force a collision.
---
Acceptance criteria from triage:
- POST /links calls randomSlug() and, while store.has(slug) is true, calls it again until it returns an unused slug
- With an injected randomSlug returning e.g. 'aaa', 'aaa', 'bbb', creating two links yields slugs 'aaa' and 'bbb' (second POST returns 201 with slug 'bbb' and shortUrl '/bbb')
- After a forced collision, GET /aaa still redirects to the first link's URL and GET /stats/aaa shows the original url, clicks and createdAt unchanged
- The new link is stored under the free slug and its stats are retrievable via GET /stats/bbb
- Without a collision, behavior is unchanged: one randomSlug() call, 201 { slug, url, shortUrl }
- Invalid URL still returns 400 { error: "invalid url" } and does not call randomSlug()

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.