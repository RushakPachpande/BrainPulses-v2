# Deploy (VPS)

| App | Domain | Path / process |
| --- | --- | --- |
| API | `https://server.brainpulses.com` | PM2 `brainpulses-api` + `brainpulses-worker` → `127.0.0.1:3002` |
| Admin | `https://admin.brainpulses.com` | `/var/www/brainpulses/admin` |
| Participant | `https://participant.brainpulses.com` | `/var/www/brainpulses/participant` |
| Postgres / Redis | loopback only | Docker `5434` / `6381` |

Clone: `/root/apps/BrainPulses_v2.0`. Detail: [`docs/ops/DEPLOY.md`](docs/ops/DEPLOY.md).

## Prerequisites

- DNS for the three hosts → this VPS
- Root shell
- Twilio SID, token, from-number
- Let's Encrypt email

## First setup

```bash
cd /root/apps/BrainPulses_v2.0
export CERTBOT_EMAIL=you@example.com
export TWILIO_ACCOUNT_SID=…
export TWILIO_AUTH_TOKEN=…
export TWILIO_FROM_NUMBER=…
sudo -E bash setup.sh
```

Creates secrets, Docker db/redis, migrates (no seed), PM2, SPA publish, certbot, nginx (HTTPS / h2 / h3). Create the first admin manually afterward.

## Updates

```bash
cd /root/apps/BrainPulses_v2.0
sudo bash update-deploy.sh --pull
```

## Smoke

```bash
curl -fsS https://server.brainpulses.com/health
curl -fsS https://server.brainpulses.com/health/ready
curl -sI --http2 https://admin.brainpulses.com | head -n 5
```
