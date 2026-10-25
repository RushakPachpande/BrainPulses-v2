# Progress

**Resume point.** Read this file, then `git status`, before continuing.

## Current phase and task

The phased excellence pass for 2026-10-24 is finished. There is no in-progress code task.

Next task, only when a real change needs it: add a failing test for one function inside `activity-wizard.tsx`, `attempts/service.ts`, or `activities/service.ts`, then extract that function. Do not split those files for line count.

## Implementation ledger

1. **Implemented and verified**
   - Admin page tests provide a query client. `npm run test` in `admin/` — 11 passed.
   - Token scripts lint as Node. Admin and client lint have 0 errors.
   - `withTenantOrganization` rejects a foreign organization on create rows. Unit test in `api/test/tenant-scope.test.ts`.
   - Excel question-bank export prefixes formula cells. Same test file.
   - Student start and resume omit `isCorrect` and `answerKey`. `api/test/attempt-payload.test.ts`.
   - Published assessment review still shows `isCorrect` or `correctLabels`. Quiz `QZ-26002` hides them. `api/test/result-review.test.ts`. Policy unchanged.
   - Unknown file download token returns 403 without a stack. `api/test/file-download.test.ts`.
   - Client login renders Unique ID and Sign in. `client/src/pages/login.test.tsx`. 7 client tests passed.
   - Prettier write in api, then admin, then client. Each `format:check` passed.
   - Admin routes: elements in `app-routes.tsx`, `appRouter` only in `index.tsx`. Admin lint has 0 problems.
   - CI workflow `.github/workflows/check.yml` on Node 22. Not run here.

2. **Verified existing behavior**
   - Recheck before new tests: API `npm run test` 41 passed, typecheck PASS, lint PASS.
   - After new tests and API format: 43 passed, lint PASS, format PASS.
   - Tenant-mismatch throw is still not reachable from current routes. HTTP 500 mapping unchanged.
   - Duplicate submit idempotency remains covered by `api/test/attempts.test.ts`.

3. **Documented only**
   - Threat model rows for attempt answers and answer keys now match the code.
   - Bundle sizes recorded below. Not split.

4. **Blocked or deferred**
   - Large-file splits. No test yet that fails when one inner function changes.
   - Coverage percentage. No coverage script. Not invented.
   - Shared admin/client package. React Router majors differ. Not extracted.
   - CI execution. Workflow is in the repo. GitHub has not run it in this session.
   - Entry chunks over 500 kB. Fixed: client pages load on navigation, and React, the router, and TanStack Query are their own chunks in both apps. Builds no longer warn. Largest remaining piece is admin charts at 331 kB.

## Phase status

| Phase | Status | Why |
|---|---|---|
| 0 Baseline | COMPLETE | Audit, map, register, screenshots |
| 1 Quality gates | COMPLETE | Tests, lint errors, format checks now pass |
| 2 Critical flows | COMPLETE | Five flows in `DEPENDENCY_MAP.md` |
| 3 Security | COMPLETE for the checked paths | Attempt payload, review policy locked by test, download token, tenant create guard, Excel formulas. Assessment review behavior kept |
| 4 Tests | COMPLETE for the added cases | API node:test plus client login render. No coverage gate |
| 5–6 Module splits | DEFERRED | Large files left. Route export split is done and is not a service split |
| 7 Shared package | DEFERRED | Copies stay. Reason is the router major mismatch |
| 8 Type sweep | DEFERRED | No new `any` or lint suppressions. No repo-wide type rewrite |
| 9 Visual redesign | DEFERRED | No screen redesign |
| 10 Bundle split | COMPLETE | Client routes are lazy. Vendor groups keep every chunk under 500 kB. Admin charts stay a 331 kB chunk |
| 11 CI | COMPLETE as a file | `.github/workflows/check.yml`. Not executed here |
| 12 Report | COMPLETE | This file and `QUALITY_GATES.md` |

## Commands on this pass

| Command | Result |
|---|---|
| `npm run test`, `typecheck`, `lint` in `api/` before new tests | PASS. 41 tests |
| `node --test test/result-review.test.ts test/file-download.test.ts` | PASS. 2 passed |
| `npx prettier --write .` then format, lint, test in `api/` | PASS. Format clean. 43 tests |
| Same sequence in `admin/` | PASS. Format clean. Lint still had 23 warnings before the route split. 11 tests |
| `npm run lint` in `admin/` after the route split | PASS. No problems printed |
| `npm run typecheck` in `admin/` after the route split | PASS |
| Same format sequence plus typecheck in `client/` | PASS. Format clean. Lint clean. 7 tests. Typecheck PASS |
| `npm run build` in `admin/` | PASS. `index-*.js` 507.67 kB |
| `npm run build` in `client/` | PASS. `index-*.js` 673.07 kB |

## Kept product rule

Published assessments still include review fields. Quizzes include them only when `answersVisibleToStudent` is true. `QZ-26002` in the seed is false, and the test expects an empty review.

## Uncommitted work to preserve

All of the above is still uncommitted. Do not stash or reset.
