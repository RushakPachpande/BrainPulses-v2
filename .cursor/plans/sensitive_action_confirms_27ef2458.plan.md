---
name: Sensitive action confirms
overview: Add one admin confirmation dialog and use it before every action that ends a session, removes access, or changes a live result. The student sign-out gets the same kind of warning the exam exit already has.
todos:
  - id: confirm-dialog
    content: Add the admin confirm dialog and provider.
    status: completed
  - id: admin-actions
    content: Ask before sign-out, deactivate, delete, publish, archive, unassign, and result actions.
    status: completed
  - id: student-signout
    content: Ask before student sign-out using the existing exam confirm modal.
    status: completed
isProject: false
---

# Confirmation dialogs for sensitive actions

Saves, cancels, filters, and pagination stay immediate. Exam submit and exam exit already ask before continuing, so those stay as they are.

## Shared admin dialog

Add [`admin/src/components/confirm-dialog.tsx`](admin/src/components/confirm-dialog.tsx) on the existing `Dialog` in [`admin/src/components/ui/dialog.tsx`](admin/src/components/ui/dialog.tsx). It shows a title, a short warning, Cancel, and a confirm button. Destructive confirms use the destructive button variant.

Mount one provider in [`admin/src/layouts/admin-layout.tsx`](admin/src/layouts/admin-layout.tsx) and expose `confirm({ title, description, confirmLabel, destructive })` that resolves true or false. Call sites stay async: if the person cancels, the handler returns before the API call.

## Admin actions that will ask first

- **Sign out** in the sidebar. Warning that they will need to sign in again.
- **Deactivate user** in [`admin/src/pages/user-detail.tsx`](admin/src/pages/user-detail.tsx).
- **Deactivate question** in [`admin/src/pages/bank-form.tsx`](admin/src/pages/bank-form.tsx).
- **Delete a saved round question** in [`admin/src/pages/activity-wizard.tsx`](admin/src/pages/activity-wizard.tsx) (`deleteRoundQuestion`).
- **Publish** and **Archive** on the wizard review step.
- **Unassign student** in [`admin/src/pages/registration-detail.tsx`](admin/src/pages/registration-detail.tsx).
- **Publish result**, **Regrade**, **Disqualify**, **Re-qualify**, **Grant continue**, and **Grant restart** in [`admin/src/pages/result-detail.tsx`](admin/src/pages/result-detail.tsx).

Each description names the consequence (lost access, hidden question, student can start, score replaced, attempt no longer counts).

The in-app “leave while saving” prompt in [`admin/src/hooks/use-leave-guard.ts`](admin/src/hooks/use-leave-guard.ts) will use this same dialog instead of `window.confirm`. Closing the browser tab still uses the browser’s own prompt, which cannot be replaced.

Removing an unsaved registration field, round, or option inside the wizard does not call the API, so those controls stay immediate.

## Student app

[`client/src/layouts/student-shell.tsx`](client/src/layouts/student-shell.tsx) sign-out will open the same confirm modal the attempt page already uses for exit, then sign out only if confirmed. Submit and exit dialogs in [`client/src/pages/attempt.tsx`](client/src/pages/attempt.tsx) stay.
