---
name: Skip org picker demo
overview: "Temporarily auto-select the NextGenInnov8 org (`slug: nextgeninnov8`) after admin sign-in so demos never show the organization chooser."
todos:
  - id: temp-auto-org
    content: In auth signIn, prefer nextgeninnov8 membership and skip select_organization when present
    status: completed
isProject: false
---

# Temporarily skip org chooser (demo)

## Goal

After admin credentials succeed, always enter **NextGenInnov8** (`organizations.slug = nextgeninnov8`) when the user has that membership. Hide the choose-org screen until further notice.

Seeded admins (`admin@brainpulses.com`, `superadmin@…`) belong to both NextGenInnov8 and GreyCaps, which currently triggers `select_organization`.

## Approach

Change only [`api/src/modules/auth/service.ts`](api/src/modules/auth/service.ts) in `signIn`:

After loading memberships, if more than one:

1. Prefer membership where `organization.slug === 'nextgeninnov8'`.
2. If found → `issueSession` and return `authenticated` (same as single-org path).
3. If not found → keep existing `select_organization` payload (safety for non-demo users).

Mark with a clear `// TEMP DEMO:` comment so it is easy to revert.

Do **not** delete login choose-org UI or the select-organization endpoint — they stay unused for seeded multi-org admins.

## Out of scope

- No seed changes, no admin login.tsx changes, no settings changes.
- GreyCaps remains in DB; just not auto-selected for demos.

## Verify

- Sign in as `admin@brainpulses.com` → land on dashboard in NextGenInnov8, no org picker.
- Restart API if already running so the change loads.
