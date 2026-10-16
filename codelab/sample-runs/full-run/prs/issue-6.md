# Links that expire (#6)

Branch: `factory/issue-6` -> `main`

Automated change for #6 from the software factory (run `2026-10-16T01-23-36Z-snwl`).

**Summary.** POST /links now accepts an optional expiresInSeconds. It must be a positive integer, otherwise the response is 400 {"error":"invalid expiresInSeconds"} and no link is created. GET and HEAD /:slug return 410 {"error":"expired"} once now() - createdAt >= expiresInSeconds*1000, and that visit is not counted as a click. All time checks use the injected now(). Added test/expiry.test.js covering invalid values, the valid 201 shape, the exact boundary, HEAD, clicks unchanged after expired visits, and links without the field never expiring. npm test passes (9 tests).

| Gate | Result |
|---|---|
| Triage | feature: Specifies exact validation, status codes, bodies, and click-counting behavior, with an injectable clock already in createApp, so it is a bounded, testable change. |
| Worker self-report | tests pass, tests added: yes |
| Verifier (clean copy, `npm test`) | pass |
| Reviewer | approve |

**Reviewer notes.** I read the diff and src/store.js and did not run npm test myself. The verifier reported a pass. Validation uses Number.isInteger, so 0, negatives, floats, strings, null and booleans all return 400. Expiry is checked with ctx.now() and the boundary is inclusive (age >= expiresInSeconds*1000), which matches "once the link is N seconds old". The expiry check comes before the click increment, so expired visits are not counted. The tests cover the boundary, HEAD requests and the no-expiry case. Very large integers such as 1e300 are accepted and simply never expire. Other endpoints, such as /stats and the link list, still show expired links, which the issue did not ask to change.

Closes #6

_A human merges this pull request. The factory never merges._
