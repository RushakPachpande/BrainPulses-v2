# BrainPulses · Design System

**Version:** 1.0 · **Scope:** Client web app · **Brand master:** `../../../assets/brainpulses.svg` in the repository, deployed as `public/brand.svg`

BrainPulses is a professional quiz and assessment platform. Its visual design should be quiet, accessible, dependable and optimized for dense admin work and distraction-free student attempts. The uploaded SVG is the only master artwork. Its flat background is `#45058F` (Royal Violet); its nearly white paths are part of the SVG and must not be recreated or recolored arbitrarily.

## Architecture and ownership

| Directory                             | Responsibility                                                                                                                | Branding rules                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `api/`                                | **Authoritative** accounts, access rules, quiz and assessment logic, answers, scoring, registrations, submissions and reports | No UI/CSS tokens; validate and authorize in the API                     |
| `admin/`                              | Operator dashboard, quiz and assessment builders, registration management, assignment rules, reporting and system settings    | shadcn / Radix components, Tailwind v4, semantic CSS tokens, light/dark |
| `client/`                             | Participant login/registration, quiz and assessment attempts, progress and results                                            | Existing CSS component patterns, same semantic CSS tokens, light/dark   |
| Each frontend `src/styles/tokens.css` | App-local CSS tokens and light/dark variables                                                                                 | No imports from the repository root or the other frontend               |

**Canonical token file for this app:** [`src/styles/tokens.css`](../../src/styles/tokens.css). It is imported **after** the existing app stylesheet by `client/src/main.tsx`. This deliberate ordering preserves legacy layout CSS while making the shared variables authoritative. Some historical theme declarations still exist in the app stylesheets and are superseded by this file; do not edit those old declarations to change the design system. New components should not add more token blocks.

To export the current variables as JSON for design tooling, run `npm run design:tokens` from this app. `docs/design-system/tokens.json` is **generated output**; edit the CSS and regenerate, not the JSON. Token syntax is CSS custom properties, so runtime theme selection works without modifying app internals. Some variables intentionally reference other variables and are not literal hex strings.

## Palette

| Token                  | Light value  | Dark value | Guidance                                                            |
| ---------------------- | ------------ | ---------- | ------------------------------------------------------------------- |
| `--brand-logo`         | `#45058F`    | `#45058F`  | Fixed color from supplied SVG; do not theme the logo                |
| `--primary`            | brand violet | `#7E22CE`  | One primary action per surface                                      |
| `--primary-foreground` | `#FFFFFF`    | `#FFFFFF`  | White text on primary; passes WCAG AA standard text for both themes |
| `--background`         | `#FAFAFF`    | `#081020`  | Main app canvas                                                     |
| `--card`               | `#FFFFFF`    | `#111827`  | Cards, panels, tables                                               |
| `--foreground`         | `#0F172A`    | `#F8FAFC`  | Primary text                                                        |
| `--muted-foreground`   | `#485563`    | `#CBD5E1`  | Secondary text                                                      |
| `--border`             | `#E4E7F0`    | `#334155`  | Restrained 1px separators                                           |
| `--accent`             | `#EDE9FE`    | `#2D1B4E`  | Active navigation, selections                                       |
| `--ring`               | `#7E22CE`    | `#C084FC`  | Focus indication                                                    |
| `--success`            | `#047857`    | `#34D399`  | Completed/approved                                                  |
| `--warning`            | `#B45309`    | `#FBBF24`  | Attention/pending                                                   |
| `--destructive`        | `#DC2626`    | `#F87171`  | Destructive actions                                                 |

The brand tonal ramp is `--brand-50` through `--brand-900` (`--brand-600` matches the exact logo violet). The supporting tones are design-system choices _derived around_ the source logo color; they are not all literal colors found inside the SVG. Do not assign status meaning with violet. Statuses require explicit words and icons or dots; never rely on hue alone. Use CSS `var(--primary)` and shadcn `bg-primary` / `text-muted-foreground`, not arbitrary hex values in components. The accessibility check covers primary buttons; each **additional text/surface combination** requires review.

## Typography

- **Headings:** Plus Jakarta Sans, weights 600–800, tight tracking around `-0.02em` to `-0.035em`.
- **Body and UI:** Source Sans 3; 16px/1.6 body, 15px/1.45 controls and tables, 13px/1.35 labels and metadata.
- Page title 24–30px; section 18–22px; card title 16px; KPI value 24px. Sentence case except compact table headers.
- External Google Fonts are already requested by the apps. The CSS stacks include local/system fallbacks if offline.

