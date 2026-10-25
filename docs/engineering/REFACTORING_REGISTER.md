# Refactoring register

**Status:** Baseline backlog, 2026-10-23. Commit `ac881f3` on branch `fixes`.
**Reader job:** Pick the next bounded change. Do not treat this list as permission to start it.
**Source:** [`BASELINE_AUDIT.md`](BASELINE_AUDIT.md) and [`../architecture/DEPENDENCY_MAP.md`](../architecture/DEPENDENCY_MAP.md).

Severity is impact if left alone, not effort. Items marked done were verified on 2026-10-24.

## Recommended next implementation task

The safe excellence work through 2026-10-24 is in place. Do not hide published assessment reviews. Do not split `activity-wizard.tsx`, `attempts/service.ts`, or `activities/service.ts` until a test fails when one function's result changes.

The admin and client entry chunks were over 500 kB. Student routes are now loaded on navigation, and React, the router, and TanStack Query are separate chunks. Latest builds have no chunk-size warning. Largest pieces: admin `kpi-grid` 331 kB (charts, already separate) and `react` 219 kB.

Do not hide published assessment reviews. Do not split `activity-wizard.tsx`, `attempts/service.ts`, or `activities/service.ts` until a test fails when one function's result changes.

## Register

### R1 — Admin page tests fail closed on QueryClient

**Status:** Done on 2026-10-24. `npm run test` in `admin/` — 11 passed. Helper: `admin/src/test/render-with-query.tsx`. Production pages were not changed.

| | |
|---|---|
| Severity | High. `npm run test:admin` is already red, so later refactors cannot use it as a safety net |
| Evidence | Audit command table. Failures: `admin/src/pages/dashboard.test.tsx`, `admin/src/pages/students.test.tsx`. Error text: `No QueryClient set` |
| Next action | Mount the same query provider the app uses, or a test double, around those two renders |
| Acceptance | `npm run test` in `admin/` passes. Dashboard and students UI behavior stay as captured in `baseline/` |
| Depends on | None |

### R2 — Docs still describe the API as proposed

| | |
|---|---|
| Severity | High. Agents and reviewers will "implement" a backend that already exists, or ignore live auth rules |
| Evidence | Audit section "Doc contradictions". [`TRD.md`](TRD.md), [`docs/README.md`](../README.md), mixed status in [`API_STRUCTURE.md`](../architecture/API_STRUCTURE.md) |
| Next action | Update those pages so current behavior and proposals are labeled separately. Point current API facts at `api/openapi.yaml` and `DEPENDENCY_MAP.md` |
| Acceptance | A reader can tell implemented routes from undecided proposals without opening the source. No product rule changes |
| Depends on | This audit being accepted as the current-state source |

### R3 — Client has no automated tests

**Status:** Login screen covered on 2026-10-24. `client/src/pages/login.test.tsx` renders the Unique ID field and sign-in button. Validation tests remain in `login-validation.test.ts`. Attempt-flow UI tests are still absent.

| | |
|---|---|
| Severity | High for any client refactor. Student sign-in and attempts have no component or end-to-end suite in `client/` |
| Evidence | No test script in `client/package.json`. No `*.test` files under `client/src`. API covers OTP and attempts at HTTP level (`api/test/auth.test.ts`, `api/test/attempts.test.ts`) |
| Next action | Add one client test for the sign-in screen states already visible in `baseline/client-login-*.png` (Unique ID tab, phone tab, validation). Do not add a full E2E stack in that change |
| Acceptance | `npm run test` exists in `client/` and the new test fails if the Unique ID field or sign-in button disappears |
| Depends on | R1 is independent. Do this before editing `client/src/pages/attempt.tsx` or the date-time picker |

### R4 — Format check is red in every package

**Status:** Done on 2026-10-24. `prettier --write` ran in `api/`, then `admin/`, then `client/`. Each package's `format:check` passed afterward. `graphify-out` and generated Prisma output stayed ignored.

| | |
|---|---|
| Severity | Medium. A format-only diff will swamp the next review. API also formats gitignored `api/graphify-out/` |
| Evidence | Audit command table. API 28 files (15 generated graph files). Admin 33. Client 23 |
| Next action | Ignore generated graph output in API Prettier config, then format only the tracked files that Prettier listed, in a commit that does nothing else |
| Acceptance | `npm run format:check` passes in the touched package. No behavior diff |
| Depends on | Do not mix with R1 |

### R5 — Lint error in both design-token scripts

**Status:** Done on 2026-10-24. Admin lint is 0 errors. Client lint is 0 errors. Node globals apply to `scripts/**/*.mjs`. The 23 admin react-refresh warnings remain R6.

| | |
|---|---|
| Severity | Medium. `npm run lint` fails in admin and client |
| Evidence | `admin/scripts/export-design-tokens.mjs:32` and `client/scripts/export-design-tokens.mjs:32`: `'console' is not defined` (`no-undef`) |
| Next action | Give those script files a Node ESLint environment, or move the log. Do not disable the rule for the whole app |
| Acceptance | `npm run lint` in admin has zero errors. Client lint has zero errors. Existing react-refresh warnings are a separate item (R6) |
| Depends on | None |

