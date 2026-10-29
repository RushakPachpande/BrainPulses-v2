# Technical Requirements Document (TRD)

**Status:** Admin, student client, and API are implemented for local development. Hosting and some operational choices remain proposals. Critical request flows are in [../architecture/DEPENDENCY_MAP.md](../architecture/DEPENDENCY_MAP.md).

## 1. Current stack
| Area | Current |
|---|---|
| UI/language | React 19, TypeScript 6 |
| Build | Vite 8 |
| CSS | Tailwind CSS v4, CSS variables |
| Components | shadcn/ui local components, Radix UI |
| Icons | `lucide-react` |
| Routing | `react-router` |
| Charts/toasts | Recharts / Sonner |
| Utilities | class-variance-authority, `cn` |
| Quality | ESLint, Prettier, TypeScript |
| Runtime | Node.js >= 22 |
| App | `admin/` |
| Data | Fixtures in `admin/src/services/fixtures.ts`, mapped in `services/index.ts` |

## 2. Current architecture
```text
Browser → admin React app → Router → AdminLayout/pages
                              ├─ shadcn/ui local components
                              ├─ theme/page-header contexts
                              └─ services → API (fixtures only when VITE_USE_FIXTURES=true)
```

`api/` is Express with Prisma, PostgreSQL, and Redis. It is the server-side auth, tenant, and assessment boundary. The fixture diagram that used to stand here described only the optional fixture path.

## 3. Target architecture (proposed)
```text
Browser SPA → typed API client → trusted API/server functions
                                  ├─ session validation
                                  ├─ authorization/tenant scope
                                  ├─ input/domain validation
                                  ├─ audit events
                                  └─ data access → relational DB + object storage
```
**Decision required:** backend approach (Supabase-only, separate API, hybrid), auth, tenancy, database, storage and hosting.

## 4. Principles
Keep route components focused; use shared shadcn/domain components; centralize API access in typed services; keep business rules out of presentation; validate at boundaries; use one navigation/permission configuration; avoid duplicate libraries; refactor incrementally; keep fixture mode explicit.

## 5. Suggested growth structure
```text
admin/src/
  components/ui/       # shadcn primitives
  components/layout/   # shell, sidebar, topbar
  components/shared/
  features/             # domain modules when useful
  routes/
  services/api/
  services/fixtures/
  contexts/ hooks/ lib/ types/
```
This is guidance, not a mandatory migration.

## 6. Configuration/data rules
Never commit `.env` or secrets. Vite-exposed variables are public. Separate local/test/staging/production. Add typed request/response contracts and consistent errors when APIs arrive. Never trust client role, tenant ID, score, timing or attempt state. Version all schema changes.

## 7. Non-functional requirements
Accessibility target WCAG 2.2 AA; responsive from 360 px to wide desktop; server-enforced security; recoverable errors; performance baselines measured on realistic data; privacy-safe observability; availability/RPO/RTO defined by business/operations.

## 8. Validation commands
`npm run typecheck:admin`, `npm run lint:admin`, `npm run format:check:admin`, `npm run build:admin`, or `npm run check:admin`. Report only commands actually run.
