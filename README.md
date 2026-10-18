# BrainPulses v2.0

Multi-tenant platform for creating and taking quizzes and assessments. This repo has three apps that share one API and database.

| Package              | Role                                                                                    | Local URL             | LAN URL                |
| -------------------- | --------------------------------------------------------------------------------------- | --------------------- | ---------------------- |
| [`admin/`](admin/)   | Administrator workspace (students, banks, activities, registrations, reports, settings) | http://localhost:5173 | `http://<lan-ip>:5173` |
| [`client/`](client/) | Student portal (browse, attempt, results, profile)                                      | http://localhost:5174 | `http://<lan-ip>:5174` |
| [`api/`](api/)       | Express API, Prisma, JWT auth, attempt lifecycle                                        | http://127.0.0.1:3002 | `http://<lan-ip>:3002` |

Data plane (Docker): Postgres `127.0.0.1:5434`, Redis `127.0.0.1:6381` (host-only; not exposed for LAN clients).

Dev servers bind `0.0.0.0`. Vite proxies `/api` to the API on the host, so other devices on your network use the admin/client Network URLs printed by Vite. Ensure `api/.env.dev` has `HOST=0.0.0.0` (see `api/.env.dev.example`). Allow Node/Vite through Windows Firewall if peers cannot connect.

## Requirements

- Node.js **22** or newer (`engines` in root and package manifests)
- npm 10 or newer
- Docker Desktop (for Postgres and Redis)

## Quick start

From the repo root (PowerShell):

```powershell
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

Confirm:

- `admin/.env` has `VITE_USE_FIXTURES=false`
- `api/.env.dev` has `HOST=0.0.0.0` and `CORS_ORIGIN=http://localhost:5173,http://localhost:5174` (LAN SPA origins are allowed automatically outside production)

Start each app in its own terminal:

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

Full local UAT notes: [`docs/handoff/LOCAL_PRODUCTION.md`](docs/handoff/LOCAL_PRODUCTION.md).

## Seed logins

| Role                | Credentials                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- |
| Super admin         | `admin@brainpulses.com` / `Password123!`                                              |
| View-only admin     | `viewer@brainpulses.com` / `Password123!` (UI + API block writes)                     |
| Student (Unique ID) | `BP-24101` on http://localhost:5174/login                                             |
| Student (Phone OTP) | `+91` / `9876510000` — when `TWILIO_ENABLED=false`, OTP is printed in the API console |

Demo organization slug: `demo`. Seed also creates quizzes and an assessment assigned to the demo students.

Optional Postgres BI role (not the API user): `brainpulses_readonly` / `brainpulses_ro` — see [`docs/ops/postgres-readonly-role.sql`](docs/ops/postgres-readonly-role.sql).

## Useful scripts (root)

| Script                                               | Purpose                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev:api` / `dev:admin` / `dev:client`       | Run each app in development                                        |
| `npm run build:api` / `build:admin` / `build:client` | Production builds                                                  |
| `npm run start:api` / `start:admin` / `start:client` | Run built API or SPA preview                                       |
| `npm run db:up` / `db:down`                          | Start or stop Docker data services                                 |
| `npm run db:migrate` / `db:seed`                     | Apply migrations and load demo data                                |
| `npm run check`                                      | API checks + tests, admin checks + tests, client typecheck + build |

Package-level scripts (`lint`, `typecheck`, `format`, `test`) live under each app’s `package.json`.

## Documentation

| Doc                                                                    | Use it for                                |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| [`docs/handoff/LOCAL_PRODUCTION.md`](docs/handoff/LOCAL_PRODUCTION.md) | Boot order, ports, reset DB, known limits |
| [`docs/handoff/CUSTOMER_TEST.md`](docs/handoff/CUSTOMER_TEST.md)       | End-to-end manual test script             |
| [`docs/design/DESIGN.md`](docs/design/DESIGN.md)                       | Admin UI design contract                  |
| [`docs/COLOR_PALETTE.md`](docs/COLOR_PALETTE.md)                       | Brand and semantic colors                 |
| [`api/openapi.yaml`](api/openapi.yaml)                                 | HTTP API contract                         |
| [`docs/README.md`](docs/README.md)                                     | Broader product and engineering doc index |

## Scope

This stack is for **local / UAT** work with synthetic seed data. Admin and student flows talk to the live API when fixtures are off. Cloud hosting, production identity provider, MFA, and full ops hardening are still open gates—see the handoff docs.

## BrainPulses design system (independent frontends)

The supplied BrainPulses SVG remains the master logo at `assets/brainpulses.svg`. **Admin** and **Client** each own a copy of their runtime CSS tokens and DateTimePicker. No frontend imports a root `design-system/` directory or the other frontend. The API remains the source of truth for application data.

| Application | Design tokens | Component files | Handoff & standalone preview |
|---|---|---|---|
| Admin | [`admin/src/styles/tokens.css`](admin/src/styles/tokens.css) | `admin/src/components/date-time-picker.*` | [`admin/docs/design-system/`](admin/docs/design-system/) |
| Client | [`client/src/styles/tokens.css`](client/src/styles/tokens.css) | `client/src/components/date-time-picker.*` | [`client/docs/design-system/`](client/docs/design-system/) |

Admin still has its interactive **Settings → Design System** route (`/settings/design-system`). Both apps keep their current light/dark theme behavior and the shared design intent, but their token/component files are now maintained independently. You can regenerate a design-token JSON export for either app using `npm run design:tokens --prefix admin` or `npm run design:tokens --prefix client`.

At the repository root the convenience installation commands still work:

```bash
npm run cleaninstall # npm ci --prefix api, admin, client (sequentially)
npm run install      # npm install --prefix api, admin, client (sequentially)
```

For independent startup, run `npm ci && npm run dev` in the chosen app directory. See [`docs/design/INDEPENDENT_APPS_MIGRATION.md`](docs/design/INDEPENDENT_APPS_MIGRATION.md) for details. Keep `node_modules`, generated builds, and secrets out of source archives.
