# Environment configuration

All apps use the same fixed rule. No other env filenames are loaded
(`.env.production`, `.env.local`, `.env.p`, `.env.[mode]`, etc.).

| Mode | Priority (first file found wins) |
| --- | --- |
| production | `.env.prod` → `.env` |
| otherwise | `.env.dev` → `.env` |

## API (`api/`)

Loader: [`api/src/config/load-env.ts`](../api/src/config/load-env.ts).

Keyed off process `NODE_ENV` (shell / nodemon / PM2). Development never loads
`.env.prod`. Production never loads `.env.dev`.

Templates: `api/.env.dev.example`, `api/.env.prod.example`.

Queue knobs (optional; code defaults exist): `QUEUE_INLINE`, `QUEUE_CONCURRENCY`,
`QUEUE_MAX_WAITING`, `QUEUE_JOB_ATTEMPTS`, `QUEUE_BACKOFF_MS`, `QUEUE_JOB_TIMEOUT_MS`.

PM2 starts with `--env production` so `NODE_ENV=production` before load-env runs.

## Admin / Participant (Vite)

Loader: `load-fixed-env.ts` in each app + `envDir: false` in `vite.config.ts`
(so Vite does not auto-load `.env.production` / `.env.local`).

- **`mode` `development`** (and other non-prod modes) → `.env.dev` → `.env`
- **`mode` `production`** or **`singlefile`** → `.env.prod` → `.env`
- **`PORT`** — each SPA’s `vite.config.ts` reads `PORT` for `server` / `preview`.
  Defaults: admin `5173`, participant `5174`.
- Dev: Vite proxy to API; `VITE_API_URL` ignored for same-origin `/api`.
- Production build: bake `VITE_API_URL` from `.env.prod`.
- Admin `VITE_USE_FIXTURES` is **DEV-only**; production builds always call the API.
- When you change **api `PORT`**, update each SPA’s `VITE_API_URL` /
  `VITE_API_PROXY_TARGET`. When you change **participant `PORT`**, update admin
  `VITE_PARTICIPANT_DEV_PORT` for local registration links.

Templates: `admin/.env.dev.example`, `admin/.env.prod.example`,
`participant/.env.dev.example`, `participant/.env.prod.example`.
