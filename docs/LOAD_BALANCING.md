# Load balancing

## Current production topology

```text
Internet → nginx (TLS/h2/h3)
             ├─ admin.brainpulses.com → static files
             ├─ participant.brainpulses.com → static files
             └─ server.brainpulses.com → 127.0.0.1:3002 (single PM2 API fork)
                                              │
                         Postgres + Redis (Docker, loopback)
                         BullMQ worker (separate PM2 process)
```

Nginx already terminates TLS and proxies the API. There is **no** multi-upstream API pool today.

## Why API stays single-instance

Local disk under `UPLOAD_DIR` (`api/uploads`) stores initiated and finalized files. Two API processes without a shared filesystem would see inconsistent file SoT. Redis already coordinates rate limits, sessions, and the job queue.

## Path to multiple API instances (blocked until approved)

1. Shared upload volume (NFS) **or** object storage migration (requires explicit approval).
2. Set `TRUST_PROXY` appropriately (already `1` behind nginx in prod examples).
3. Add nginx `upstream` with multiple `127.0.0.1` ports **or** raise PM2 `instances` with a shared upload mount.
4. Health: route only to instances that pass `GET /health/ready` (Postgres + Redis).
5. Keep **one logical worker pool** with controlled `QUEUE_CONCURRENCY` so duplicate side effects stay bounded by BullMQ job ids / idempotency keys.

Until then, horizontal scale for heavy work is the **worker queue**, not additional API listeners.
