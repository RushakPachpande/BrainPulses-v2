---
name: Dummy notifications popup
overview: Add a header notifications popover with three dummy items, per-item dismiss, and a Clear All action, wired to the existing bell button without changing the rest of the shell.
todos:
  - id: add-popover
    content: Add shadcn Popover under admin/src/components/ui
    status: completed
  - id: notifications-menu
    content: Build NotificationsMenu with dummy list, dismiss, and Clear all
    status: completed
  - id: wire-header
    content: Swap header bell for NotificationsMenu in admin-layout
    status: completed
isProject: false
---

# Dummy notifications popup

## Approach

Build a small client component and replace the bare notifications button in the header. Use **Popover** (add via shadcn) so clearing several items does not fight menu auto-close the way `DropdownMenu` would.

## Implementation

1. **Add Popover** in `admin/` with the project’s shadcn setup (`popover` from `@/components/ui/popover`).

2. **New component** [`admin/src/components/notifications-menu.tsx`](admin/src/components/notifications-menu.tsx):
   - Local state seeded with three dummy items (short title + relative time), e.g. registration / quiz published / attempt completed — fixture-style copy only.
   - Trigger: existing ghost icon button (`BellIcon`, `aria-label="Notifications"`, `aria-expanded` from popover open).
   - Panel (`align="end"`, ~`w-80`):
     - Header label “Notifications”
     - List rows: text + ghost icon dismiss (`XIcon`, `aria-label="Dismiss …"`)
     - Footer: outline/ghost **Clear all** button (disabled when empty)
     - Empty state: short “No notifications” message when the list is cleared
   - Dismiss removes that id; Clear all sets the list to `[]`. State is session-only (resets on reload).

3. **Wire header** in [`admin/src/layouts/admin-layout.tsx`](admin/src/layouts/admin-layout.tsx): replace the standalone notifications `Button` with `<NotificationsMenu />`. Leave theme toggle and the rest of the header unchanged.

## Out of scope

No API, persistence, unread badge, or settings-page wiring. Visual language stays tokens + `@/components/ui` only.
