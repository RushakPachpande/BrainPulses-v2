---
name: Static admin foundation
overview: "Turn the single admin mock into a Vite static site at the repo root: shared shell, hash routes for all 17 screens, and sample data behind a small data layer so a future API can replace it without rewriting the UI."
todos:
  - id: vite-shell
    content: Add Vite config, package.json, index.html, and split CSS tokens/layout/components
    status: completed
  - id: modules
    content: Move fixtures, widgets, routes, and the 17 screens into src modules with hash navigation
    status: completed
  - id: verify-remove
    content: Build, spot-check desktop and mobile, then remove the monolith HTML
    status: completed
isProject: false
---

# Static Brainpules admin foundation

## What this is

Replace [brainpules-admin-ui.html](brainpules-admin-ui.html) with a Vite app of plain HTML, CSS, and JS modules. `npm run build` emits a static `dist/` folder. No React and no API yet. The reference [quiztel](references/reference-projects/brainpulses/quiztel) app is Vite too, so this can later gain a React UI and an Express API beside it without throwing away the screens.

The prototype screen strip goes away. The sidebar is the real navigation. Hash routes (`#/students`) so the built site works on any static host without rewrite rules.

## Layout

- [index.html](index.html) — shell only: skip link, sidebar, top bar, `#main`. Vite entry.
- [package.json](package.json) — `dev`, `build`, `preview`. Vite 6, same major as quiztel. No UI libraries.
- [vite.config.js](vite.config.js) — `server.port` 3001, `build.outDir` `dist` (already gitignored).
- `src/main.js` — boot shell, listen to `hashchange`.
- `src/routes.js` — the 17 paths and titles.
- `src/styles/tokens.css` — existing color, type, radius, and shadow tokens, unchanged.
- `src/styles/base.css` and `src/styles/components.css` — layout and components split out of the monolith.
- `src/ui/icons.js`, `src/ui/widgets.js` — SVG icons, pills, tables, filters, KPIs, charts, toggles.
- `src/data/fixtures.js` — the current India sample rows.
- `src/data/index.js` — `getStudents()`, `getAssessments()`, and the other readers. Screens call these, not the raw arrays, so a later fetch client can replace this file.
- `src/screens/` — `dashboard.js`, `students.js`, `users.js`, `assessments.js`, `quizzes.js`, `settings.js`. Assessment and quiz modules take a `kind` argument, same as today.

## Routes

- `#/dashboard` (default `#/`)
- `#/students`, `#/users`
- `#/assessments`, `#/assessments/banks`, `#/assessments/new`, `#/assessments/registrations`, `#/assessments/reports`
- `#/quizzes`, `#/quizzes/banks`, `#/quizzes/new`, `#/quizzes/registrations`, `#/quizzes/reports`
- `#/settings`, `#/settings/access`, `#/settings/notifications`, `#/settings/system`

Unknown hashes fall back to the dashboard. Active nav uses `aria-current`. Mobile drawer, focus, and reduced-motion stay as they are.

## Cleanup

Delete [brainpules-admin-ui.html](brainpules-admin-ui.html) once the Vite app renders the same screens. Leave [references/](references/) untouched.

## Check

`npm run build` must succeed. Open the dev server and click dashboard, a table screen, a create form, and the phone-width drawer. Confirm there is no page-level horizontal scroll.