# Repository audit — Production Hardening Mission

**Date:** 2026-11-07  
**Decisions locked:** Queue/LB **1A** (BullMQ workers; API stays single fork). Frontends **2B** (harden both `participant/` and `client/`).  
**Scope:** Behavior-preserving hardening. No live deploy, no shared-upload migration, no design-system merge.

## Architecture

| Package | Role | Runtime |
| --- | --- | --- |
| `api/` | Express 5 + Prisma 7 + PostgreSQL + Redis (`ioredis`) | Port **3002**, PM2 `brainpulses-api` (1× fork) |
| `admin/` | React 19 + Vite + Tailwind v4 + shadcn | Dev **5173**; prod static nginx |
| `participant/` | Production participant SPA (same generation as client) | Dev **5175**; prod static nginx |
| `client/` | Legacy participant SPA (kept in-repo) | Dev **5174** |

**Authoritative data path:** Browser → API only. Prisma, Redis, uploads, Twilio live under `api/`.

```text
Admin / Participant / Client
            │
            ▼
         API (SoT)
      ┌─────┼─────┐
      ▼     ▼     ▼
   Postgres Redis  uploads/ (local disk)
```

## Stack notes

- **Validation:** Zod middleware on API routes.
- **Auth:** JWT access + Redis refresh (admin); participant OTP + sessions in Redis.
- **Timeouts:** `REQUEST_TIMEOUT_MS` default 30000 (API + SPA `api-client`).
- **Env (API):** production → `.env.prod` then `.env`; otherwise `.env.dev` then `.env` (`api/src/config/load-env.ts`).
- **Deploy:** `setup.sh`, `update-deploy.sh`, nginx samples under `docs/ops/nginx/`, Compose Postgres/Redis.
- **Queue (pre-mission):** none. Heavy Excel export/import and SMS OTP ran on the request thread.
- **CI (pre-mission):** no root `.github/workflows` (docs incorrectly claimed `check.yml`).

## Baseline gate evidence (2026-11-07, this machine)

Node `v26.13.0`, npm `11.20.0`. Commands run without auto-fix.

| Package | typecheck | lint | format:check |
| --- | --- | --- | --- |
| api | pass | pass after ignoring `ecosystem.config.cjs` | fail (many pre-existing Prettier diffs) |
| admin | pass | pass | fail (pre-existing Prettier diffs) |
| participant | pass | pass | fail (pre-existing Prettier diffs) |
| client | pass | pass | fail (pre-existing Prettier diffs) |

Tests and production builds are re-run after implementation; results land in `docs/FINAL_ENGINEERING_REPORT.md`.

**Ports:** Inspected at mission start; reuse existing listeners on 3002/5173/5174/5175. Do not kill user processes. Ask before starting missing servers.

## Risks addressed by this mission

1. Long Excel export/import / SMS can hit the 30s request timeout with no recoverable job id.
2. Single API process + local `UPLOAD_DIR` blocks safe horizontal scale.
3. Admin `VITE_USE_FIXTURES` and always-fixture `getMonths()` can bypass API SoT.
4. Participants admin list still uses horizontal-scroll table (other lists use `ResponsiveRecords`).
5. Missing CI; stale engineering progress docs.
6. No dedicated worker process in PM2.

## Implementation decisions

| Topic | Choice |
| --- | --- |
| Queue | **BullMQ** on existing Redis; dedicated `brainpulses-worker` |
| First jobs | Report exports, spreadsheet imports, SMS OTP |
| API clustering | **Not enabled**; document prerequisites (shared uploads) |
| Response contracts | Additive job endpoints; keep `{ data }` / `{ error }` |
| Frontends | Harden admin + participant + client; no merge/retire of `client/` |
| Format mass-rewrite | **Deferred** — do not reformat entire trees solely for baseline fail |

## Related docs

- Excellence plan: [`BrainPulses_Engineering_Excellence_Plan.md`](./BrainPulses_Engineering_Excellence_Plan.md)
- Prior baseline: [`engineering/BASELINE_AUDIT.md`](./engineering/BASELINE_AUDIT.md)
- Deploy: [`ops/DEPLOY.md`](./ops/DEPLOY.md)
