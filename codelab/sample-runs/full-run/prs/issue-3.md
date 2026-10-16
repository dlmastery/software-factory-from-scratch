# GET /stats/:slug returns 500 for an unknown slug (#3)

Branch: `factory/issue-3` -> `main`

Automated change for #3 from the software factory (run `2026-10-16T01-23-36Z-snwl`).

**Summary.** GET /stats/:slug now returns 404 {"error":"not found"} for an unknown slug instead of throwing a TypeError and returning 500. This is the same response the redirect route gives. I added test/stats.test.js. One test checks the unknown-slug 404 and compares it with the redirect route's response. The other checks that an existing slug still returns { slug, url, clicks, createdAt } with the same values. npm test passes (7/7).

| Gate | Result |
|---|---|
| Triage | bug: Names the exact status code and body for an unknown slug on GET /stats/:slug, mirroring the existing redirect route's 404 response. |
| Worker self-report | tests pass, tests added: yes |
| Verifier (clean copy, `npm test`) | pass |
| Reviewer | approve |

**Reviewer notes.** The fix is a one-line guard in the stats route. It returns 404 with {"error":"not found"}, the same status and body as the redirect route. The store is a Map, so slugs like "constructor" or "__proto__" can't produce a false hit. The tests check the unknown-slug 404 against the redirect route's response, and they check that the existing-slug response is unchanged. I did not run npm test myself. I relied on the verifier's PASS. The stats route still handles only GET, as before.

Closes #3

_A human merges this pull request. The factory never merges._
