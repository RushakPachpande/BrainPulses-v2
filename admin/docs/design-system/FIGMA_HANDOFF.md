# BrainPulses — Figma design handoff

## Design principles

Keep the existing BrainPulses admin and student UX. The requested update is a professional unified design system, **not** a rewrite. The brand master is `../../../assets/brainpulses.svg` (deployed locally as `public/brand.svg`) (Royal Violet `#45058F` plus white). Use application-local variables from `src/styles/tokens.css`; this app generates `docs/design-system/tokens.json` with `npm run design:tokens`. Both theme modes must be represented.

## File organization

1. `00 · Cover & Brand` — product mark, usage, do/don't examples, wordmark treatment.
2. `01 · Foundations` — brand-50…900 palette, light/dark semantic color variables, typography, 4px spacing, corner radii, elevation, grid.
3. `02 · Components` — actions (button states), fields, toggles, selects, pills/badges, cards, breadcrumbs, tables, navigation, dialogs, toasts, skeletons.
4. `03 · Admin` — dashboard, quiz and assessment lists, question banks, forms, assignment rules, registrations, reports, settings, design-system showcase.
5. `04 · Client` — login, student dashboard, library, activity details, instructions, attempt, question navigation, submit confirmation, results, profile, help.
6. `05 · Mobile & Tablet` — responsive admin navigation, table overflow, form stacking, quiz answer options and timer.
7. `06 · Interactive Prototypes` — admin create/publish journey and client attempt/review/submit journey; verify empty, pending, error and expired states.
8. `07 · Specs & Handoff` — CSS variables, type sizes, breakpoints, accessibility requirements, component/state mapping, API data boundary.

## Variables and component naming

- Collections: `Brand` (fixed), `Semantic` (modes `Light`, `Dark`), `Sizing`, `Type`.
- Source color: `Brand/Violet/600` = `#45058F`. Map semantic `Action/Primary` -> Brand/Violet/600 (light); `#7E22CE` (dark).
- Names: `Button/Primary/Default`, `Button/Primary/Disabled`, `Input/Default/Focus`, `Status/Success`, `Question/Option/Selected`, `Sidebar/Item/Active`, etc.
- Variants: state `default | hover | focus | disabled | loading | error` as relevant; size `sm | md | lg` only when a real product need exists; scheme `light | dark` via variables.
- Grids: 1440×900 desktop, 1024×768 landscape tablet, 768×1024 portrait tablet, 390×844 phone; test 320px small phone.
- Prioritize responsive Auto Layout and constraints; do not convert screenshots into a non-editable component library.

## Key UX journeys

**Admin** → Sign in → Dashboard → Create quiz/assessment → Configure question bank → Configure registration → Assignment rules → Publish/access link → Registrations → Reports.

**Client** → Enter via registration/access link → Validation → Instructions → Attempt → Mark for review / change answer → Confirm submission → Result (when allowed).

Keep quiz and assessment separate where business rules differ; reuse structural components, form patterns, status and validation feedback. Do not invent APIs or modify scoring rules in Figma. The `api/` application remains the single source of truth. Do not assume students must sign in if a link-driven journey is configured.

## Quality checklist

- [ ] Logo matches exact SVG, scales without cropping or distortion.
- [ ] All components use named semantic colors, not hard-coded purple everywhere.
- [ ] Light and dark checked for readability; button foreground contrast at least 4.5:1.
- [ ] Complete keyboard focus, invalid, loading, and disabled states.
- [ ] One primary action per section, with clear destructive confirmation.
- [ ] Distinct quiz attempt states: unanswered, answered, flagged, current, submitted.
- [ ] Timer remains visible; backend submission status is not faked by UI.
- [ ] Admin forms preserve unsaved input after recoverable errors.
- [ ] Mobile nav and long tables do not overflow the viewport.
- [ ] Meaningful empty states and permission-denied states.

## Implementation reference

Use the running Admin route `/settings/design-system` as a living component specimen board. For this app, the CSS source is `src/styles/tokens.css`, and `docs/design-system/tokens.json` is the generated representation. This handoff is a specification, **not** an editable Figma document; importing into Figma is a separate step.
