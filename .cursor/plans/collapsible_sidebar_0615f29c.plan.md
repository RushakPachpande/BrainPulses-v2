---
name: Collapsible sidebar
overview: Add a desktop collapse control that shrinks the sidebar to an icon rail and gives that space back to the page. The phone drawer stays unchanged.
todos:
  - id: sidebar-markup
    content: Add collapse button, nav label spans, and icons for every sidebar link
    status: completed
  - id: sidebar-css
    content: Style the icon rail, tooltips, and width transition for desktop only
    status: completed
  - id: sidebar-behavior
    content: Persist the collapsed state and verify desktop plus the phone drawer
    status: completed
isProject: false
---

# Collapsible sidebar

On screens at least 1024px wide, a button in the sidebar header toggles between the current 268px nav and a 76px icon rail. Below that width, the existing drawer and menu button stay as they are.

## Behavior

- The toggle sits in the logo row in [index.html](index.html). It is a 44px button labeled "Collapse sidebar" or "Expand sidebar", with `aria-expanded` and `aria-controls="sidebar"`.
- Collapsed state is a class on `html` (`sidebar-collapsed`). An inline script in `head` reads `localStorage` (`brainpulses-sidebar`) before paint so the rail does not flash open.
- [src/main.js](src/main.js) writes that preference on click. Resizing to a phone does not clear it; the class only changes the desktop grid.
- Every nav link, including Assessment, Quiz, and Settings items, gets an SVG icon and a `<span class="nav-label">`. Group headings hide in the rail. The word "Brainpules" hides; the mark stays.
- Collapsed labels stay in the accessibility tree. On hover and keyboard focus they appear as a tooltip to the right of the icon, so the rail is not hover-only.
- Escape still closes the phone drawer only. It does not expand the desktop rail.

## Motion and layout

In [src/styles/tokens.css](src/styles/tokens.css), add `--sidebar-w-collapsed: 76px`. In [src/styles/base.css](src/styles/base.css), the app grid already uses `--sidebar-w`, so the page fills the freed space. Transition `grid-template-columns` for 180ms with ease-out. Fade labels with opacity. The existing `prefers-reduced-motion` rule already shortens that.

Collapsed rules are inside `@media (min-width: 1024px)` so a stored collapsed preference cannot strip labels out of the phone drawer.

## Check

At a wide desktop width, collapse and expand the sidebar, reload, and confirm the choice sticks and the main area grows. At 390px, open and close the drawer and confirm labels are still visible.