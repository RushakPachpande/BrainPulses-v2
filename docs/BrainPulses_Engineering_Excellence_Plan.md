# BrainPulses Engineering Excellence & Refactoring Plan

**Version:** 1.0\
**Prepared from:** `BrainPulses v2.0.zip` and the supplied BrainPulses
design specification\
**Purpose:** A controlled, evidence-driven plan for bringing the
existing codebase toward senior-engineer quality, maintainability,
security, accessibility, testability, and operational readiness.

> **Important scope note:** This plan is not a claim that BrainPulses is
> ISO-certified or currently conforms to any ISO standard. ISO alignment
> requires a defined scope, controls, evidence, and appropriate
> organizational review. The immediate objective is to use relevant
> standards as engineering reference points and produce verifiable
> improvements without breaking current behavior.

------------------------------------------------------------------------

## 1. Executive objective

Refactor BrainPulses as an existing production-shaped application---not
as a greenfield rewrite. Preserve its business rules, API contracts,
database history, role and tenant boundaries, assessment lifecycle, and
approved UI design unless a separately approved change says otherwise.

The desired outcome is a codebase where: - each module has a clear
responsibility and a documented public interface; - repeated behavior
and UI patterns are reused where reuse improves consistency; -
components and services are small enough to reason about, test, and
change safely; - TypeScript types model real domain concepts rather than
hiding uncertainty behind `any`, casts, or duplicated interfaces; -
comments explain intent, invariants, constraints, and non-obvious
decisions---not every line; - tests verify behavior, security
boundaries, failure cases, and regressions; - lint, format, type-check,
build, and test gates run consistently; - security, privacy,
accessibility, and responsive behavior are part of definition-of-done; -
changes are incremental, reviewable, reversible, and backed by evidence.

"Human-written quality" should be interpreted as **clear ownership,
explicit decisions, understandable abstractions, useful comments,
predictable naming, tests, and reviewable diffs**---not as making code
look artificially hand-written.

## 2. Scope discovered in the supplied archive

The archive contains three primary applications plus documentation and
generated output:

  -----------------------------------------------------------------------
  Area                    Current technology /    Refactoring focus
                          role                    
  ----------------------- ----------------------- -----------------------
  `api/`                  Express 5, TypeScript,  Domain boundaries,
                          Prisma, PostgreSQL,     authorization, tenant
                          Redis, JWT/session      isolation, service
                          flows                   decomposition,
                                                  validation, transaction
                                                  and concurrency
                                                  correctness

  `admin/`                React 19, Vite,         Page decomposition,
                          TypeScript, Tailwind    shared UI patterns,
                          v4, Radix/shadcn-style  accessibility,
                          primitives              API/service boundaries,
                                                  design-system
                                                  consistency

  `client/`               React, Vite,            Assessment-flow
                          TypeScript,             reliability, component
                          student-facing portal   reuse, API contract
                                                  consistency,
                                                  accessibility and
                                                  responsive behavior

  `api/prisma/`           Prisma schema,          Migration safety,
                          migrations, seed        schema integrity,
                                                  constraints and
                                                  reproducible setup

  `docs/`                 Product, architecture,  Reconcile authoritative
                          security, design,       docs with actual
                          testing and handoff     behavior; record
                          docs                    decisions and evidence

  `graphify-out/`         Generated-looking       Establish provenance
                          output tree             and generation
                                                  instructions; do not
                                                  hand-edit or treat as
                                                  source without
                                                  verification
  -----------------------------------------------------------------------

Root scripts already provide commands for build, lint, typecheck,
formatting, and tests. API tests include authentication, attempts, quiz
operations, scoring, security, student portal, and tenancy. Admin has a
small number of component/page tests. The existence of scripts and tests
does **not** prove that they pass or adequately cover the product.

### High-priority refactoring candidates observed by source-file line count

