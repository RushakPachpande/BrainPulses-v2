---
name: Quizora shell match
overview: "Restyle the admin shell to match the Quizora prototype: a 256px sidebar that collapses to a 76px icon rail, and a sticky top bar with search, theme, notifications, and the account. Existing routes, copy, and page bodies stay."
todos:
  - id: sidebar
    content: Set the sidebar to a 256px panel that collapses to a 76px icon rail, with the prototype brand and user footer.
    status: completed
  - id: topbar
    content: Rebuild the sticky top bar and move breadcrumbs into the page header.
    status: completed
  - id: breakpoint
    content: Align the mobile drawer breakpoint with the tablet sidebar.
    status: completed
  - id: verify
    content: Check desktop collapse, tablet, and phone, then run typecheck, lint, and format.
    status: completed
isProject: false
---

# Quizora shell match

Colors already follow the prototype. This pass matches the shell geometry and chrome in [quizora_ui_prototype.html](quizora_ui_prototype.html) and [docs/DESIGN.md](docs/DESIGN.md) sections 4.1–4.3. Brainpules routes, fixture data, page copy, module link rows, and page bodies stay.

## Sidebar

In [admin/src/layouts/admin-layout.tsx](admin/src/layouts/admin-layout.tsx):

- Set `collapsible="icon"`, `--sidebar-width` to `16rem` (256px), and `--sidebar-width-icon` to `76px`.
- Brand row matches the prototype: primary rounded mark with the activity icon, then “Brainpules”, linking to `/dashboard`. The name stays the darker text color.
- The six links stay ungrouped. Active item keeps the soft primary tint. Collapsed icons keep their tooltips.
- Footer becomes the prototype user row: avatar, Meera Joshi, Super Admin, and the theme icon button. Drop the account dropdown from the footer.

Do not persist collapse in `localStorage`. Default is expanded.

## Top bar

Replace the breadcrumb header with a sticky bar about 72px tall, `bg-card`, border below:

- Sidebar trigger
- A search field labeled “Search” (it does not replace each page’s own search)
- Theme icon button and the existing Notifications button
- Avatar plus “Meera Joshi” and “Super Admin”, hidden down to the avatar on a narrow screen

Move breadcrumbs from this bar into the page header, above the existing `h1`. [admin/src/components/module-nav.tsx](admin/src/components/module-nav.tsx) stays under the title.

Restore [admin/src/components/theme-toggle.tsx](admin/src/components/theme-toggle.tsx) as the icon button used in the top bar and the sidebar footer.

## Page frame

Wrap the outlet in a column with `max-w-[1600px]`, about 28px padding on desktop and less on small screens. Keep `--control-h` at 44px so buttons and inputs stay the app’s tap size. Keep the current fonts.

## Drawer breakpoint

The prototype hides the sidebar under about 760px. Today the drawer starts below 1024px because [admin/src/hooks/use-mobile.ts](admin/src/hooks/use-mobile.ts) and the `lg:` visibility classes in [admin/src/components/ui/sidebar.tsx](admin/src/components/ui/sidebar.tsx) are paired. Move that pair to `md` (768px) so a tablet keeps the sidebar and a phone still gets the sheet. Sheet close-on-navigate, overlay, Escape, and the in-sheet close button stay.

## Check

On the existing server at port 5173, confirm desktop expand/collapse (labels, then a 76px icon rail with tooltips), the top bar contents, and breadcrumbs above the title on Dashboard, Students, an assessment page, and Settings. At about 375px the sheet closes after a link. At about 768px the sidebar is the rail, not the sheet. Then run `npm run typecheck`, `npm run lint`, and Prettier on the edited files in `admin/`.
