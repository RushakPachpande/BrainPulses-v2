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

- API: closes HTTP server, queue producer, Redis, Prisma.
- Worker: `kill_timeout` 30s; drains in-flight BullMQ jobs via `worker.close()`.

## Clustering

API **instances remain 1**. Multiple API processes need shared upload storage (see [`LOAD_BALANCING.md`](./LOAD_BALANCING.md)).