Line count is a review signal, not a rule that a file must be split.

  ------------------------------------------------------------------------------------------------
  File                                                      Approx. lines Initial investigation
  ------------------------------------------ ---------------------------- ------------------------
  `admin/src/pages/activity-wizard.tsx`                             1,278 Separate wizard
                                                                          orchestration, step UI,
                                                                          validation, domain
                                                                          mapping, and persistence
                                                                          where responsibilities
                                                                          are mixed

  `api/src/modules/attempts/service.ts`                               948 Map lifecycle
                                                                          transitions,
                                                                          timer/deadline rules,
                                                                          submission idempotency,
                                                                          scoring, and
                                                                          persistence; preserve
                                                                          transaction boundaries

  `api/src/modules/activities/service.ts`                             862 Separate cohesive use
                                                                          cases and policy checks
                                                                          while preserving
                                                                          publish/assignment rules

  `admin/src/services/index.ts`                                       828 Identify API client,
                                                                          mapping, fixtures, and
                                                                          domain operations; split
                                                                          by responsibility and
                                                                          feature

  `admin/src/pages/question-banks.tsx`                                671 Separate table
                                                                          orchestration,
                                                                          filtering, row actions,
                                                                          and dialogs if they are
                                                                          coupled

  `admin/src/pages/bank-form.tsx`                                     654 Separate form sections
                                                                          and
                                                                          validation/persistence
                                                                          concerns

  `api/src/modules/banks/service.ts`                                  741 Identify use-case
                                                                          boundaries and shared
                                                                          bank/question invariants

  `api/src/modules/banks/import-export.ts`                            662 Separate parsing,
                                                                          validation, mapping, and
                                                                          file generation if
                                                                          independent and testable

  `client/src/styles.css`                                           4,026 Audit for duplicated
                                                                          rules, stale styles,
                                                                          global leakage, and
                                                                          token duplication before
                                                                          restructuring

  `admin/src/index.css`                                             1,015 Inspect theme/token
                                                                          precedence and
                                                                          consolidation risks
                                                                          before changing the
                                                                          cascade
  ------------------------------------------------------------------------------------------------

### Duplication candidates observed

The two frontend apps have near-identical date/time picker
implementations and CSS, near-identical token stylesheets, and exact
duplicate copies of some small utilities (including
`use-debounced-value`, `use-leave-guard`, and the design-token export
script). The pickers and styles differ slightly, so the agent must
compare their behavior and dependencies before deciding whether to share
them.

**Do not introduce a shared workspace package as the first step.** First
prove the duplication, document the API and styling differences, and
define the least risky shared boundary. If a workspace package would
destabilize the current independent app setup, use a documented
alternative and defer package extraction.

## 3. Standards and quality framework

Use the following as reference frameworks, not as a claim of
certification.

  -----------------------------------------------------------------------
  Framework                           How it applies
  ----------------------------------- -----------------------------------
  **ISO/IEC 25010** software product  Maintainability, reliability,
  quality model                       security, functional suitability,
                                      usability, compatibility,
                                      performance efficiency, and
                                      flexibility as quality dimensions

  **ISO/IEC/IEEE 12207** software     Requirements, design,
  life-cycle processes                implementation, verification,
                                      validation, configuration
                                      management, maintenance, and change
                                      control

  **ISO/IEC 27001** information       Organizational risk management,
  security management                 access controls, incident handling,
                                      asset management, and evidence; a
                                      code refactor alone cannot
                                      establish compliance

  **ISO/IEC 27701** privacy           Privacy governance, data
  information management              purpose/minimization, retention,
                                      rights, and processor
                                      responsibilities where applicable

  **WCAG 2.2 AA** accessibility       Keyboard operation, visible focus,
  target                              labels, contrast, error
                                      identification, reflow, target
                                      sizing, and assistive-technology
                                      support

  **OWASP ASVS / OWASP Top 10**       Practical application-security
                                      verification for authentication,
                                      authorization, validation,
                                      sessions, uploads, logging, and
                                      data exposure

  **Semantic Versioning and API       Controlled API changes,
  compatibility practices**           versioning/compatibility
                                      expectations, migration notes, and
                                      release discipline
  -----------------------------------------------------------------------

The organization should obtain qualified review to determine which ISO
standards and editions apply to its business, jurisdictions, customers,
and contractual obligations. Do not label the product "ISO compliant"
based solely on this plan.

## 4. Non-negotiable rules for the AI coding agent

1.  **Audit before editing.** Read the repository instructions, package
    manifests, architecture docs, product requirements, security docs,
    schema, migrations, and relevant code paths first.
2.  **No big-bang rewrite.** Work in small, independently verifiable
    phases and feature-sized changes.
3.  **Preserve behavior by default.** Do not change business rules,
    routes, payloads, database semantics, roles, permissions, or UI
    intent as an incidental cleanup.
4.  **No destructive database actions.** Never reset, drop, truncate,
    rewrite, squash, or edit an applied migration. Never use production
    data or credentials for tests. Ask before any operation that could
    destroy or alter user data.
5.  **Never expose secrets.** Do not print `.env` values, tokens,
    private keys, password hashes, or personal data in reports. Check
    tracked files and client bundles for accidental secrets without
    copying secret values into output.
6.  **No speculative abstractions.** Reuse code when it represents the
    same concept and has a stable contract. Do not create generic
    "framework" layers for one-off behavior.
