---
name: Students page revamp
overview: "Restyle the Students content area to match the mock: title and description with Upload and Add beside them, a labeled filter row, and a selectable table with avatars, status dots, sorting, and pagination. Other list pages keep the current toolbar and DataTable."
todos:
  - id: header-slot
    content: Add students description and a header-actions slot beside the title
    status: completed
  - id: toolbar-filters
    content: Extend Toolbar for labeled selects, search, and Clear Filters; wire course/city on student fixtures
    status: completed
  - id: students-table
    content: "Build the Students table: checkbox, avatars, status dots, sort, kebab, pagination"
    status: completed
  - id: verify
    content: Typecheck, lint, format, and verify Students plus Users in the browser
    status: completed
isProject: false
---

# Students page revamp

The screenshot is the main content column only (breadcrumb through the table). Sidebar and top bar stay as they are. Fixture rows already match the mock (BP-24101–BP-24106, names, phones, Sep/Oct 2026 dates, activity counts, Active/Inactive). Brand spelling stays **Brainpules**.

## Header row

In [admin/src/routes/meta.ts](admin/src/routes/meta.ts), add an optional `description` and set it only for `/students`: “Manage student accounts, view details, and track their learning progress.”

In [admin/src/layouts/admin-layout.tsx](admin/src/layouts/admin-layout.tsx), render that description under the existing `h1` when present. Add a small page-header context so a page can place actions on the same row as the title. [admin/src/pages/students.tsx](admin/src/pages/students.tsx) will put **Upload Students** (outline) and **Add Student** (primary) there. Below `sm`, the actions wrap under the title at full width. Other routes leave the slot empty, so their headers do not change. Buttons stay non-navigating, as they are today.

## Filter row

Extend [admin/src/components/toolbar.tsx](admin/src/components/toolbar.tsx) without changing the current `filters: string[]` behavior used by Users, reports, and the rest.

Students will pass structured filters instead:

- Search placeholder: “Search by name, email or ID…”
- Status, Course, and City selects, each showing the field name and **All** inside the existing 44px trigger
- **Clear Filters** on the right (`sm:ml-auto`), not the upload/add buttons

Search matches id, name, and email. Status uses the existing status field. Course and city are new fixture fields on `getStudents()` only (not table columns). Closed menus still show **All**. Clear resets search, filters, and page.

Suggested assignments, one per row: JEE, Aptitude, Scholarship, Olympiad, Career, Logic; cities Pune, Ahmedabad, Mumbai, Bengaluru, Delhi, Chennai.

## Table

Leave [admin/src/components/data-table.tsx](admin/src/components/data-table.tsx), [admin/src/components/status-badge.tsx](admin/src/components/status-badge.tsx), and [admin/src/components/row-actions.tsx](admin/src/components/row-actions.tsx) unchanged so other lists keep View/Edit/More and outline badges.

Build the Students table in the page with the existing `Table` primitives, inside the current `Card`:

- Checkbox column. Add the shadcn checkbox at [admin/src/components/ui/checkbox.tsx](admin/src/components/ui/checkbox.tsx) (`npx shadcn@latest add checkbox` from `admin/`). Header checkbox selects the visible page; each box is named “Select {name}”.
- Columns: Unique ID, Student (initials avatar + name), Email, Phone, Registration Date, Assigned Activities (“3 active”), Status, Last Login, Actions.
- Avatar colors cycle existing tokens (`primary`, `chart-2`, `destructive`, `success`, `chart-3`, `chart-5`) with contrasting fallback text.
- Status is a dot plus the word, using `success` and `destructive`, with the text still available to screen readers.
- Sortable headers (chevron, `aria-sort`) for every column except the checkbox and Actions. Default order is the fixture order.
- Actions are a square icon button (`--control-h`) opening the existing dropdown with View and Edit.
- Footer: “Showing 1 to 6 of 6 students”, rows-per-page select (10, 20, 50), previous / current page / next. Counts follow the filtered list. The table keeps horizontal overflow on narrow screens.

## Checks

From `admin/`: `npm run typecheck`, `npm run lint`, `npm run format:check`. In the browser, exercise search, each filter, clear, sort, select-all, pagination, and the action menu on `/students`, then confirm `/users` still uses the old toolbar and row links. Check about 375px, 768px, and 1280px.