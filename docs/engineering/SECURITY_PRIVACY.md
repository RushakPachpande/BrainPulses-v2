# Security and Privacy Requirements

**Status:** Baseline; applicable legal requirements need qualified review.

## Principles
Least privilege, deny by default, server-side authorization, input validation, data minimization, assessment integrity and privacy-safe auditability.

## Authentication and authorization
Choose identity provider before production. Handle expiry, sign-out, disabled users and recovery. Do not store passwords directly or trust client-only roles. Maintain a role × action × resource matrix. Enforce ownership and tenant scope in API/database for reads, writes, files and exports. Test crafted API requests and direct URLs. Audit privilege changes and high-impact actions.

## Assessment integrity
Server owns official timer, deadline, submission timestamp and score. Validate attempt transitions; make submission idempotent; protect autosaved answers; never return unreleased answer keys. Define retakes, late submissions, accommodations, manual grading and regrading.

## Uploads/exports
Validate content, size and schema server-side; extensions/MIME alone are insufficient. Use private controlled storage. Protect CSV from formula injection. Rate/size-limit operations. Escape untrusted rendered content.

## Secrets
Never commit `.env`, tokens or private keys. Vite-exposed variables are public. Keep privileged credentials server-side and rotate leaks.

## Privacy lifecycle
Define data categories/purpose, required fields, retention, deletion/export, backup deletion, consent/legal basis where applicable, residency and third-party processors. Do not claim compliance without review.

## Audit/observability
Use structured logs and request IDs. Record actor/action/target/time/outcome as needed. Restrict audit access; never log tokens/passwords or unnecessary PII/answer payloads. Define log retention.

## Release gates
Threat model ([THREAT_MODEL.md](./THREAT_MODEL.md)), authorization/tenant tests (`npm run test --prefix api`), dependency and secret scans (`npm audit` in `api/` and `admin/`), upload/export tests, backup/restore plan, and critical/high findings resolved or formally accepted.

Run before release: `npm run check` from the repo root (API check+tests, admin check, admin Vitest). See also [THREAT_MODEL.md](./THREAT_MODEL.md) and [RESPONSIVE_CHECKLIST.md](./RESPONSIVE_CHECKLIST.md).