### R6 — react-refresh warnings on admin route modules

**Status:** Done on 2026-10-24. Route elements live in `admin/src/routes/app-routes.tsx`. `index.tsx` only exports `appRouter`. `npm run lint` in `admin/` reports no problems.

| | |
|---|---|
| Severity | Low. Warnings, not the lint failure |
| Evidence | Admin lint: 23 `react-refresh/only-export-components` warnings, including `admin/src/routes/index.tsx` |
| Next action | Move non-component exports out of component modules when a file is already being edited. Do not mass-move routes just to clear warnings |
| Acceptance | Files touched for another task introduce no new warning of this rule |
| Depends on | Whatever task edits those files |

### R7 — Tenant isolation and attempt integrity tests exist and passed

| | |
|---|---|
| Severity | Info. Keep these tests as the gate before splitting attempt or activity services |
| Evidence | `api/test/tenancy.test.ts`, `api/test/security.test.ts`, `api/test/attempts.test.ts`, `api/test/student-portal.test.ts`. Full API run: 36 passed |
| Next action | Before changing `attempts/service.ts` or `activities/service.ts`, add one characterization test only for a branch the current files do not hit. Do not split the file first |
| Acceptance | API `npm run test` still passes, including the new case |
| Depends on | R1 is not required for API work. R4 should not be mixed in |

### R8 — Plain Error on tenant mismatch becomes HTTP 500

**Status:** Investigated 2026-10-24. No current route can throw it. The 500 mapping was left in place. `createMany` could previously keep a foreign `organizationId`; that path now throws. See ADR-004 and `api/test/tenant-scope.test.ts`.

| | |
|---|---|
| Severity | Medium. A query that sets a foreign `organizationId` throws `Error`, and the error handler maps unknown errors to 500 |
| Evidence | `ensureOrgInWhere` / `injectOrgOnCreate` in `api/src/lib/prisma.ts`. Cross-tenant HTTP tests currently expect **404**, which is the scoped-query path, not this throw |
| Next action | Confirm with one test whether any route can trigger the throw. If it can, map it to 404 without leaking the message. If it cannot, document that and leave the throw |
| Acceptance | A test names the expected status. Response JSON has no stack |
| Depends on | Read of the Prisma extension. Do not change tenant behavior until that test exists |

### R9 — Large modules stay intact until a characterization test names one responsibility

**Status:** Deferred on 2026-10-24. `activity-wizard.tsx`, `attempts/service.ts`, and `activities/service.ts` were not split. A line-count split would change structure without a test that fails when one extracted function's result changes. Leave them until a change inside one function has a failing test first.

| | |
|---|---|
| Severity | Medium long-term. Low as an immediate defect |
| Evidence | Line counts in the audit. Responsibilities are mixed in the wizard, attempt service, activity service, and `admin/src/services/index.ts` |
| Next action | When a change is required inside one of those files, extract the one function that change touches, after a test locks its current result |
| Acceptance | Public HTTP and UI behavior unchanged. The extract has a name that matches one use case |
| Depends on | R1 for admin files. R7 for API files |

### R10 — Admin/client picker and hook copies

| | |
|---|---|
| Severity | Low until one side changes and the other does not |
| Evidence | Audit duplication table. `use-leave-guard` sits on React Router 8 in admin and 7 in client |
| Next action | Do not add a shared workspace package. If a picker bug is fixed, record the behavioral diff and port only the matching change |
| Acceptance | A written parity note exists before any file is deleted from one app |
| Depends on | R3 if the client picker is the one that changes |

### R11 — No root CI workflow

**Status:** Done on 2026-10-24. `.github/workflows/check.yml` runs typecheck, lint, format check, test, and build for api, admin, and client on Node 22. The API job uses ephemeral Postgres and Redis, then `prisma migrate deploy` and seed. It does not touch a production database.

| | |
|---|---|
| Severity | Medium for regression, not a runtime bug |
| Evidence | No `.github/workflows` at the repo root |
| Next action | After R1, R4, and R5 are green locally, add one workflow that runs the same typecheck, lint, format check, test, and build commands. Do not add deploy |
| Acceptance | A pull request cannot merge with a red copy of those commands |
| Depends on | R1, R4, R5. Otherwise the workflow fails on the current baseline |

### R12 — Coverage is unmeasured

| | |
|---|---|
| Severity | Info |
| Evidence | No coverage script. Audit records NOT RUN |
| Next action | Add a coverage command only when a package's tests are green. Do not set a percentage gate in the same change |
| Acceptance | The command prints a report. The register is updated with the number and the date |
| Depends on | R1 for admin. R3 for client. API tests are already green |

## Explicitly not next

- Splitting `activity-wizard.tsx`, attempt service, or activity service to hit a line-count target.
- Merging admin and client, or extracting a shared package for the date-time picker.
- Rewriting `client/src/styles.css` or consolidating theme blocks.
- Dependency upgrades. `npm audit` reported 0 vulnerabilities on this date.
- Editing applied Prisma migrations.
- Claiming ISO, WCAG, or OWASP compliance from this register.
