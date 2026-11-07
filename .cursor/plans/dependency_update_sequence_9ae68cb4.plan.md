---
name: Dependency update sequence
overview: Update the listed npm dependencies in root, admin, api, and participant, in risk order, adapting only the call sites that the major releases actually break. Revert any bump that cannot pass typecheck, lint, test, and build without changing unlisted packages.
todos:
  - id: root-concurrently
    content: Bump root concurrently to 10.0.6 and run the root check scripts
    status: completed
  - id: admin-patches-minors
    content: Apply admin patch group, then minor group, verifying after each group
    status: completed
  - id: admin-majors
    content: Apply admin majors one at a time, adapting jest-dom, cn, jsdom, TypeScript, and Vitest only as required
    status: completed
  - id: api-patches-minors
    content: Apply api patch group, then minor group, verifying after each group
    status: completed
  - id: api-majors
    content: Apply api majors one at a time, including BullMQ paused-count, Zod record/ZodType, and Prisma 8 RC with revert if client 7 cannot generate
    status: completed
  - id: participant-all
    content: Apply participant patches, minors, then majors, including React Router 8
    status: completed
  - id: summary
    content: Summarize landed versions, code edits, reverts, and remaining attention items
    status: completed
isProject: false
---

# Dependency update sequence

Work in this order: root, then [admin/package.json](admin/package.json), then [api/package.json](api/package.json), then [participant/package.json](participant/package.json). Inside each package: all patches in one install, all minors in one install, then each major (or same-repo set) alone. Do not touch [client/package.json](client/package.json) or any dependency that is not in the request.

Use the exact `npm install` commands from the request, run from that package directory. Do not edit lockfiles by hand and do not change other version ranges. npm’s save prefix may rewrite a range to `^<target>` (admin and participant `typescript` are currently `~6.0.2`); leave that prefix as npm writes it. If a step fails and cannot be fixed inside the listed packages, restore that package with npm to its previous spec and continue.

After every step, in that package directory, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Fix failures before the next step. Root is the exception below. Do not start the API, admin, or participant dev servers.

## Root — `concurrently` 10.0.6

The only use is the CLI in [package.json](package.json) `dev`: `-n api,admin,client -c blue,magenta,green`. v10 drops Node 18, becomes ESM-only, and removes `--name-separator` / `killOthers`. None of those apply: `engines` is already `>=22`, and this script does not use the removed flags. No source change.

Verify with `npx concurrently --version` from the repo root, then the root `typecheck`, `lint`, `test`, and `build` scripts. Those scripts cover api, admin, and client only; they do not start `dev` and do not include participant.

## Admin

Patches together: `@tailwindcss/vite` and `tailwindcss` 4.3.5, Testing Library react 16.3.3 and user-event 14.6.8, `vite` 8.3.6, `vite-plugin-singlefile` 2.3.4.

Minors together: TanStack Query 5.107.1, the three TipTap 3.33.0 packages, `@types/react` and `@types/react-dom` 19.3.0 (already installed; this only tightens the declared range), plugin-react 6.2.1, eslint 10.14.0, globals 17.14.0, isomorphic-dompurify 4.7.0, lucide-react 1.70.0, react and react-dom 19.3.1, react-router 8.5.1, recharts 3.10.1, shadcn 4.23.0, typescript-eslint 8.72.1. If the combined install fails checks, bisect one package at a time. If a lucide icon export disappeared, update that import name only.

Majors, one at a time:

