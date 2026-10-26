---
name: Table row action buttons
overview: Replace every table’s three-dot actions menu with wrapping View and Edit buttons that show an icon and a label. Question rows keep Deactivate as a third button.
todos:
  - id: row-actions
    content: Add the shared wrapping View/Edit/Deactivate button group.
    status: completed
  - id: list-pages
    content: Replace the kebab on students, users, sponsors, contests, activities, banks, and registrations.
    status: completed
  - id: question-rows
    content: Replace the question-row menu on the bank form, keeping Deactivate.
    status: completed
isProject: false
---

# Table row action buttons

Every admin table actions cell uses a vertical three-dot menu. Replace that with visible buttons: icon plus label, same destinations and permission checks as today.

## Shared control

Add [`admin/src/components/row-actions.tsx`](admin/src/components/row-actions.tsx). It renders a `flex flex-wrap gap-2` group so the buttons stay tappable and wrap inside the cell on narrow screens. The table already scrolls horizontally when the row is still wider than the viewport.

Each action is an outline `Button` (destructive variant for Deactivate):

- Link actions use `asChild` and `Link`
- Click actions stay `type="button"`
- Icons from `lucide-react` with `data-icon="inline-start"`: Eye for View, Pencil for Edit, Ban for Deactivate
- Button height stays on the existing `--control-h` rule. Do not set a custom height

## Pages

Swap the `DropdownMenu` block and drop the unused menu imports:

- [`admin/src/pages/students.tsx`](admin/src/pages/students.tsx), [`admin/src/pages/users.tsx`](admin/src/pages/users.tsx), [`admin/src/pages/sponsors.tsx`](admin/src/pages/sponsors.tsx), [`admin/src/pages/contests.tsx`](admin/src/pages/contests.tsx): View always; Edit only when the page already allows mutation
- [`admin/src/pages/activity-list.tsx`](admin/src/pages/activity-list.tsx): quizzes and assessments
- [`admin/src/pages/question-banks.tsx`](admin/src/pages/question-banks.tsx) and [`admin/src/pages/registrations.tsx`](admin/src/pages/registrations.tsx): same View/Edit links, including the quiz vs assessment paths
- [`admin/src/pages/bank-form.tsx`](admin/src/pages/bank-form.tsx): read-only rows keep View; editable rows keep Edit and Deactivate. Deactivate still calls `onDeactivate`

Update the one sentence in [`docs/design/DESIGN.md`](docs/design/DESIGN.md) that still says tables use a kebab, so it describes these buttons instead.

Reports and the dashboard have no row action menu, so they stay as they are. The student app has no matching menus.
