# Dependencies and security

Audited 2026-11-07 with `npm audit --omit=dev` per package after installing `bullmq` on the API.

## API

- Added: `bullmq` (stable 5.x) for Redis-backed jobs.
- Safe `npm audit fix --omit=dev` was **not** retained: it removed toolchain packages when run incorrectly; lockfile restored via `npm ci`.
- Residual: Zod `<4.6.6` high advisory requires a **major** upgrade (`audit fix --force` → Zod 4). Deferred to avoid breaking validation across the API. Track separately.
- Other advisories (body-parser, multer, qs, follow-redirects, fast-uri) appear in the full tree; compatible non-breaking bumps should be re-tried with a full `npm ci` verification after any lockfile change.

## Admin

- Several advisories come from the `shadcn` **CLI** toolchain (deepmerge, undici, zod, systeminformation), not the browser runtime bundle.
- Force-fixing to clear them installs breaking `shadcn@1` / Zod 4 — deferred.

## Participant / Client

- `npm audit --omit=dev`: **0** vulnerabilities reported in this run.

## Policy

- Prefer current stables; no alpha/beta.
- No blind major upgrades.
- Do not suppress audit output; document residuals here and in the final engineering report.