- `@testing-library/jest-dom@7.0.1`. Setup already uses `@testing-library/jest-dom/vitest` in [admin/src/test/setup.ts](admin/src/test/setup.ts). v7 requires `@testing-library/dom` and Node 22. The lockfile already has `@testing-library/dom` via Testing Library. Add it as a direct devDependency only if npm refuses the install for a missing peer.
- `@types/node@26.6.6`. If the current TypeScript 6 cannot parse these types, revert this bump, finish the later TypeScript step, then retry once.
- `cn@0.5.2`. 0.5 drops Node 20 and changes the `cn build` CLI. App code only calls `cn()` from `cn` (re-exported in [admin/src/lib/utils.ts](admin/src/lib/utils.ts)). No call-site change unless types move.
- `jsdom@31.0.0`. Admin tests use `environment: 'jsdom'` in [admin/vitest.config.ts](admin/vitest.config.ts). jsdom 27+ changes `element.click()` to a `PointerEvent` and later releases have broken Vitest `FormData` shims. If `npm run test` fails for that reason, revert jsdom.
- `typescript@7.0.2`. typescript-eslint 8.72.1’s peer is `typescript >=4.8.4 <6.1.0`, and TypeScript 7 does not expose the compiler API ESLint needs (`typescript-eslint does not support TS 7.0`). Do not add `@typescript/native` or alias `typescript` to `@typescript/typescript6`; those packages are not in the list and would undo the requested `typescript@7.0.2` install. Attempt the install. If npm ERESOLVE or `npm run lint` fails for this reason, revert to `~6.0.2`.
- `vitest@5.1.0` only if TypeScript is still on a version Vitest accepts. v5 needs Vite 6.4+ and Node 22.12+ (already true) and clears mocks before each test. Keep `vi.mock` / `vi.hoisted` at module scope if any test moves them. jest-dom 7’s matcher types may not merge with Vitest 5’s `Assertion`; if `toBeInTheDocument` disappears from `tsc`, add a local matcher augmentation in the existing test setup rather than a new dependency. If tests cannot be made green, revert Vitest.

## API

Patches together: `@prisma/adapter-pg` 7.10.1, the cookie-parser and express type packages at their already-installed 1.4.10 and 5.0.6, bcryptjs 3.0.3, cors 2.8.6, jsonwebtoken 9.0.3, temporal-polyfill 1.0.8. Leave `@prisma/client` at `^7.10.1`.

Minors together: csv-stringify 6.9.0 (already installed), eslint 10.14.0, express 5.3.0, express-rate-limit 8.7.3, globals 17.14.0, helmet 8.3.0, multer 2.5.0, tsx 4.23.15, twilio 6.3.0, typescript-eslint 8.72.1. Bisect on failure. express-rate-limit must land before `rate-limit-redis` 6, which requires 8.6+.

Majors, one at a time, after reading the release notes already reviewed:

- `@types/node@26.6.6` on today’s TypeScript 5.9. Same retry rule as admin: revert if 5.9 cannot consume the types, then retry after the TypeScript step.
- `bullmq@6.7.2`. [api/src/lib/queue/connection.ts](api/src/lib/queue/connection.ts) can keep passing `{ url, maxRetriesPerRequest: null }` through `connection`; BullMQ 6 still accepts that for the default Redis backend, and ioredis stays a direct dependency. Remove `'paused'` from `getJobCounts` in [api/src/lib/queue/queues.ts](api/src/lib/queue/queues.ts) (the paused job state is gone; paused queues report as waiting). Adjust `Queue` / `Worker` generics in [queues.ts](api/src/lib/queue/queues.ts) and [worker.ts](api/src/worker.ts) only if the new backend type parameters fail typecheck. There are no repeatable jobs, debounce, or `Job.discard()` call sites.
- `dotenv@18.0.9`. [api/src/config/load-env.ts](api/src/config/load-env.ts) uses `config({ path })` only. v18 removes `.env.vault` and `node -r dotenv/config`, which this app does not use. Do not open real env files.
- `ioredis@6.0.0`. v6 defaults to RESP3 and needs Node 20+. [docker-compose.yml](docker-compose.yml) uses `redis:8`, which speaks RESP3. Keep the constructor in [api/src/lib/redis.ts](api/src/lib/redis.ts). Set `protocol: 2` only if a Redis call fails under RESP3.
- `rate-limit-redis@6.0.2`. [api/src/app.ts](api/src/app.ts) already uses `sendCommand` and does not pass `resetOnExpiryChange`. No call-site change unless the store’s `sendCommand` types narrow.
- `typescript@7.0.2`. Same constraint as admin: the API is on TypeScript 5.9 with typescript-eslint 8.72.1. Attempt the install, then revert to `^5.9.2` if install or lint cannot succeed. `tsx` 4.23 can run TypeScript 7, so test/build are not the expected blocker; ESLint is.
- `uuid@14.0.3`. Application code uses `node:crypto` `randomUUID`, not the `uuid` package. Leave the exceljs override that pins nested `uuid` to `^11.1.1` unchanged. Revert the direct dependency if exceljs or the install breaks.
- `zod@4.6.7`. Deprecated Zod 3 spellings (`.strict()`, `.email()`, `err.issues`) still work. Two breaks are real and must be edited before the checks:
  - Replace removed `ZodTypeAny` with `ZodType` in [api/src/middleware/validate.ts](api/src/middleware/validate.ts) and the `refinePhoneParts` generic in [api/src/modules/auth/schema.ts](api/src/modules/auth/schema.ts).
  - Single-argument `z.record` is removed. Change `z.record(z.unknown())` to `z.record(z.string(), z.unknown())` in [api/src/modules/banks/schema.ts](api/src/modules/banks/schema.ts) and [api/src/modules/settings/schema.ts](api/src/modules/settings/schema.ts). The two-argument records in contest forms and activities can stay.
  - If stricter UUID checks reject existing fixtures, switch only those validators to `z.guid()`. Do not rewrite every `.email()` or `.strict()` unless typecheck requires it.
