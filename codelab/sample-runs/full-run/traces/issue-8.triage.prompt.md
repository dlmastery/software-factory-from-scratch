Issue #8: List links with cursor pagination
Labels: feature

Add `GET /links`, which returns `{"items": [...], "nextCursor": string | null}`. Each item is `{ slug, url, clicks, createdAt }`.

- Items come back in creation order, oldest first.
- `?limit=` sets the page size: default 20, maximum 100. A limit above 100 is treated as 100; a limit that is not a positive integer returns 400 with `{"error": "invalid limit"}`.
- `?cursor=` takes the `nextCursor` from the previous page. The last page has `nextCursor: null`.
- Walking every page returns every link exactly once.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.