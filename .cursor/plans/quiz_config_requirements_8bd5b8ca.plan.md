---
name: Quiz config requirements
overview: "Close gaps vs Quiz Configuration System Requirements: rich-text instructions with a start modal + checkbox gate, CASE II locks including forced-off question panel, true per-question countdown with auto-advance, and passing default 50%."
todos:
  - id: admin-locks-defaults
    content: Force showQuestionPanel off on per-question; passing default 50%; persist force-off
    status: completed
  - id: admin-rich-instructions
    content: TipTap + sanitize; replace instructions Textarea in wizard Basic
    status: completed
  - id: client-start-modal
    content: Start modal with sanitized HTML + checkbox gate; remove inline ack
    status: completed
  - id: api-per-q-timer
    content: Per-question deadlineAt window, advance/renew, autoSubmitIfExpired adjust, mapAttempt panel force-off
    status: completed
  - id: client-per-q-timer
    content: Question countdown, auto-advance/submit, wire advance API
    status: completed
  - id: verify
    content: API tests + admin/client typecheck/lint + graphify update
    status: completed
isProject: false
---

# Quiz configuration system requirements

## Locked decisions

- **Per-question timer:** True countdown per question (full `perQuestionSeconds` on each question enter). At 0: auto-advance (leave unanswered if empty); on last question: auto-submit. Server-authoritative question window via existing `Attempt.deadlineAt` (repurposed as *current question* deadline under `durationMode === 'per_question'`), clamped by `activity.endsAt`.
- **Instructions:** (a) TipTap rich editor in admin → HTML in `Activity.instructions`; (b) modal on Start before attempt loads; (c) checkbox required only when instructions are non-empty.

## Already in place (do not rework)

- Overall vs per-question duration fields; presentation lock to one-at-a-time on per-question; Allow Previous force-off; shuffle / negative marking / leaderboards / cover image; plain instructions + inline ack on detail (to be replaced by modal + rich text).

## Gap work

### 1. Admin Behaviour locks + defaults

[`admin/src/pages/activity-wizard.tsx`](admin/src/pages/activity-wizard.tsx)

- When `durationMode === 'per_question'`: force `showQuestionPanel` **off** and **disable** the switch (mirror Allow Previous); persist `showQuestionPanel: false` in `settingsPayload`.
- Passing percent default / load fallback: **50** (today `40`).
- Keep CASE I: both Allow Previous and Question overview freely toggleable for overall + either presentation.

### 2. Rich-text instructions (admin)

- Add TipTap (`@tiptap/react`, `@tiptap/starter-kit`, and minimal extensions for bold/italic/lists) in **`admin/`** only; sanitize on save with `isomorphic-dompurify` (allow: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, headings if needed).
- Replace Basic Details instructions `Textarea` with a compact editor + toolbar (bold, italic, bullets, numbered list). Empty = store `null` (no student gate).
- No schema migration: `instructions` is already `Text`.

### 3. Student start modal + safe HTML render

[`client/src/pages/activity-detail.tsx`](client/src/pages/activity-detail.tsx)

- On Start (new attempt only): if instructions non-empty, open a modal (reuse existing `.modal-backdrop` / `.confirm-modal` patterns) that renders sanitized HTML, checkbox (“I confirm that I have read the instructions”), and Begin disabled until checked.
- Resume / open attempt: skip modal (same as today’s ack skip).
- Detail page may keep a read-only instructions preview without the checkbox; remove the old inline ack gate so Start alone owns confirmation.
- Add `isomorphic-dompurify` in **`client/`**; small helper for allowlisted HTML.

### 4. True per-question countdown (API + client)

```mermaid
sequenceDiagram
  participant Client
  participant API
  Note over API: per_question start
  API->>API: deadlineAt = now + perQuestionSeconds
  API-->>Client: attempt + perQuestionSeconds
  loop Each question
    Client->>Client: countdown to deadlineAt
    alt Time hits 0 or student Next
      Client->>API: advance / save then advance
      API->>API: lock move; deadlineAt = now + perQuestionSeconds
      API-->>Client: new deadlineAt, index
    end
  end
  Note over Client,API: Last question timeout or Submit
  Client->>API: submit
```

**API** ([`api/src/modules/attempts/service.ts`](api/src/modules/attempts/service.ts)):

- Change `attemptDurationMs` for `per_question`: return **`perQuestionSeconds * 1000`** (not `N * seconds`). Start/reattempt refresh set `deadlineAt = now + that` (still clamp to `endsAt`).
- Force `showQuestionPanel: false` in `mapAttempt` when `durationMode === 'per_question'` (defense in depth).
- Add admin-authenticated-equivalent student path: **advance** current question when forward-only / per-question — e.g. `POST /api/attempts/:id/advance` (or extend existing save) that: verifies in-progress; if `now > deadlineAt` or client requests advance, moves to next index (client already tracks index; server only renews `deadlineAt` and optionally records timeout); on last question timeout → same path as auto-submit.
- Adjust `autoSubmitIfExpired`: for `per_question`, expired `deadlineAt` means **advance/submit-current-question window**, not always full attempt submit—unless last question or `endsAt` passed (then full auto-submit).

**Client** ([`client/src/pages/attempt.tsx`](client/src/pages/attempt.tsx)):

- If `durationMode === 'per_question'`: timer drives **question** remaining from `deadlineAt`; on 0 call advance (then set next `deadlineAt` from response); hide overview when `showQuestionPanel === false`.
- Manual Next also renews deadline via the same advance/renew API after save.
- Overall mode unchanged (single session countdown to `deadlineAt`).

### 5. Tests and verify

- API: unit/integration — `attemptDurationMs` per-question is one question window; parse/settings force panel off; advance renews deadline; last-question expiry submits.
- Admin/client: typecheck, lint, format; `graphify update .`.
- Reminder: restart API on **3002** after attempt changes (do not kill user servers without approval).

## Out of scope

- Assessments per-question mode; new shuffle/negative/leaderboard features; changing plain-text historical instructions beyond sanitize-on-render (empty tags OK).
