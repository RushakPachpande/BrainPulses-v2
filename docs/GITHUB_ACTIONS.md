# GitHub Actions

## Manual check (non-deploy)

[`.github/workflows/check.yml`](../.github/workflows/check.yml) uses **`workflow_dispatch` only** (no push / PR triggers):

- API: typecheck, lint, test (Postgres + Redis services), build
- Admin / Participant / Client: typecheck, lint, test, build

It does **not** deploy, migrate production, or touch the VPS. Run it from the Actions tab when you want a full gate.

## Manual deploy only

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) uses:

```yaml
on:
  workflow_dispatch:
```

Required secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. The job SSHs to the VPS and runs `update-deploy.sh --pull`, then loopback health checks.

Never enable `push` / `pull_request` triggers on the deploy workflow.
