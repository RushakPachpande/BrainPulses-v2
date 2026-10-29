# Architecture decisions

Short records for choices made during the engineering excellence mission. Use `docs/templates/ADR-TEMPLATE.md` when a later decision needs the full form.

## ADR-001 — Admin page tests provide a query client directly

**Date:** 2026-10-24
**Status:** Accepted

`DashboardPage` and `StudentsPage` call `useQuery`. Their tests rendered the pages without a `QueryClientProvider`, so Vitest failed before any assertion.

**Decision:** `renderWithAdminQuery` creates a client with `createAdminQueryClient` and wraps the render. Tests do not mount `AdminQueryProvider`, because that provider also persists cache in `sessionStorage` and tracks organization changes.

**Consequences:** The tests exercise the same query defaults as the app, without writing session storage. A future test that needs persistence has to opt into `AdminQueryProvider` on purpose.

## ADR-002 — Do not mass-format, and do not lint generated graphs

**Date:** 2026-10-24
**Status:** Accepted

`npm run format:check` fails in api, admin, and client. API Prettier was also scanning gitignored `api/graphify-out`.

**Decision:** Ignore `graphify-out` in `api/.prettierignore`. Leave tracked formatting failures in place until a change is dedicated to formatting. Do not mix a repository-wide `prettier --write` with behavior or test fixes.

**Consequences:** Format check stays red. That is a known baseline failure, not a regression from the 2026-10-24 test and lint fixes.

## ADR-003 — Client tests start with pure validation

**Date:** 2026-10-24
**Status:** Accepted

The student app had no test script. The sign-in page depends on auth context, routing, and theme.

**Decision:** Add Vitest in `client/` and test `isValidUniqueId` and `isValidNationalMobile` first. Do not add a shared workspace package, and do not render the login page until a test harness for auth exists.

**Consequences:** `npm run test` in `client/` is real and small. It does not protect layout, OTP submission, or attempt flows yet.

## ADR-004 — Tenant-mismatch throw stays a 500, and createMany cannot override the org

**Date:** 2026-10-24
**Status:** Accepted

The Prisma extension throws a plain `Error` when a query inside tenant context names another organization. The error handler maps unknown errors to HTTP 500.

**Reachability, verified 2026-10-24:** Current routes cannot hit that throw.

- The only caller of `tenantStore.run` is `withTenantContext`. It sets `organizationId` from `req.actor.organizationId`. `withTenant()` has no callers.
- Controllers pass that same actor id into services. Tenant-model queries that set `organizationId` use that parameter.
- `POST /api/auth/select-organization` accepts an organization id, and it is not behind `withTenantContext`. It loads the membership for the signed-in user before issuing a session.
- `GET /api/files/download` is registered before `withTenantContext`. Its query uses the organization stored in the download token, with no tenant context active, so the mismatch check does not run.

No route was added to force the throw. The defensive check stays, including the 500 mapping, until a real caller can hit it.

**Separate guard hole that was reachable in code, not in current payloads:** `createMany` injected `organizationId` and then spread the row, so a foreign `organizationId` on the row would win and would not throw. `withTenantOrganization` now throws on a foreign id and writes the request organization. Current callers already pass the actor organization, so successful creates stay the same. Unit coverage is `api/test/tenant-scope.test.ts`.

**Revisit when:** A new caller supplies an organization id from the client while tenant context is active.
