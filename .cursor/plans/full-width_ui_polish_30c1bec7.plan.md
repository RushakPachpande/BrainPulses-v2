---
name: Full-width UI polish
overview: Keep the current Brainpules colors, screens, and routes, and restyle the shell so every page fills the workspace instead of sitting in a 1240px column.
todos:
  - id: fill-shell
    content: Remove the main and form width caps and make the workspace fill the viewport
    status: completed
  - id: fill-components
    content: Stretch dashboard charts, activity rail, tables, and two-column forms
    status: completed
  - id: verify-layout
    content: Check wide desktop and phone layouts for full-width content and no page scroll
    status: completed
isProject: false
---

# Full-width admin polish

## What changes

The brand tokens in [src/styles/tokens.css](src/styles/tokens.css) stay as they are. The empty band on the right comes from [src/styles/base.css](src/styles/base.css): `main` is capped at `1240px`, and [src/styles/components.css](src/styles/components.css) caps forms at `860px`. Those caps go away so cards, tables, charts, and forms use the full workspace beside the sidebar.

## Layout

- Make `.workspace` a full-height column (`min-height: 100dvh`) and let `main` grow (`flex: 1`, no max-width).
- Use fluid page padding: `clamp(16px, 2vw, 32px)` on the top bar and main, same left/right inset so the header and content align.
- Let short pages (create, settings) fill the viewport surface instead of ending in a short block of gray.
- On small screens, drop the `h1` `16ch` cap so titles wrap instead of looking cut off.

## Components

- Dashboard in [src/screens/dashboard.js](src/screens/dashboard.js): KPI row and the three charts already stretch; make chart cards equal height and let the SVG fill the card. Change `.split` so recent activity takes the leftover width and quick actions stay a full-height rail (about 280px), stacking only under 1024px.
- Tables: keep horizontal scroll for wide data, and stretch a short table to the card (`min-width: 100%`). Stick the header just under the top bar.
- Forms (create assessment/quiz, general settings): remove the 860px cap. On wide screens, lay fields in two columns; description, upload rows, and the action row span the full card. One column below 800px.
- Search stays a compact field; the toolbar spacer already pushes actions to the far edge, so that row uses the full width.
- Access, reports, and notification grids already use `1fr` tracks. They inherit the wider main area with no markup change.

## Check

Run the dev server and look at the dashboard, students table, and create form at a wide desktop width and at 390px. Content should reach the right edge of the workspace, with no page-level horizontal scroll.