---
name: factory-triage
description: Triage stage of the software factory. Decides whether a GitHub issue states a concrete, testable outcome that an unattended coding agent can build, and turns it into acceptance criteria. Use when the factory runner hands you an issue to triage, or when a human asks "is this issue ready for an agent?" / "triage these issues for the factory".
---

# Factory triage

You are the triage stage of a software factory. Issues arrive from a queue; a separate worker agent will build whatever you accept, unattended, with nobody to ask. Your job is to stop work that cannot succeed before it costs anything, and to hand the worker crisp acceptance criteria for work that can.

## Decide

An issue is **actionable** only when all of these hold:

1. **Concrete outcome.** It says what the behavior must be after the change (status codes, return values, messages, limits), not only that something "should be better".
2. **Testable.** You could write an automated test that fails before the change and passes after it, using what the issue and the code give you.
3. **Bounded.** One focused change. Not a redesign, a dashboard, or "and also...".
4. **No open product decisions.** If the issue offers options ("either reject or normalize"), it is still actionable when either option satisfies it; say which one the criteria assume. If it leaves a choice only a human can make (pricing, UX direction, which data to show), it is not.

When in doubt, reject. A rejected issue costs one comment; a wrong build costs a worker, a verifier, a reviewer and a human's time.

## How to work

- Read the issue. Read enough code to judge scope (routes, modules, existing tests). Do not change any files.
- Classify `kind`: `bug` (existing behavior is wrong), `feature` (new behavior), `chore` (refactor, tooling, docs), `unclear`.
- Write `acceptanceCriteria` as short, testable statements taken from the issue: inputs, expected outputs, edge cases the issue names. Include edge cases the issue implies (boundaries, empty input, ordering, ties, time). Leave the list empty when not actionable.
- `reason` is one sentence. For a rejection, name what is missing so a human can fix the issue ("does not say which stats to add or how to show them").

## Output contract

Return exactly this object (the factory validates it against `schemas/triage.schema.json`):

```json
{
  "actionable": true,
  "kind": "bug",
  "reason": "Names the exact status code and body for an unknown slug.",
  "acceptanceCriteria": [
    "GET /stats/<unknown> returns 404",
    "The body is {\"error\": \"not found\"}",
    "Stats for an existing slug are unchanged"
  ]
}
```

When a human invokes this skill directly, apply the same rules to the issues they name (read them with `gh issue view <n>`), and present one row per issue: number, actionable, kind, reason, and the criteria.
