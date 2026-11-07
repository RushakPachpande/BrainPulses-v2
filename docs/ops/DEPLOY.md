# VPS production deploy — BrainPulses v2.0

Host **API**, **Admin**, and **Participant** on one Ubuntu LTS VPS. No GitHub Actions in this guide.

| Surface | Domain | Runtime |
| --- | --- | --- |
| API | `https://server.brainpulses.com` | PM2 → `127.0.0.1:3002`, nginx HTTPS / HTTP/2 / HTTP/3 |
| Admin | `https://admin.brainpulses.com` | Static files in `/var/www/brainpulses/admin` (HTTPS / h2 / h3) |
| Participant | `https://participant.brainpulses.com` | Static files in `/var/www/brainpulses/participant` (HTTPS / h2 / h3) |
| Postgres | — | Docker Compose `127.0.0.1:5434` |
| Redis | — | Docker Compose `127.0.0.1:6381` |

Repo clone path: `/root/apps/BrainPulses_v2.0`.

Deploy the [`participant/`](../../participant/) package (not legacy [`client/`](../../client/)).

Short checklist: [`DEPLOY.md`](../../DEPLOY.md) at the repo root.

---

## Architecture

```text
Internet
  │
  ├─ admin.brainpulses.com ──nginx──► /var/www/brainpulses/admin
  ├─ participant.brainpulses.com ──nginx──► /var/www/brainpulses/participant
  └─ server.brainpulses.com ──nginx──► 127.0.0.1:3002 (pm2 brainpulses-api)
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
              Postgres :5434 (docker)                     Redis :6381 (docker)
```

- API loads [`api/.env.prod`](../../api/.env.prod.example) when `NODE_ENV=production` ([`load-env.ts`](../../api/src/config/load-env.ts)).
- Admin refresh cookie (`bp_refresh`, path `/api/auth`, `SameSite=lax`) works across `*.brainpulses.com` over HTTPS when CORS lists both SPA origins and `TRUST_PROXY=1`.
- SPA `VITE_*` values are baked at **build** time from `.env.production`.
- Never delete `api/uploads` on deploy.

---

## One-time bootstrap (`setup.sh`)

### Before you run

1. DNS A/AAAA for `server`, `admin`, and `participant.brainpulses.com` → this VPS (must resolve before certbot).
2. Clone the repo to `/root/apps/BrainPulses_v2.0`.
3. Have Twilio credentials and a Let's Encrypt contact email ready.

### Run

```bash
cd /root/apps/BrainPulses_v2.0

export CERTBOT_EMAIL=you@example.com
export TWILIO_ACCOUNT_SID=ACxxxxxxxx
export TWILIO_AUTH_TOKEN=xxxxxxxx
export TWILIO_FROM_NUMBER=+1xxxxxxxxxx

sudo -E bash setup.sh
```

[`setup.sh`](../../setup.sh) will:

1. Install Node 22, Docker, nginx, certbot, rsync, pm2; open ufw for SSH / 80 / 443 (tcp+udp).
2. Create root `.env` with generated Postgres/Redis passwords (if missing).
3. Create `api/.env.prod` from the example; inject DB/Redis URLs and a generated `JWT_SECRET`; apply Twilio from the environment. **Exits** if Twilio placeholders remain.
4. Copy SPA `.env.production` examples when missing.
5. `docker compose up -d` (db+redis only) and wait until healthy.
6. `npm ci` + `prisma migrate deploy` (no seed) + API build + PM2 start/reload with `--env production` + `pm2 save` / startup.
7. Build admin + participant and `rsync` to `/var/www/brainpulses/{admin,participant}`.
8. Certbot standalone certificates (skips if live certs exist); install nginx configs from [`docs/ops/nginx/`](nginx/); strip HTTP/3 lines if nginx lacks `http_v3`; reload nginx.
9. Smoke loopback health and best-effort `curl --http2` to the three hosts.

Re-running is mostly safe: existing secrets and certs are kept; PM2 reloads; nginx configs are re-copied.

### After setup

- Create the **first admin user** yourself (no production seed / demo passwords).
- Optional local DB UIs: `docker compose --profile tools up -d` (loopback + SSH tunnel only).

### Manual fallback

If you prefer step-by-step without the script, the historical order is: packages → env files → `docker compose up -d` → migrate → PM2 → SPA publish → certbot → nginx. Env templates: [`api/.env.prod.example`](../../api/.env.prod.example), [`admin/.env.production.example`](../../admin/.env.production.example), [`participant/.env.production.example`](../../participant/.env.production.example). Nginx samples: [`docs/ops/nginx/`](nginx/).

---

## Update / redeploy (`update-deploy.sh`)

```bash
cd /root/apps/BrainPulses_v2.0
sudo bash update-deploy.sh --pull
# or without git: sudo bash update-deploy.sh
```

