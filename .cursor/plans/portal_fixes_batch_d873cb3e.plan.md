---
name: Portal fixes batch
overview: "Ten admin and participant fixes: password visibility on the remaining admin fields, slimmer report columns and a working Excel-only download, faster Excel import with a quiz sample that matches quiz questions, a participant reload that leaves the spinner, and attempt progress that survives tab changes and resume."
todos:
  - id: password-toggle
    content: Use PasswordInput on admin login and user-create password fields
    status: completed
  - id: report-columns
    content: Default report columns to the requested set and bump localStorage key
    status: completed
  - id: excel-only-download
    content: Fix report Excel download and remove CSV export options
    status: completed
  - id: wizard-steps
    content: Remove Registration Form and Assignment Rules from the activity wizard
    status: completed
  - id: import-speed-sample
    content: Batch question import and drop numeric columns from the quiz sample
    status: completed
  - id: participant-spinner
    content: Stop clearing the participant query cache on first sign-in hydration
    status: completed
  - id: attempt-progress
    content: Remove tab/minimize save and persist closed questions plus current index
    status: completed
  - id: registrations-buttons
    content: Remove Add Registration and Download Filtered Data from registrations
    status: completed
  - id: regenerate-link
    content: Regenerate a new registration slug and retire the old one
    status: completed
isProject: false
---

# Portal, reports, and import fixes

## 1. Show/hide password

Password fields exist only in admin. [PasswordInput](admin/src/components/password-input.tsx) already toggles with an eye button and `aria-label` (“Show password” / “Hide password”). Change-password, reset, and delete-confirm already use it.

Switch the two plain `type="password"` inputs to `PasswordInput`:

- [admin/src/pages/login.tsx](admin/src/pages/login.tsx) (login)
- [admin/src/pages/user-editor-dialog.tsx](admin/src/pages/user-editor-dialog.tsx) (invite user)

Participant and client sign in with a Registration ID and have no password field. Nothing to add there.

## 2. Report columns hidden by default

Quiz columns live in [admin/src/pages/quiz-report-format.ts](admin/src/pages/quiz-report-format.ts). Assessment columns are the local `COLUMNS` list in [admin/src/pages/assessment-reports.tsx](admin/src/pages/assessment-reports.tsx). Both pages already have a Columns menu and persist the choice in `localStorage`.

Default visible:

- Quiz: Registration ID, Participant Name, Quiz, Marks scored, %, Result, Time taken, Submitted, Auto-submitted, Attempt status
- Assessment: the same set, with **Assessment** in place of Quiz (there is no Quiz column). Round stays hidden until enabled.

Hidden until checked: Email, Phone, Contest (quiz only), Round (assessment only), Attempts used, Total marks, correct count, question count, skipped, negative marks.

Bump the storage key (`bp-quiz-report-columns:v2:…`) so a previously saved wide set does not override the new default.

## 3. Report download, Excel only

Download is [QuizReportDownloadDialog](admin/src/pages/quiz-report-download.tsx) → `downloadQueuedExport` in [admin/src/lib/jobs.ts](admin/src/lib/jobs.ts) → `GET /api/quiz-reports/export` or `/api/assessment-reports/export` (202) → poll `GET /api/jobs/:id` → `GET /api/jobs/:id/download`.

The API only enqueues the file. A separate process, [api/src/worker.ts](api/src/worker.ts), builds it. If that worker is not running, the job stays queued and the dialog gives up after ~90s with a generic “Couldn't create the file.” Inline mode (`QUEUE_INLINE`) already builds the file inside the request.

Fix:

- Run quiz and assessment report exports in the API process when the worker is not what completes the job (same path as `useInlineQueue`), so Download returns a finished `.xlsx` without a second process.
- Show the API error in the toast instead of swallowing it.
- Remove the CSV radio. Always send `format=xlsx`.
- Drop `csv` from the export schemas, job types, and `buildReportCsv` / `buildAssessmentCsv` branches.
- Remove unused CSV export/sample routes: question `sample.csv` and `export.csv` ([api/src/modules/banks/routes.ts](api/src/modules/banks/routes.ts)), and registrations `GET /api/registrations/export` (CSV-only, and the admin button is already disabled). Keep `sanitizeCsvCell` where Excel cells still need it. Leave the file-library mime list so an already-stored file can still be opened.

## 4. Remove registration form and assignment rules from quiz/assessment create and edit

In [admin/src/pages/activity-wizard.tsx](admin/src/pages/activity-wizard.tsx), drop the **Registration Form** and **Assignment Rules** steps (both quiz and assessment, create and edit) and stop writing `settings.registrationForm` and `settings.assignmentRules`. Leave any existing stored values in place so older activities are not wiped.

