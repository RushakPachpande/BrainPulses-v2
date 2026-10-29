# Agent notes — BrainPulses v2.0

This file is for AI agents working in this repo. Prefer project rules under `.cursor/rules/` when they conflict with generic advice.

## Workspace

Open **only** `BrainPulses v2.0` as the folder workspace. Do not add `references/` as a second workspace root; that splits chat history. `references/` stays on disk under this project and is readable via Read, Grep, and Glob when `.cursorignore` allows it.

## Referencing other products

`references/` is **read-only**. It is gitignored and must not be committed. Do not copy ports, env layout, Prisma trees, or UI wholesale into this app. Use it for ideas, then implement with this repo’s stack and conventions.

When the user says **refer**, **look at**, **from**, or **like** one of these, search and read **only** the matching folder:

| User says | Path |
| --- | --- |
| PGDM, DISHA, Induction, PGDM Induction | `references/PGDM Induction Program/` |
| LevelUP, Level Up | `references/LevelUP/` |
| legacy BrainPulses, old BrainPulses, brainpulses (reference) | `references/brainpulses/` |

```text
# ❌ BAD
grep the whole repo for “registration” and hope

# ✅ GOOD
Grep / Read with path scoped to references/PGDM Induction Program/
```

- Scope tools with `path` set to that folder. Use absolute paths when needed.
- Other trees under `references/` (`ChatGPT/`, `design-systems/`, HTML mocks) only when the user names them.
- Related Cursor rule: `.cursor/rules/refer-reference-projects.mdc`.

## Examples

1. *Refer the PGDM (or DISHA) project …* → `references/PGDM Induction Program/`
2. *Refer the LevelUP project …* → `references/LevelUP/`
3. *Refer the legacy brainpulses project …* → `references/brainpulses/`
