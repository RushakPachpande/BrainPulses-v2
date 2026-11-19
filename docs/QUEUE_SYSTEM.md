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
| `sms.otp` | Participant OTP issue | One attempt. A retry would send the same code again. |
| `report.quiz-export` | `GET /api/quiz-reports/export` | Queued file under `uploads/temporary/jobs/` |
| `report.assessment-export` | `GET /api/assessment-reports/export` | Same |
| `import.participants` | `POST /api/participants/import` | Queued import JSON |
| `import.bank-questions` | `POST /api/banks/:id/import` | Queued import JSON. Idempotency key becomes the job id. |

## Client handshake

1. API accepts → **202** `{ data: { jobId, status: "queued" } }`.
2. Client polls `GET /api/jobs/:jobId` until completed or failed. The admin poll window covers the 120s worker lock plus a short margin. Each poll uses the normal 30s request timeout.
3. On `completed`, export clients call `GET /api/jobs/:jobId/download`; import clients read `result.data`.
4. Acceptance is never presented as success until status is `completed`.

`QUEUE_INLINE=true` and `NODE_ENV=test` still run the processor in the API process and may return the file or import JSON on the first response. Production does not set `forceInline`.

The worker deletes files in `uploads/temporary/jobs` older than 24 hours. A download does not delete the file, so a retry in that window still works.

## Backpressure

When waiting + active depth ≥ `QUEUE_MAX_WAITING`, enqueue returns **503** `SERVICE_UNAVAILABLE`. Jobs are not silently dropped.

## Env knobs

See `api/.env.dev.example` and `api/.env.prod.example`: `QUEUE_INLINE`, `QUEUE_CONCURRENCY`, `QUEUE_MAX_WAITING`, `QUEUE_JOB_ATTEMPTS`, `QUEUE_BACKOFF_MS`, `QUEUE_JOB_TIMEOUT_MS`.
