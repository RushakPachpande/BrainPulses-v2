---
name: Root README
overview: Add a single root README.md that explains what BrainPulses v2.0 is, how the monorepo is laid out, how to run the local stack, and where deeper docs live—clear and professional, with no fluff.
todos:
  - id: write-root-readme
    content: Add professional root README.md covering product, layout, quick start, ports, seed logins, scripts, docs links
    status: completed
isProject: false
---

# Root README

## Goal

Create [`README.md`](README.md) at the repo root. Reader can understand product purpose, packages, setup, credentials, and next docs in one pass.

Tone: simple, professional, clear. Short sentences. No marketing fluff. Persist as normal prose (not caveman voice in the file).

## Content outline (in order)

1. **Title + one-line pitch** — BrainPulses v2.0: multi-tenant admin + student portal + Express API for quizzes/assessments.
2. **What’s in the repo** — three apps:
   - `admin/` — Vite React admin (port 5173)
   - `client/` — student portal (port 5174)
   - `api/` — Express + Prisma + Postgres/Redis (port 3002)
3. **Requirements** — Node `>=22`, Docker, npm 10+.
4. **Quick start** — copy env examples, `db:up` / `migrate` / `seed`, `npm ci` per package, three `dev:*` terminals. Point to [`docs/handoff/LOCAL_PRODUCTION.md`](docs/handoff/LOCAL_PRODUCTION.md) for full detail.
5. **Ports table** — 5173 / 5174 / 3002 / 5434 / 6381.
6. **Seed logins** — admin + student1 (same as handoff doc).
7. **Useful scripts** — `dev:*`, `build:*`, `check`, `db:*` from root [`package.json`](package.json).
8. **Docs map** — link `docs/handoff/`, design (`docs/design/DESIGN.md`), OpenAPI (`api/openapi.yaml`), customer test script.
9. **Scope note** — local UAT stack; cloud IdP/hosting still open (one short paragraph).

## Constraints

- Do **not** edit the production E2E plan file.
- Do **not** rewrite [`docs/README.md`](docs/README.md) in this change (it is stale; root README is the onboarding entry).
- Prefer PowerShell-friendly commands (this machine’s shell).
- No secrets beyond the documented seed demo passwords already in handoff docs.

## Done when

Root `README.md` exists and a new reader can boot and sign in from it alone, with links for deeper steps.
