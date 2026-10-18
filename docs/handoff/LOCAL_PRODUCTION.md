# Local production-like stack — BrainPulses v2.0

Run Admin, Student Client, and API against Docker Postgres/Redis with seeded demo data. This is the supported way to test end-to-end as an end customer before cloud hosting.

## Ports

| Service               | Loopback              | LAN (same Wi‑Fi / Ethernet) |
| --------------------- | --------------------- | --------------------------- |
| Admin (Vite)          | http://localhost:5173 | `http://<lan-ip>:5173`      |
| Student client (Vite) | http://localhost:5174 | `http://<lan-ip>:5174`      |
| API                   | http://127.0.0.1:3002 | `http://<lan-ip>:3002`      |
| Postgres              | 127.0.0.1:5434        | not published for peers     |
| Redis                 | 127.0.0.1:6381        | not published for peers     |

Admin, client, and API listen on `0.0.0.0` in development. Prefer the Vite Network URLs for peers; `/api` is proxied to the API on the host. Outside production, the API also accepts CORS from RFC1918 origins (in addition to `CORS_ORIGIN`). If peers cannot connect, allow inbound TCP 5173 / 5174 / 3002 in Windows Firewall.

## One-time setup

Requirements: Node.js **22+**, Docker Desktop, npm 10+.

```powershell
# From repo root
if (-not (Test-Path api\.env.dev)) { Copy-Item api\.env.dev.example api\.env.dev }
if (-not (Test-Path admin\.env)) { Copy-Item admin\.env.example admin\.env }
if (-not (Test-Path client\.env)) { Copy-Item client\.env.example client\.env }

npm ci --prefix api
npm run db:up
npm run db:migrate
npm run db:seed

npm ci --prefix admin
npm ci --prefix client
```

Confirm `admin/.env` has `VITE_USE_FIXTURES=false` and `api/.env.dev` includes:

```text
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

## Start (three terminals)

```powershell
npm run dev:api
npm run dev:admin
npm run dev:client
```

Health checks:

```powershell
Invoke-RestMethod http://127.0.0.1:3002/health
Invoke-RestMethod http://127.0.0.1:3002/health/ready
```

## Seed credentials

Admin (Admin UI at http://localhost:5173):

| Role            | Email                    | Password       |
| --------------- | ------------------------ | -------------- |
| Super admin     | `admin@brainpulses.com`  | `Password123!` |
| View-only admin | `viewer@brainpulses.com` | `Password123!` |

Students (Student client at http://localhost:5174 — Unique ID or Phone OTP):

| Name        | Unique ID  | Phone (E.164)   | National (demo)      |
| ----------- | ---------- | --------------- | -------------------- |
| Priya Patel | `BP-24101` | `+919876510000` | `+91` / `9876510000` |
| Rohan Mehta | `BP-24102` | `+919876510001` | `+91` / `9876510001` |
| Sana Khan   | `BP-24103` | `+919876510002` | `+91` / `9876510002` |

Development OTPs are printed in the API console as `[otp] …` when Twilio is disabled.

Demo organization slug: `demo`.

Seeded activities (assigned to demo students):

- Assessment `ASM-26001` — JEE Mock Series 2026 (5 questions)
- Quiz `QZ-26001` — Weekly General Knowledge (5 questions)
- Quiz `QZ-26002` — Maths Sprint #12 (5 questions)

## Production-like preview (built assets)

```powershell
npm run build:api
npm run start:api

npm run build:admin
npm run start:admin

npm run build:client
npm run start:client
```

For SPA preview builds, set `VITE_API_URL=http://localhost:3002` in `admin/.env` and `client/.env` (dev mode uses the Vite proxy instead).

## Reset data

```powershell
npm run db:down
docker volume rm brainpulses-postgres-data
npm run db:up
npm run db:migrate
npm run db:seed
```

## Verify gates

```powershell
npm run check:api
npm run check:admin
npm run test:admin
npm run typecheck:client
npm run build:client
```

## Known limitations (not cloud production)

See also the QA handoff `PRODUCTION_GATES.md` themes. Still open for a public launch:

- No cloud IdP / MFA / password reset flows
- Student JWT is access-token only (sessionStorage); no refresh-cookie rotation for students
- File upload / CSV import UI is partially disabled (API supports bank import)
- Hosting, CSP, monitoring, and backup drill are not configured here

This stack is suitable for stakeholder UAT on a trusted machine with synthetic seed data.
