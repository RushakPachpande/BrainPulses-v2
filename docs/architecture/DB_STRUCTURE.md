# Database Structure and Data Model

**Status: Draft planning contract. No production schema is defined here.**

## Current state
The inspected frontend uses fixtures in `admin/src/services/fixtures.ts` and `services/index.ts`. UI labels are not a database schema.

## Conceptual domains (not approved table names)
| Domain | Concepts | Decisions/risks |
|---|---|---|
| Identity | provider identity, profile | Prefer provider-managed credentials |
| Organizations | organization, membership | Required only if multi-tenancy |
| Authorization | roles, permissions, assignments | Least privilege; static vs configurable RBAC |
| Learners | profile, enrollment | PII minimization/retention |
| Activities | quiz, assessment, schedule | Shared vs separate model |
| Questions | question, option, version, media reference | Protect answer keys |
| Banks | bank, bank-question relation | Reuse/versioning |
| Registration | registration/assignment | Eligibility and duplicate rules |
| Attempts | attempt, response, timing, submission state | Server authority/autosave |
| Results | score, grading, release state | Regrade/audit |
| Notifications | preference, delivery record | Minimize content |
| Audit | security/admin event | Restricted retention |
| Files | metadata/object reference | Private access and validation |

## Modeling rules
Document ownership, lifecycle, uniqueness, relationships and policies. Use stable internal IDs and separate human-readable IDs. Enforce integrity with DB constraints. Define timestamp/timezone semantics. Soft-delete only with a documented need. Index real query patterns. Migrations are the schema source of truth. Keep answer keys out of broad read models.

## Tenancy — decision required
Choose single-tenant, shared DB with organization scope/RLS, schema-per-tenant or hybrid. If multi-tenant, every tenant-owned record needs an ownership path and server/database enforcement for reads, writes, exports and files. Test cross-tenant denial.

## Assessment integrity
Model approved attempt states, server-owned timing, idempotent submission, acknowledged answer saves, reconnect behavior, score versioning and controlled answer/result release. Finalize only after timer, autosave, retake, late-submission, randomization and grading rules are approved.

## Security/privacy
Use approved identity provider; least privilege; server/database policies; private storage; upload validation; restricted audit; retention/deletion/export policy. Legal applicability needs qualified review.

## Migration workflow
Write versioned migration → test from clean DB → test constraints/policies → review destructive/locking impact → backup → controlled deploy → verify integrity → document rollback/forward-fix. Record emergency manual changes as migrations.

## Required before implementation
ERD, table/column definitions, constraints/indexes, data classification/retention matrix, access policy matrix, seed strategy, backup/restore procedure and cross-tenant tests if applicable.

## Decisions required
Provider/migration tool, auth, tenancy, roles, activity/question versioning, attempt/timer/autosave/grading/release rules, PII/retention, file storage and signed URL policy.
