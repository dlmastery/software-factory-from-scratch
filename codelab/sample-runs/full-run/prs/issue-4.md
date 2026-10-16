# HEAD requests are counted as clicks (#4)

Branch: `factory/issue-4` -> `main`

Automated change for #4 from the software factory (run `2026-10-16T01-23-36Z-snwl`).

**Summary.** The redirect handler in src/app.js now increments clicks only for GET. HEAD still answers 302 with Location, and unknown slugs still return 404. Added test/head.test.js covering HEAD with no click counted, a GET plus HEAD sequence giving clicks === 1, and HEAD on an unknown slug returning 404. npm test passes (8 tests).

| Gate | Result |
|---|---|
| Triage | bug: The issue states exact expected behavior (HEAD still 302 + Location, no click increment), and the fix is a small, testable change in the redirect handler in src/app.js. |
| Worker self-report | tests pass, tests added: yes |
| Verifier (clean copy, `npm test`) | pass |
| Reviewer | approve |

**Reviewer notes.** The change is minimal. src/app.js now increments clicks only for GET, and HEAD still gets the 302 with a Location header. The only other place clicks is touched is the stats endpoint, which just reads it. The new tests cover three cases: HEAD leaves the count at 0, one GET plus one HEAD gives exactly 1, and HEAD on an unknown slug gives 404. I did not run the tests myself; the verifier reported a pass. No existing tests were weakened.

Closes #4

_A human merges this pull request. The factory never merges._
