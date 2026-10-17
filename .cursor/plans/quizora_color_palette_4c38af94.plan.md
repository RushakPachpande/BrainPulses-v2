---
name: Quizora color palette
overview: Recolor the admin app with the Quizora prototype palette, and switch the shell so the sidebar is a white surface on a gray page. Existing warning, error, and KPI pastel colors stay.
todos:
  - id: tokens
    content: Map light and dark shell tokens to the Quizora palette, leaving status and KPI pastels unchanged.
    status: completed
  - id: shell
    content: Switch the sidebar off the inset variant and keep the header on a white surface.
    status: completed
  - id: verify
    content: Check light and dark at desktop and phone, then run typecheck, lint, and format on the edited files.
    status: completed
isProject: false
---

# Quizora color palette

## Placement

The prototype paints the sidebar and cards as a white surface (`#fff` / dark `#151f31`) and the page behind them as gray (`#f5f7fb` / dark `#0e1524`). The current inset shell does the opposite.

In [admin/src/layouts/admin-layout.tsx](admin/src/layouts/admin-layout.tsx), change `variant="inset"` to `variant="sidebar"`. That drops the rounded gray frame. The sidebar keeps its border. Give the header `bg-card` so the top bar stays a white surface on the gray page, matching the prototype top bar.

## Tokens

Update only the shell colors in [admin/src/index.css](admin/src/index.css). Leave `--warning`, `--destructive`, `--ok-*`, `--wn-*`, `--er-*`, `--gy-*`, `--kpi-*`, `--bar-muted`, and the extra chart series as they are.

Light:

- Page `--background` `#f5f7fb`, text `#17233f`, muted text `#71809d`
- Cards, popovers, and `--sidebar` `#ffffff`
- Muted fills `#f0f3f9`, borders and inputs `#e4e9f2`
- Primary and ring `#2463eb`, active tint `#eaf1ff` with `#2463eb` text
- Sidebar text `#71809d` so idle links match the prototype; the Brainpules brand link uses the darker text color

Dark, from the prototype’s `data-theme="dark"` block:

- Page `#0e1524`, surfaces and sidebar `#151f31`, raised fill `#1d2940`
- Text `#edf2ff`, muted `#9baac5`, lines `#2a3850`
- Primary, ring, and chart-1 `#6c9cff`, active tint `#1b3155`

Also point the theme-color meta values in [admin/src/contexts/theme.tsx](admin/src/contexts/theme.tsx) at the new page backgrounds (`#f5f7fb` light, `#0e1524` dark). Fonts, routes, copy, and layout structure stay.
