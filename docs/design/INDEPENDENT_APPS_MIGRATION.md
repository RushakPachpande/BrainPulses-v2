# BrainPulses — Independent frontend migration

This project now consists of three individually installable apps: `api`, `admin`, and `client`. The API is the data/authorization source of truth, not a design-system dependency.

## What moved

- Former `design-system/tokens.css` → `admin/src/styles/tokens.css` and `client/src/styles/tokens.css` (light/dark CSS variables and `--control-h` unchanged).
- The DateTimePicker JSX/CSS already existed in both apps; the root canonical copies were removed. Both are now separately maintained and include the `useLayoutEffect` popup-positioning fix.
- Design docs, Figma handoff, machine-readable tokens, and the dependency-free preview are retained in **each app** at `docs/design-system/`.
- Each app has its own `scripts/export-design-tokens.mjs` and `npm run design:tokens`, independent of the project root.
- Removed the root `design-system/` directory, root design helper scripts, and root `design:tokens`, `design:check`, and `design:picker:sync` scripts.
- Updated app-level imports in `admin/src/main.tsx` and `client/src/main.tsx` only; existing UI components, layouts, routes, and API contracts are preserved.

## Installation / testing

From the repository root, `npm run cleaninstall` or `npm run install` still installs all three apps. Alternatively run these commands separately from each app directory:

```bash
cd admin && npm ci && npm run typecheck && npm run build
cd ../client && npm ci && npm run typecheck && npm run build
cd ../api && npm ci && npm run typecheck && npm run build
```

For a single app, `npm run dev` starts its dev server. For token handoff regeneration, run `npm run design:tokens` in the desired frontend directory. Open `docs/design-system/preview.html` as a local file for a standalone light/dark visual reference.

## Change ownership

Each frontend owns its own component and CSS runtime. Theme changes in one app do not automatically propagate to the other. If cross-app consistency is desired, coordinate intentionally rather than relying on an implicit root dependency. Do not delete the Admin app's `/settings/design-system` React route—it is an application screen, not a repository-level folder.
