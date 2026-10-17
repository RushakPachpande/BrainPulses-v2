---
name: Mobile sidebar dismiss
overview: Make the mobile sidebar a real dismissible drawer, matching the PGDM Induction pattern and the shadcn close-on-navigate fix, so the open menu no longer covers the page.
todos:
  - id: close-on-nav
    content: Close the mobile sheet when a sidebar menu button is activated
    status: completed
  - id: visible-close
    content: Show a 44px Close sidebar control inside the mobile drawer
    status: completed
  - id: header-reflow
    content: Keep the header on one row and stop the page from scrolling under the drawer
    status: completed
  - id: verify-mobile
    content: Check phone dismiss paths, tablet sheet, and desktop rail
    status: completed
isProject: false
---

# Dismissible mobile sidebar

The hamburger opens a modal sheet, then the page stays covered. Two things in the current shell cause that.

- The sheet close control is removed with `[&>button]:hidden` in [admin/src/components/ui/sidebar.tsx](admin/src/components/ui/sidebar.tsx), and the header trigger sits under the overlay (`z-50`), so it cannot close the drawer.
- Nav links never call `setOpenMobile(false)`. The route changes underneath the open sheet. This is the known shadcn gap ([issue 5561](https://github.com/shadcn-ui/ui/issues/5561), [PR 5755](https://github.com/shadcn-ui/ui/pull/5755)).

PGDM Induction ([layout.tsx](references/reference-projects/PGDM%20Induction%20Program/admin/src/pages/admin/layout.tsx), [sidebar.tsx](references/reference-projects/PGDM%20Induction%20Program/admin/src/components/ui/sidebar.tsx)) uses the same sheet, but its header stays one row and `SidebarInset` is `min-w-0` so the page cannot spill beside the drawer. Its JS breakpoint (`768`) matches its `md:` sidebar classes. BrainPulses already pairs `1024` in [admin/src/hooks/use-mobile.ts](admin/src/hooks/use-mobile.ts) with `lg:` in the sidebar. That pairing stays.

## Changes

- In `SidebarMenuButton` (and `SidebarMenuSubButton`), on click while `isMobile`, call `setOpenMobile(false)` after the link’s own click. Desktop icon clicks do not close anything. `useSidebar` stays internal; do not export it.
- On the mobile `SheetContent`, stop hiding the close button. Keep it inside the drawer, named “Close sidebar”, with a 44px hit area and sidebar foreground color so it is visible on the navy rail.
- Overlay click and Escape already close the sheet through Radix. Leave those.
- In [admin/src/layouts/admin-layout.tsx](admin/src/layouts/admin-layout.tsx), make the header one row like PGDM: trigger, truncating title, then actions. Give `SidebarInset` `min-w-0` and the main region `overflow-x-hidden` so a narrow phone does not scroll sideways under the drawer.
- Leave the 48px icon rail, 268px expanded width, `localStorage` key `brainpulses-sidebar`, header toggle, and no edge rail.

## Check

On a ~375px width with the server already on port 5173: open the menu, choose a link, and confirm the sheet and overlay are gone and the new page is usable. Close again with the in-drawer button, the overlay, and Escape. At desktop width, confirm the icon rail, expanded labels, and saved state are unchanged. Spot-check ~768px still uses the sheet, not a fixed rail.
