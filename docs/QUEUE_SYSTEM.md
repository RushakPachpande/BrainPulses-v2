# Queue system (BullMQ)

BrainPulses uses **BullMQ** on the existing Redis instance for selected long-running work. The HTTP API remains the only client entry point.

## Processes

| Process | PM2 name | Role |
| --- | --- | --- |
| API | `brainpulses-api` | Validates requests, enqueues jobs, serves job status/download |
| Worker | `brainpulses-worker` | Runs job processors (`api/src/worker.ts` → `dist/worker.js`) |

Local/tests: `QUEUE_INLINE=true` or `NODE_ENV=test` runs processors in-process (no worker required).

## Job types

| Name | Trigger | Result |
| --- | --- | --- |
| `sms.otp` | Participant OTP issue | Side effect only (auth response unchanged) |
| `report.quiz-export` | `GET /api/quiz-reports/export` | File under `uploads/temporary/jobs/` |
| `report.assessment-export` | `GET /api/assessment-reports/export` | Same |
| `import.participants` | `POST /api/participants/import` | Import JSON (or 202 + poll) |
| `import.users` | `POST /api/users/import` | Import JSON (or 202 + poll) |
| `import.bank-questions` | `POST /api/banks/:id/import` | Import JSON (or 202 + poll) |

## Client handshake

1. API accepts → **202** `{ data: { jobId, status: "queued" } }` (imports may still return **200** when finished inline).
2. Client polls `GET /api/jobs/:jobId` (each poll uses the normal 30s request timeout).
3. On `completed`, export clients call `GET /api/jobs/:jobId/download`; import clients read `result.data`.
4. Acceptance is never presented as success until status is `completed`.

## Backpressure

When waiting + active depth ≥ `QUEUE_MAX_WAITING`, enqueue returns **503** `SERVICE_UNAVAILABLE`. Jobs are not silently dropped.

## Env knobs

See `api/.env.dev.example` and `api/.env.prod.example`: `QUEUE_INLINE`, `QUEUE_CONCURRENCY`, `QUEUE_MAX_WAITING`, `QUEUE_JOB_ATTEMPTS`, `QUEUE_BACKOFF_MS`, `QUEUE_JOB_TIMEOUT_MS`.
