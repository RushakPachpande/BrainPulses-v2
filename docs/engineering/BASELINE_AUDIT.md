# Baseline audit

**Status:** Phase 0 evidence, 2026-10-23. Commit `ac881f3` on branch `fixes`.
**Reader job:** See what was true on that date before any refactor from the [Engineering Excellence Plan](../BrainPulses_Engineering_Excellence_Plan.md).
**Limits:** This is not a certification, penetration test, or coverage report. Application code was not changed. Real `.env` files were not opened. Secret values are not recorded here.

The ordered backlog is [`REFACTORING_REGISTER.md`](REFACTORING_REGISTER.md). Flow traces are [`../architecture/DEPENDENCY_MAP.md`](../architecture/DEPENDENCY_MAP.md).

## Architecture summary

**Verified.** Three apps, Node `>=22` in each `package.json`. This machine was Node `v24.21.0` and npm `11.19.0`.

| App | Role | Entry |
|---|---|---|
| `api/` | Express 5, Prisma 7, PostgreSQL, Redis, JWT access tokens plus refresh cookies | [`api/src/app.ts`](../../api/src/app.ts) listens on port **3002** |
| `admin/` | React 19, Vite 8, Tailwind v4, Radix/shadcn | Port **5173**. Router: [`admin/src/routes/index.tsx`](../../admin/src/routes/index.tsx) |
| `client/` | Student portal, same generation of React/Vite | Port **5174**. Router: [`client/src/App.tsx`](../../client/src/App.tsx) |

API modules under `api/src/modules/`: activities, attempts, audit, auth, banks, dashboard, files, leaderboards, registrations, results, settings, student-portal, students, users. Shared code is in `api/src/lib/` and `api/src/middleware/`. Controllers translate HTTP; services own rules; Prisma is called from services and `api/src/lib/prisma.ts`.

Root [`package.json`](../../package.json) only forwards scripts, plus `concurrently`. `npm run check` expands to:

1. API `typecheck`, `lint`, `format:check`, then API `test` (via `check:api`)
2. Admin `typecheck`, `lint`, `format:check`
3. Admin `test` again as its own step
4. Client `typecheck`, `lint`, `format:check`

It does not build. It does not run a client test suite. There is no `test:client` script.

## Git and toolchain

**Verified** at the start of this audit, before these documents were added.

- Branch `fixes`, HEAD `ac881f3` (`feat: refactor routing and navigation structure in admin and client applications`).
- Tracked tree was clean. Untracked: `docs/BrainPulses_Engineering_Excellence_Plan.md` and `.cursor/plans/excellence_baseline_audit_2f164b80.plan.md`.
- Lockfiles present: root, `api/`, `admin/`, `client/`.
- No `.github/workflows` at the repo root. Workflows under `references/` are not this app.

Recent history on this branch is feature work (routing, quiz import/export, rounds, leaderboards). It is not a greenfield scaffold.

## Ownership inventory

| Kind | Where | Notes |
|---|---|---|
| API source | `api/src` except `api/src/generated/` | Hand-written |
| Generated Prisma client | `api/src/generated/prisma/` | Gitignored (`**/generated/prisma/`). `prisma generate` rewrites it. Do not hand-edit |
| Schema and migrations | `api/prisma/schema.prisma`, `api/prisma/migrations/` | Nine migrations, `20261014195541_init` through `20261022100000_rename_stem_to_question`. Not reset or edited |
| Seed | `api/prisma/seed.ts` | Local data. Not a production dump |
| API tests | `api/test/*.test.ts` | `node:test` via `tsx` |
| Admin source and fixtures | `admin/src`, fixtures in `admin/src/services/` | Fixtures are the fallback when `VITE_USE_FIXTURES=true` |
| Admin tests | six `*.test.ts(x)` files under `admin/src` | Vitest |
| Client source | `client/src` | No `*.test` / `*.spec` files |
| Design tokens source | `admin/src/index.css`, `client/src/styles.css` | Last `:root` / `.dark` blocks are the theme |
| Generated knowledge graph | `graphify-out/`, `api/graphify-out/` | Gitignored. Not source |
| Build output | `dist/` | Gitignored. Produced by the builds below |

Large files, line counts **verified** by file length. Line count is a review signal, not a split order.

| File | Lines |
|---|---|
| `client/src/styles.css` | 4,026 |
| `admin/src/pages/activity-wizard.tsx` | 1,278 |
| `admin/src/index.css` | 1,015 |
| `api/src/modules/attempts/service.ts` | 948 |
| `api/src/modules/activities/service.ts` | 862 |
| `admin/src/services/index.ts` | 828 |
| `api/src/modules/banks/service.ts` | 741 |
| `admin/src/pages/question-banks.tsx` | 671 |
| `admin/src/pages/bank-form.tsx` | 654 |
| `api/src/modules/banks/import-export.ts` | 662 |

