Issue #8: List links with cursor pagination
Labels: feature

Add `GET /links`, which returns `{"items": [...], "nextCursor": string | null}`. Each item is `{ slug, url, clicks, createdAt }`.

- Items come back in creation order, oldest first.
- `?limit=` sets the page size: default 20, maximum 100. A limit above 100 is treated as 100; a limit that is not a positive integer returns 400 with `{"error": "invalid limit"}`.
- `?cursor=` takes the `nextCursor` from the previous page. The last page has `nextCursor: null`.
- Walking every page returns every link exactly once.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.