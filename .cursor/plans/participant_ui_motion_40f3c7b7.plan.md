---
name: Participant UI Motion
overview: "Add a light CSS-only motion pass to the participant portal: shared button press feedback, richer hover on controls, and short enter transitions for cards and dialogs—respecting the existing prefers-reduced-motion kill switch."
todos:
  - id: motion-buttons
    content: Add hover/active transitions to primary, outline, and icon controls
    status: completed
  - id: motion-surfaces
    content: Polish option/nav transitions and dialog/result enter
    status: completed
  - id: motion-verify
    content: Quick visual check + reduced-motion still respected
    status: completed
isProject: false
---

# Participant UI motion pass

## Scope
CSS-only in [`participant/src/styles/portal.css`](participant/src/styles/portal.css) (and a touch of [`login.css`](participant/src/styles/login.css) if the login CTA needs the same press feel). No new animation libraries. Keep motion short (120–220ms) and calm so it matches the existing portal look.

Already present (keep): card lift on hover (`.grid .card`), CTA brightness, option hover ring, timer pulse, sidebar transform, and the global `@media (prefers-reduced-motion: reduce)` block that disables transitions/animations.

## Changes

### 1. Shared control feedback
Add a small utility block near the top of the interactive styles (or after base button rules):

- Primary / filled actions (`.begin`, `.cta`, `.da .p`, `.qf .nx`, `.rbt .p`, login `.btn`): `transition` on background/box-shadow/transform; `:hover` slight brightness or shadow deepen; `:active:not(:disabled)` `transform: scale(0.97)`.
- Outline / secondary (`.da .s`, `.rbt .s`, `.lo`, `.back`): transition on box-shadow/color; hover soft tint; same `:active` scale.
- Icon controls (`.thm`, `.tg`, `.ib`, `.xb`): transition on background/box-shadow; `:active` scale(0.94).

Gate hover transforms with `@media (hover: hover)` where lift/scale would fight touch scroll (same pattern already used for cards).

### 2. Option and nav polish
- `.o` / `.o.on`: keep current shadow hover; add a short transition and a light `:active` scale so taps feel acknowledged.
- `.nv a`: short background transition (hover already exists).

### 3. Dialog and result enter
- `.dlg.open .dc` / `.lbx.open .lbc`: short opacity + `scale(0.96 → 1)` enter (keyframes or transition from a default closed state). Keep backdrop as-is.
- `.rcard`: subtle fade/rise on first paint via a short `@keyframes` applied once (no loop).
- Library cards: keep existing lift; optionally add a slightly softer shadow transition so the lift feels less abrupt.

### 4. Guardrails
- Do not animate layout width of the sidebar or page padding beyond what exists.
- Do not add continuous decorative motion (no floating blobs).
- Leave the existing `prefers-reduced-motion: reduce` rule as the off switch (it already zeros transitions/animations).

## Verify
- Spot-check home cards, attempt option tap, Leave/Submit dialogs, login Sign in, theme toggle.
- Confirm reduced-motion OS setting still kills motion.