## Environment names

**Verified** from [`api/src/config/env.ts`](../../api/src/config/env.ts) and example files only. Values are omitted.

API: `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_EXPIRES_IN`, `STUDENT_JWT_ACCESS_EXPIRES_IN`, `JWT_ORG_SELECT_EXPIRES_IN`, `REFRESH_TOKEN_TTL_SECONDS`, `CORS_ORIGIN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `UPLOAD_DIR`, `FILE_DOWNLOAD_TTL_SECONDS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `REQUEST_TIMEOUT_MS`, `TRUST_PROXY`, `DASHBOARD_CACHE_TTL_SECONDS`, `TWILIO_ENABLED`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Tests may also set `ENABLE_RATE_LIMIT_IN_TEST`.

Production startup in `env.ts` rejects a short `JWT_SECRET`, `COOKIE_SECURE` other than true, and missing Twilio settings. Non-production defaults exist for several non-secret settings. `JWT_SECRET` and `DATABASE_URL` have no insecure default; they must be present.

Browser examples (`admin/.env.example`, `client/.env.example`): `VITE_API_URL`, and on admin `VITE_USE_FIXTURES`. Optional `VITE_API_PROXY_TARGET`. No privileged secret name uses a `VITE_` prefix in those examples.

Compose example (root `.env.example`): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `CLOUDBEAVER_ADMIN_USER`, `CLOUDBEAVER_ADMIN_PASSWORD`, `CLOUDBEAVER_SERVER_URL`.

`git ls-files` shows no tracked env file except `*.example`. `git check-ignore` ignores `.env`, `api/.env`, `admin/.env`, `client/.env`, `api/.env.dev`, and `api/.env.prod`. API tests and `prisma generate` reported that they loaded `api/.env.dev`. This audit did not print that file.

## Recheck on 2026-10-24

Branch still `fixes` at `ac881f3` before these code edits. Re-ran the gates that the first audit had marked failing.

| Command | Result | Change since 2026-10-23 |
|---|---|---|
| `admin` `npm run test` | PASS | 11 passed, 6 files. The two `No QueryClient set` failures are fixed |
| `admin` `npm run lint` | PASS with warnings | 0 errors, 23 pre-existing `react-refresh/only-export-components` warnings in `admin/src/routes/index.tsx` |
| `admin` `npm run typecheck` | PASS | Includes the new test helper |
| `client` `npm run lint` | PASS | The `console` error in `scripts/export-design-tokens.mjs` is gone |
| `client` `npm run test` | PASS | New. 6 tests in `src/lib/login-validation.test.ts` |
| `client` `npm run typecheck` | PASS | |
| Format checks | Still FAIL | Not re-run across the whole tree. `api/.prettierignore` now excludes `graphify-out`. Tracked source files were not mass-formatted |
| API tests | NOT RE-RUN | No API source change in this session. The 2026-10-23 result remains the latest full run |

## Command results

Commands were non-mutating except `npm run build`, which writes gitignored `dist/` and regenerates the gitignored Prisma client. No `--fix`, no format write, no migrate, no `db:reset`.

| Command | Result | Evidence |
|---|---|---|
| `api` `npm run typecheck` | PASS | `tsc --noEmit` exit 0 |
| `api` `npm run lint` | PASS | `eslint .` exit 0 |
| `api` `npm run format:check` | FAIL | Prettier reported 28 files: 15 under gitignored `api/graphify-out/`, plus `prisma/seed.ts`, `src/app.ts`, `src/config/env.ts`, `src/index.ts`, `src/middleware/request-timeout.ts`, activities controller and service, attempts `admin-controller.ts` and `service.ts`, `banks/import-export.ts`, `leaderboards/service.ts`, `test/attempts.test.ts`, `test/scoring.test.ts` |
| `api` `npm run test` | PASS | 36 passed, 0 failed, 9 suites, about 97s. Suites: attempts, auth, cors-origin, quiz-ops, scoring, security, student portal, tenancy |
| `api` `npm run build` | PASS | `prisma generate` then `tsc` exit 0 |
| `admin` `npm run typecheck` | PASS | exit 0 |
| `admin` `npm run lint` | FAIL | 1 error, 23 warnings. Error: `console` is not defined in `admin/scripts/export-design-tokens.mjs:32`. Warnings: `react-refresh/only-export-components` in route and context modules |
| `admin` `npm run format:check` | FAIL | 33 files, including pages, `src/services/index.ts`, date-time picker, package.json, design-system docs |
| `admin` `npm run test` | FAIL | 2 failed, 9 passed, 6 files. Both failures are `No QueryClient set` in `dashboard.test.tsx` and `students.test.tsx` |
| `admin` `npm run build` | PASS | Vite 8 production build exit 0 |
| `client` `npm run typecheck` | PASS | exit 0 |
| `client` `npm run lint` | FAIL | 1 error, 0 warnings. `console` is not defined in `client/scripts/export-design-tokens.mjs:32` |
| `client` `npm run format:check` | FAIL | 23 files, including `src/styles.css`, date-time picker, pages, `src/services/api.ts` |
| `client` `npm run test` | NOT RUN | No test script |
| `client` `npm run build` | PASS | Vite production build exit 0 (`built in 5.38s`) |
| root `npm run audit:all` | PASS | `npm audit` reported 0 vulnerabilities in api, admin, and client |
| Coverage | NOT RUN | No coverage script in the three package manifests. No percentage is claimed |

