---
name: Question banks revamp
overview: "Revamp shared QuestionBanksPage for assessments and quizzes to match the Question Banks mock and Students/Assessments chrome: header description and Bulk Upload/Create, KPI cards, info alert, toolbar filters, and selectable sortable table with icons, type chips, status pills, and pagination."
todos:
  - id: banks-meta-kpis
    content: Add bank descriptions, header Bulk Upload/Create, info alert, KPI cards
    status: completed
  - id: banks-fixtures-table
    content: Extend getQuestionBanks; rebuild QuestionBanksPage toolbar, table, pills, pagination
    status: completed
  - id: banks-verify
    content: Typecheck, lint, format; verify assessment and quiz bank pages
    status: completed
isProject: false
---

# Question Banks page revamp

Both routes share [`admin/src/pages/question-banks.tsx`](admin/src/pages/question-banks.tsx) (`kind: 'assessment' | 'quiz'`). One rewrite covers `/assessments/banks` and `/quizzes/banks`. Sidebar, top bar, and ModuleNav stay unchanged. Do not change Students, Users, activity lists, or Registrations beyond shared tokens if needed.

Follow the same chrome as Assessments / Registrations, aligned to [`references/ChatGPT/Brainpulses Assessment Question Banks Dashboard.png`](references/ChatGPT/Brainpulses%20Assessment%20Question%20Banks%20Dashboard.png).

## Locked decisions

- Header actions (not toolbar): **Bulk Upload** (outline) and **Create Question Bank** (primary, non-navigating) via `PageHeaderActions` — same placement as other revamps. Toolbar right side is **Clear Filters** only.
- KPI counts derived from fixtures (like Registrations), not invented static mock numbers.
- Remove the quiz Sample MCQ side panel so both kinds use a full-width table layout. Quiz MCQ guidance stays in the info alert copy.
- Keep kind-specific table columns: assessment has Description + Question Types; quiz has Presentation Types (no Description column).

## Header and meta

In [`admin/src/routes/meta.ts`](admin/src/routes/meta.ts), add descriptions:

- Assessment: Manage reusable question banks for assessments. A bank can be attached to multiple assessments.
- Quiz: Manage reusable question banks for quizzes. Banks use MCQs with one correct answer.

Keep titles **Assessment Question Banks** / **Quiz Question Banks**.

## Info alert

Keep a single `Alert` under ModuleNav (already on the page):

- Assessment: Question banks are reusable across assessments. You can attach a bank to any assessment.
- Quiz: keep the existing quiz MCQ note (or shorten to match the same tone).

Simple Alert as used today; no dismiss control required.

## KPI cards

Four-card metric row (icon-tile pattern like Assessments, not tinted `KpiGrid`):

- Total Question Banks — row count
- Active / Draft — counts from `status`
- Total Questions — sum of `questions`

Tokens: `chart-2` or `primary`, `success`, `warning`, `chart-3`. Responsive: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. Display-only; filtering stays on toolbar selects.

## Toolbar

Students-style structured filters:

- Search: Search question banks…
- **Type**: `All` plus unique types from fixture strings (`questionTypes` for assessment, `presentationTypes` for quiz). A bank matches if its type string includes the selected value (assessment types are comma-separated).
- **Status**: `All`, `Active`, `Draft`, `Completed`
- **Clear Filters** on the right

Search matches name (and description for assessment). Clear resets search, filters, and page.

## Fixtures

Extend [`getQuestionBanks`](admin/src/services/index.ts) with a stable `id` (e.g. `QB-…`) for selection keys. Keep name, description, questions, types, presentation, updated, usedIn, status.

## Table

Rewrite like Students/Assessments: local filter/sort/selection/pagination; `Table` in `Card` (no `DataTable` / `RowActions`).

Shared columns: Checkbox, Question Bank Name (colored icon tile + bold name), Number of Questions, Last Updated, Used In (`N assessments|quizzes`), Status, Actions.

Assessment-only: Description, Question Types (outline chips split from the comma list).
Quiz-only: Presentation Types (single value or chip).

- Status pills: Active → `ok` + success dot; Draft → `wn` + warning dot; Completed → primary-tinted pill + primary dot (same page-local pattern as Assessments; do not change global `statusTone`)
- Sortable headers (asc → desc → clear) on data columns
- Kebab View / Edit
- Footer: Showing X to Y of Z question banks; rows-per-page 10/20/50; pagination

## Checks

From `admin/`: `npm run typecheck`, `npm run lint`, format touched files. Browser both bank routes: search, type/status filters, clear, sort, select-all, kebab, pagination, KPIs; confirm activity list and Registrations unchanged. Spot-check ~375px / 768px / 1280px.
