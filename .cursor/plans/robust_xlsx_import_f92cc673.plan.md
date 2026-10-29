---
name: Robust xlsx import
overview: Make every admin import accept only .xlsx, map columns by header name, and show row-level guidance when something is wrong. Wire student and user imports with sample workbooks, and add password-confirmed delete for students, sponsors, and contests.
todos:
  - id: spreadsheet-reader
    content: "Add shared .xlsx reader: header aliases, missing/duplicate header errors, detailed row issues"
    status: completed
  - id: question-import
    content: Move question import onto the reader, drop CSV import, enrich row errors and tests
    status: completed
  - id: import-dialog
    content: Shared import result dialog on bank form, quiz panel, students, and users
    status: completed
  - id: student-user-import
    content: Student and user .xlsx import APIs, sample workbooks, and enable the upload buttons
    status: completed
  - id: guarded-deletes
    content: Password-confirmed delete for students, sponsors, and contests, with link guards
    status: completed
isProject: false
---

# Robust Excel import and guarded deletes

## What is broken today

- Question import in [`api/src/modules/banks/import-export.ts`](api/src/modules/banks/import-export.ts) already finds a header row and maps aliases, but it only insists on a `question` column, still accepts CSV and a JSON `{ csv }` body, and row failures are short strings (`Failed to import row`).
- [`admin/src/pages/students.tsx`](admin/src/pages/students.tsx) and [`admin/src/pages/users.tsx`](admin/src/pages/users.tsx) show **Upload Students** / **Upload Users** as disabled buttons. There is no API for either import.
- Deletes that already ask for the signed-in user’s password: users, activities, round questions, attempts, results. Students, sponsors, and contests have no delete. Pending upload cleanup in [`api/src/modules/files/service.ts`](api/src/modules/files/service.ts) is not a user action and stays as it is.
- Export of questions and registrations stays CSV/xlsx. This change is import-only.

## Shared spreadsheet reader

Add [`api/src/lib/spreadsheet-import.ts`](api/src/lib/spreadsheet-import.ts) and use it from question, student, and user import.

- Accept only a real `.xlsx` workbook (extension and ExcelJS load). Reject `.csv`, `.xls`, and the question JSON `{ csv }` body with a message that names the file and says to save as Excel (.xlsx) and download the sample.
- Read cell text the way question import already does (rich text, formula results, leading-apostrophe formula guard).
- Scan the first 20 rows. Pick the row whose cells match the most expected headers. Column order does not matter.
- Match headers by normalizing trim, case, spaces, `_`, and `-`. A short alias list counts as that column (`Question Text` → `question`, `Option A` → `optionA`, `Marks` → `points`, `Email Address` is not an alias). Aliases live next to each importer’s official names and are printed on the sample Instructions sheet.
- If any official header is missing, or two columns map to the same field, reject the whole file before any writes. The message lists missing official names, headers that were found, and unrecognized headers (so `Emial` is visible next to missing `email`).
- Blank optional cells are valid. Empty data rows are skipped. No data rows, no worksheet, more than 1000 data rows, or a file over 10 MB each get their own sentence.
- Unknown extra columns do not shift the mapped ones. They are returned as `ignoredColumns` so the dialog can say those values were not imported.

Row issues use the DISHA shape from `references/PGDM Induction Program/api/src/lib/user-facing-error.ts`:

`Sheet row 4, column “email”: "not-an-email" — this is not a valid email. Expected: a real email address. Example: student@college.edu.`

Good rows are saved and bad rows are skipped, same as today’s question import and the LevelUP / DISHA dialogs. A header failure saves nothing.

## Question import

Keep [`BANK_IMPORT_HEADERS`](api/src/modules/banks/import-export.ts) as the required header set (all of them, including unused option columns). Rewrite `parseBankQuestionsFile` onto the shared reader and delete the CSV parse path. [`api/src/modules/banks/upload.ts`](api/src/modules/banks/upload.ts) accepts `.xlsx` only. Sample download stays `.xlsx`; stop offering sample CSV in the admin client. Update [`api/test/bank-import-export.test.ts`](api/test/bank-import-export.test.ts) for shifted columns, a missing header, a duplicate header, and a rejected CSV. Per-row type/option failures go through the detailed issue formatter instead of a generic catch message.

## Student and user import

Sample workbooks (Instructions + data sheet), `GET .../sample.xlsx`, and `POST .../import` (multipart `file`).

Student columns, matching [`createStudentSchema`](api/src/modules/students/schema.ts): `name`, `email`, `phone`, `course`, `city`, `cohort`, `code`. `name` and `email` must be filled. Blank `code` uses the existing `BP` code generator. Phone is normalized. Duplicate email, code, or phone in the file or the org is a row error that names the conflicting value.

User columns, matching [`inviteUserSchema`](api/src/modules/users/schema.ts): `name`, `email`, `password`, `role`, `assessmentAccess`, `quizAccess`. `name`, `email`, and `password` (8–128 characters) are required. Blank role is `admin`; blank access is `full`. The same privilege checks as invite apply (only a super admin can create a super admin; access cannot exceed the actor). Passwords are hashed and are not echoed in the result.

Enable the two upload buttons: file input limited to `.xlsx`, **Download sample** beside them, then the shared result dialog. Invalidate the students or users query after any row is created.

## Import result dialog

One component, [`admin/src/components/import-result-dialog.tsx`](admin/src/components/import-result-dialog.tsx), used by the question bank form, the quiz questions panel, students, and users. Follow the LevelUP dialog in `references/LevelUP/levelup-admin/src/pages/admin/questions.tsx`: title, summary, created count, numbered issue list, and a tip that points at the sample workbook. Use existing semantic badges (`destructive` / outline / secondary), not a new palette. File-level API errors (missing headers, wrong type) open the same dialog with the server message as the summary and any `details` lines as the list, not a toast the admin has to remember.

Copy on the question-bank bulk-upload dialog changes from “CSV or Excel” to Excel (.xlsx) only.

## Password-gated deletes

Reuse `verifyActingUserPassword` and `confirm({ requirePassword: true })`, the same path as [`admin/src/pages/users.tsx`](admin/src/pages/users.tsx).

- **Student:** `DELETE /students/:id` with `{ password }`. Prisma already cascades registrations, attempts, and results. The confirm dialog says that those records are removed with the student. Row action **Delete** on the students table. Audit `student.delete`.
- **Sponsor:** delete only when it has no contests and no activities (`onDelete: Restrict`). Otherwise `409` naming the counts. Card action on [`MediaCard`](admin/src/components/media-card-grid.tsx). The catalog image stays in the library.
- **Contest:** delete only when no activity uses it. Same password confirm and card action.

Existing password checks on users, activities, round questions, attempts, and results stay. No new delete without that check.

## Checks

API tests for the shared reader, question header failures, and student/user row mapping (shifted columns, missing header, bad email, duplicate). `npm run typecheck` and `npm run lint` in `api/` and `admin/`. After the UI is in, exercise sample download, a shifted-column import, a missing-header failure, and one password delete in the running admin app. Then `graphify update .`.
