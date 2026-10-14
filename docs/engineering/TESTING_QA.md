# Testing and Quality Assurance Strategy

## Test layers
- **Static:** TypeScript, ESLint, Prettier, production build, dependency/secret scans.
- **Unit:** mapping/formatting, validation, permissions, state transitions and query serialization.
- **Component:** forms, errors, keyboard interaction, loading/empty/error, themes, tables and dialogs.
- **Integration:** routes/deep links, service failures, role navigation, imports/exports, settings persistence and authorization.
- **E2E:** sign-in/session expiry, learner management, activity publishing, bank assignment, registration export, student attempt when implemented.
- **Visual regression:** dashboard, lists, settings, dialogs, themes, responsive widths, sidebar states and long content.

## Viewports
Test approximately 360×800, 390×844, 768×1024, 1024×768, 1440×900 and 1920×1080. Avoid accidental page-level horizontal overflow.

## Accessibility
Keyboard-only use, visible focus, semantic landmarks/headings, icon accessible names, labels/error associations, dialog/menu focus, contrast in both themes, non-color status, zoom/reflow, reduced motion and screen-reader smoke tests.

## Security/data tests
Unauthorized operations denied; cross-tenant denial if applicable; no self-escalation; results follow release policy; retries do not duplicate submission; invalid/oversized uploads rejected; CSV injection mitigated; logs exclude secrets/unneeded sensitive content.

## Current commands
```bash
npm run typecheck:admin
npm run lint:admin
npm run format:check:admin
npm run build:admin
npm run check:admin
```
Run before release and record actual results.

## Severity
| Severity | Meaning | Release |
|---|---|---|
| Critical | Exposure, privilege bypass, data loss, core outage | Block |
| High | Major workflow or serious security/accessibility issue | Block unless formally accepted |
| Medium | Important issue with workaround | Prioritize |
| Low | Cosmetic/low impact | Schedule |

Record commit, environment/browser versions, exact commands, test totals, visual evidence, defects, accepted risks, approver and release decision.
