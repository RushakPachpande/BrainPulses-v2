# Customer test script — live stack

Use disposable browser profiles. Record browser/OS, app, route, steps, expected vs actual.

Prerequisites: follow [`LOCAL_PRODUCTION.md`](LOCAL_PRODUCTION.md) until all three apps and `/health/ready` are green.

## 1. Admin sign-in and lists

1. Open http://localhost:5173/login
2. Sign in as `admin@brainpulses.com` / `Password123!`
3. Confirm dashboard KPIs load (not empty fixture zeros unless the DB is empty)
4. Open **Students** — seeded students appear (`BP-24101` …)
5. Open **Assessments** and **Quizzes** — seeded activities appear
6. Open **Question Banks** — Physics + GK banks appear
7. Open **Registrations** for assessments/quizzes — assigned students appear
8. Sign out and confirm `/dashboard` redirects to login

## 2. Admin mutations (persistence)

1. **Students → Add Student** — create a student with email + password; confirm they appear after save
2. **Users → Add User** — invite an admin; confirm they appear on Users
3. **Assessments → Question Banks → Create** — create a bank with a starter MCQ; confirm list refresh
4. **Assessments → Create Assessment** — create + optionally publish; confirm it appears on the list
5. **Registrations → Add Registration** — assign a student to an activity; confirm the row appears
6. Refresh the browser — created rows remain (DB-backed)

## 3. Student journey (thin E2E)

1. Open http://localhost:5174/login
2. Sign in with Unique ID `BP-24101` (Unique ID tab) — or use Phone tab with `+91` / `9876510000`, read the OTP from the API console (`[otp] …`), then verify
3. Dashboard shows assigned quizzes/assessments
4. Open **My quizzes** → start **Weekly General Knowledge** (or resume if open)
5. Answer at least one question; wait briefly (autosave)
6. Refresh the attempt URL — answers and remaining timer restore
7. Submit the attempt
8. Confirm score on **My results** and open result detail (answer review)
9. In Admin → **Quizzes → Reports**, confirm the submitted result appears

Optional: confirm Phone OTP fails with a wrong 6-digit code; Unique ID `BP-NOPE` shows an error.

## 4. Integrity checks

1. Second submit of the same attempt with the same Idempotency-Key does not create a duplicate result
2. `student2@mail.com` cannot open `student1` result detail URLs (404)
3. Timed attempt at zero auto-submits (or shows submitted result after deadline)

## 5. Build gates

- [ ] `npm run check:api` passes
- [ ] `npm run check:admin` and `npm run test:admin` pass
- [ ] `npm run typecheck:client` and `npm run build:client` pass
- [ ] Direct refresh works on admin and client SPA routes in preview/host config

## Release decision (local UAT)

- [ ] No P0 defects on the seeded E2E path
- [ ] Stakeholders accept remaining production gates (IdP, hosting, monitoring)
- [ ] Do not treat this as a public production launch until those gates are closed