`npm run check` was not run as a single root command. The rows above are the same steps, split so a failure stays attached to one package. Running the root script would repeat API tests once and admin tests once, and would still fail on admin lint, admin tests, and every format check.

## UI captures

Dev servers for this capture were started only after confirming ports 3002, 5173, and 5174 were free, then stopped. Screenshots are in [`baseline/`](baseline/).

The Cursor browser already had an admin session, so `http://localhost:5173/login` redirected to the dashboard. The login form itself was not captured. The student app had no session, so its login screen was captured. Phone OTP was not submitted.

Theme default in code is dark unless storage says light (`brainpulses-theme`, `brainpulses-client-theme`). Both were returned to dark after the light captures.

Widths 375 and 768 were applied with a device-metrics override. The PNG frame is wider than that override; the laid-out page sits on the left. Empty space on the right of those files is the host window, not a second column of the app.

| File | What it shows |
|---|---|
| `baseline/admin-dashboard-dark-1280.png` | Live dashboard, dark, sidebar open. KPIs: 12 students, 1 active assessment, 1 active quiz |
| `baseline/admin-dashboard-dark-768.png` | Same page. Sidebar stays visible; KPI grid wraps to two columns |
| `baseline/admin-dashboard-dark-375.png` | Sidebar hidden behind the menu control. KPI cards stack |
| `baseline/admin-dashboard-light-1280.png` | Same dashboard after the theme toggle. Computed body background `rgb(250, 250, 255)` |
| `baseline/admin-students-light-1280.png` | Students list from the API. Table columns extend past the viewport (horizontal table scroll). City filter is clipped at the right edge |
| `baseline/admin-students-light-375.png` | Filters and actions stack full width. Table remains horizontally scrollable |
| `baseline/client-login-dark-1280.png` | Student sign-in, Unique ID tab, dark |
| `baseline/client-login-dark-768.png` | Same card, centered |
| `baseline/client-login-dark-375.png` | Card fits the 375 column. Footer links sit at the bottom of the column |
| `baseline/client-login-light-1280.png` | Same screen, light. Computed body background `rgb(250, 250, 255)` |

**Unknown:** keyboard-only pass, contrast measurements, and an authenticated student attempt screen. Not claimed from these images.

## Doc contradictions

**Verified** by reading the docs and the code on this date. These files were not rewritten in this pass.

| Document | What it says | What the code does |
|---|---|---|
| [`docs/README.md`](../README.md) verified-facts section | Admin uses fixtures. Frontend inspection does not establish an API, database, or auth | API, Prisma, and auth exist. Admin uses the API when `VITE_USE_FIXTURES` is not `true` |
| [`docs/engineering/TRD.md`](TRD.md) | Production architecture is proposed. Diagram stops at fixture services. "This is not evidence of a production API" | Express API, migrations, and session tests exist |
| [`docs/architecture/API_STRUCTURE.md`](../architecture/API_STRUCTURE.md) | "Implemented for local UAT" and also "Confirm response format before implementation" | OpenAPI file and controllers exist. Some sections are still written as proposals |
| [`docs/engineering/TESTING_QA.md`](TESTING_QA.md) command list | Documents admin commands only | API and client commands also exist. Client has no test script |

## Duplication inventory

**Verified** by file comparison during planning and rechecked paths here. No shared package was added.

| Item | Classification | Evidence |
|---|---|---|
| `use-debounced-value.ts` in admin and client | Exact duplicate | Same hook, both apps |
| `use-leave-guard.ts` in admin and client | Exact text, different runtime | Admin `react-router` `^8.4.0`, client `^7.13.0` |
| `date-time-picker.tsx` and `.css` | Near copy | Header comment differs (Admin vs Client). Behavior parity was not retested in this pass |
| Token stylesheets | Conceptual | Both implement the same theme; files are not the same length (`index.css` 1,015 lines, `styles.css` 4,026). Do not merge blindly |
| Prisma client | Generated | Fix the schema, then `prisma generate` |

Sharing those hooks through a new workspace package is deferred. The React Router major mismatch is enough reason to keep `use-leave-guard` local until a parity check exists.
