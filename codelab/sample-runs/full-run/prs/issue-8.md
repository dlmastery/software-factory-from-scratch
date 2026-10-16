# List links with cursor pagination (#8)

Branch: `factory/issue-8` -> `main`

Automated change for #8 from the software factory (run `2026-10-16T01-23-36Z-snwl`).

**Summary.** Added GET /links, routed before the /:slug redirect. It returns {items, nextCursor} in creation order, with a default limit of 20 and a cap of 100. A non-positive-integer limit returns 400 "invalid limit", and a malformed cursor returns 400 "invalid cursor". The cursor is an opaque base64url of a per-link sequence number that the store assigns and never reuses, so deleting a link between pages doesn't break paging. The last page, including an exact multiple of the limit, gets nextCursor null. New test/list-links.test.js covers the empty store, item shape and order, the 20/20/5 walk over 45 links, the exact-multiple end, clamping at 100, invalid limits, invalid cursors, deletion between pages, and that redirect and stats still work. npm test passes (14 tests).

| Gate | Result |
|---|---|
| Triage | feature: The issue gives the exact response shape, default and maximum limit, 400 body, and ordering, and the store already keeps links in creation order, so the change is small and testable. |
| Worker self-report | tests pass, tests added: yes |
| Verifier (clean copy, `npm test`) | pass |
| Reviewer | approve |

**Reviewer notes.** I read the diff and did not run anything beyond that. The verifier reported that npm test passes.

- Creation order comes from a per-store sequence number, so slugs created in the same millisecond keep their order. The cursor encodes the last item's sequence number, so deleting that link between pages does not break pagination, and a test covers this.
- Cursor validation is stricter than the issue asks: a malformed or empty `cursor=` returns 400 `{"error":"invalid cursor"}`. The issue doesn't specify this case, so it is a reasonable choice.
- Pagination state lives only in the in-memory store. This matches the existing design.
- The store's `page` method scans from the start of the map on each call, so it is O(n) per page. That is fine at this scale.

Closes #8

_A human merges this pull request. The factory never merges._
