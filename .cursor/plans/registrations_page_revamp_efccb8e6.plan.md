---
name: Registrations page revamp
overview: "Revamp shared RegistrationsPage for assessments and quizzes to match the Registration Dashboard mock: header description and Download/Add actions, KPI metric cards, Students-style toolbar and selectable sortable table with avatar IDs, status pills, kebab actions, and pagination."
todos:
  - id: reg-meta-kpis
    content: Add registration descriptions, header Download/Add actions, KPI metric cards
    status: completed
  - id: reg-fixtures-table
    content: Extend getRegistrations; rebuild RegistrationsPage toolbar, table, pills, pagination
    status: completed
  - id: reg-verify
    content: Typecheck, lint, format; verify assessment and quiz registration pages
    status: completed
isProject: false
---

# Registrations & Student Data revamp

Both routes share [`admin/src/pages/registrations.tsx`](admin/src/pages/registrations.tsx) (`kind: 'assessment' | 'quiz'`). One rewrite covers `/assessments/registrations` and `/quizzes/registrations`. Sidebar, top bar, and [`ModuleNav`](admin/src/components/module-nav.tsx) stay unchanged. Do not change list pages for Students, Users, or activity lists beyond what’s needed for shared tokens.

Follow the same chrome as Students / Assessments lists, aligned to [`references/ChatGPT/Brainpulses Registration Dashboard.png`](references/ChatGPT/Brainpulses%20Registration%20Dashboard.png).

## Header and meta

In [`admin/src/routes/meta.ts`](admin/src/routes/meta.ts), add descriptions:

- Assessment: “View all student registrations, their assigned question banks, and assessment status.”
- Quiz: “View all student registrations, their assigned question banks, and quiz attempt status.”

Keep title **Registrations & Student Data**. Header actions via `PageHeaderActions`: **Download Filtered Data** (outline) and **Add Registration** (primary, non-navigating). Remove Download from the toolbar.

## KPI cards

Add a four-card metric row (same icon-tile pattern as Assessments, not tinted `KpiGrid`):

- Total Registrations — count of rows; subtext “Across all assessments” / “Across all quizzes”; show `↑ 12%` as static fixture copy matching the mock
- Completed / In Progress / Not Started — counts and “X% of total” derived from `attempt` field on the full fixture set (display-only; filtering stays on toolbar selects)

Responsive: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. Tokens: `chart-2`, `success`, `warning`, `primary`.

## Toolbar

Students-style structured filters:

- Search: “Search by name, email, or unique ID…”
- Selects: **Assessment|Quiz**, **City**, **Course**, **Assignment Status** (`All`, `Assigned`, `Pending`), **Student Status|Attempt Status** (`All`, `Completed`, `In Progress`, `Not Started`)
- **Clear Filters** on the right

Drop the old Registration Date filter (not in the mock). Search matches id, name, email. Clear resets search, filters, and page.

## Fixtures

Extend [`getRegistrations`](admin/src/services/index.ts) with `city` and `course` (reuse `studentCities` / `studentCourses`). Keep existing id, name, email, phone, registered, activity, bank, assignment, attempt.

## Table

Rewrite like Students/Users: local filter/sort/selection/pagination; `Table` in `Card` (no `DataTable`).

Columns: Checkbox, Unique ID (initials avatar + id), Student Name, Email, Phone, Registration Date, Assessment|Quiz, Assigned Question Bank, Assignment Status, Student Status|Attempt Status, Actions.

- Assignment pills: Assigned → `ok` + success dot; Pending → `wn` + warning dot
- Attempt/Student pills: Completed → `ok`; In Progress → `wn`; Not Started → `er` (page-local pill + dot, same pattern as Students status)
- Avatars: colored initials next to Unique ID (mock layout; cycle existing tone tokens)
- Sortable headers (asc → desc → clear) on data columns
- Kebab View / Edit
- Footer: “Showing X to Y of Z registrations”, rows-per-page 10/20/50, pagination

## Checks

From `admin/`: `npm run typecheck`, `npm run lint`, format touched files. Browser both registration routes: search, filters, clear, sort, select-all, kebab, pagination, KPIs; confirm activity list and Students/Users unchanged. Spot-check ~375px / 768px / 1280px.