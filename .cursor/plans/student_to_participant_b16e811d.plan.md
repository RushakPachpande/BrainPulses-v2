---
name: Student to participant
overview: Rename the product term Student to Participant across the client portal, admin, API, and database, while keeping the `client` folder name. One change set, because the HTTP contract, tokens, and stored rows have to move together.
todos:
  - id: schema-migration
    content: Rename Prisma model, columns, enum, settings keys, and quiz JSON with a non-destructive migration
    status: completed
  - id: api-contract
    content: Rename API modules, routes, JWT typ, Redis session keys, OpenAPI, seed, and tests
    status: completed
  - id: admin-client
    content: Rename admin and client identifiers, routes, and visible copy; keep client folder name
    status: completed
  - id: docs-env-verify
    content: Update docs and env examples, then typecheck, lint, API tests, and browser-check both apps
    status: completed
isProject: false
---

# Rename student to participant

The signed-in person is a **participant**. The portal is the **participant portal**. Plurals become **participants**. The app folder stays [`client/`](client/), and npm/script names that say `client` stay (`brainpulses-client`, `dev:client`). Words that are not this role stay as they are, including “YOUR LEARNING SPACE” and “learning”. [`references/`](references/) and old `.cursor/plans` stay untouched. Past migration files stay as history; a new migration renames live objects.

This lands in one change. Splitting the API from the apps would break sign-in and lists in between.

## Language map

- Screen copy: “Student portal” → “Participant portal”, “Student sign in” → “Participant sign in”, “Students” → “Participants”, role “Student” → “Participant”.
- Code: `Student` → `Participant`, `studentId` → `participantId`, `requireStudent` → `requireParticipant`, modules `students` and `student-portal` → `participants` and `participant-portal`.
- HTTP: `/api/students` → `/api/participants`, `/api/student` → `/api/participant`, `/api/auth/student/*` → `/api/auth/participant/*`. Auth JSON field `student` → `participant`.
- Admin URLs: `/students` → `/participants`, `/settings/student-portal` → `/settings/participant-portal`. Keep `Navigate` redirects from the old paths so current bookmarks still open.
- JWT `typ: 'student'` → `typ: 'participant'`. Existing access tokens stop working; people sign in again. Redis keys move from `student:session:` to `participant:session:` in [`api/src/lib/student-sessions.ts`](api/src/lib/student-sessions.ts); old keys expire on their TTL.
- Env name `STUDENT_JWT_ACCESS_EXPIRES_IN` → `PARTICIPANT_JWT_ACCESS_EXPIRES_IN` in [`api/src/config/env.ts`](api/src/config/env.ts) and the example env files only. Real `.env` files are not opened or edited; you rename that one variable locally before the API starts.
- Stored settings and quiz JSON: `studentPageOverview` (and the other `studentPage*` keys) → `participantPage*`; `answersVisibleToStudent` → `answersVisibleToParticipant`; assignment mode `all_active_students` → `all_active_participants`.
- Audit `actor_type` enum value and `target_type` string `'student'` → `'participant'`.

## Database

Edit [`api/prisma/schema.prisma`](api/prisma/schema.prisma): model `Student` → `Participant` mapped to `participants`; `studentId` / `student_id` on Registration, Attempt, ReattemptGrant, and Result → `participantId` / `participant_id`; `ActorType.student` → `participant`; relation names `student` / `students` → `participant` / `participants`.

Hand-write the migration SQL so Prisma does not drop and recreate the table. Rename the table, columns, indexes, and foreign keys; `ALTER TYPE "ActorType" RENAME VALUE 'student' TO 'participant'`; update `settings.key` and `audit_events.target_type`; rewrite the two JSON keys inside `activities.settings`. Then `prisma generate`. Do not rewrite [`api/prisma/migrations/20261014195541_init`](api/prisma/migrations/20261014195541_init/migration.sql) or later files.

Tenant model list in [`api/src/lib/prisma.ts`](api/src/lib/prisma.ts) changes `'student'` to `'participant'`.

## API, admin, and client

Rename the module folders and the files whose names contain `student` (`student-pages`, `student-sessions`, `students.tsx`, `student-editor-dialog.tsx`, `student-view-dialog.tsx`, `settings-student-portal.tsx`, `student-shell.tsx`, `student-page-guard.tsx`, `use-student-pages.ts`). Update imports, OpenAPI in [`api/openapi.yaml`](api/openapi.yaml), seed, and tests with the same words.

Client UI strings already found: document title and meta in [`client/index.html`](client/index.html), “Student sign in” and “Student portal” in [`client/src/pages/login.tsx`](client/src/pages/login.tsx), sidebar and crumb in the shell, profile role/email/description, the withheld-score sentence in results, and the empty state “No student pages are available right now”. The unused prototype [`client/src/App.handoff.tsx`](client/src/App.handoff.tsx) repeats those phrases plus the demo address `aarav.sharma@student.edu`; rename those too. CSS classes `.student-mini*` become `.participant-mini*`.

Admin labels: sidebar “Students” and “Student portal”, page titles in [`admin/src/routes/meta.ts`](admin/src/routes/meta.ts), Add/Edit/Upload Student, “Assign Students”, “Registered Students”, “Total Students”, and the portal settings page.

Update maintained docs under [`docs/`](docs/) and the client README so they use participant. Leave `references/` alone.

## Checks

After the edit: `prisma generate`, API tests, and `typecheck` / `lint` / `format:check` in `admin/`, `client/`, and `api/` where those scripts exist. Then `graphify update .`.

Browser check on the already-running apps (do not restart them): participant login title and shell crumb on port 5174, profile role, admin nav “Participants” and “Participant portal” on port 5173, and one list load that hits `/api/participants`. Sign in again after the token `typ` change.