7.  **No blanket file splitting.** Extract cohesive units with
    meaningful names and tests. Do not split solely to hit a line-count
    target.
8.  **No comments that restate syntax.** Comment intent, invariants,
    security decisions, surprising behavior, external constraints, and
    non-obvious trade-offs.
9.  **No suppressions without justification.** Do not add `any`,
    `@ts-ignore`, `eslint-disable`, non-null assertions, or broad error
    swallowing to make checks pass. If unavoidable, narrow the scope,
    explain why, and add a follow-up.
10. **Keep generated code generated.** Identify generated files and
    their generator. Change the source/schema and regenerate; do not
    manually refactor generated Prisma output.
11. **Respect existing UI foundations.** Use existing UI primitives,
    Lucide icons, semantic tokens, and the supplied design system. Do
    not add a second component kit or one-off colors without an approved
    token change.
12. **Evidence over claims.** Report commands actually run, their
    results, tests added, files changed, risks, and anything not
    verified. Never claim a build/test/security audit passed if it was
    not run.
13. **One concern per change set.** Avoid mixing visual redesign,
    dependency upgrades, schema changes, and structural refactoring in
    one commit.
14. **Ask before broad behavior changes.** If a finding requires a
    product decision, record options and impact and stop that part of
    the work until a decision is made.

## 5. Phase 0 --- Establish a safe baseline

### Tasks

-   Read `AGENT.md`, `.cursor/rules/`, root and package manifests,
    `.gitignore`, `.cursorignore`, `README.md`, `docs/README.md`,
    PRD/BRD/TRD, architecture docs, security/privacy docs, threat model,
    testing QA, release checklist, and handoff docs.
-   Establish the real Git state: current branch, dirty files, untracked
    files, recent commits, and migration status. Do not reset or stash
    user work automatically.
-   Determine the supported Node/npm versions and lockfile expectations.
-   Inventory source, generated, fixture, test, migration,
    documentation, and build-output files.
-   Run the existing checks **without auto-fixing**: API/admin/client
    type-check, lint, format check, test suites, and production builds.
    Record exact outcomes and known environmental blockers.
-   Identify environment variable names and usage locations without
    printing values. Verify that real `.env` files are not committed and
    that browser-exposed variables contain no secrets.
-   Record existing routes, API request/response contracts, role matrix,
    tenant-scoping rules, critical assessment state transitions, and
    database invariants.
-   Capture current UI behavior/screenshots for representative admin and
    student flows at approximately 375px, 768px, and 1280px, including
    light/dark mode where supported.
-   Establish a baseline of test coverage if the current toolchain
    supports it; do not invent a percentage if coverage is not measured.

### Deliverables

-   `docs/engineering/BASELINE_AUDIT.md`
-   A source/generated/fixture ownership inventory
-   A command-result table (pass/fail/not run, reason, evidence)
-   A prioritized defect and risk register with severity, evidence,
    owner/next action, and acceptance criteria

### Exit criteria

No refactor begins until the current state, constraints, and test/build
blockers are recorded. Baseline failures are not silently "fixed" as
part of an unrelated task.

## 6. Phase 1 --- Architecture and dependency map

### API

Map route → middleware → controller → service/use case →
repository/Prisma → external service. Record authorization checks,
tenant context, transactions, and side effects for critical endpoints.

### Admin and client

Map route → page → feature components → hooks/state → API client/service
→ server contract. Identify duplicated request logic, inconsistent error
handling, fixture-only paths, and components with mixed
presentation/business responsibilities.

### Data and external integrations

Document Prisma models and relationships, migrations, Redis keys/TTL,
JWT/session lifecycle, file handling, OTP/Twilio behavior,
exports/imports, and cache invalidation.

### Deliverables

-   Updated architecture diagrams or concise text diagrams
-   `docs/architecture/DEPENDENCY_MAP.md`
-   A feature-by-feature critical-flow checklist
-   A list of circular dependencies, hidden side effects, and
    cross-layer imports

### Exit criteria

Each critical user journey can be traced end-to-end, including
authorization and failure behavior.

## 7. Phase 2 --- Design and implement a maintainable module structure

### API target conventions

Retain the current feature-oriented module layout. Use a structure like
this only where it fits existing patterns:

``` text
api/src/modules/<feature>/
  routes.ts           # HTTP route registration and middleware composition
  controller.ts       # HTTP request/response translation; no domain orchestration
  schema.ts           # Request validation and input/output schemas
  service.ts          # Use cases and business rules
  policy.ts           # Feature-specific authorization rules, if non-trivial
  mapper.ts           # API/domain/DB mapping, if needed
  *.test.ts           # Focused tests, colocated or in the established test tree
```

