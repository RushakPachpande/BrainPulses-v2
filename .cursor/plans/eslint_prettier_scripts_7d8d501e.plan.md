---
name: ESLint Prettier scripts
overview: "Add ESLint, Prettier, and typecheck the same way the PGDM admin app does: tooling lives in `admin/`, and the root `package.json` only forwards those scripts. LevelUP’s current apps do not have this setup, so PGDM admin is the concrete reference."
todos:
  - id: admin-configs
    content: Add admin ESLint and Prettier configs from the PGDM admin app
    status: completed
  - id: admin-deps-scripts
    content: Install ESLint/Prettier devDependencies, drop oxlint, add typecheck/lint/format scripts
    status: completed
  - id: root-scripts
    content: Add root scripts that forward typecheck, lint, format, and check to admin
    status: completed
  - id: verify-check
    content: Run root check, fix lint errors, and format so format:check passes
    status: completed
isProject: false
---

# Add ESLint, Prettier, and typecheck

PGDM ([admin/package.json](D:/Code/PGDM Induction Program/admin/package.json), [eslint.config.js](D:/Code/PGDM Induction Program/admin/eslint.config.js), [.prettierrc.json](D:/Code/PGDM Induction Program/admin/.prettierrc.json)) is the reference. LevelUP’s root and `levelup-admin` only have dev/build/preview plus database helpers, so they are not copied for lint or format.

BrainPulses already typechecks inside `admin` via `tsc -b` on build. Typecheck becomes its own script. ESLint replaces the current `oxlint` lint script. Root stays a marker with no dependencies, matching both reference roots.

## Admin (`admin/`)

Install latest stable devDependencies in [admin/package.json](admin/package.json) (PGDM versions are the floor):

- `eslint`, `@eslint/js`, `typescript-eslint`
- `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`
- `eslint-config-prettier`, `prettier`

Remove `oxlint`. TypeScript is already present (`~6.0.2`), so typecheck needs no new package.

Scripts, matching PGDM admin:

- `typecheck`: `tsc -b --pretty false`
- `lint`: `eslint .`
- `format`: `prettier --write .`
- `format:check`: `prettier --check .`

Leave `dev`, `build`, and `preview` unchanged.

New files, copied from PGDM admin and kept to this Vite app:

- [admin/eslint.config.js](admin/eslint.config.js) — recommended JS + typescript-eslint, React hooks (`rules-of-hooks` error, `exhaustive-deps` warn), `react-refresh/only-export-components` warn, unused vars error with `^_` ignore, `no-explicit-any` off, Prettier last so it turns off conflicting rules. Ignore `dist`, `node_modules`, `coverage`, `.vite`. Lint `src/**/*.{ts,tsx}` and `vite.config.ts`.
- [admin/.prettierrc.json](admin/.prettierrc.json) — `semi`, `singleQuote`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`, `endOfLine: lf`.
- [admin/.prettierignore](admin/.prettierignore) — `node_modules`, `dist`, `coverage`, `*.tsbuildinfo`, `package-lock.json`, env files, `.vite`.

## Root ([package.json](package.json))

No new dependencies. Scripts call admin only (`api/` and `client/` do not exist yet):

- `typecheck`, `lint`, `format`, `format:check` via `npm run <script> --prefix admin`
- `check`: `typecheck` then `lint` then `format:check`

Do not add PGDM’s `verify` or database scripts.

## After install

Run `npm run check` from the repo root. Fix real ESLint errors in existing admin code with the smallest edit. Run Prettier once so `format:check` passes. Current sources mix semicolon styles; PGDM’s `semi: true` will rewrite files that omit them. That format diff is limited to style.

No UI, API, or schema changes. No dev server.