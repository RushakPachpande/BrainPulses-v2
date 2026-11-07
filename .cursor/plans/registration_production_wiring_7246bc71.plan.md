---
name: Registration production wiring
overview: Point contest registration links at the participant portal (local port 5175, a configured origin in production), replace the side preview and native date inputs, and make a saved registration create the same assignment rows the quiz and assessment Registrations pages and the portal already use.
todos:
  - id: participant-origin
    content: Build registration URLs from VITE_PARTICIPANT_ORIGIN, with a local port 5175 fallback, and serve /register/:slug from the participant app.
    status: completed
  - id: picker-preview
    content: Use DateTimePicker for open and close, and replace the side preview with a Preview dialog that switches desktop and mobile.
    status: completed
  - id: assignment-wire
    content: On final save and on public register, assign the contest's quizzes and assessments so both Registrations pages and the portal see the same rows.
    status: completed
isProject: false
---

# Registration production wiring

## Link origin

[`admin/src/lib/contest-form.ts`](admin/src/lib/contest-form.ts) builds the public URL by swapping port 5173 for 5174. The live participant app is [`participant/`](participant/) on **5175** ([`participant/vite.config.ts`](participant/vite.config.ts)). The public form currently exists only on [`client/src/pages/register.tsx`](client/src/pages/register.tsx), which is the other app.

Change `registrationUrl` so:

- `VITE_PARTICIPANT_ORIGIN` wins when it is set. Production sets this to the real participant host, for example `https://participant.example.com`, with no port guess.
- When it is unset and the admin host is localhost, `127.0.0.1`, or a private LAN address, use that same hostname with port **5175**. This covers local testing, including a LAN IP, without a hardcoded 5174.
- A production build without the variable does not invent a port. Document the variable in [`admin/.env.example`](admin/.env.example) only.

Move the public page to the participant app as `/register/:slug`, outside the login gate in [`participant/src/App.tsx`](participant/src/App.tsx). Remove the `/register/:slug` route from [`client/src/App.tsx`](client/src/App.tsx) so the copied link cannot open the wrong app. Copy, Open as participant, and the Participants list all keep using `registrationUrl`.

## Date and time

Replace both `datetime-local` inputs in [`admin/src/pages/contest-form-wizard.tsx`](admin/src/pages/contest-form-wizard.tsx) with [`DateTimePicker`](admin/src/components/date-time-picker.tsx), the same control the quiz wizard uses. Persist with `date.toISOString()` on Apply. Drop the IST-only string conversion for these two fields so registration open and close are the same kind of instant as quiz start and end. Labels stay “Registration opens” and “Registration closes”.

## Preview

Remove the sticky side column, the resize handle, and the Desktop / Mobile / Light / Dark controls from the builder. One **Preview** button opens the existing dialog. Inside it, switch the frame between desktop and mobile widths. The dialog uses the admin theme already on the page, so dark mode is the app’s dark mode and there is no second theme toggle.

## Registration must reach login and attempts

The participant portal lists an activity only from an assignment `Registration` with status `assigned` whose activity is `active` or `completed` ([`api/src/modules/participant-portal/service.ts`](api/src/modules/participant-portal/service.ts)). Quizzes and Assessments → Registrations list those same rows, filtered by activity kind ([`api/src/modules/registrations/service.ts`](api/src/modules/registrations/service.ts)). Those pages stay as they are. They are not a second registration form.

Close the gap in [`api/src/modules/contest-forms/service.ts`](api/src/modules/contest-forms/service.ts): saving a form updates which activities are on the form, but only **Give a quiz** and a new public registration create assignment rows. On final save, also assign every newly added activity to people who already registered through that form.

The activity list on step 2 and in Give a quiz includes the contest’s quizzes and assessments. A quiz assignment shows on Quizzes → Registrations and, once the quiz is active, in the participant portal. An assessment assignment shows on Assessments → Registrations the same way. Draft or scheduled activities stay off the portal until they are active, which is the portal’s existing rule.

Public register stays on the participant origin, issues `BP` plus 8 digits, applies the match rules, and then the person signs in on that same app with the Registration ID. Existing `BP-24NNN` codes still sign in.