Do not create empty files just to satisfy a template. A small module may
legitimately have fewer files. Shared infrastructure belongs in `lib/`
only when it is truly cross-cutting. Avoid controllers that query Prisma
directly or services that depend on Express request objects.

### Frontend target conventions

Prefer feature-oriented folders when a feature has enough complexity:

``` text
src/
  app/ or routes/          # App setup and route composition
  components/ui/           # Existing low-level UI primitives
  components/shared/       # Truly shared app-level components
  features/<feature>/
    components/
    hooks/
    services/              # Feature operations, not duplicate generic clients
    schemas/               # If validation schemas are warranted
    types.ts
    *.test.tsx
  lib/                     # Small cross-feature utilities and API infrastructure
  styles/
```

Adapt to existing conventions; do not move every file just to match this
example. Keep page files focused on orchestration and composition.
Extract a component when it has a meaningful name, a stable contract, a
distinct responsibility, or independent test value.

### Refactoring method for every large file

1.  Read the entire file and all its callers.
2.  Write down its responsibilities and externally visible behavior.
3.  Add characterization tests around existing behavior before changing
    structure.
4.  Define the new module interfaces and dependency direction.
5.  Extract one cohesive responsibility at a time.
6.  Run targeted tests and the relevant package checks.
7.  Compare behavior and public contracts.
8.  Remove old code only after references and tests confirm it is
    unused.
9.  Document non-obvious invariants and decisions.
10. Report the exact files and checks completed.

### Exit criteria

The resulting modules have clear responsibilities, dependency direction,
and test seams; public behavior remains unchanged unless explicitly
approved.

## 8. Phase 3 --- Eliminate harmful duplication and standardize components

### Duplication policy

Classify every duplication as: - **Exact duplication:** same behavior
and contract; consolidate when ownership is clear. - **Conceptual
duplication:** similar-looking code with different business semantics;
share only stable primitives. - **Intentional duplication:** independent
apps, runtime boundaries, styling, release schedules, or security
boundaries make copies reasonable; document why. - **Generated
duplication:** output of a generator; fix its source or generator
instead.

### UI component rules

-   Use the existing `@/components/ui` primitives and app-level shared
    components.
-   Standardize patterns for page headers, module navigation, toolbars,
    tables, sorting, row actions, status pills, KPI grids,
    loading/empty/error states, form fields, dialogs, and settings rows.
-   Keep business-specific composition in feature components; avoid a
    single mega-component with many flags.
-   Use typed props, discriminated unions where they simplify state, and
    sensible defaults.
-   Avoid duplicating status-tone maps, date formatting, validation
    rules, or API response mappings across pages.
-   Keep accessibility behavior in the component contract: labels,
    keyboard navigation, focus management, disabled states, errors, and
    appropriate ARIA attributes.

### Date/time picker decision

The admin and client pickers are nearly identical but differ slightly.
Before consolidation: - diff their TSX and CSS and document every
behavioral/styling difference; - test timezone/local-date handling,
daylight-saving edge cases where relevant, minute-step behavior, min/max
boundaries, keyboard behavior, focus return, screen-reader naming,
portal positioning, and mobile layout; - decide whether to create a
minimal shared package, a copied source with automated parity checks, or
intentionally independent versions; - preserve each app's theme
integration and avoid importing one frontend into the other.

### Design tokens

The supplied design specification describes token precedence and says
the admin stylesheet contains repeated theme blocks. Inspect the actual
cascade first. Consolidate theme declarations only after screenshot and
computed-style comparisons, then ensure light and dark tokens remain
consistent. Do not add a fourth token block or scatter hex values across
page components.

### Exit criteria

Every consolidation has a documented reason, no meaningful behavior is
lost, and shared UI behavior is covered by tests.

## 9. Phase 4 --- TypeScript, validation, errors, and comments

### Type safety

-   Prefer `unknown` at untrusted boundaries and validate before use.
-   Remove avoidable `any`, unsafe casts, duplicated API types, and
    non-null assertions.
-   Use discriminated unions for meaningful lifecycle states and result
    types.
-   Infer types from validated schemas where it reduces drift, but avoid
    coupling domain types to UI library implementation details.
-   Keep API response types aligned with actual OpenAPI contracts and
    server behavior.
-   Treat generated Prisma types as generated; never hand-edit them.

### Validation

-   Validate request body, query, params, uploads, and configuration at
    boundaries.
-   Distinguish validation errors from not-found, conflict,
    unauthorized, forbidden, rate-limit, and unexpected server errors.
