# Support custom slugs (#5)

Branch: `factory/issue-5` -> `main`

Automated change for #5 from the software factory (run `2026-10-16T01-23-36Z-snwl`).

**Summary.** POST /links now accepts an optional `slug`. A slug that isn't a string or doesn't match ^[a-z0-9-]{3,32}$ gets 400 {error:"invalid slug"}. A slug that already exists gets 409 {error:"slug taken"}, and the existing link is not touched. Without `slug`, randomSlug is used as before. The url check runs first. test/custom-slug.test.js covers the criteria. The "url check takes precedence" test uses an empty url, because the existing isValidUrl only rejects empty or non-string values. `npm test` passes (11 tests). Reserved routes like "health" and "stats" aren't blocked as slugs, since the issue doesn't ask for it.

| Gate | Result |
|---|---|
| Triage | feature: Issue specifies the slug regex, exact status codes and bodies for invalid and taken slugs, and unchanged behavior without a slug, all within the single POST /links handler. |
| Worker self-report | tests pass, tests added: yes |
| Verifier (clean copy, `npm test`) | pass |
| Reviewer | approve |

**Reviewer notes.** I read the diff and the surrounding code. I did not run the tests myself; the verifier's PASS is the only test evidence.

The change meets every criterion:
- A custom slug is validated against `^[a-z0-9-]{3,32}$`, and non-string values such as null, numbers and objects return 400 `invalid slug`.
- A taken slug returns 409 `slug taken`, checked before `store.set`, so the existing link is not overwritten.
- Without `slug`, a random one is generated as before.
- The success response is unchanged.

The tests cover the boundary lengths 3 and 32, bad types, and the 409 case. The 409 test checks that the original link's url, clicks and createdAt are unchanged.

Edge cases not covered:
- The custom slug `health` is valid but unreachable, because `GET /health` is matched before the redirect route. A reserved-word check would fix it, but the issue doesn't ask for one.
- A randomly generated slug can still collide with an existing custom slug and overwrite it. The code has no collision check on that path, and it behaves the same as before this change.

Closes #5

_A human merges this pull request. The factory never merges._
