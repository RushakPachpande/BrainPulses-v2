---
name: Typography standards
overview: Replace Plus Jakarta Sans and Source Sans 3 with Sora and Manrope on admin and the participant app, and apply the desktop and mobile size scale to page chrome on both apps and to the attempt screen.
todos:
  - id: tokens-fonts
    content: Load Sora and Manrope and add shared type-size tokens in admin and client
    status: completed
  - id: shared-chrome
    content: Apply page title, subtitle, supporting text, and primary-button sizes on both apps
    status: completed
  - id: attempt-type
    content: Apply attempt question, option, timer, counter, badge, and progress-percentage styles
    status: completed
  - id: docs
    content: Update design docs and design-system copy that still name the old fonts
    status: completed
  - id: verify
    content: Typecheck, lint, format, graphify update, and browser-check both apps at phone and desktop widths
    status: completed
isProject: false
---

# Typography standards

Sora is used only for page titles, question text, option letters, and the timer value. Manrope is the UI face for everything else, including section titles, card titles, tables, nav, and labels. Current sizes for those other roles stay as they are. Login and welcome heroes keep their larger sizes and switch to Sora.

Breakpoint is the existing `sm` cut: under 640px uses the mobile sizes; 640px and up uses the desktop sizes. Roles with no mobile size stay at the desktop size on small screens (question counter 20px, timer label 16px, question-type line 16px, progress percentage 20px).

## Tokens and font loading

Load variable faces so weight **650** is real, not browser-synthesized:

`family=Manrope:wght@500;600;650;700&family=Sora:wght@700`

Update the links in [admin/index.html](admin/index.html), [client/index.html](client/index.html), and the duplicate `@import` at the top of [client/src/styles.css](client/src/styles.css). Keep `Segoe UI` as the offline fallback.

Add the same custom properties in each app (they do not import each other’s CSS):

- [admin/src/index.css](admin/src/index.css) `@theme` (`--font-sans`, and a new `--font-display`)
- [admin/src/styles/tokens.css](admin/src/styles/tokens.css) (loaded after `index.css`, so it wins for variables)
- [client/src/styles.css](client/src/styles.css) hardcoded `font-family` on the root, plus `:root`
- [client/src/styles/tokens.css](client/src/styles/tokens.css)
- Fallback strings in [admin/src/components/date-time-picker.css](admin/src/components/date-time-picker.css) and [client/src/components/date-time-picker.css](client/src/components/date-time-picker.css)

```css
--font-display: 'Sora', 'Segoe UI', sans-serif; /* page title, question, option letter, timer */
--font-heading: 'Manrope', 'Segoe UI', sans-serif;
--font-sans: 'Manrope', 'Segoe UI', sans-serif; /* admin */
--font-body: 'Manrope', 'Segoe UI', sans-serif; /* participant */
```

`--font-heading` becomes Manrope so existing `h2`, `h3`, and card titles do not all become Sora. Sora is applied only on the four roles above.

Mobile-first size variables, overridden at `min-width: 640px`:

- Page title 24px / 32px, weight 700, Sora
- Subtitle 16px / 20px, weight 500, Manrope
- Supporting text 14px / 16px, weight 500, Manrope
- Primary button 18px / 24px, weight 700, Manrope
- Question 24px / 42px, weight 700, Sora
- Option text 18px / 26px, weight 650, Manrope
- Option label 20px / 26px, weight 700, Sora
- Timer value 24px / 32px, weight 700, Sora

## Shared chrome (both apps)

- Page title and subtitle: [admin/src/layouts/admin-layout.tsx](admin/src/layouts/admin-layout.tsx) `PageHeader` (`h1` is `text-xl font-semibold` today; the description is `text-sm`). Participant [client/src/styles.css](client/src/styles.css) base `h1` (`clamp(24px, 2vw, 30px)`) and `.page-heading p` (15px). Leave `.login-copy h1` and `.welcome-banner h1` size rules in place.
- Supporting text: style the shared hint slots, not every `text-sm`. Admin `[data-slot='field-description']` in [admin/src/components/ui/field.tsx](admin/src/components/ui/field.tsx). Participant secondary lines that are hints (`.page` empty copy, `.question-instruction`). Tables, breadcrumbs, badges, sidebar, and labels keep their current sizes.
- Primary buttons only. Admin: `[data-slot='button'][data-variant='default'][data-size='default']` overrides `text-sm font-medium` from [admin/src/components/ui/button-variants.ts](admin/src/components/ui/button-variants.ts). Outline, ghost, and icon buttons stay as they are. Participant: `.btn.primary` only (today all `.btn` are 14px / 600).
- Control height: keep `--control-h` at 44px for inputs, selects, and non-primary buttons. Set primary line-height to about 1.15. If the 24px label clips inside 44px, raise **primary** min-height to 52px. Do not grow every field.

## Participant attempt

Styles live in [client/src/styles.css](client/src/styles.css); markup in [client/src/components/attempt-question-block.tsx](client/src/components/attempt-question-block.tsx) and [client/src/pages/attempt.tsx](client/src/pages/attempt.tsx).

- Question text: `.question-stem` (today `clamp(1.25rem, 2.4vw, 1.75rem)`).
- Option text: `.answer-option` (14px desktop, 13px under 640px).
- Option label: `.option-letter` is a 30×30 box at 12px. Grow the box so 26px / 20px Sora fits (about 44px desktop, about 36px mobile). The row remains the hit target.
- Question counter: `.question-topline` and `.question-counter` at 20px Manrope 700.
- Timer: `.exam-timer b` and `.exam-timer span` (label 16px / 600). Let `.exam-topbar` grow with the 32px / 24px value instead of clipping it.
- Question type: style the existing `.question-context` line as the badge (16px Manrope 700). Do not add a second badge.
- Progress percentage: the bar has no number today. Show the same ratio the bar already uses (`progressRatio`) as text beside it, Manrope 20px 700. No scoring change.

Admin has no attempt player. Question editors stay at form size; they do not pick up 42px question type.

## Docs that state the old faces

Update the type section so later UI work does not restore Plus Jakarta Sans / Source Sans 3:

- [docs/design/DESIGN.md](docs/design/DESIGN.md) and [.stitch/DESIGN.md](.stitch/DESIGN.md)
- [admin/docs/design-system/README.md](admin/docs/design-system/README.md), [client/docs/design-system/README.md](client/docs/design-system/README.md), both `preview.html` files, and the sentence in [admin/src/pages/design-system.tsx](admin/src/pages/design-system.tsx)
- The font sentence in [docs/product/PRD.md](docs/product/PRD.md) and [docs/DESIGN.md](docs/DESIGN.md)

Regenerate `tokens.json` with each app’s `design:tokens` script if that script exports font variables. Do not hand-edit the JSON.

## Checks

Reuse already-running admin (`http://localhost:5173`) and participant (`http://localhost:5174`) if those ports are listening. Do not start or stop them without asking.

`typecheck`, `lint`, and `format:check` in `admin/` and `client/`. Then `graphify update .`.

In the browser, at about 375px and 1280px: an admin list header (title, description, primary button, a field hint) and a participant attempt (question, option letter and text, timer, counter, progress percent, primary button). Confirm outline buttons, tables, and inputs are still 44px.