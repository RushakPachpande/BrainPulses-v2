# Environment configuration

## API (`api/`)

Loader: [`api/src/config/load-env.ts`](../api/src/config/load-env.ts).

| `NODE_ENV` | Priority |
| --- | --- |
| `production` | `.env.prod` → `.env` |
| otherwise | `.env.dev` → `.env` |

Development never loads `.env.prod`. Production never loads `.env.dev`. Templates: `.env.dev.example`, `.env.prod.example` (placeholders only).

Queue knobs: `QUEUE_INLINE`, `QUEUE_CONCURRENCY`, `QUEUE_MAX_WAITING`, `QUEUE_JOB_ATTEMPTS`, `QUEUE_BACKOFF_MS`, `QUEUE_JOB_TIMEOUT_MS`.

PM2 starts with `--env production` so `NODE_ENV=production` before load-env runs.

## Admin / Participant / Client (Vite)

- **`PORT`** — each SPA’s `vite.config.ts` reads `PORT` from the env file (or process env) for `server` and `preview`. Defaults: admin `5173`, client `5174`, participant `5175`.
- Dev: Vite proxy to API; `VITE_API_URL` ignored for same-origin `/api`.
- Production build: bake `VITE_API_URL` from `.env.production`. `PORT` still applies to local `vite preview`.
- Admin `VITE_USE_FIXTURES` is **DEV-only**; production builds always call the API.
- When you change **api `PORT`**, update each SPA’s `VITE_API_URL` / `VITE_API_PROXY_TARGET`. When you change **participant `PORT`**, update admin `VITE_PARTICIPANT_DEV_PORT` for local registration links.

Examples: `admin/.env.example`, `admin/.env.production.example`, `participant/.env.example`, `participant/.env.production.example`, `client/.env.example`, `client/.env.production.example`.
