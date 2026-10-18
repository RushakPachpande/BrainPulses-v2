# Independent apps migration — Verification

Verified on 2026-10-18 against `BrainPulses_v2_DateTimePicker_Integrated.zip`.

## Passed source-level checks

- Root `design-system/` and its dependent root scripts are absent.
- `admin/src/main.tsx` and `client/src/main.tsx` import their own `./styles/tokens.css` after original app styles.
- Both apps preserve 44px `--control-h`, light and dark semantic colors, existing package scripts, and original components.
- Both DateTimePicker components keep the same public props and use `useLayoutEffect` to calculate popup placement before browser paint; `focus({ preventScroll: true })` avoids scrolling the page.
- Both local `npm run design:tokens` exports run successfully with Node alone (94 light and 54 dark tokens each).
- Admin and Client retain their own React components, design documentation, token JSON, and self-contained previews. Preview CSS/logo links resolve inside the owning app.
- SVG master and all four deployed Admin/Client brand assets have matching SHA-256 hashes.
- All modified TSX sources transpile without syntax diagnostics (using globally installed TypeScript); token and DateTimePicker CSS parse successfully (PostCSS).
- No runtime relative imports into `design-system/` or sibling application source roots remain in either frontend.

## Checks blocked by environment

`npm run typecheck:admin` and `npm run typecheck:client` were attempted, but the archive deliberately excludes `node_modules`; the checks cannot resolve installed package types including `vite/client`, `@types/node` and React JSX types. These are missing-dependency failures, **not evidence that a full application build passed**. Runtime interaction and browser checks are unverified.

Install dependencies locally (`npm run cleaninstall` from the repository root, or `npm ci` inside each app), then run `npm run typecheck`, `npm run build`, and your existing tests. Manually exercise light/dark switching, DateTimePicker opening and focus, Admin Settings → Design System, and client quiz/assessment forms.