-   Ensure API error responses are consistent and do not leak stack
    traces or secrets.
-   Validate environment variables once at startup, fail fast for
    invalid production configuration, and avoid permissive fallback
    values for security-critical settings.

### Error handling

-   No silent catches. If an error is intentionally recoverable,
    document and test the fallback.
-   Add useful contextual logging with request/correlation IDs, while
    excluding passwords, tokens, OTPs, sensitive answers, and
    unnecessary personal data.
-   Avoid duplicating error-to-toast logic across frontend pages;
    centralize only stable conventions.
-   Ensure loading, empty, success, validation-error, permission-denied,
    and server-error states are explicit.

### Comment standard

Add comments for: - business invariants and lifecycle rules; -
authorization/tenant-isolation requirements; - transaction and
idempotency rationale; - timezone and date serialization decisions; -
non-obvious workarounds or third-party API constraints; - public APIs
whose correct use is not obvious.

Prefer comments like:

``` ts
// Submission must be idempotent: retries after a lost response must not score
// or finalize the same attempt twice. Keep the state check and write atomic.
```

Avoid comments like:

``` ts
// Increment i
i++;
```

Use TSDoc for exported utilities or complex public interfaces where it
helps callers. Keep comments accurate when code changes; stale comments
are defects.

## 10. Phase 5 --- Security, privacy, and assessment integrity

This is a review and remediation workstream, not a substitute for a
qualified penetration test or compliance audit.

### Authentication and sessions

-   Review token issuance, expiry, refresh/rotation, revocation, cookie
    flags, sign-out, disabled users, OTP limits, session store TTLs, and
    failure behavior.
-   Verify that access-token lifetime and server-side session TTL cannot
    drift into inconsistent states.
-   Confirm password hashing, credential recovery, and secret
    management.
-   Never trust client-only role checks as authorization.

### Authorization and multi-tenancy

-   Build a role × action × resource matrix.
-   Verify tenant/organization scope on every read, write, export, file
    operation, and background/administrative action.
-   Test IDOR/BOLA cases by changing IDs and organization context.
-   Ensure privileged routes fail closed and object ownership is
    enforced server-side.
-   Add negative tests, not just successful-path tests.

### Assessment integrity

-   The server is authoritative for deadlines, official submission
    timestamps, state transitions, scoring, and release of
    results/answer keys.
-   Verify idempotent submission, concurrent requests, autosave
    behavior, retake rules, manual grading/regrading, and attempt status
    transitions.
-   Keep sensitive answer keys and unreleased scores out of student
    responses.
-   Use database constraints/transactions for invariants that must
    survive concurrent requests.

### Inputs, files, and exports

-   Validate file size, type/content, schema, row counts, and parsing
    failures on the server.
-   Protect file access by authorization and tenant scope.
-   Test CSV formula injection, path traversal, malformed import files,
    oversized payloads, and unsafe content rendering.
-   Rate-limit authentication, OTP, import/export, and expensive
    operations as appropriate.
-   Check upload storage privacy, lifecycle, and cleanup.

### Web and infrastructure security

-   Review CORS allowlists, Helmet headers, cookies/CSRF assumptions,
    rate limits, request timeouts, Redis use, SQL access, dependency
    vulnerabilities, Docker exposure, and production error handling.
-   Confirm no privileged secret is exposed through `VITE_*` variables
    or frontend bundles.
-   Use least privilege for database, Redis, deployment, and read-only
    reporting roles.
-   Define backup/restore, retention, incident response, and security
    update processes.

### Privacy

Document data categories, purpose, minimization, retention,
deletion/export workflows, backup lifecycle, audit access, third-party
processors, and applicable legal obligations. Do not invent legal
conclusions or claim compliance without qualified review.

### Exit criteria

Critical security findings are fixed or explicitly accepted by the
responsible owner; tests prove access-denial and tenant-isolation
behavior; no secret values are included in reports.

## 11. Phase 6 --- Testing strategy and quality gates

### Testing layers

1.  **Unit tests:** pure functions, validation, mappers, scoring rules,
    date/time logic, policy decisions.
2.  **Service/integration tests:** database constraints, transactions,
    tenant boundaries, sessions, Redis behavior, imports/exports.
3.  **API contract tests:** status codes, schemas, error shapes,
    authorization, pagination, idempotency.
4.  **Component tests:** interaction, loading/error/empty states,
    accessibility names, keyboard operation.
5.  **End-to-end tests:** critical admin and student journeys against a
    controlled test environment.
6.  **Manual UAT:** business owner verifies acceptance criteria and
    representative devices.

### Minimum critical journeys