Do not change the form builder: [admin/src/pages/contest-form-wizard.tsx](admin/src/pages/contest-form-wizard.tsx). Its own Assignment Rules step (link, activities, domains) stays.

## 5. Import/export speed and quiz sample

Uploads are already one `.xlsx` file. Slowness is the server loop in `importFromRows` ([api/src/modules/banks/service.ts](api/src/modules/banks/service.ts)): each row calls `createQuestion`, which reloads the bank, inserts question + version + options, places images, and writes an audit event. Assessment confirm ([api/src/modules/activities/assessment-import.ts](api/src/modules/activities/assessment-import.ts)) does the same on the request, inside the 30s timeout. User import hashes each password with bcrypt cost 12, one after another.

Fix:

- Import questions in one transaction: load the bank once, reuse the passage cache, insert the rows together, and write one import audit instead of one audit per question. Use that path for bank import and assessment confirm.
- Hash user-import passwords with a small concurrency limit instead of strictly one-by-one.
- Quiz sample: `numericValue` is the expected answer for `numeric` questions. Quiz banks reject that type (`resolveExplicitType`), but `headersForKind` still emits the full assessment header list, including `numericValue` and `numericTolerance`. Quiz sample and quiz headers should only include columns quiz import accepts (MCQ fields, images, passage). Assessment sample keeps the numeric column because those questions use it. Header aliases stay so older files still import.

## 6. Participant reload spinner

[ClientQueryScope](participant/src/contexts/query-provider.tsx) calls `clearClientQueryCache` whenever `participantId` changes. On every refresh that is `null` → the signed-in id, which wipes the pages and activities queries that just started. [ParticipantPageGuard](participant/src/layouts/participant-page-guard.tsx) and [LibraryPage](participant/src/pages/library.tsx) stay on `PageLoader` while those queries have no data.

Clear the cache only when leaving a participant (logout, or switching from one id to another). Do not clear on the first hydration after reload.

## 7 and 8. Tab/minimize and question position

There is no blur or violation counter. What runs today:

- `visibilitychange` (hidden) and `pagehide` in [participant/src/pages/attempt.tsx](participant/src/pages/attempt.tsx) call `saveAttemptKeepalive`, which posts the current revision and never stores the new one.
- The normal save then gets 409, `load()` runs, and `applyLoadedAttempt` jumps to the first unanswered question. Timer skips live only in `timedOutUnanswered`, which that reload clears. The server has no current index and no skipped list ([Attempt](api/prisma/schema.prisma) stores `questionOrder` and response JSON only).

```mermaid
flowchart LR
  hide[Tab hidden] --> keepalive[Keepalive save same revision]
  keepalive --> save[Debounced save]
  save --> conflict[409]
  conflict --> reload[Reload first unanswered]
```

Changes:

- Remove the visibility listener so changing tab, minimizing, or switching windows does not save or reset the attempt. Keep a single page-hide flush for a real close, and make it share one in-flight save so it cannot 409 against itself.
- On a real 409, reload from the server cursor below instead of “first empty answer”.
- Persist progress on the attempt: the current question index, and the question-version ids that are closed. Close a question when the participant leaves it after answering, or when the per-question timer skips it.
- Behaviour stays the source of truth. When previous is not allowed, or timing is per question (`forwardOnly` already means both), closed questions are not rendered again — including after focus returns, exit, or resume. When previous is allowed and timing is not per question, answered questions can still be shown.

`useLeaveGuard` only blocks in-app navigation and tab close while a save is in progress. It does not run on tab switch. Leave it.

## 9. Registrations page buttons

Remove **Add Registration** and **Download Filtered Data** from both header blocks in [admin/src/pages/registrations.tsx](admin/src/pages/registrations.tsx) (loading and loaded). Do not delete the registrations list.

## 10. Regenerate a real new registration link

[regenerateLink](api/src/modules/contest-forms/service.ts) calls `uniqueSlug(slugifyContest(name), id)`. The `formId` exclusion ignores this form’s current slug, so the function returns the same slug. The public lookup already treats a slug in `retiredSlugs` as “This link is no longer active.”

On regenerate, allocate a slug that is not the current one and not retired (contest base plus a short random suffix, still checked for uniqueness). Save it, and append the previous slug to `retiredSlugs` so the old URL stops working.

## Checks

After the edits: `npm run typecheck`, `npm run lint`, and `npm run format:check` in `admin/`, `participant/`, and `api/` for the packages touched. Update the graph with `graphify update .`. Browser-check admin report columns and Excel download, the wizard steps, registrations headers, regenerate link, and a participant reload plus a quiz/assessment resume after a tab switch. Do not restart the user’s API or Vite processes.
