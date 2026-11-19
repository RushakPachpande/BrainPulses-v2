# PM2 configuration

Source of truth: [`api/ecosystem.config.cjs`](../api/ecosystem.config.cjs).

## Apps

| Name | Script | Mode | Notes |
| --- | --- | --- | --- |
| `brainpulses-api` | `dist/index.js` | fork, **1** instance | HTTP on `127.0.0.1:3002` behind nginx |
| `brainpulses-worker` | `dist/worker.js` | fork, **1** instance | BullMQ consumer |

Both use `env_production.NODE_ENV=production` so `load-env.ts` prefers `api/.env.prod`.

## Commands (VPS)

```bash
cd /root/apps/BrainPulses_v2.0
pm2 startOrReload api/ecosystem.config.cjs --env production
pm2 save
pm2 status
pm2 logs brainpulses-api
pm2 logs brainpulses-worker
pm2 reload brainpulses-api --env production
pm2 reload brainpulses-worker --env production
pm2 stop brainpulses-worker
```

Deploy scripts (`setup.sh`, `update-deploy.sh`) call `pm2 startOrReload` on the ecosystem file so API and worker stay aligned.

## Graceful shutdown

- API: closes HTTP server, queue producer, Redis, Prisma. Production drain is 8 seconds, under `kill_timeout` 10s. Development drain is 1 second so nodemon can reload.
- Worker: `kill_timeout` 30s; drains in-flight BullMQ jobs via `worker.close()`, with a 25 second force exit so a reload still finishes inside that budget. A single failed or stalled job is logged and does not exit the process.

## Resource budget

| Process | `DATABASE_POOL_MAX` | `max_memory_restart` |
| --- | --- | --- |
| `brainpulses-api` | 8 | 500M |
| `brainpulses-worker` | 4 | 500M |

Both stay at one fork. Do not raise either pool without measuring Postgres memory on the shared VPS.

## Clustering

API **instances remain 1**. Multiple API processes need shared upload storage (see [`LOAD_BALANCING.md`](./LOAD_BALANCING.md)).
