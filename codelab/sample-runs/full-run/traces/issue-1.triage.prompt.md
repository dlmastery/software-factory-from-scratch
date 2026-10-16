Issue #1: Random slugs can collide and overwrite existing links
Labels: bug

`POST /links` asks `randomSlug()` for a slug but never checks whether that slug is already taken. When the generator repeats itself, the new link silently replaces the old one, so an existing short URL starts pointing somewhere else.

Expected: creating a link must never overwrite an existing one. If the generated slug is taken, keep asking `randomSlug()` until it returns a free slug. The generator is injectable (`createApp({ randomSlug })`), so a test can force a collision.
---
Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.