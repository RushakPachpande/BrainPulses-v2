# Threat model — BrainPulses API

**Status:** Active for production readiness. Remediations are defensive only; this document does not include exploit payloads.

**Related:** [SECURITY_PRIVACY.md](./SECURITY_PRIVACY.md), [TESTING_QA.md](./TESTING_QA.md)

## Assets

| Asset | Sensitivity | Notes |
|---|---|---|
| Admin JWTs (access) | High | Bearer; short-lived; carries org + access levels |
| Refresh cookie `bp_refresh` | High | HttpOnly; Redis-backed family rotation |
| Student attempt answers / scores | High | Before publish; answer keys never to students |
| Question bank answer keys | High | Stripped for view-only; never to students |
| Tenant org data (students, activities, files) | High | Multi-tenant isolation |
| Uploaded files | Medium–High | Logos, imports; private storage |
| Audit events | Medium | Super-admin only |
| Settings / membership roles | High | Privilege changes |

## Trust boundaries

```text
[Admin SPA :5173] --HTTPS/credentials--> [API :3002]
                                              |
                         +--------------------+--------------------+
                         |                    |                    |
                    [Postgres]            [Redis]            [UPLOAD_DIR]
                    tenant rows           refresh/rate         local disk
                                          download tokens
```

- Browser is untrusted. Roles and access levels come only from verified JWT / DB membership at sign-in.
- Prisma ALS (`withTenantContext`) scopes tenant models; no Postgres RLS in this pass (deferred).
- Docker Postgres/Redis/CloudBeaver/RedisInsight are operator-trusted on localhost ports.

## Actors

| Actor | Capability |
|---|---|
| Anonymous | Health, auth sign-in/refresh, file download with opaque token |
| Org admin (`view` / `edit` / `full` per assessment or quiz) | Scoped CRUD |
| `super_admin` | Full org access + audit |
| Student | Attempts only |
| Cross-tenant attacker | Stolen/forged token or guessed UUIDs |

## OWASP API Top 10 (2023) mapping

| ID | Theme | Control | Proved by |
|---|---|---|---|
| API1 | BOLA / IDOR | Tenant ALS + 404 on cross-org IDs; download-token scoped to uploader or edit+ | `api/test/tenancy.test.ts`, `api/test/security.test.ts` |
| API2 | Broken auth | HS256 + iss/aud pin; refresh reuse family revoke; auth rate limit; prod COOKIE_SECURE + JWT length | `api/test/auth.test.ts`, `api/test/security.test.ts` |
| API3 | BOPLA / mass assignment | Zod `.strict()` on mutation bodies | `api/test/security.test.ts` |
| API4 | Resource consumption | Rate limits; upload size on initiate + PUT; MIME allowlist | `api/test/security.test.ts` |
| API5 | Function-level auth | `requireAccess` / `requireOrgAccess` on mutations; activity service asserts | `api/test/tenancy.test.ts`, `api/test/security.test.ts` |
| API6 | Business flows | Invite/role gates; result publish requires full | service + security tests |
| API7 | SSRF | No outbound URL fetch from user input | N/A this surface |
| API8 | Misconfig | Helmet; CORS allowlist; prod Redis for rate limits; no stack traces | error-handler + security tests |
| API9 | Inventory | OpenAPI synced to live routes | `api/openapi.yaml` |
| API10 | Unsafe API consumption | N/A (we are the provider) | — |

## Route-family checklist (tryhackme-style, defensive)

| Family | Abuse case (intent) | Expected control | Test |
|---|---|---|---|
| `POST /api/auth/sign-in` | Credential stuffing | Auth rate limit + identical errors | flood → 429 |
| `POST /api/auth/refresh` | Stolen rotated cookie | Family revoke | auth reuse test |
| `GET /api/students/:id` | Cross-tenant UUID | 404 | tenancy |
| `POST /api/banks` as view | Privilege escalate | 403 `requireAccess` | security matrix |
| `POST /api/activities` as view | Same | 403 | tenancy |
| `PATCH /api/settings/*` as view | Same | 403 `requireOrgAccess` | security matrix |
| `POST /api/files/initiate` bad MIME | Malware upload | 400 allowlist | MIME reject |
| `PUT /api/files/:id/content` oversize | Disk fill | 400 vs declared size | oversize reject |
| `POST /api/files/:id/download-token` as view non-uploader | Broad file read | 403 unless edit/full or uploader | token scope |
| JWT wrong `aud` / `typ` | Token confusion | 401 | JWT claims |
| Unexpected body fields | Mass assignment | 422 strict Zod | strict body |
| 500 path | Info leak | No `stack` in JSON | no stack traces |

## Deferred (documented, not this pass)

- MFA / TOTP
- Postgres RLS
- Object storage (S3)
- Email delivery
- Student portal UI
- Full Prisma 8 `orm-postgres` rewrite
- Dedicated notifications API

## Production env gates

When `NODE_ENV=production`:

- `JWT_SECRET` length ≥ 32
- `COOKIE_SECURE=true`
- Redis must be ready (rate limits + refresh); `/health/ready` fails otherwise

## Residual risks

- Download token may appear in query strings (Referer/logs); prefer short TTL; header support optional (`x-download-token`).
- App-level tenancy without RLS: raw SQL / forgotten `withTenantContext` is a footgun.
- Concurrent refresh race (two parallel rotates) is mitigated by atomic GETDEL plus family revocation on reuse.
- Student Unique ID login is single-factor by product choice. Student codes use the predictable `BP-${24000 + seq}` format. One active Redis session (`sid` in JWT) and a short access-token TTL do not prevent code guessing. A guessed code with `replaceSession: true` can replace the current session and revoke the real student's access during an exam. The auth rate limit slows guessing but does not prevent distributed attempts. Consider non-sequential codes, a replace cooldown, and student notification on replacement.

## Accepted dependency audit findings (this pass)

| Package | Issue | Decision |
|---|---|---|
| `prisma` → `deepmerge-ts` / `mysql2` | High advisories; `npm audit fix --force` would downgrade Prisma to 6.x | **Accepted** — we use Postgres via `@prisma/adapter-pg`; mysql2 is unused transitive CLI dep. Revisit on Prisma patch. |
| `admin` → `shadcn` / `braces` / `micromatch` | High via CLI tooling | **Accepted** — build-time CLI, not runtime bundle. Revisit when shadcn publishes a patched release. |
