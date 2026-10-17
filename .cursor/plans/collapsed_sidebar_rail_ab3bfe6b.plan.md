---
name: Collapsed sidebar rail
overview: Narrow the collapsed sidebar to a 48px icon rail and let that icon list scroll, while the expanded sidebar, mobile drawer, and header toggle stay as they are.
todos:
  - id: narrow-rail
    content: Drop the 76px collapsed width so the icon rail uses the 48px default
    status: completed
  - id: scroll-collapsed
    content: Let the collapsed icon list scroll vertically while the logo stays fixed
    status: completed
  - id: verify-edges
    content: Visually check collapsed scroll, expanded width, and the mobile drawer
    status: completed
isProject: false
---

# Narrow, scrollable collapsed sidebar

The collapsed rail is wide because [admin/src/layouts/admin-layout.tsx](admin/src/layouts/admin-layout.tsx) forces `--sidebar-width-icon` to `76px`. The shadcn default is `3rem` (48px), which fits the 32px icons. The icon list cannot scroll because [admin/src/components/ui/sidebar.tsx](admin/src/components/ui/sidebar.tsx) sets `group-data-[collapsible=icon]:overflow-hidden` on `SidebarContent`, so items below the fold are clipped.

## Changes

- In the layout provider, keep the expanded width at `268px` and stop overriding the icon width, so the collapsed rail uses `3rem`.
- In `SidebarContent`, replace the collapsed `overflow-hidden` with vertical scrolling (`overflow-y-auto`) and a thin scrollbar. The logo header stays fixed above the scrolling list.
- Collapsed group labels stay visually removed (they already use a negative margin). Icon buttons stay 32px, centered, with the existing hover and focus tooltips.
- Leave the header **Toggle sidebar** button as the only way to expand or collapse. Do not bring back the edge rail.

## Edge cases

- Desktop collapsed: every nav icon is reachable by wheel, trackpad, and keyboard; the active item is not stuck off-screen if the list is scrolled.
- Desktop expanded: full labels, 268px width, and the existing scroll behavior.
- Below 1024px: the sidebar is still the mobile sheet, not the 48px rail, and that sheet still scrolls.
- Refresh keeps the saved collapsed or expanded state.

## Check

With the admin server already on port 5173, collapse the sidebar at a desktop width and confirm the rail is about 48px, icons are centered, and the lower Settings icons can be scrolled into view. Then expand it again and spot-check the mobile drawer.