## Layout and spacing

- **Spacing:** 4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px (`--space-*`).
- **Size:** Minimum interactive target **44px** (`--control-h`); tabs, icon buttons and mobile controls follow this rule.
- **Corners:** Card 12px (`--radius`), controls 8px, inputs 9px; pill fully rounded.
- **Surface:** Flat card + border; elevate overlays only. Avoid decorative gradients or bright status-colored KPI backgrounds.
- **Shell:** Admin sidebar 256px, rail 76px and drawer on small screens; content max 1600px; mobile gutter 14px, desktop gutter 28px.
- **Responsiveness:** Develop for 320px upward; exercise 390px, 768px, 1024px, 1440px. Tables scroll inside their panels; form footers wrap rather than clip.

## Component contracts

| Component        | Admin implementation                       | Client implementation  | Rules                                                                      |
| ---------------- | ------------------------------------------ | ---------------------- | -------------------------------------------------------------------------- |
| Action buttons   | `components/ui/button`                     | existing `.btn`        | Primary, secondary, outline, ghost, destructive; explicit loading/disabled |
| Text field       | shadcn Input and Field                     | labeled form controls  | Persistent label, hint, inline error, visible focus                        |
| Select           | Radix Select                               | existing client Select | Keyboard-operable, avoid browser-only hover reliance                       |
| Status           | `StatusPill`                               | `Status`               | Word + tone; distinguish draft, pending, failed, completed                 |
| Panels           | Card family                                | `.panel`               | Shared surfaces and borders, consistent spacing                            |
| Question options | production quiz builder / attempt controls | `pages/attempt`        | Clearly selected state, not hue-only; recover previous answer              |
| Theme            | `ThemeProvider`                            | `use-client-theme`     | `.dark` on `<html>`; preserve existing app-specific storage keys           |

Do not create a second UI component framework. Prefer the existing primitives within each app. The admin design-system screen at `/settings/design-system` is a **non-destructive showcase**: controls on the page do not modify stored quiz/assessment data.

## Accessibility and usability

1. Meet WCAG AA contrast for text; test the **actual** token pair in light and dark, including semantic badge surfaces.
2. Persistent labels, correct form semantics and visible `:focus-visible` outlines are mandatory.
3. Avoid layout shifts during loading; use skeletons and stable card dimensions where available.
4. Confirm irreversible actions. Re-entry, retries and autosave states must be truthful (do not promise server persistence for local-only data).
5. Do not rely on animated progress, color or icons alone. Honor `prefers-reduced-motion`.
6. In a timed attempt, never silently delete answers when navigating, and never hide the remaining time.
7. For read-only and disabled controls distinguish visual semantics and announce status appropriately.

## Asset rules

- Source: `assets/brainpulses.svg` (unchanged uploaded artwork).
- Deployment copies: `public/brand.svg` and `public/favicon.svg` **must be byte-identical** to the master SVG; these are deployable copies and need no runtime access to repository-root assets.
- Preserve the SVG aspect ratio. In sidebar use a 32×32px rendering; in marketing/identity contexts a larger square is okay. Never stretch, crop its rays, rotate, add gradients, or re-color the white artwork.
- Use `<img src="/brand.svg" alt="">` if visible adjacent product text already names BrainPulses; otherwise use meaningful alternative text.

## Developer workflow

```bash
npm ci                       # from this app directory
npm run design:tokens        # export local CSS variables as JSON
npm run dev                  # run this app alone
npm run typecheck            # TypeScript check (requires dependencies)
npm run build                # build this app alone
```

The project root still offers `npm run install` and `npm run cleaninstall` to install all three apps as a convenience, but this app can be installed and built independently. Do not zip `node_modules`, output builds, secrets, or generated caches.

## Design handoff

Open [`preview.html`](preview.html) directly in a browser for a dependency-free style specimen; it changes no application data. See [`FIGMA_HANDOFF.md`](FIGMA_HANDOFF.md) for screen structure and variables. Importing `tokens.json` into Figma may require a token plugin or a custom importer; it is not itself a native `.fig` or `.figma` file. Keep existing app behavior and authorization rules as the product source of truth.
