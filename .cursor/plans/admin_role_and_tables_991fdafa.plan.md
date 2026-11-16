---
name: Admin role and tables
overview: Hide super admins from normal admins, drop user bulk import, simplify quiz and registration tables, let only a super admin wipe a registration form (and anything it created), and bring the participants page in line with the other admin lists.
todos:
  - id: super-admin-visibility
    content: Hide super admins from normal-admin list, get, and create-role option
    status: completed
  - id: remove-user-import
    content: Remove user sample Excel and upload from admin UI and API
    status: completed
  - id: users-row-actions
    content: Show users table actions only to super admins
    status: completed
  - id: contest-sponsor-view
    content: Hide contest and sponsor view for normal admins
    status: completed
  - id: activity-columns
    content: Drop Attempts and Assigned Question Bank; add sponsor and contest columns and filters
    status: completed
  - id: icon-actions
    content: Icon-only quiz/assessment row actions on desktop with tooltips
    status: completed
  - id: form-wipe
    content: Super-admin registration-form delete with full participant wipe and destructive warning
    status: completed
  - id: participants-list
    content: Paginate, filter, and 3-way sort the participants table; restyle registration forms
    status: completed
  - id: remove-assign
    content: Remove Assign participants button, page, and routes
    status: completed
isProject: false
---

# Admin roles, tables, and clean deletes

Stay on the existing admin chrome in [`docs/design/DESIGN.md`](docs/design/DESIGN.md): flat cards, semantic tokens, 44px controls, one primary action. No new palette.

## 1. Super admins are invisible to normal admins

Today [`api/src/modules/users/service.ts`](api/src/modules/users/service.ts) returns every membership, and [`admin/src/pages/user-editor-dialog.tsx`](admin/src/pages/user-editor-dialog.tsx) always offers Super Admin on create. The API already rejects a normal admin who tries to invite or edit a super admin.

- `listUsers` and `getMembership`: when the actor is not `super_admin`, exclude `role: super_admin` (list filter and 404 on direct id).
- Create dialog: Super Admin option only when `membership.role === 'super_admin'`.

## 2. Users are added one at a time

Remove Sample Excel and Upload Users from [`admin/src/pages/users.tsx`](admin/src/pages/users.tsx), plus `downloadUsersSample` / `importUsers` in [`admin/src/services/index.ts`](admin/src/services/index.ts).

Remove the matching API: `GET /users/sample.xlsx`, `POST /users/import`, `sampleUsersWorkbook`, `importUsersFile`, and [`api/src/modules/users/import-export.ts`](api/src/modules/users/import-export.ts). Leave question-bank and quiz Excel import alone.

Row actions on the users table: render them only for a super admin (view, edit, reset password, delete). A normal admin still uses Add User. No row click into the view dialog for a normal admin. Checkbox selection on that page stays; it is not a bulk import.

## 3. Contest and sponsor cards

In [`admin/src/pages/contests.tsx`](admin/src/pages/contests.tsx) and [`admin/src/pages/sponsors.tsx`](admin/src/pages/sponsors.tsx), a normal admin does not get View or the view dialog. Edit on the card and Add at the top stay. A super admin still has View.

## 4. Quiz and assessment lists

In [`admin/src/pages/activity-list.tsx`](admin/src/pages/activity-list.tsx) (both kinds):

- Remove the Attempts column, `attemptPercent`, and the attempts count from the list query in [`api/src/modules/activities/service.ts`](api/src/modules/activities/service.ts). Reports pages keep their own attempt fields.
- Add Sponsor and Contest columns. The list API already returns `sponsor` and `contest`; [`mapActivityFromApi`](admin/src/services/api-mappers.ts) currently drops them. Pass the names through and add toolbar filters whose options come from the loaded rows (same pattern as Status).

In [`admin/src/pages/registrations.tsx`](admin/src/pages/registrations.tsx) (both kinds): remove the Assigned Question Bank column. The mapper already stores `'—'`.

## 5. Icon actions on the quiz and assessment list

Desktop table only, in `activity-list.tsx`: [`RowActions`](admin/src/components/row-actions.tsx) shows icons with `aria-label` and the existing tooltip. Mobile cards keep the text labels. Other tables stay labeled.

## 6 and 7. Clean deletes

Shared confirm in [`admin/src/components/confirm-dialog.tsx`](admin/src/components/confirm-dialog.tsx) already asks once, then asks for the password. Style the consequence list as a destructive alert (warning color, not body text) so every delete that uses `confirmSensitiveDelete` shows what will be lost before the password step.

New: super admin only can delete a registration form from the participants page.

- `DELETE` contest form, `requireRole('super_admin')`, existing password check.
- Wipe, in one transaction: every participant who submitted that form (their registrations, attempts, results, and other contest submissions cascade from `Participant`), then the form, its quiz links, and its live slug. The quizzes and assessments themselves stay.
- Warning copy states that those people are removed from every contest and report, including another contest if they also joined one.

Participant delete on the registrations page already deletes the person, and Prisma cascades registrations, attempts, results, and form submissions. Update that warning to name those records. Contest delete, which already removes the form when no quiz is linked, will delete those same participants instead of leaving them behind. Sponsor delete stays blocked while contests or activities still use it. Deleting one attempt still deletes only that attempt.

## 8. Participants table

[`admin/src/pages/participants.tsx`](admin/src/pages/participants.tsx) already loads real people, then shows only the first 10 with no sort or filters.

Match the other lists: search (name, email, registration id), Sponsor and Contest filters built from the loaded rows, 3-way column sort, rows per page 10/20/50, and “Showing X to Y of Z”.

## 9. Registration forms block

Replace the dense clickable grid on that same page with a quiet card list that matches the admin tables: contest, sponsor, status, quiz count, link with a copy button, Edit, and Delete for a super admin only. No extra color, shadow, or motion. Stack on small screens. Update [`admin/src/pages/participants.test.tsx`](admin/src/pages/participants.test.tsx).

## 10. Remove Assign participants

Remove the outline button on quiz and assessment registrations, the `/quizzes/registrations/new` and `/assessments/registrations/new` routes and meta, and [`admin/src/pages/assign-registration.tsx`](admin/src/pages/assign-registration.tsx) plus `assignRegistrations`. Keep Add registration and the registration-detail unassign action.

After code changes: `npm run typecheck`, `npm run lint`, and `npm run format:check` in `admin/` and the API package’s equivalent checks. Then `graphify update .`.
