Issue #1: Random slugs can collide and overwrite existing links
Labels: bug

`POST /links` asks `randomSlug()` for a slug but never checks whether that slug is already taken. When the generator repeats itself, the new link silently replaces the old one, so an existing short URL starts pointing somewhere else.

Expected: creating a link must never overwrite an existing one. If the generated slug is taken, keep asking `randomSlug()` until it returns a free slug. The generator is injectable (`createApp({ randomSlug })`), so a test can force a collision.
---
The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/main...HEAD
The factory's verifier already ran `npm test` on a clean copy of this branch: PASS.
Shell commands you may run (one plain command per call): git diff, git log, git show, npm test, node.
Review the change. Do not modify any files.