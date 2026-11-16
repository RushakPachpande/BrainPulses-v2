---
name: Registrations and filters
overview: Add manual and assigned registrations, make edit and delete actually change a participant, surface quiz/round result publishing on the reports page, and turn list filters into multi-selects.
todos:
  - id: manual-add
    content: "Header actions: assign existing participants, and a dialog plus API to create a new Registration ID and assignment (and contest submission when the activity is on a form)"
    status: completed
  - id: edit-delete
    content: Edit registration fields via updateParticipant; delete registration removes the participant so the public link can issue a new ID
    status: completed
  - id: publish-reports
    content: Reports header Publish for one after-publish quiz/round, and a list of unpublished items when All or several are selected
    status: completed
  - id: multiselect-filters
    content: Toolbar multi-select with Select all, divider, and Clear selection; update list pages, report query APIs, and the student results type filter
    status: completed
isProject: false
---

# Registrations, publishing, and multi-select filters

## 1. Add a registration two ways

On [admin/src/pages/registrations.tsx](admin/src/pages/registrations.tsx), add header actions (editors only):

- **Assign participants** links to the existing page at `/quizzes/registrations/new` or `/assessments/registrations/new` ([admin/src/pages/assign-registration.tsx](admin/src/pages/assign-registration.tsx)). That page already assigns people who have a Registration ID. It is not linked from the list today.
- **Add registration** opens a dialog: activity, full name, email, phone, course, city. On save, the API creates a participant with a public-style `BP########` id (same helper as [api/src/modules/contest-forms/service.ts](api/src/modules/contest-forms/service.ts) `nextRegistrationId`, not the generic participant code), assigns that activity, and returns the new id in the toast.

If that activity sits on a saved contest form, the same request also writes a `ContestFormSubmission` and assigns every activity on that form, matching the public link. The admin path does not run the public form’s required-field checks.

New route on the registrations module, edit access: `POST /activities/:activityId/registrations/manual` (or the existing registrations router if that is where `assign` already lives).

## 2. Publish results on the reports page

Quiz and assessment report payloads already include `scoreRelease` and `resultsPublishedAt` on every quiz or round option, even when the table filter is All ([api/src/modules/quiz-reports/service.ts](api/src/modules/quiz-reports/service.ts), [api/src/modules/assessment-reports/service.ts](api/src/modules/assessment-reports/service.ts)). No new publish API.

- **Exactly one** quiz or round selected, and it is `after_publish` and not yet published: **Publish results** in `PageHeaderActions` (next to Download), with the existing confirm copy. The warning alert stays as status text.
- **None or several** selected: a short list above the toolbar of every `after_publish` quiz or round that is still unpublished (narrowed to the current selection). Each row has its own Publish button and calls the existing `publishQuizResults` / `publishRoundResults`.
- The per-attempt **Publish result** button on [admin/src/pages/result-detail.tsx](admin/src/pages/result-detail.tsx) stays, so one student can be released early.

## 3. Delete a registration

Row action **Delete registration** (full access), plus the same action on the detail page. Password confirm, same pattern as delete attempt.

It calls the existing `deleteParticipant` ([api/src/modules/participants/service.ts](api/src/modules/participants/service.ts)). Participant delete cascades registrations, attempts, results, and contest submissions, so the live link no longer finds them and the next signup gets a new Registration ID. Confirm copy says this removes their attempts and scores, and any other activities they are on.

**Delete attempt** stays as the lighter action that only clears one attempt.

## 4. Make Edit edit

[admin/src/pages/registration-detail.tsx](admin/src/pages/registration-detail.tsx) `mode="edit"` currently renders the same read-only card as view and only offers Unassign. View stays read-only. Edit becomes a form for name, email, phone, course, and city, saved with `updateParticipant`. Registration ID and activity stay read-only. Unassign remains a separate destructive button, not the save action.

## 5. Multi-select filters

Replace toolbar single selects in [admin/src/components/toolbar.tsx](admin/src/components/toolbar.tsx) with a popover of checkboxes (existing Popover and Checkbox). Each menu has:

- **Select all** at the top, with a bottom border separating it from the options
- One checkbox per real option (drop the synthetic All / Any item)
- **Clear selection** at the bottom, which clears only that dropdown

Empty or fully selected means no filter. A partial selection matches any of the chosen values. The trigger reads All, the one chosen label, or “N selected”. Page-level **Clear Filters** still resets search and every dropdown. Rows-per-page, sort, and form selects stay single-select.

Update callers and their filter logic: [registrations.tsx](admin/src/pages/registrations.tsx), [users.tsx](admin/src/pages/users.tsx), [activity-list.tsx](admin/src/pages/activity-list.tsx), [question-banks.tsx](admin/src/pages/question-banks.tsx), [quiz-questions-panel.tsx](admin/src/pages/quiz-questions-panel.tsx), [quiz-reports.tsx](admin/src/pages/quiz-reports.tsx), [assessment-reports.tsx](admin/src/pages/assessment-reports.tsx).

Report APIs today take one id or one enum ([api/src/modules/quiz-reports/schema.ts](api/src/modules/quiz-reports/schema.ts), [api/src/modules/assessment-reports/schema.ts](api/src/modules/assessment-reports/schema.ts), `filterReportRows`). Accept a repeated query param or comma list, and treat an empty list as “any”. The student results type filter in [participant/src/pages/results.tsx](participant/src/pages/results.tsx) gets the same control. Registration-form fields stay single-select.

## Checks

Read the accessibility skill before building the dialog, edit form, and multi-select. After edits: `npm run typecheck`, `npm run lint`, and `npm run format:check` in `admin/` and `api/` (and `participant/` if that filter changes). Then `graphify update .`. Verify in the browser on the registrations list (add, assign, edit, delete) and on quiz reports (one quiz vs All, publish still confirms).