-   Admin login, logout, session expiry, and unauthorized access.
-   Student login/OTP failure and throttling.
-   Student and organization isolation on list/detail/update/export
    routes.
-   Create/edit/publish an activity or quiz.
-   Question-bank creation/import/export and malformed input rejection.
-   Registration/assignment lifecycle.
-   Attempt start, save answers, timer/deadline, submit, duplicate
    submission, scoring, result release, retake handling.
-   Empty, loading, network failure, permission denied, and retry
    states.
-   Theme switch and responsive layout at approximately 375px, 768px,
    and 1280px.
-   Keyboard-only operation and automated accessibility checks on core
    flows.

### Quality gates

For each affected package, require: - type-check passes; - lint
passes; - formatting check passes; - relevant unit/integration tests
pass; - build passes; - no new unreviewed security suppressions; -
API/schema compatibility review for contract or database changes.

Root `npm run check` should be run where practical, but the agent must
inspect its actual script expansion so tests are not accidentally
assumed to run twice or omitted. Do not use `--fix` as a substitute for
understanding lint findings.

### Coverage policy

First measure a trustworthy baseline. Then add tests to changed logic
and critical security/assessment flows. Set thresholds only after
reviewing baseline and test quality; coverage percentage alone does not
establish correctness.

## 12. Phase 7 --- Frontend UI/UX and accessibility

Preserve the supplied BrainPulses visual system: - semantic color tokens
instead of one-off hex values; - existing typography hierarchy and
spacing rhythm; - existing UI primitives and Lucide icons; - 44px
target/control sizing where specified; - calm, compact administrative
tables and consistent status semantics; - existing light/dark
behavior; - responsive sidebar/drawer and horizontally scrollable
tables/module tabs where intended; - reduced-motion support, visible
focus, accessible labels, and clear error feedback.

Review every route for: - layout consistency and alignment; - mobile
overflow and responsive tables; - keyboard access and focus order; -
semantic headings, labels, landmarks, and accessible names; - contrast
in both themes; - form validation and error association; - loading,
empty, permission, and failure states; - date/time picker usability,
localization, timezone assumptions, and keyboard support.

Do not make an unrequested redesign during code cleanup. Visual changes
require before/after evidence and explicit acceptance criteria.

## 13. Phase 8 --- Performance and operational readiness

Measure before optimizing. Investigate: - unnecessary React renders,
expensive derived calculations, oversized route bundles, and duplicated
dependencies; - API latency, N+1 queries, unbounded list endpoints, and
missing indexes; - query plans for high-volume tenant-scoped
operations; - pagination and export memory usage; - cache invalidation
and stale data behavior; - Redis key lifecycle and memory limits; -
timeouts, retries, rate limits, and graceful failure of external
services; - structured logs, health/readiness endpoints, metrics, and
alerts; - backup restoration and migration rollout procedures.

Do not add caching, memoization, background queues, or indexes
speculatively. Capture a baseline, state the bottleneck, implement a
targeted change, and compare results.

## 14. Phase 9 --- Documentation and change governance

Keep documentation close to the implementation and remove
contradictions.

Recommended documents: - `docs/engineering/BASELINE_AUDIT.md` ---
initial state and commands; -
`docs/engineering/ARCHITECTURE_DECISIONS.md` or ADRs --- choices and
alternatives; - `docs/engineering/CODE_CONVENTIONS.md` --- naming,
modules, types, comments, error handling; -
`docs/engineering/QUALITY_GATES.md` --- required local and CI checks; -
`docs/engineering/REFACTORING_REGISTER.md` --- ordered backlog with
evidence and acceptance criteria; - updated architecture diagrams,
API/OpenAPI, threat model, data model, testing, release, and handoff
docs as behavior changes.

Each non-trivial architecture or dependency decision should record
context, options, decision, consequences, and revisit conditions. Do not
duplicate an existing document if it can be updated clearly.

Each pull request/change set should describe: - objective and scope; -
behavior intended to remain unchanged; - key files/modules affected; -
tests added and commands/results; - database/API compatibility
implications; - security/privacy/accessibility impact; - screenshots for
visible UI changes; - rollback or mitigation notes where relevant.

## 15. Phase 10 --- CI and release discipline

Inspect whether CI workflows already exist outside the supplied archive
or in repository hosting before creating new ones. The ZIP snapshot does
not establish the state of remote CI.

A suitable pipeline should: 1. use a supported Node version and
deterministic lockfile installs; 2. run type-check, lint, formatting
check, tests, and production builds; 3. run dependency and secret
scanning using approved tools; 4. validate Prisma schema and migrations
without connecting to production; 5. run targeted integration/E2E tests
against isolated ephemeral services where feasible; 6. publish artifacts
only from trusted branches/tags; 7. require review for schema,
authorization, and security-sensitive changes.