- `prisma@8.0.0-rc.33`, included as requested. This CLI will run on `postinstall` / `npm run build` via `prisma generate`, while `@prisma/client` and `@prisma/adapter-pg` stay on 7.10.x. If generate or typecheck fails because the RC client does not match client 7, revert the CLI to `^7.10.0` and regenerate with Prisma 7. Do not bump `@prisma/client`; it is not in the list.

## Participant

Patches together: Tailwind Vite plugin and `tailwindcss` 4.3.5, Testing Library react 16.3.3, `vite` 8.3.6.

Minors together: TanStack Query 5.107.1, the React type packages at 19.3.0, plugin-react 6.2.1, eslint 10.14.0, globals 17.14.0, isomorphic-dompurify 4.7.0, lucide-react 1.70.0, react and react-dom 19.3.1, typescript-eslint 8.72.1. Do the React bump before the router major. Bisect on failure. Same lucide import rule as admin.

Majors, one at a time:

- jest-dom 7.0.1, same peer rule as admin. Setup is [participant/src/test/setup.ts](participant/src/test/setup.ts).
- `@types/node` 26.6.6, same retry rule.
- `jsdom` 31.0.0. [participant/vitest.config.ts](participant/vitest.config.ts) uses `environment: 'node'`, so DOM behavior changes matter only if a test still loads jsdom. Revert if tests fail.
- `react-router@8.5.1` from 7.18.4. Imports are already from `react-router`, not `react-router-dom`. No `useMatches().data`, loaders, or future flags. v8 requires Node 22.22+ and React 19.2.7+ (satisfied by the React minor). Read the v7-to-v8 upgrade notes, then fix only type or runtime breaks in [participant/src/App.tsx](participant/src/App.tsx) and the pages that use `useBlocker`, `createBrowserRouter`, and `MemoryRouter`.
- `typescript@7.0.2` with the same revert-to-`~6.0.2` rule as admin. Do not add the side-by-side TypeScript 6 alias.
- `vitest@5.1.0`, same mock-clearing and jest-dom matcher rules as admin.

## Finish

Report, per package, what landed, what source changed, and what was reverted and why. Call out anything still on you: TypeScript 7 if ESLint blocked it, Prisma 8 RC if it cannot pair with client 7, jsdom if Vitest’s DOM shims break, and the known moderate/high audit notes already attached to eslint, typescript-eslint, shadcn, and zod (updating them does not by itself clear those advisories). After source edits, run `graphify update .` from the repo root.