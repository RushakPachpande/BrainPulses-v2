# Final engineering report — Production Hardening Mission

**Date:** 2026-11-07  
**Decisions:** Queue/LB **1A** (BullMQ + worker; API single fork). Frontends **2B** (admin + participant + client).

## 1. Executive summary

BrainPulses was hardened without redesigning either SPA design system and without live production deploy. The API gained a Redis BullMQ queue and PM2 worker for exports, imports, and SMS OTP; frontends poll job status with the existing 30s per-request timeout. Admin fixture mode is DEV-only. CI check workflows and a manual-only deploy workflow were added. Documentation was synchronized with the live topology.

## 2. Repository audit

See [`REPOSITORY_AUDIT.md`](./REPOSITORY_AUDIT.md). Four packages: `api/`, `admin/`, `participant/`, `client/`. Postgres + Redis via Compose. Pre-mission: no job queue, no root CI, single PM2 API process.

## 3. Architectural changes

- **Queue:** BullMQ on existing Redis; processors in `api/src/lib/queue/`; worker entry `api/src/worker.ts`.
- **Jobs API:** `GET /api/jobs/:jobId`, `GET /api/jobs/:jobId/download`.
- **Exports / imports:** enqueue → 202 (or inline complete in test) → poll → download/result.
- **SMS OTP:** enqueue with direct-send fallback if queue unavailable.
- **SoT:** Admin `VITE_USE_FIXTURES` ignored in production builds; `getMonths()` no longer reads fixtures.
- **Responsive:** Participants people table uses `ResponsiveRecords`.
- **PM2:** `brainpulses-worker` added; deploy scripts use `startOrReload` on the ecosystem file.
- **CI:** `.github/workflows/check.yml` and `deploy.yml` are both `workflow_dispatch` only (no push/PR deploy or check).

## 4. File changes (high level)

**Added:** queue lib, worker, jobs module, admin `lib/jobs.ts`, CI workflows, docs (`REPOSITORY_AUDIT`, `QUEUE_SYSTEM`, `PM2_CONFIGURATION`, `LOAD_BALANCING`, `FILE_UPLOADS`, `ENVIRONMENT_CONFIGURATION`, `GITHUB_ACTIONS`, `DEPENDENCIES_AND_SECURITY`, this report), tests for queue/timeouts/jobs.

**Modified:** export/import/auth controllers, admin services/download flows, participants page, ecosystem + setup/update scripts, env examples, ops docs.

**Removed:** none required (fixtures remain for DEV).

Moved files: none. References updated for new routes and PM2 processes.

## 5. Backend improvements

Validated request path → enqueue → worker → authoritative job status. Backpressure via `QUEUE_MAX_WAITING` → 503 `SERVICE_UNAVAILABLE`. Correlation via existing `x-request-id` on enqueue metadata. API remains single fork; LB path documented.

## 6. Frontend improvements

Admin/participant/client already enforced 30s timeouts; admin gained job polling for exports/imports. Design systems preserved (admin shadcn; participant/client CSS). Participants table responsive panels.

## 7. Environment configuration

API prod/dev file isolation unchanged; queue knobs documented in `.env.*.example`. Admin fixtures DEV-gated.

## 8. Security improvements

Upload staging under `uploads/temporary/jobs` (gitignored with `uploads/`). Dependency audit documented; Zod major deferred. No secrets committed.

## 9. Testing results

| Suite | Result | Notes |
| --- | --- | --- |
| `api` typecheck / lint / build | **pass** | After `npm ci` restore |
| `api` `test/queue.test.ts` | **pass** (4) | Inline queue mode |
| `api` full `npm test` | **fail** (pre-existing) | Fixture/schema drift (tenancy unique, portal 403, etc.) — not introduced by this mission; documented as baseline |
| `admin` typecheck / test / build | **pass** | 20 tests |
| `participant` typecheck / test / build | **pass** | 8 tests |
| `client` typecheck / test / build | **pass** | 8 tests |
| format:check | **fail** (pre-existing) | Mass Prettier drift deferred |

## 10. End-to-end testing

| Scenario | Outcome |
| --- | --- |
| Production builds (api/admin/participant/client) | Verified |
| Inline queue SMS + job snapshot | Verified in unit test |
| Live VPS deploy / multi-instance LB | **Not executed** (requires approval) |
| Worker restart with Redis jobs | **Not executed** against live Redis worker process in this session |
| Browser mobile/smoke at all listed viewports | **Not fully executed** — participants ResponsiveRecords wired; no browser automation run |
| Full API regression suite | Pre-existing failures remain |

## 11. Performance and reliability

Heavy Excel export/import and SMS are off the default request-completion path when a worker is running. Client still waits via polling with 30s per request. API clustering deferred pending shared uploads.

## 12. Production readiness

PM2 ecosystem includes API + worker; setup/update scripts reload both. Manual GitHub deploy workflow present but **not run**. Ready for operator-approved VPS update after secrets configured.

## 13. Documentation changes

New mission docs listed above; updated `DEPLOY.md`, `docs/ops/DEPLOY.md`, `docs/README.md`, `docs/engineering/PROGRESS.md`.

## 14. Outstanding issues

- Full API test suite failures (seed/schema expectations) predating this mission.
- Zod 4 major upgrade deferred.
- Admin CLI (`shadcn`) audit noise deferred.
- Shared upload storage / API cluster not enabled.
- Live E2E against running stack not completed in this session (ports not assumed started).

## 15. Final status

| Item | Status |
| --- | --- |
| BullMQ + worker + job APIs | Implemented and typechecked/built; unit-tested inline |
| Admin SoT fixture lockdown + responsive participants | Implemented and tested |
| PM2 / deploy script / docs | Implemented |
| CI check + manual deploy workflows | Implemented (not executed on GitHub here) |
| Live production deploy | Blocked — needs explicit approval |
| API cluster / shared uploads | Not implemented — by design (1A) |
| Full API regression green | Not achieved — pre-existing failures |
