---
name: Client motion and search debounce
overview: Port admin-style motion to the client (View Transitions theme toggle, per-route page enter, reduced-motion) and standardize 300ms search debounce so list filtering does not run on every keystroke—especially on the client library, where debounce is missing today.
todos:
  - id: client-theme-vt
    content: Port View Transitions theme toggle to client; wire login + shell
    status: completed
  - id: client-page-enter
    content: Add bp-page-enter on route changes + reduced-motion CSS
    status: completed
  - id: debounce-hooks
    content: Add useDebouncedValue in admin and client; refactor Toolbar; debounce library search
    status: completed
isProject: false
---

# Client animations + search debounce

## Context

- Admin motion is CSS / View Transitions (no framer-motion): circular theme reveal in [`admin/src/components/theme-toggle.tsx`](admin/src/components/theme-toggle.tsx), `bp-page-enter` in [`admin/src/index.css`](admin/src/index.css), `prefers-reduced-motion` guards.
- Client theme today is an instant class toggle via [`client/src/hooks/use-client-theme.ts`](client/src/hooks/use-client-theme.ts) (login + shell).
- Admin list search already delays commits **300ms** inside [`admin/src/components/toolbar.tsx`](admin/src/components/toolbar.tsx). Client [`library.tsx`](client/src/pages/library.tsx) filters on **every keystroke**. List search is currently **in-memory** (API loads once); debounce still prevents filter thrash and future API `q=` spam.

## 1. Client animations (mirror admin)

### Theme toggle (View Transitions)

- Add [`client/src/components/theme-toggle.tsx`](client/src/components/theme-toggle.tsx) modeled on admin: `startViewTransition` + circular `clip-path` on `::view-transition-new(root)`, `flushSync` when updating React theme state, skip when `prefers-reduced-motion` or API missing.
- Extend [`use-client-theme.ts`](client/src/hooks/use-client-theme.ts) with `setTheme('dark' | 'light')` (keep storage key `brainpulses-client-theme`).
- Replace raw Moon/Sun buttons in [`login.tsx`](client/src/pages/login.tsx) and [`student-shell.tsx`](client/src/layouts/student-shell.tsx) with the shared component.
- Add matching CSS to [`client/src/styles.css`](client/src/styles.css): `::view-transition-*` rules, `.theme-toggle` icon micro-motion, `data-bp-theme-transition` duration vars (same timings as admin: ~460ms reveal, ~160ms icon).

### Page change enter

- Wrap shell `<Outlet />` (or page children) with a remounting wrapper `key={location.pathname}` so enter runs on navigation (admin’s selector currently only fires on shell mount).
- Add `@keyframes bp-page-enter` (opacity + 4px translateY, ~220ms) and apply to that wrapper in [`styles.css`](client/src/styles.css).
- Apply the same class to the login card/page root when `/login` mounts (or a short enter on `.login-center`).

### Chrome polish + a11y

- Keep existing control transitions; ensure `prefers-reduced-motion` disables view transitions / page enter (client already zeros transitions globally under reduce—add an exception-safe block so view-transition pseudos are forced off, matching admin).

## 2. Search debounce (admin + client)

**Default delay: 300ms** (match existing admin Toolbar).

| Surface | Change |
|--------|--------|
| Admin [`toolbar.tsx`](admin/src/components/toolbar.tsx) | Extract logic into `useDebouncedCallback` / `useDebouncedValue` in `admin/src/hooks/use-debounced-value.ts`; Toolbar keeps immediate input, debounced `onSearchChange`. Update [`toolbar.test.tsx`](admin/src/components/toolbar.test.tsx) if timing helpers needed. |
| Client [`library.tsx`](client/src/pages/library.tsx) | Local `searchInput` for the field; `search` used in `useMemo` comes from `useDebouncedValue(searchInput, 300)` via `client/src/hooks/use-debounced-value.ts`. Clear button clears both immediately. |

**Out of scope for debounce:** country-code combobox (suggestion UI, not a list search bar); cosmetic admin header search with no handler; Reports Toolbar with no `onSearchChange`.

## 3. Verify

- Client: `npm run typecheck` / `npm run verify` in `client/`.
- Admin: `npm run typecheck` / Toolbar unit test in `admin/`.
- Manual: theme toggle circular reveal on login + shell; navigate between dashboard/library and see page enter; type quickly in Students and My quizzes search—filter updates after idle, not per key.
