---
name: Negative vs compulsory
overview: When quiz negative marking is on, force Questions are compulsory off and disable that switch in the admin wizard; normalize the same rule on save and in API parse so attempts never treat both as true. Leave Allow Previous independent.
todos:
  - id: admin-ui-couple
    content: Force compulsory off + disable switch when negative marking is on in activity-wizard
    status: completed
  - id: admin-save-normalize
    content: Normalize questionsCompulsory false in settingsPayload when negative marking enabled
    status: completed
  - id: api-parse-coerce
    content: Coerce questionsCompulsory false in parseQuizSettings (+ Zod transform on write)
    status: completed
isProject: false
---

# Negative marking forces compulsory off

## Rule

For quizzes only: if `negativeMarkingEnabled` is true, `questionsCompulsory` is always false and the compulsory control is disabled. This applies regardless of presentation (`one_at_a_time` / `all_on_page`) or duration mode. **Allow Previous stays independent** (unchanged by negative marking).

Rationale matches scoring: negative marking only penalizes answered wrong items; unanswered must remain allowed, so compulsory navigation cannot stay on.

Mirror the existing Allow Previous / per-question pattern in [admin/src/pages/activity-wizard.tsx](admin/src/pages/activity-wizard.tsx) (force display + disable + normalize on save).

## 1. Admin wizard UI

In the Quiz behaviour section of [admin/src/pages/activity-wizard.tsx](admin/src/pages/activity-wizard.tsx) (~1538–1604):

- **Compulsory switch**
  - `checked`: show false whenever negative marking is enabled; otherwise use `quizSettings.questionsCompulsory`
  - `disabled`: `readOnly || quizSettings.negativeMarkingEnabled`
  - Update `FieldDescription` when negative marking is on (compulsory is off while negative marking is enabled)
- **Negative marking switch `onCheckedChange`**
  - When turning **on**, also set `questionsCompulsory: false` (keep existing `negativeMarkPoints` defaulting)
  - When turning **off**, leave `questionsCompulsory` as-is (admin can turn it back on); do not auto-restore to `true`

Do not change Allow Previous, presentation, or per-question forcing.

## 2. Admin save payload

In `settingsPayload` (~445–456), normalize like `allowPrevious` under per-question: when `negativeMarkingEnabled` is true, write `questionsCompulsory: false`.

So saved JSON never keeps both flags true for existing quizzes that currently have both on.

## 3. API normalize on read/write

In [api/src/lib/quiz-settings.ts](api/src/lib/quiz-settings.ts) `parseQuizSettings`, after reading both flags: if `negativeMarkingEnabled` is true, force `questionsCompulsory: false`.

That covers attempt mapping (`mapAttempt` already uses parse) so participant/client Next/Submit compulsory UX turns off even for legacy settings that still have both true in JSON until the next admin save.

In [api/src/modules/activities/schema.ts](api/src/modules/activities/schema.ts), add a Zod transform that sets `questionsCompulsory: false` when `negativeMarkingEnabled` is true on create/update (coerce, do not reject).

## 4. Out of scope

- Participant/client attempt pages: no logic change; they already key off `attempt.questionsCompulsory`
- Assessments: no quiz negative-marking settings
- Scoring: already skips unanswered; no change
- No DB migration; settings are JSON

## Acceptance

- Toggle negative marking on → compulsory immediately shows off and is disabled; Allow Previous unchanged
- Toggle negative marking off → compulsory becomes editable again (still false until admin turns it on)
- Save + reload with negative marking on → stored `questionsCompulsory` is false
- Open attempt for a quiz with negative marking → `questionsCompulsory` is false (skip allowed; Next/Submit not locked for unanswered)
- One-at-a-time + negative marking: compulsory still off/disabled in admin; Previous toggle still independent