Deployment and migration sequencing must be explicit. Never run
destructive migrations automatically as a side effect of a frontend
build. Production deployment, secrets, environment configuration, and
rollback remain separate controlled procedures.

## 16. Recommended implementation order

Prioritize risk and evidence rather than maximum code movement.

  -------------------------------------------------------------------------------
  Priority          Workstream              Reason              Gate to continue
  ----------------- ----------------------- ------------------- -----------------
  P0                Baseline, repo rules,   Prevents accidental Baseline report
                    secret/config scan      damage and          and known
                                            establishes truth   blockers

  P0                Authentication, tenant  High-impact data    Negative tests
                    isolation, attempt      and trust           and reviewed
                    integrity               boundaries          findings

  P1                Test coverage for       Makes later         Critical journey
                    critical flows          refactors safer     tests pass

  P1                API service             Large               Behavior
                    decomposition           business-critical   preserved, tests
                                            services            pass

  P1                Admin wizard and        Large UI and mixed  UI and flow
                    service-layer           responsibilities    regressions ruled
                    decomposition                               out

  P1                Error/validation/type   Improves            Consistent
                    consistency             predictability      contracts and
                                            across layers       tests

  P2                Shared UI and utility   Reduces drift       Contract
                    deduplication                               comparison and
                                                                parity tests

  P2                CSS/token cleanup and   Reduces visual      Theme and
                    accessibility           inconsistencies     viewport
                                                                comparisons

  P2                CI and dependency       Prevents            Required checks
                    governance              regressions         enforced

  P3                Performance tuning and  Optimize measured   Before/after
                    operational             bottlenecks         measurements
                    improvements                                

  P3                Broader standards       Sustains            Named owners,
                    evidence and governance improvements        records, review
                                                                cadence
  -------------------------------------------------------------------------------

Do not perform all phases in a single agent run. Complete one phase,
report evidence, review the diff, and then proceed.

## 17. Definition of done

A change is done only when applicable items below are satisfied: - \[ \]
Scope and acceptance criteria are clear. - \[ \] Existing behavior and
relevant contracts are understood. - \[ \] The implementation has one
clear responsibility and an understandable interface. - \[ \]
Duplication is removed only where semantics genuinely match. - \[ \]
Types and validation are sound; no unexplained suppressions or unsafe
casts were introduced. - \[ \] Comments explain non-obvious
intent/invariants and are accurate. - \[ \] Error, loading, empty,
disabled, and permission states are handled. - \[ \] Accessibility and
responsive behavior are verified for UI changes. - \[ \] Security and
tenant boundaries are tested for relevant API changes. - \[ \] Tests
cover changed logic and critical edge cases. - \[ \] Lint, type-check,
formatting check, tests, and build pass for the affected package(s). -
\[ \] Database/API compatibility and migration safety are reviewed where
applicable. - \[ \] Documentation and ADRs are updated where needed. -
\[ \] Diff contains no unrelated formatting churn or generated output
changes. - \[ \] Report states what changed, evidence, remaining risk,
and checks not run.

## 18. Required format for every AI-agent progress report

The agent must report using this template after each phase or bounded
task:

``` text
Task:
Scope and reason:

Findings (with file paths and evidence):
1.
2.

Files changed:
- path — purpose

Behavior preserved / behavior intentionally changed:
- 

Tests and commands actually run:
- command — PASS/FAIL/NOT RUN — short result

Security, data, migration, accessibility, and performance impact:
- 

Risks / open decisions:
- 

Next smallest safe step:
- 
```

The agent must not state "fully audited," "ISO compliant," "secure," or
"all duplicates removed" without defining the scope and presenting
evidence.

## 19. Copy/paste master prompt for your AI coding agent

Use the following prompt from the repository root. It intentionally
instructs the agent to start with audit and planning rather than
immediately editing the whole application.

------------------------------------------------------------------------

**ROLE**

Act as a staff-level software engineer, application architect,
application-security reviewer, test engineer, and
accessibility-conscious frontend engineer. Your task is to improve the
existing BrainPulses codebase through small, safe, evidence-driven
refactors. Optimize for maintainability, clarity, correctness, security,
accessibility, and long-term changeability---not code golf or line-count
reduction.

**SOURCE OF TRUTH**

Work only in the existing BrainPulses repository and follow `AGENT.md`,
`.cursor/rules/`, product requirements, architecture docs,
security/privacy guidance, API contracts, Prisma migrations, and the
supplied BrainPulses design system. Resolve contradictions by inspecting
actual implementation and documenting the discrepancy. Do not silently
substitute assumptions for missing requirements.

