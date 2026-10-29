# BrainPulses Documentation Hub

**Audience:** Product, design, engineering, QA, operations and AI coding agents.  
**Status:** Initial baseline. Current implementation is distinguished from proposals.

| Document | Purpose | Status |
|---|---|---|
| [BRD](product/BRD.md) | Business goals, stakeholders, scope, value, risks | Draft for validation |
| [PRD](product/PRD.md) | Product requirements, features and acceptance criteria | Initial baseline |
| [TRD](engineering/TRD.md) | Stack, architecture and technical requirements | Admin, client, and API current; hosting still proposed |
| [DESIGN](design/DESIGN.md) | Mandatory UI/UX contract for the current admin theme | Normative |
| [Color palette](COLOR_PALETTE.md) | Brand and semantic colors for that theme | Canonical |
| [Stitch extraction](../.stitch/DESIGN.md) | Same visual system, formatted for Stitch | Current |
| [App flow](../APP_FLOW.md) | Routes and journeys | Current + target |
| [AI Agent Guide](../AI_AGENT_GUIDE.md) | Required AI coding workflow | Normative |
| [DB Structure](architecture/DB_STRUCTURE.md) | Data model notes | Draft; live schema is `api/prisma/schema.prisma` |
| [API Structure](architecture/API_STRUCTURE.md) | API notes | Local API exists; contract is `api/openapi.yaml` |
| [Dependency map](architecture/DEPENDENCY_MAP.md) | Critical-flow traces from the 2026-10-23 audit | Current |
| [Baseline audit](engineering/BASELINE_AUDIT.md) | Command results and inventory | Current, with a 2026-10-24 recheck |
| [Refactoring register](engineering/REFACTORING_REGISTER.md) | Ordered engineering backlog | Current |
| [Progress](engineering/PROGRESS.md) | Resume point for the excellence mission | Current |
| [Quality gates](engineering/QUALITY_GATES.md) | What each check covers today | Current |
| [Implementation plan](engineering/IMPLEMENTATION_PLAN.md) | Phased delivery | Proposed |
| [Security & privacy](engineering/SECURITY_PRIVACY.md) | Security baseline | Requirements |
| [Testing & QA](engineering/TESTING_QA.md) | Test strategy | Requirements |
| [Release checklist](engineering/RELEASE_CHECKLIST.md) | Release gate | Template |
| [ADR template](templates/ADR-TEMPLATE.md) | Architecture decisions | Ready to use |

## Verified current-state facts
- `admin/` is React + TypeScript + Vite.
- UI uses Tailwind CSS v4, shadcn/ui (`radix-nova`), Radix UI, `lucide-react`, React Router, Recharts and Sonner.
- The live theme is Royal Violet `#45058F` on a porcelain canvas in light mode, and Vivid Violet `#7E22CE` on night navy in dark mode. Dark is the default. Tokens are the last `:root` and `.dark` blocks in `admin/src/index.css`.
- Current routes cover dashboard, students, users, assessments, quizzes, question banks, registrations, reports and four settings pages.
- `admin/src/services/index.ts` calls the API unless `VITE_USE_FIXTURES=true`, in which case it reads `admin/src/services/fixtures.ts`.
- `api/` is an Express service with Prisma, PostgreSQL, Redis, and server-side auth. Critical flows are traced in [architecture/DEPENDENCY_MAP.md](architecture/DEPENDENCY_MAP.md).
- Settings saves that are still local-only are called out in the page that owns them. Do not treat every settings control as a confirmed persistent write.

**Status vocabulary:** Implemented = present and verified; Prototype = local UI/state; Proposed = not implemented; Decision required = owner must choose; Deferred = out of scope for now.

Update docs when decisions change. Use ADRs for architectural, security, data, deployment and maintenance decisions. Never describe proposed infrastructure as implemented.
