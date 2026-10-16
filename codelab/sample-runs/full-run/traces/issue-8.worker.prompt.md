Issue #8: List links with cursor pagination
Labels: feature

Add `GET /links`, which returns `{"items": [...], "nextCursor": string | null}`. Each item is `{ slug, url, clicks, createdAt }`.

- Items come back in creation order, oldest first.
- `?limit=` sets the page size: default 20, maximum 100. A limit above 100 is treated as 100; a limit that is not a positive integer returns 400 with `{"error": "invalid limit"}`.
- `?cursor=` takes the `nextCursor` from the previous page. The last page has `nextCursor: null`.
- Walking every page returns every link exactly once.
---
Acceptance criteria from triage:
- GET /links returns 200 with {"items": [...], "nextCursor": string|null}
- Each item is exactly { slug, url, clicks, createdAt }
- Items are in creation order, oldest first
- With no ?limit, the page has at most 20 items
- ?limit=N with 1<=N<=100 returns at most N items
- ?limit above 100 (e.g. 101 or 1000) is treated as 100
- ?limit=0, a negative number, a non-numeric value, a decimal (1.5) or an empty value returns 400 with {"error": "invalid limit"}
- ?cursor= set to the previous page's nextCursor returns the next page, continuing right after the last item of the previous page
- The last page has nextCursor: null; when the total number of links is an exact multiple of the limit, the final page must still end with nextCursor: null (no extra empty page needed, or if one occurs its nextCursor is null)
- An empty store returns {"items": [], "nextCursor": null}
- Walking every page by following nextCursor returns every link exactly once, with no duplicates or gaps, for example 45 links at limit=20 gives pages of 20, 20 and 5
- Existing POST /links, GET /stats/:slug and redirect behavior are unchanged. GET /links must be routed before the /:slug redirect pattern, which cannot match it today because it has a single path segment, and it must not be shadowed by it
- Assumption for unspecified cases: the cursor is opaque to clients. A malformed or unknown cursor returns 400 with {"error": "invalid cursor"}. The worker should keep the cursor stable if a link is deleted between pages, for example by encoding a position or createdAt-based marker rather than relying on a slug that may be gone.

Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: npm test
Shell commands you may run (one plain command per call): npm, npx, node, git diff, git status, ls. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.