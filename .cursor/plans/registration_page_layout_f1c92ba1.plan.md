---
name: Registration page layout
overview: Restyle the public registration page to the two-column mock, and keep contest image, sponsor, close time, seats, and fields driven by each form’s admin “Show on the form” settings.
todos:
  - id: payload-seats
    content: Add seat cap to the public contest-form payload
    status: completed
  - id: register-layout
    content: Rebuild the public registration page to the mock layout and states
    status: completed
  - id: register-css
    content: Add scoped register.css using existing portal background, fonts, and theme
    status: completed
  - id: verify
    content: Typecheck/lint and check the live registration page in the browser
    status: completed
isProject: false
---

# Registration page matching the mock

The public page is [`participant/src/pages/register.tsx`](participant/src/pages/register.tsx) at `/register/:slug`. It already loads `GET /api/public/contest-forms/:slug` and submits to `POST .../register`. The admin wizard chips in [`admin/src/pages/contest-form-wizard.tsx`](admin/src/pages/contest-form-wizard.tsx) stay the source of truth: contest image, sponsor name, registration closes, and seats left. The admin preview dialog is unchanged.

Do not ship the mock’s “Preview” state switch. States come from the API (`open`, `not_yet`, `closed`, `full`, `inactive`) and from a successful submit.

## Layout

Replace the login-card shell on this route with the mock’s structure, scoped in a new [`participant/src/styles/register.css`](participant/src/styles/register.css) so [`participant/src/styles/login.css`](participant/src/styles/login.css) stays the login page.

- Reuse the existing portal background (`.bp-bg` and `--bp-full` / `--bp-top` / `--bp-bot` in [`participant/src/styles/portal.css`](participant/src/styles/portal.css)) and the existing `ThemeButton` (`body.dk2`, `bp-mode`). Keep the BrainPulses header.
- Desktop: intro column (max ~520px) plus a 460px register card, max width 1180px, gap 56px. At 920px, one column (max 560px) and hide the “How it works” list. At 420px, first and last name stack.
- Card: accent top bar, “Register”, required-field note, submit, “Already registered? Log in”, and the lock line. Success and blocked states use the mock’s centered card (check, dashed Registration ID, copy, warning icon).

## What each form shows

Render only what that form’s payload allows:

- **Contest image** when `contestImage` is true, from `GET .../image/contest`. Hide the cover otherwise.
- **Sponsor** when `showSponsorName`: initial plus “Presented by {sponsorName}”. The admin control is the name, so do not add a sponsor photo.
- **Title** is always `contestName`. **Welcome** only when `welcomeMessage` is set.
- **Closes** when `showRegistrationCloses` and `closesAt` are set: relative line (“Registration closes in 2 days” / hours) plus the `en-IN` datetime. Use the warning fact style when the close is within 3 days and still in the future.
- **Seats** when `showSeatsLeft` and a cap exists: “{seatsLeft} of {seats}”. Today the public payload only has `seatsLeft`. Add the cap as `seats` on the `form` object in [`api/src/modules/contest-forms/service.ts`](api/src/modules/contest-forms/service.ts) (`publicForm`). Unlimited seats stay hidden, matching the wizard (the seats chip is off when no limit is set).
- **Fields** from `form.fields`, including types the mock does not draw (`textarea`, `number`, `multi_select`). `first_name` and `last_name` share one row when both are present. Required fields get `*`; optional fields get “(optional)”. Show `help`, `consentText`, and `termsLink` from the field. Phone keeps the +91 prefix and 10-digit entry. Keep the Radix `Select` for dropdowns and style it like the mock control.
- **How it works** is static copy on the intro side (hidden under 920px), not an admin toggle.

## Card states

- **open:** the form. Keep server validation errors (`ApiError.fields`) on the fields, plus the summary alert when more than one field fails.
- **Registered:** after a successful POST, show the mock success card with `code`, copy-to-clipboard, the email from the `email` answer when present, and a link to `/login`.
- **closed / full:** icon, heading, and the API `message` (include the seat cap in the full message only if the current message does not already). “Already registered?” plus Log in.
- **not_yet:** same card, no Log in link (matches the mock’s “soon” state). The API message already says when it opens.
- **inactive or missing link:** short status in the card, no intro facts.

## Checks

Typecheck and lint in `participant/` and `api/` after the payload change. In the browser, open a live `/register/:slug` on the existing participant server (port 5174 if it is already up) and confirm image, sponsor, close, and seats appear or hide with the form’s flags, plus the open form and one blocked state. Do not start or stop a server that is already running.