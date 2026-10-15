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

`POST /api/auth/student/sign-in` then Bearer access token (sessionStorage). Protected routes require a signed-in student.

See [`docs/handoff/LOCAL_PRODUCTION.md`](../docs/handoff/LOCAL_PRODUCTION.md) for the full local stack.
