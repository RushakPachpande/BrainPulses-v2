---
name: Assessments quizzes revamp
overview: "Revamp Assessments and Quizzes list pages via shared ActivityListPage to match the mock: header description and Create action, KPI cards instead of count tabs, Students-style toolbar/table chrome, and rich rows with icon, subtitle, status pills, attempts progress, and dual-line dates."
todos:
  - id: activity-meta-kpis
    content: Add assessments/quizzes descriptions, header Create action, KPI metric cards
    status: completed
  - id: activity-fixtures
    content: Extend getActivities with id, subtitle, icon tone, times for rich rows
    status: completed
  - id: activity-table
    content: "Rebuild ActivityListPage: toolbar, sortable table, status pills, attempts bar, pagination"
    status: completed
  - id: activity-verify
    content: Typecheck, lint, format; verify Assessments and Quizzes in browser
    status: completed
isProject: false
---

# Assessments and Quizzes list revamp

Both routes share [`admin/src/pages/activity-list.tsx`](admin/src/pages/activity-list.tsx) (`kind: 'assessment' | 'quiz'`). One rewrite covers both. Sidebar, top bar, and [`ModuleNav`](admin/src/components/module-nav.tsx) stay as they are (labels unchanged). Do not change Question Banks, Registrations, Reports, or Create pages.

Decisions locked: replace count tabs with KPI cards; full mock row richness (icon, subtitle, progress, dual-line dates).

## Header and meta

In [`admin/src/routes/meta.ts`](admin/src/routes/meta.ts):

- `/assessments`: description “Create and manage assessments, track participation, and monitor performance.”
- `/quizzes`: description “Create and manage quizzes, track participation, and monitor performance.”

Keep titles **Assessments** / **Quizzes**. Move **Create Assessment** / **Create Quiz** into `PageHeaderActions` (primary, links to existing `/assessments/new` or `/quizzes/new`). Remove Create from the toolbar.

## KPI cards

Remove the All/Active/Draft/Completed `Tabs` block.

Add a four-card metric row (not dashboard `KpiGrid` tint cards): icon tile + label + large count. Values match current tab totals:

- Assessment: Total 24, Active 14, Draft 6, Completed 4
- Quiz: Total 32, Active 26, Draft 4, Completed 2

Use existing tokens (`primary`, `success`, `warning`, `chart-2`). Responsive: 1 → 2 → 4 columns (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`). Cards are display-only (filtering stays on the Status select).

## Toolbar

Students/Users pattern:

- Search: “Search by assessment name…” / “Search by quiz name…”
- Filters: **Status** (`All`, `Active`, `Draft`, `Completed`) and **Date Range** (`All` only for now — closed label matches mock)
- **Clear Filters** on the right

Search matches activity name (and subtitle). Status filters rows. Clear resets search, filters, and page.

## Fixtures

Extend [`getActivities`](admin/src/services/index.ts) (and fixture helpers as needed) with:

- Stable `id` (e.g. `ASM-…` / `QUZ-…`) for selection keys
- `subtitle` (e.g. “Engineering • Mock Test”)
- `category` or icon tone index for the colored glyph beside the name
- `startTime` / `endTime` (e.g. `10:00 AM`) for the second date line
- Keep `registered`, `assigned`, `banks`, `attempts`, `status`, `start`, `end`

Progress % = `attempts / registered` (0 when registered is 0).

## Table

Rewrite `ActivityListPage` like Students/Users: local filter/sort/selection/pagination; `Table` inside `Card` (no `DataTable` / `RowActions`).

Columns: Checkbox, Name (icon + title + muted subtitle), Status, Registered, Assigned, Question Banks, Attempts (count + thin primary progress bar + %), Start Date, End Date, Actions.

- Status pills: Active → `ok` + success dot; Draft → `wn` + warning dot; Completed → primary-tinted pill + primary dot (page-local; do not change global `statusTone` so Completed stays green elsewhere)
- Sortable headers (asc → desc → clear) on all data columns
- Kebab View / Edit
- Footer: “Showing X to Y of Z assessments|quizzes”, rows-per-page 10/20/50, pagination

Column order for quizzes can stay the existing quiz order (Question Banks before Registered) if that differs today; same chrome either way.

## Checks

From `admin/`: `npm run typecheck`, `npm run lint`, format touched files. Browser: `/assessments` and `/quizzes` — search, status filter, clear, sort cycle, select-all, kebab, pagination, KPI counts visible; confirm `/students` and `/users` unchanged. Spot-check ~375px / 768px / 1280px.