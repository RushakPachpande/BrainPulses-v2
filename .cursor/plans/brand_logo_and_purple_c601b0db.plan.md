---
name: Brand logo and purple
overview: Replace the sidebar Activity mark with the filled BrainPulses logo, and shift the blue UI tokens to the brand purple `#45058f` while leaving status and KPI pastels alone.
todos:
  - id: logo
    content: Use the filled brand SVG in the sidebar mark and as the favicon
    status: completed
  - id: tokens
    content: "Retint primary, accent, ring, chart, and sidebar tokens to #45058f, with a lighter dark-mode tint"
    status: completed
  - id: report-bar
    content: Point the reports score chart at var(--primary)
    status: completed
isProject: false
---

# Brand logo and purple tokens

## Logo

The PNG at [assets/brainpulses.png](assets/brainpulses.png) is the mark. [assets/brainpulses.svg](assets/brainpulses.svg) is the same artwork with real fills (`#45058F` and white). [assets/Brainpulses-Logo.svg](assets/Brainpulses-Logo.svg) is a stroke-only trace (`fill="None"`, `stroke-width="0.3"`), so it would render as a faint outline. The shell will use the filled SVG.

- Copy that SVG to [admin/public/brand.svg](admin/public/brand.svg) and replace [admin/public/favicon.svg](admin/public/favicon.svg) with it. [admin/index.html](admin/index.html) already points at `/favicon.svg`.
- In [admin/src/layouts/admin-layout.tsx](admin/src/layouts/admin-layout.tsx), drop `ActivityIcon` and the `bg-primary` tile. Show `<img src="/brand.svg" alt="" />` at `size-8` (the file is already the rounded purple tile). Keep the “Brainpules” label, hidden when the rail is collapsed, and keep the mark centered in the 76px header.

## Color tokens

In [admin/src/index.css](admin/src/index.css), recolor only the blue brand roles. Leave `--warning`, `--destructive`, `--success`, and the green, amber, rose, and gray status/KPI tokens as they are.

Light (`:root`):

- `--primary`, `--ring`, `--chart-1`, `--sidebar-primary`, `--sidebar-ring`: `#45058f`
- `--primary-foreground` and `--sidebar-primary-foreground`: `#ffffff` (about 12:1 on this purple)
- `--secondary`, `--accent`, `--sidebar-accent`, `--kpi-0`: a light brand wash `#f3eafb`
- `--secondary-foreground`, `--accent-foreground`, `--sidebar-accent-foreground`: `#45058f`
- `--chart-4`, `--bar-muted`: a softer purple `#d4c4ea` so muted bars are not still blue
- `--chart-5`: a deeper brand purple `#3b0764`

Dark (`.dark`): `#45058f` is too close to the dark surface for text and rings (about 1.6:1). Buttons keep the brand fill with white text. Text, rings, and the first chart series use a lighter brand tint `#c9a6f5` (hsl 268, ~78% lightness).

- `--primary`, `--sidebar-primary`: `#45058f`
- `--accent-foreground`, `--sidebar-accent-foreground`, `--ring`, `--chart-1`, `--sidebar-ring`: `#c9a6f5`
- `--accent`, `--sidebar-accent`, `--kpi-0`: `#2a1844`
- `--chart-4`, `--bar-muted`: `#3d2a5c`

Page and sidebar backgrounds stay the current gray/white and dark navy.

## One leftover hex

[admin/src/pages/reports.tsx](admin/src/pages/reports.tsx) passes `color="#2563eb"` into the score chart. Change it to `var(--primary)` so that bar follows the token. `BarChartCard` already uses the string as an SVG fill.
