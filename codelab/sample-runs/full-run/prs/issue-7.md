# Delete a link (#7)

Branch: `factory/issue-7` -> `main`

Automated change for #7 from the software factory (run `2026-10-16T01-23-36Z-snwl`).

**Summary.** Added DELETE /links/:slug (204 empty body if it existed, 404 {error:"not found"} otherwise, including on a repeat delete). GET /stats/:slug now returns 404 {error:"not found"} for a missing link instead of throwing a 500. Added test/delete.test.js covering delete, repeat delete, unknown slug, redirect and stats after delete, stats for an unknown slug, and that other links are unaffected. npm test passes (8 tests).

| Gate | Result |
|---|---|
| Triage | feature: Specifies exact status codes, bodies, and post-deletion behavior for a single endpoint; the store already has delete(). |
| Worker self-report | tests pass, tests added: yes |
| Verifier (clean copy, `npm test`) | pass |
| Reviewer | approve |

**Reviewer notes.** The change meets every criterion. DELETE /links/:slug returns 204 with an empty body, or 404 with {"error":"not found"}. After deletion, GET /:slug and GET /stats/:slug both return 404. I read the diff and the surrounding source but did not run npm test; the verifier reported it passing. The diff also adds a 404 guard to GET /stats/:slug. Before this change an unknown slug would have thrown and returned a 500, so that was needed. Slugs are matched without URL-decoding, as in the existing routes. HEAD and other methods on /links/:slug fall through to the 404 route. The tests also check that other links survive a delete.

Closes #7

_A human merges this pull request. The factory never merges._