[`update-deploy.sh`](../../update-deploy.sh) runs: optional `git pull --ff-only` → `npm ci` (api/admin/participant) → `prisma migrate deploy` → API build → `pm2 reload … --env production` → SPA builds → `rsync` (keeps `admin.prev` / `participant.prev`) → loopback health.

It does **not** change Docker, nginx, certbot, or `api/uploads`.

[`docs/ops/deploy.sh`](deploy.sh) is a thin wrapper that `exec`s the root update script.

### Manual equivalent

1. `npm ci --prefix api && npm ci --prefix admin && npm ci --prefix participant`
2. `NODE_ENV=production npm run prisma:deploy --prefix api` — never `migrate reset` or rewrite applied migrations
3. `npm run build --prefix api` → `pm2 reload brainpulses-api --env production`
4. `npm run build --prefix admin && npm run build --prefix participant`
5. `rsync -a --delete` into the www dirs
6. Hit `/health` and `/health/ready`; spot-check admin + participant login

---

## Smoke checks

```bash
curl -fsS https://server.brainpulses.com/health
curl -fsS https://server.brainpulses.com/health/ready

curl -sI --http2 https://server.brainpulses.com/health | head -n 5
curl -sI --http2 https://admin.brainpulses.com | head -n 5
curl -sI --http2 https://participant.brainpulses.com | head -n 5

# Optional HTTP/3 (needs curl with h3 support + UDP 443 open)
curl -sI --http3 https://server.brainpulses.com/health | head -n 5 || true
```

Browser: sign in on admin (session survives refresh) and participant. DevTools → Network → Protocol should show `h2` or `h3`.

If admin refresh fails, check `CORS_ORIGIN`, HTTPS, `COOKIE_SECURE=true`, and that `/api/auth/refresh` hits `server.brainpulses.com`.

---

## nginx notes (HTTPS / HTTP/2 / HTTP/3)

Configs match LevelUP/DISHA (`http2 on`, TLS 1.2/1.3, HSTS) and add QUIC (`listen … quic`, `http3 on`, `Alt-Svc`). `setup.sh` installs them under `/etc/nginx/conf.d/`.

- Prefer nginx **1.25.1+** with `http_v3`. Check: `nginx -V 2>&1 | grep http_v3`.
- Without HTTP/3, `setup.sh` strips quic/http3/Alt-Svc automatically; HTTPS + HTTP/2 still work.
- Firewall must allow **UDP 443** for HTTP/3.
- After any certbot rewrite, keep `http2 on`, quic listens, `http3 on`, and `Alt-Svc`.

---

## Rollback

| Layer | How |
| --- | --- |
| SPA | `rsync -a --delete /var/www/brainpulses/admin.prev/ /var/www/brainpulses/admin/` (same for participant) |
| API code | `git checkout <previous-tag>` → `sudo bash update-deploy.sh` |
| Database | Migrate **forward** only. Do not delete or rewrite applied Prisma migrations on production |

Uploads stay under `api/uploads` across rollbacks unless you deliberately restore a backup.

---

## Production env checklist

**Root `.env` (Compose):** strong `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (`setup.sh` generates these when creating the file).

**`api/.env.prod`:** `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3002`, matching DB/Redis URLs on `127.0.0.1:5434` / `:6381`, `JWT_SECRET` ≥ 32 chars, `CORS_ORIGIN=https://admin.brainpulses.com,https://participant.brainpulses.com`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=1`, Twilio enabled + credentials, `UPLOAD_DIR=./uploads`.

**`admin/.env.production`:** `VITE_API_URL=https://server.brainpulses.com`, `VITE_PARTICIPANT_ORIGIN=https://participant.brainpulses.com`, `VITE_USE_FIXTURES=false`.

**`participant/.env.production`:** `VITE_API_URL=https://server.brainpulses.com`.

After changing SPA env files, run `update-deploy.sh` so the static builds pick them up.

---

## Ops notes

- **Logs:** `pm2 logs brainpulses-api`; files under `api/logs/`; nginx `/var/log/nginx/`; Compose json-file rotation is already set.
- **Backups:** schedule `pg_dump` (or volume snapshots) for Postgres; Redis AOF is enabled; back up `api/uploads`.
- **Tools profile:** `docker compose --profile tools up -d` starts RedisInsight (`127.0.0.1:5540`) and CloudBeaver (`127.0.0.1:8977`). Use SSH tunnels only.
- **PM2:** always pass `--env production` on start/reload so `NODE_ENV` is set and `.env.prod` is loaded.
- **Root scripts:** `npm run cleaninstall:deploy` installs api + admin + participant for this topology.

---

## Out of scope

- GitHub Actions / CI deploy
- Automatic first-admin bootstrap
- Replacing or removing legacy `client/`
- Cloud IdP / MFA
