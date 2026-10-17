---
name: Admin shadcn Tailwind
overview: Move the vanilla admin app into admin/ as a React + TypeScript app on Tailwind v4 and shadcn, rebuild every current screen with shadcn and lucide-react, map the existing color tokens into light and dark themes, and add a repo rule that frontend UI uses only shadcn.
todos:
  - id: scaffold-admin
    content: Create admin/ with Vite, React, TypeScript, Tailwind v4, and shadcn (New York, lucide)
    status: completed
  - id: theme
    content: Map current color tokens into light and dark shadcn variables and add the Sun/Moon theme toggle
    status: completed
  - id: shell-pages
    content: Rebuild the admin shell and every current screen with shadcn components, preserving routes, data, and sidebar behavior
    status: completed
  - id: rule
    content: Add an always-on rule that frontend UI uses only shadcn and lucide-react
    status: completed
  - id: cleanup-verify
    content: Remove the root vanilla app, build admin/, and verify routes plus the theme toggle in the browser
    status: completed
isProject: false
---

# Admin shadcn, Tailwind, and theme

The current admin UI is vanilla JavaScript at the repo root ([src/main.js](src/main.js), [index.html](index.html), [src/styles/tokens.css](src/styles/tokens.css)). shadcn and lucide-react need React. This pass converts that admin app only. `client/` and `api/` are not created.

Locked choices: rebuild every current screen, live in `admin/`, Tailwind v4 (same generation as LevelUP and the current shadcn CLI).

## What stays the same

- The same screens and paths: dashboard, students, users, assessments (list, banks, create, registrations, reports), quizzes (same five), settings (general, access, notifications, system).
- Fixture data in [src/data/fixtures.js](src/data/fixtures.js) moves as-is. No API.
- Sidebar groups, collapse (persisted), mobile drawer, breadcrumbs, and the top bar (notifications, avatar, Meera Joshi).
- Fonts: Plus Jakarta Sans for UI, Source Sans 3 for body.
- Control height stays 44px (`--control-h`) for inputs, selects, and buttons, per the existing toolbar rule.
- Brand colors stay the current hex values. Dark mode is a second set of tokens built from that same navy and blue. There is no dark palette in the app today.

Addresses change from `#/dashboard` to `/dashboard` via React Router. `/` redirects to `/dashboard`.

## App layout

`admin/` is its own package (own `package.json` and lockfile), like LevelUP. Root [package.json](package.json) becomes a private marker with no Vite app. Dev server stays on port **3001** in `admin/vite.config.ts`.

```text
admin/
  components.json
  index.html
  package.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    index.css              # Tailwind v4 + shadcn theme tokens
    assets/
    components/
      ui/                  # shadcn source only
      theme-toggle.tsx
    contexts/theme.tsx     # light/dark, localStorage
    hooks/
    layouts/admin-layout.tsx
    pages/                 # one module per current screen
    routes/index.tsx
    services/              # current fixture accessors
    lib/utils.ts           # cn()
    utils/
```

shadcn paths stay the CLI defaults (`src/components/ui`, `src/lib/utils`, `src/index.css`). Feature code uses the folders from the React structure reference.

## Setup

- Scaffold `admin/` with Vite, React, and TypeScript.
- Tailwind v4 through `@tailwindcss/vite` and `@import "tailwindcss"` in `src/index.css`. Follow the [Tailwind v4 Vite guide](https://tailwindcss.com/docs/installation/using-vite), not the v3 CLI steps.
- `npx shadcn@latest init` for Vite: New York, CSS variables, lucide as the icon library. Then add only the components the screens need: `sidebar`, `button`, `input`, `select`, `badge`, `card`, `table`, `tabs`, `switch`, `separator`, `tooltip`, `dropdown-menu`, `avatar`, `breadcrumb`, `scroll-area`, `sheet`, `chart`, `sonner`.
- `lucide-react` for every icon, including the theme toggle (Sun / Moon). Remove the inline SVGs in [src/ui/icons.js](src/ui/icons.js).

## Theme

Map [src/styles/tokens.css](src/styles/tokens.css) onto shadcn semantic variables in `admin/src/index.css`.

Light (current hex, unchanged):

- background `#eef1f6`, card `#ffffff`, foreground `#14213d`, muted `#f6f8fb`, muted-foreground `#6b778c`, border `#e3e8ef`
- primary `#2563eb`, primary-foreground `#ffffff`, accent `#e8f0ff`
- sidebar `#0f1b3d`, sidebar accent `#1a2a57`, sidebar text `#b9c6ee`
- destructive `#b91c1c`, warning `#b45309`, success `#15803d`
- radius base `12px` (current `--radius-md`)

Dark (same brand, navy surfaces):

- background `#0f1b3d`, card `#1a2a57`, foreground `#f6f8fb`, muted `#14213d`, muted-foreground `#b9c6ee`, border `#2a3d6e`
- primary stays `#2563eb`
- sidebar `#0b142e` so the chrome stays darker than the page

`contexts/theme.tsx` stores `brainpulses-theme` as `light` or `dark`, defaults to light, and sets the `dark` class on `<html>` before paint to avoid a flash. The top bar gets a shadcn icon button that swaps Sun and Moon and updates its accessible name.

## Screens

Each current render function becomes a page built only from shadcn primitives and Tailwind layout utilities:

- KPI cards, chart cards, activity list, quick actions
- Toolbars: search `Input`, filter `Select`, action `Button`s. Action group stays on the trailing edge and stacks full-width under 640px.
- Tables, status `Badge`s, row actions
- Tabs for the segment chips
- `Switch` for settings toggles
- Bar charts through the shadcn chart component, using the current series, captions, and chart colors (`#7c3aed`, `#16a34a`, `#2563eb`, `#bcd0f7`)

Buttons, inputs, and selects use height `var(--control-h)`.

## Repo rule

Add [.cursor/rules/shadcn-only-ui.mdc](.cursor/rules/shadcn-only-ui.mdc) with `alwaysApply: true`.

- Frontend UI (this `admin/` app and the future client app) uses shadcn components from `components/ui` only.
- Icons come from `lucide-react` only.
- Tailwind utilities are for layout and spacing.
- Do not add another UI kit (MUI, Chakra, Ant Design, Bootstrap, Headless UI) or hand-rolled buttons, inputs, selects, dialogs, tables, badges, switches, or tabs.
- Radix is allowed only inside the generated shadcn components.
- The future Express API is not a UI surface.

Also point the port notes in the close-terminals and secure-dependencies rules from `web/` to `admin/`, since that is where Vite will live.

## Cleanup

Remove the root vanilla app after `admin/` builds: [src/](src/), [index.html](index.html), [vite.config.js](vite.config.js), and the root Vite dependency. Leave `references/`, `.cursor/`, and `.agents/` in place.

## Check

- `npm run build` in `admin/`.
- In the browser: every route, sidebar collapse and mobile drawer, light/dark toggle with persistence, and desktop plus a ~375px width.