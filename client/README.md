# BrainPulses student client

Vite + React student portal wired to the BrainPulses API.

## Scripts

```powershell
npm ci
npm run dev        # http://localhost:5174 (proxies /api → :3002)
npm run typecheck
npm run build
npm run preview
```

## Auth

`LoginPage` supports:

- **Unique ID** — `POST /api/auth/student/sign-in-by-code`
- **Phone OTP** — `POST /api/auth/student/request-otp`, `resend-otp`, and `verify-otp`

A successful sign-in stores a Bearer access token in `sessionStorage`. Protected routes require a signed-in student. A second concurrent login prompts to revoke the other session (`replaceSession`).

See [`docs/handoff/LOCAL_PRODUCTION.md`](../docs/handoff/LOCAL_PRODUCTION.md) for the full local stack.
