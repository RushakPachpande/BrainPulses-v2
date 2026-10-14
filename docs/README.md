# BrainPulses Documentation Hub

**Audience:** Product, design, engineering, QA, operations and AI coding agents.  
**Status:** Initial baseline. Current implementation is distinguished from proposals.

| Document | Purpose | Status |
|---|---|---|
| [BRD](product/BRD.md) | Business goals, stakeholders, scope, value, risks | Draft for validation |
| [PRD](product/PRD.md) | Product requirements, features and acceptance criteria | Initial baseline |
| [TRD](engineering/TRD.md) | Stack, architecture and technical requirements | Frontend current; backend proposed |
| [DESIGN](design/DESIGN.md) | Mandatory UI/UX contract for the current admin theme | Normative |
| [Color palette](COLOR_PALETTE.md) | Brand and semantic colors for that theme | Canonical |
| [Stitch extraction](../.stitch/DESIGN.md) | Same visual system, formatted for Stitch | Current |
| [App flow](../APP_FLOW.md) | Routes and journeys | Current + target |
| [AI Agent Guide](../AI_AGENT_GUIDE.md) | Required AI coding workflow | Normative |
| [DB Structure](architecture/DB_STRUCTURE.md) | Future data model | Draft; not implemented |
| [API Structure](architecture/API_STRUCTURE.md) | Future API conventions | Draft; not implemented |
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
- `admin/src/services/index.ts` reads fixture data from `admin/src/services/fixtures.ts`.
- Settings saves and asset selections are local prototype interactions, not confirmed persistent writes/uploads.
- The inspected frontend does not establish a production database, API, authentication or server-side authorization model.

**Status vocabulary:** Implemented = present and verified; Prototype = local UI/state; Proposed = not implemented; Decision required = owner must choose; Deferred = out of scope for now.

Update docs when decisions change. Use ADRs for architectural, security, data, deployment and maintenance decisions. Never describe proposed infrastructure as implemented.
