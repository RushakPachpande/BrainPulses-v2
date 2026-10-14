# BrainPulses Implementation Plan

**Status:** Proposed. Reprioritize after decisions and capacity estimates. Each phase requires evidence.

## Phase 0 — Product decisions
Confirm customer segment, MVP, roles/permissions, tenancy, backend/database/auth/storage/hosting, attempt/timer/autosave/scoring/retake/release rules and privacy/retention.

**Exit:** PRD approved; decisions have owners; ADRs recorded; MVP acceptance criteria prioritized.

## Phase 1 — UI foundation
Enforce DESIGN.md/palette; audit shared shadcn components; standardize 44 px controls, 1 px borders, 12 px card radius, spacing and icons; review routes for responsive/accessibility/async states; remove or label fixture metrics.

**Exit:** routes reviewed, no critical layout/theme regressions, shared patterns reused, type-check/lint/build pass.

## Phase 2 — Identity and authorization
Implement chosen identity/session provider; define server-side roles and tenant scope; separate environments and secrets; protected-route UX backed by server enforcement.

**Exit:** unauthorized operations denied, tenant tests pass if relevant, no privileged secrets in client, session recovery tested.

## Phase 3 — Database and API
Finalize DB structure/ERD and API/OpenAPI; write migrations/policies; define seeds and backup/restore; replace fixtures behind typed services.

**Exit:** clean migrations, constraints/policies tested, contracts documented, fixture mode explicit.

## Phase 4 — Admin workflows
Suggested order: students/users → question banks/import → activity create/publish → registrations/assignments → reports/results → settings → dashboard/audit.

**Per-feature exit:** approved requirements, server validation/authorization, async states, tests, accessibility review and updated docs.

## Phase 5 — Student assessment experience
Assigned activities, instructions, eligibility/start, question navigation, answer persistence, timer/reconnect, idempotent submission and result release.

**Exit:** server-authoritative lifecycle, recovery tested, no answer-key leakage, critical E2E flows pass.

## Phase 6 — Production readiness
Threat model, WCAG 2.2 AA audit, realistic load/performance, backup/restore drill, monitoring/incident runbook, privacy review and staging acceptance.

**Exit:** no unresolved critical/high security defects, recovery objectives tested, agreed performance targets met, release approved.

## Work item standard
Every issue includes requirement IDs, owner, priority, dependencies, acceptance criteria, test evidence, docs updates and migration/release impact. Do not promise dates before scope and capacity are known.
