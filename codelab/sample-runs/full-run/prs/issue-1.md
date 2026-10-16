# Random slugs can collide and overwrite existing links (#1)

Branch: `factory/issue-1` -> `main`

Automated change for #1 from the software factory (run `2026-10-16T01-23-36Z-snwl`).

**Summary.** POST /links now keeps calling randomSlug() while store.has(slug) is true, so an existing link is never overwritten. The change is a single line in src/app.js. New test/slug-collision.test.js forces collisions with 'aaa','aaa','bbb'. It checks the second POST returns 201 with slug 'bbb' and shortUrl '/bbb'. It checks /aaa and /stats/aaa still show the original link, and /stats/bbb shows the new one. It also checks that randomSlug is called once without a collision and not at all for an invalid URL (400). npm test passes (8/8).

| Gate | Result |
|---|---|
| Triage | bug: Names the exact fix (retry randomSlug() until store.has(slug) is false) in POST /links, with an injectable generator for a collision test. |
| Worker self-report | tests pass, tests added: yes |
| Verifier (clean copy, `npm test`) | pass |
| Reviewer | approve |

**Reviewer notes.** The fix is a loop in src/app.js that calls randomSlug() again while store.has(slug) is true. store.has already existed. The check and the set run synchronously with no await between them, so two concurrent requests can't pick the same slug. If a custom randomSlug never returns a free slug, the loop never ends. The issue asks for exactly this behaviour, so I'm not treating it as a defect. The new tests force a collision, check that the original link is unchanged, and check that randomSlug is called once when there is no collision and not at all for an invalid URL.

Closes #1

_A human merges this pull request. The factory never merges._
