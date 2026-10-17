---
name: Users page revamp
overview: Rebuild the Users page to mirror the Students page chrome—header description and actions, structured toolbar with Clear Filters, selectable sortable table with status pills and kebab menus, and pagination—while keeping Users columns, Role/Status filters, and fixture data.
todos:
  - id: users-meta-header
    content: Add Users description and header Upload/Add actions
    status: completed
  - id: users-page-table
    content: "Rebuild Users page: toolbar, sortable selectable table, status pills, pagination"
    status: completed
  - id: users-verify
    content: Typecheck, lint, format; verify Users and Students in browser
    status: completed
isProject: false
---

# Users page revamp

Mirror the Students page structure on Users. Sidebar and top bar stay unchanged. Shared pieces already in place: [`PageHeaderActions`](admin/src/contexts/page-header.tsx), structured [`Toolbar`](admin/src/components/toolbar.tsx), Badge tone pills, checkbox, dropdown.

## Header

In [`admin/src/routes/meta.ts`](admin/src/routes/meta.ts), add a `/users` description:

“Manage admin users, roles, and access to assessments and quizzes.”

Keep title **User Management**. Header actions (via `PageHeaderActions`, same layout as Students): **Upload Users** (outline) and **Add User** (primary). Stack full-width below `sm`.

## Toolbar

Replace the string filters and inline Add button with the Students pattern:

- Search placeholder: “Search by name or email…”
- Filters: **Role** (`All`, `Super Admin`, `Admin`) and **Status** (`All`, `Active`, `Inactive`)
- **Clear Filters** on the right (`sm:ml-auto`)

Search matches name and email. Clear resets search, filters, and page.

## Table

Rewrite [`admin/src/pages/users.tsx`](admin/src/pages/users.tsx) like [`admin/src/pages/students.tsx`](admin/src/pages/students.tsx): local state for search, filters, sort (asc → desc → clear), selection, pagination; `Table` primitives inside `Card` (no `DataTable` / `RowActions`).

Columns (Users content, same chrome as Students):

- Checkbox (select visible page; row key = email)
- Name, Email, Role, Assessment Access, Quiz Access, Status, Last Login, Actions
- Sortable headers on every column except checkbox and Actions
- Role stays outline `StatusBadge` (Admin / Super Admin tones unchanged)
- Status uses the same pill Badge + dot as Students (`ok` / `er` + `success` / `destructive`)
- Actions: icon kebab with View / Edit

Footer: “Showing X to Y of Z users”, rows-per-page (10 / 20 / 50), prev / page / next.

Leave [`getUsers()`](admin/src/services/index.ts) fields as they are. Do not change Students, `DataTable`, or other list pages.

## Checks

From `admin/`: `npm run typecheck`, `npm run lint`, `npm run format:check` on touched files. In the browser on `/users`, exercise search, Role/Status, clear, sort cycle, select-all, kebab, pagination; confirm `/students` still works. Spot-check ~375px / 768px / 1280px.