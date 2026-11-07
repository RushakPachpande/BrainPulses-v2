---
name: Assessment quiz parity
overview: "Bring assessments in line with quizzes: cover images, one local bank per round, per-round behaviour, question limits, and comprehension sets that stay together. Drop the assessment question-bank module, the rounds bulk-import button, and the empty assessment behaviour step."
todos:
  - id: images
    content: Assessment cover on the wizard; round image column, editor, and participant round cards
    status: completed
  - id: local-banks
    content: Remove assessment banks nav/routes and linked-bank UI; questions panel per round local bank
    status: completed
  - id: pagination
    content: Paginate the shared questions panel
    status: completed
  - id: round-behaviour
    content: Add shuffle, score release, and show-answers on each round and honor them at attempt time
    status: completed
  - id: comprehension-shuffle
    content: Keep passage sets intact and shuffle only inside the set
    status: completed
  - id: drop-import-step
    content: Remove rounds bulk import and the empty assessment behaviour step
    status: completed
  - id: review-cards
    content: Redesign review round cards with duration, pass, attempts, and score release
    status: completed
  - id: question-limit
    content: Add All-or-N question limit on quiz and each round; score against the served set
    status: completed
isProject: false
---

# Assessment and quiz authoring parity

Admin chrome stays on existing tokens and controls ([admin/src/index.css](admin/src/index.css), `CatalogImageField`, list pagination). No new palette.

## 1. Assessment cover image

`Activity.imageFileId` already exists and the participant library already prefers it in [client/src/components/activity-images.tsx](client/src/components/activity-images.tsx). The wizard only renders `CatalogImageField` inside the quiz-only block in [admin/src/pages/activity-wizard.tsx](admin/src/pages/activity-wizard.tsx).

Show the same optional cover field on assessment Basic Details (label “Assessment image”) and keep the existing upload/save path (`imageFileId` on create/update).

## 2. Round cover image

Add nullable `imageFileId` on `ActivityRound` (FK to `FileObject`, `onDelete: SetNull`), plus a Prisma migration.

- Round editor: `CatalogImageField` on each round.
- Persist on the round write in [api/src/modules/activities/service.ts](api/src/modules/activities/service.ts).
- Portal round DTO in [api/src/modules/participant-portal/service.ts](api/src/modules/participant-portal/service.ts) includes `imageFileId`.
- [client/src/pages/activity-detail.tsx](client/src/pages/activity-detail.tsx) shows it on `.activity-round-card` (image or the current placeholder). Reuse the stored-file image pattern from `activity-images.tsx`.

## 3. One bank per round; remove assessment banks

Quizzes already author into a hidden local bank via `QuizQuestionsPanel`. Rounds already have `localBankId`.

- Remove the Assessment “Question Banks” link from [admin/src/components/module-nav.tsx](admin/src/components/module-nav.tsx) and the `/assessments/banks` routes in [admin/src/routes/app-routes.tsx](admin/src/routes/app-routes.tsx) and [admin/src/routes/meta.ts](admin/src/routes/meta.ts).
- On Define Rounds, remove the linked-bank checklist and the inline “manual question” form.
- Each saved round embeds `QuizQuestionsPanel` on `localBankId` (save the assessment first, same as the quiz panel’s `onEnsureBank`).
- Attempt assembly in [api/src/modules/attempts/service.ts](api/src/modules/attempts/service.ts) and portal question counts use only the round local bank. Stop writing `ActivityRoundBank` links. Existing link rows are ignored.

## 4. Question list pagination

Add the same footer as Students/Users (10/20/50, “Showing X to Y of Z”) to [admin/src/pages/quiz-questions-panel.tsx](admin/src/pages/quiz-questions-panel.tsx), paging the filtered list. Assessments use this panel, so both get it.

## 5. Per-round behaviour matches the quiz

Round JSON already stores shuffle, compulsory, negative marking (which forces compulsory off), previous, panel, and attempts, and the round editor already has most of those switches. Missing versus the quiz step:

- Shuffle questions and shuffle options switches.
- Score release: After submit / After publish.
- Show answers when published.

Add `scoreRelease` and `answersVisibleToParticipant` to [api/src/lib/round-settings.ts](api/src/lib/round-settings.ts) (JSON, no migration). Apply the same score visibility helper used for quizzes when mapping a round attempt result. Keep the existing couplings: negative marking turns compulsory off; per-question time forces one-at-a-time, no previous, no overview panel.

## 6–7. Comprehension: one passage, sets stay together

Storage is already one `Passage` row per bank body via `saveSharedPassage` in [api/src/modules/banks/passages.ts](api/src/modules/banks/passages.ts). Bank Excel import passes a passage cache; assessment import calls `createQuestion`, which dedupes by exact trimmed body in that bank. Keep that path and pass a cache through assessment import if that endpoint stays.

Shuffle today clusters, then `shuffleInPlace` breaks the cluster ([api/src/modules/attempts/service.ts](api/src/modules/attempts/service.ts) `buildShuffleOrders`). Change selection to:

- Treat each passage as one block; other questions are blocks of one.
- If shuffle is on, shuffle block order, then shuffle questions inside each passage block only.
- If shuffle is off, keep current passage clustering (set stays together in sort order).

## 8. Remove round bulk import

Remove the Bulk Import button and `AssessmentImportDialog` from Define Rounds. Rounds are only added with “Add round”. Question Excel import stays on the per-round questions panel (same as quiz). It does not create rounds.

## 9. Drop the assessment Behaviour step

That step’s body is quiz-only, so assessments see an empty “Behaviour Settings” step. Remove it from the assessment step list. Drive wizard content by step name, not a shared index, so Review stays last for both (quiz keeps Behaviour Settings).

## 10. Round review cards

Replace the plain “N banks · N manual questions” list in the review step with one card per round: cover thumbnail, name, question count, duration, pass rule, attempts, score release, and shuffle on/off as text (not color alone). Stack on small screens; two columns from `md`. Same border, muted, and type tokens as `ReviewFact`.

## 11. Number of questions

Add `questionLimit: number | null` on quiz settings and round behaviour (`null` = all), with the same number input plus All switch as attempts.

At attempt start, after building passage blocks and before shuffle:

- Walk blocks in order and take whole blocks until the next block would exceed the limit.
- A passage is never split. If one passage is larger than the limit, serve that whole passage.
- Passing percent and max score stay based on the questions actually served (already how scoring uses `questionOrder`).
- Portal `questionCount` shows the count a new attempt would receive, not the full bank size.

```mermaid
flowchart LR
  blocks[Passage blocks and single questions]
  limit[Apply question limit without splitting a passage]
  shuffle[Shuffle blocks then shuffle inside each passage]
  attempt[Freeze questionOrder on the attempt]
  blocks --> limit --> shuffle --> attempt
```