**FIRST RUN: AUDIT ONLY**

Do not modify application code on the first run. Inspect the repository
structure, Git state, package scripts, dependency boundaries,
source/generated files, routes, API contracts, Prisma schema/migrations,
auth/session lifecycle, tenant enforcement, assessment lifecycle,
frontend state, design tokens, tests, and existing documentation. Run
non-destructive checks where feasible. Do not expose secret values.
Produce the baseline audit, dependency map, risk register, refactoring
backlog, and a proposed order of work. Clearly label verified findings,
hypotheses, and unknowns.

**IMPLEMENTATION RULES**

-   Do not rewrite the application or change frameworks just to make it
    look professional.
-   Preserve existing behavior and public contracts unless the user
    explicitly approves a change.
-   Refactor one bounded responsibility at a time; add characterization
    tests before structural changes.
-   Replace duplicated code with shared abstractions only when
    semantics, contracts, and lifecycle genuinely match.
-   Separate UI rendering, domain/business rules, API transport,
    persistence, and validation where they are mixed.
-   Keep components cohesive and props typed; avoid mega-components,
    giant generic helpers, premature abstraction, and excessive prop
    flags.
-   Do not hand-edit generated Prisma files or generated artifacts.
-   Never reset or rewrite applied database migrations, destroy data, or
    change production resources.
-   Never print or commit secrets. Do not place privileged credentials
    in frontend variables or bundles.
-   Enforce server-side authentication, authorization, tenant scope,
    input validation, and assessment integrity.
-   Document invariants and non-obvious decisions. Do not add comments
    that simply narrate syntax.
-   Respect the existing BrainPulses design system and UI primitives. No
    unrequested redesign.
-   Do not add broad lint/type suppressions to silence checks.
-   Do not upgrade dependencies or introduce a new library unless a
    demonstrated need and compatibility plan justify it.
-   Do not claim tests, builds, scans, or audits passed unless they were
    actually run.
-   Ask for approval before destructive actions or product-level
    behavior changes.

**WORK SEQUENCE**

1.  Baseline audit and safe checks.
2.  Architecture and critical-flow map.
3.  Security and tenant-isolation review with negative tests.
4.  Test characterization of high-risk workflows.
5.  API module refactoring.
6.  Admin and client feature/component refactoring.
7.  Duplication and shared-component decisions.
8.  Type, validation, error, and comment improvements.
9.  Accessibility, responsive, theme, and date/time picker verification.
10. CI, documentation, performance and operational hardening.

Do not run the entire sequence in one unreviewed operation. At the end
of each bounded task, stop and report changed files, rationale, behavior
preserved, exact commands/results, unresolved risks, and the next
smallest safe task. Keep changes small enough to review and revert
independently.

**QUALITY GATES**

For every affected package, run applicable type-check, lint, formatting
check, tests, and build. Add regression tests for changed behavior and
negative tests for security boundaries. For UI changes, verify keyboard
behavior, accessible names, loading/error/empty states, light/dark
themes, and approximately 375px/768px/1280px widths. For API/schema
changes, review OpenAPI and migration compatibility. If a command cannot
run, state why and do not imply it passed.

**STANDARDS**

Use ISO/IEC 25010 as a quality-model reference, ISO/IEC/IEEE 12207 as a
lifecycle-process reference, ISO/IEC 27001/27701 as governance
references where applicable, WCAG 2.2 AA as the accessibility target,
and OWASP ASVS as an application-security verification guide. These
references do not themselves make the product certified or compliant.
Create measurable evidence and flag areas requiring qualified review.

**FIRST DELIVERABLE**

Return: 1. Verified architecture summary. 2. Baseline check results. 3.
Top risks with evidence and severity. 4. Duplicate/shared-code
inventory. 5. Prioritized backlog with acceptance criteria and
dependencies. 6. Recommended first bounded implementation task. 7.
Questions that genuinely require product-owner decisions.

Do not edit application code until the first audit is reviewed and
approved.

------------------------------------------------------------------------

## 20. Final recommendation

The safest first move is **not** to merge the frontends, split every
large file, or ask the agent to "clean the entire repo." Start with a
baseline audit, critical-flow/security tests, and a prioritized
refactoring register. Then refactor the API's assessment lifecycle and
the largest frontend workflows behind regression tests.

The most important success measure is not fewer lines of code. It is
whether another developer can understand a change, prove it is correct,
review its impact, and safely ship it without breaking tenant isolation,
assessment behavior, or the established BrainPulses interface.
