# Quality gates

**Status:** Current as of 2026-10-24, after the phased excellence pass.

| Gate | Command | Latest result |
|---|---|---|
| API test | `npm run test` in `api/` | PASS. 43 passed, 0 failed, after formatting |
| API typecheck | `npm run typecheck` in `api/` | PASS on the recheck before formatting. Formatting did not change types. Build later was not re-run after Prettier |
| API lint | `npm run lint` in `api/` | PASS on the format pass |
| API format | `npm run format:check` in `api/` | PASS |
| API build | `npm run build` in `api/` | PASS earlier the same day, before the format pass |
| Admin test | `npm run test` in `admin/` | PASS. 11 passed, 6 files, after formatting |
| Admin lint | `npm run lint` in `admin/` | PASS. 0 problems after the route split |
| Admin format | `npm run format:check` in `admin/` | PASS |
| Admin typecheck | `npm run typecheck` in `admin/` | PASS after the route split |
| Admin build | `npm run build` in `admin/` | PASS. Entry chunk `index-*.js` is 507.67 kB. Left as the app shell |
| Client test | `npm run test` in `client/` | PASS. 7 passed, 2 files |
| Client lint | `npm run lint` in `client/` | PASS. 0 problems |
| Client format | `npm run format:check` in `client/` | PASS |
| Client typecheck | `npm run typecheck` in `client/` | PASS |
| Client build | `npm run build` in `client/` | PASS. Entry chunk `index-*.js` is 673.07 kB. One bundle, not split |
| Client dependency install | `npm install -D` testing-library and jsdom | PASS. Audit reported 0 vulnerabilities |

Root `npm run test` and `npm run check` both call `test:client`. Client `vitest` is `^4.1.12`.

CI is `.github/workflows/check.yml`. It was not executed in this session. The API job migrates and seeds an ephemeral Postgres, not a production database.
