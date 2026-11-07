---
name: Root Setup Scripts
overview: Add root `setup.sh` (full first-boot automation) and `update-deploy.sh` (repeatable updates), keep a thin wrapper at `docs/ops/deploy.sh`, refresh the detailed ops guide, and add a short root `DEPLOY.md`.
todos:
  - id: setup-sh
    content: "Add root setup.sh: packages, secrets, docker, migrate, pm2, SPAs, certbot, nginx h2/h3"
    status: completed
  - id: update-deploy-sh
    content: Add root update-deploy.sh; make docs/ops/deploy.sh a thin wrapper
    status: completed
  - id: docs-detailed
    content: Rewrite docs/ops/DEPLOY.md around setup.sh / update-deploy.sh
    status: completed
  - id: docs-root
    content: Add concise root DEPLOY.md; link from README
    status: completed
isProject: false
---

# Root setup + update deploy scripts

## Script contract

| Script | Role |
|---|---|
| [`setup.sh`](setup.sh) (repo root) | One-time VPS bootstrap: packages, secrets, Docker, migrate, PM2, SPA publish, nginx HTTPS/h2/h3, certbot |
| [`update-deploy.sh`](update-deploy.sh) (repo root) | Every release: `git pull` optional flag, ci, migrate, build, pm2 reload, rsync (moves logic from [`docs/ops/deploy.sh`](docs/ops/deploy.sh)) |
| [`docs/ops/deploy.sh`](docs/ops/deploy.sh) | Thin wrapper: `exec` root [`update-deploy.sh`](update-deploy.sh) so old paths keep working |

Both scripts: `set -euo pipefail`, resolve `REPO_ROOT` from their own location (so they work even if cwd differs), require root, LF via [`.gitattributes`](.gitattributes).

**Defaults locked (cannot invent):**

- Before/with `setup.sh`, operator sets `CERTBOT_EMAIL` (required).
- Twilio: if `api/.env.prod` is missing, copy the example then overlay `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` from the environment when present; if placeholders remain (`replace-me` / `+1xxxxxxxxxx`), **exit with a clear error** listing the vars to export or edit.
- Auto-generate and write: root `.env` `POSTGRES_PASSWORD` / `REDIS_PASSWORD`, `JWT_SECRET` (≥32), and matching `DATABASE_URL` / `REDIS_URL` in `api/.env.prod`. SPA `.env.production` files from examples when missing (domains already correct).
- No `prisma seed`. Script prints that the first admin must be created manually after setup.
- DNS must already point at this VPS before certbot runs.

## `setup.sh` steps (in order)

1. Assert root, Ubuntu-ish `apt-get`, Node will be installed.
2. Install: Node 22 (NodeSource), Docker + compose plugin, nginx, certbot, rsync, ufw (if available); `npm i -g pm2`.
3. Firewall: allow OpenSSH, `80/tcp`, `443/tcp`, `443/udp`.
4. Ensure dirs: `api/logs`, `api/uploads`, `/var/www/brainpulses/{admin,participant}`.
5. Env bootstrap as above; refuse placeholder Twilio.
6. `docker compose up -d` (db+redis only); wait until healthy (`pg_isready` / redis ping loop, timeout ~120s).
7. `npm ci` api → `NODE_ENV=production npx prisma migrate deploy` → `npm run build` api → `pm2 start api/ecosystem.config.cjs --env production` (or reload if exists) → `pm2 save` + non-interactive `pm2 startup systemd -u root --hp /root` (run the printed line).
8. `npm ci` + build admin/participant → `rsync` to www.
9. TLS: `systemctl stop nginx` → `certbot certonly --standalone --non-interactive --agree-tos -m "$CERTBOT_EMAIL" -d server… -d admin… -d participant…` (skip issuance if live certs already exist) → copy the three [`docs/ops/nginx/*.conf`](docs/ops/nginx/) into `/etc/nginx/conf.d/` → if `nginx -V` lacks `http_v3`, strip `quic` / `http3` / `Alt-Svc` lines in the installed copies → `nginx -t` → start/reload nginx.
10. Smoke: loopback `/health` + `/health/ready`; best-effort `curl --http2` to the three HTTPS hosts.

Idempotent enough to re-run: skip recreating secrets if files exist; skip certbot if certs exist; pm2 reload if app exists.

## `update-deploy.sh`

Port current [`docs/ops/deploy.sh`](docs/ops/deploy.sh) to the root with:

- Optional `--pull` to `git pull --ff-only` first.
- Same require env files / ci / migrate / build / pm2 / rsync / `.prev` backups / health checks.
- Does **not** touch Docker, nginx, certbot, or uploads.

## Guides

1. **[`docs/ops/DEPLOY.md`](docs/ops/DEPLOY.md)** — keep detailed architecture, env checklist, rollback, HTTP/3 notes; rewrite bootstrap/update sections to call:

```bash
export CERTBOT_EMAIL=you@example.com
export TWILIO_ACCOUNT_SID=… TWILIO_AUTH_TOKEN=… TWILIO_FROM_NUMBER=…
sudo -E bash setup.sh

# later
sudo bash update-deploy.sh --pull
```

2. **[`DEPLOY.md`](DEPLOY.md)** (repo root) — short only: domains/paths table, prerequisites (DNS, Twilio, `CERTBOT_EMAIL`), the two commands above, smoke curls, pointer to `docs/ops/DEPLOY.md` for detail.

3. Point [`README.md`](README.md) deploy link at root `DEPLOY.md` (and keep ops doc in [`docs/README.md`](docs/README.md)).

## Out of scope

- Creating the first admin user automatically
- GitHub Actions
- Changing nginx sample *source* files beyond what setup may strip on the installed copies when HTTP/3 is unavailable
