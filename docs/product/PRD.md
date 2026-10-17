# Product Requirements Document (PRD)

**Product:** BrainPulses · **Version:** 0.1 · **Status:** Initial baseline; owner approval required

## 1. Vision
A reliable, clear platform for managing question content, creating/assigning activities, delivering assessments and reviewing outcomes.

## 2. Personas
- **Super administrator:** platform settings, staff access and oversight.
- **Administrator:** learners, assessment operations and reports.
- **Teacher/author:** question banks, activity setup, assignment and review.
- **Student/learner:** assigned activities, instructions, attempts and permitted results.

The inspected routes are admin-oriented. Full teacher/student experiences require scope confirmation.

## 3. Current routes
| Route | Capability | Current status |
|---|---|---|
| `/dashboard` | Overview | Fixture-backed |
| `/students` | Learners | Fixture-backed |
| `/users` | Users/access | Fixture-backed |
| `/assessments` | Assessment list | Fixture-backed |
| `/assessments/banks` | Assessment banks | Fixture-backed |
| `/assessments/new` | Create assessment | Prototype |
| `/assessments/registrations` | Registrations | Fixture-backed |
| `/assessments/reports` | Reports/results | Fixture-backed |
| `/quizzes` | Quiz list | Fixture-backed |
| `/quizzes/banks` | Quiz banks | Fixture-backed |
| `/quizzes/new` | Create quiz | Prototype |
| `/quizzes/registrations` | Quiz registrations | Fixture-backed |
| `/quizzes/reports` | Quiz reports | Fixture-backed |
| `/settings` | General settings | Local state |
| `/settings/access` | Access settings | Local state |
| `/settings/notifications` | Notifications | Local state |
| `/settings/system` | System settings | Local state |

Unknown routes currently redirect to `/dashboard`; this is not an authorization control.

## 4. Functional requirements
**Dashboard:** show operational overview from trusted data; charts need loading/empty/error states; fake metrics must never appear live.

**Students/users:** search/filter/inspect records; create/update/deactivate/import/export only when authorized and connected; validate bulk import with row-level errors; scope records to authorized organization; audit privilege changes.

**Activities:** distinguish quiz and assessment rules while reusing UI; define lifecycle states centrally; validate fields, dates, assignments and bank compatibility; prevent invalid publication; define impact of edits on active attempts.

**Question banks:** reusable banks with metadata/types/status/usage; central question validation; safe behavior when referenced by active/historical activities; server-side upload validation.

**Registrations/results:** filter by activity/date/status; status is text plus color; exports scoped server-side; result visibility follows approved release policy.

**Settings:** four categories; detect unsaved changes; report success only after persistence confirmation; preserve input after recoverable errors; file selection is not upload completion.

## 5. UX requirements
Follow `docs/design/DESIGN.md` and `docs/COLOR_PALETTE.md`: 44 px controls, 1 px borders, 12 px cards, 8 px buttons, Plus Jakarta Sans and Source Sans 3, Royal Violet `#45058F` (dark primary `#7E22CE`), semantic tokens, shadcn/ui, lucide-react, responsive tables, accessible focus, and both themes. Dark is the default.

## 6. Acceptance criteria
Requirements and permissions defined; shared design patterns reused; server validation/authorization exists; async states handled; tests pass; keyboard/responsive behavior reviewed; no unauthorized data/secrets leak; docs updated.

## 7. Open decisions
Final roles; student-facing scope; timer/autosave/scoring/retakes; question types/import format; result release/regrading; tenancy; integrations; notification channels; launch metrics.
