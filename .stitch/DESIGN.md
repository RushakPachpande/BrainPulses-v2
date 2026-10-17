---
name: BrainPulses Admin
colors:
  background: '#fafaff'
  foreground: '#0f172a'
  card: '#ffffff'
  popover: '#ffffff'
  primary: '#45058f'
  on-primary: '#ffffff'
  secondary: '#f3effb'
  on-secondary: '#45058f'
  muted: '#f1f5f9'
  muted-foreground: '#485563'
  accent: '#ede9fe'
  on-accent: '#45058f'
  destructive: '#dc2626'
  border: '#e4e7f0'
  input: '#d6ddeb'
  ring: '#7e22ce'
  sidebar: '#f5f3ff'
  sidebar-foreground: '#334155'
  sidebar-accent: '#ede9fe'
  sidebar-accent-foreground: '#45058f'
  success: '#047857'
  warning: '#b45309'
  chart-1: '#7e22ce'
  chart-2: '#3b82f6'
  chart-3: '#10b981'
  chart-4: '#f59e0b'
  chart-5: '#ef4444'
  bar-muted: '#d8b4fe'
  ok-bg: '#d1fae5'
  ok-fg: '#065f46'
  warning-bg: '#fef3c7'
  warning-fg: '#92400e'
  error-bg: '#fee2e2'
  error-fg: '#991b1b'
  neutral-bg: '#e2e8f0'
  neutral-fg: '#334155'
  brand-bg: '#ede9fe'
  brand-fg: '#45058f'
  dark-background: '#081020'
  dark-foreground: '#f8fafc'
  dark-card: '#111827'
  dark-primary: '#7e22ce'
  dark-border: '#334155'
  dark-sidebar: '#0b1425'
  dark-ring: '#c084fc'
typography:
  page-title:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 1.25
    letterSpacing: -0.035em
  section-title:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '650'
    lineHeight: 1.3
    letterSpacing: -0.02em
  body:
    fontFamily: Source Sans 3
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 1.6
    letterSpacing: '0'
  ui:
    fontFamily: Source Sans 3
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 1.45
    letterSpacing: '0'
  label:
    fontFamily: Source Sans 3
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 1.35
    letterSpacing: '0'
  table-head:
    fontFamily: Source Sans 3
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 1.35
    letterSpacing: 0.035em
rounded:
  sm: 8px
  DEFAULT: 10px
  md: 12px
  control: 8px
  input: 9px
  pill: 999px
spacing:
  unit: 4px
  control: 44px
  gutter-mobile: 14px
  gutter-desktop: 28px
  section: 16px
  content-max: 1600px
  sidebar: 256px
  sidebar-rail: 76px
---

# Design System: BrainPulses Admin

Extracted from `admin/` (Vite, React 19, Tailwind v4, shadcn `radix-nova`, Lucide). There is no `tailwind.config`. Tokens, type, and interaction rules live in `admin/src/index.css`. Components live in `admin/src/components/ui` and the shared chrome beside them. Dark is the default theme unless `localStorage` `brainpulses-theme` is `light`.

The stylesheet declares the theme three times. The last `:root` and `.dark` blocks win for every token they repeat. Follow those values. Do not copy an earlier block, and do not add a fourth.

## 1. Visual Theme & Atmosphere

BrainPulses Admin is a calm operations console for a learning platform: a cool porcelain canvas, white cards, and a single royal violet reserved for the action that matters. The mood is precise and institutional, closer to a well-run registrar’s desk than a consumer marketing site. Surfaces stay flat. Color carries meaning — brand, success, warning, error — and then gets out of the way.

Density is high on purpose. A page is a title, a short description, optional module tabs, a filter row, and a table or a small set of cards. Whitespace is a 4px rhythm, not a gallery margin. Type is humanist and highly legible: Plus Jakarta Sans for titles, Source Sans 3 for everything an administrator reads in a row. Motion is short (about 140–220ms) and yields to reduced-motion preferences. The dark theme is a night navy, not pure black, so long sessions stay readable.

## 2. Color Palette & Roles

Use semantic utilities (`bg-primary`, `text-muted-foreground`, `border-border`). Do not put a one-off hex on a page. The pairs below are the winning light tokens. Dark pairs follow in the same section.

### Primary Foundation

| Name | Hex | Role |
|---|---|---|
| Porcelain Mist | `#fafaff` | Page background (`--background`) |
| Paper White | `#ffffff` | Cards, popovers, table surfaces (`--card`, `--popover`) |
| Ink Slate | `#0f172a` | Primary text (`--foreground`, `--card-foreground`) |
| Hairline Silver | `#e4e7f0` | Borders, separators, sidebar rule (`--border`, `--sidebar-border`) |
| Input Silver | `#d6ddeb` | Field border (`--input`) |
| Cool Mist | `#f1f5f9` | Muted fills, table header wash, search field (`--muted`) |
| Sidebar Lavender | `#f5f3ff` | Sidebar surface (`--sidebar`) |

Night theme foundation: Night Navy `#081020` background, Deep Graphite `#111827` cards and popovers, Moon `#f8fafc` text, Slate Line `#334155` borders and inputs, Abyss `#0b1425` sidebar.

### Accent & Interactive

| Name | Hex | Role |
|---|---|---|
| Royal Violet | `#45058f` | Brand and light-theme primary. Buttons, focus selection, active brand marks |
| White | `#ffffff` | Text and icons on Royal Violet |
| Vivid Violet | `#7e22ce` | Light focus ring, chart series 1, dark-theme primary |
| Lilac Wash | `#f3effb` | Secondary button and secondary text in Royal Violet |
| Soft Violet | `#ede9fe` | Accent, sidebar active fill, brand status pill |
| Pressed Violet | `#550d9f` | Light primary button hover |
| Electric Violet | `#9333ea` | Dark primary button hover |
| Glow Violet | `#c084fc` | Dark focus ring |
| Active Rail | `#bd8bff` light / `#a855f7` dark | 3px bar on the active sidebar item |

Brand ramp declared for reference, not for scattering through components: `#f3e8ff`, `#e9d5ff`, `#d8b4fe`, `#c084fc`, `#a855f7`, `#7e22ce`, `#45058f`, `#3b0764`.

Purple identifies the primary action, the active destination, links, and selected rows. It is not a surface color for whole pages.

### Typography & Text Hierarchy

| Name | Hex | Role |
|---|---|---|
| Ink Slate | `#0f172a` | Titles, names, field labels |
| Slate Ink | `#485563` | Descriptions, placeholders, table meta, breadcrumbs (`--muted-foreground`) |
| Sidebar Slate | `#334155` | Sidebar labels |

Dark text: Moon `#f8fafc` for primary copy, Mist Blue `#cbd5e1` for muted and sidebar labels, Lilac `#e9d5ff` for text on dark accent and secondary.

### Functional States

Status is a pill with a word and a dot. Color never stands alone. Tones are `data-tone` on `Badge`, mapped in `status-pill.tsx` and `utils/tone.ts`.

| Tone | Meaning | Light fill / text | Dark fill / text |
|---|---|---|---|
| `ok` | Active, Completed (attempts), Assigned, Enabled, Published, Healthy, Passed, Yes | Mint `#d1fae5` / Forest `#065f46` | `#064e3b` / `#a7f3d0` |
| `wn` | Draft, Pending, In Progress, Not Started, Invited, Per access | Amber wash `#fef3c7` / `#92400e` | `#78350f` / `#fde68a` |
| `er` | Inactive, Failed, Disabled, Absent, No | Rose `#fee2e2` / `#991b1b` | `#7f1d1d` / `#fecaca` |
| `gy` | Neutral, Admin | `#e2e8f0` / `#334155` | `#273449` / `#e2e8f0` |
| `pr` | Brand-flow Completed on activities and question banks | Soft Violet `#ede9fe` / Royal Violet | `#2d1b4e` / `#e9d5ff` |

Semantic singles: success `#047857` (dark `#34d399`), warning `#b45309` (dark `#fbbf24`), destructive `#dc2626` (dark `#f87171`).

Charts: violet `#7e22ce`, blue `#3b82f6`, emerald `#10b981`, amber `#f59e0b`, red `#ef4444`. Bar charts mute earlier bars with `#d8b4fe` (dark `#4c1d95`) and emphasize the latest bar in the series color.

KPI tint tokens exist (`--kpi-0` … `--kpi-4`) and are then flattened: tinted cards paint with `--card`. Do not bring rainbow KPI fills back.

## 3. Typography Rules

### Hierarchy & Weights

| Role | Family | Size | Weight | Tracking |
|---|---|---|---|---|
| Page title (`#main h1`) | Plus Jakarta Sans | `clamp(1.5rem, 2vw, 1.875rem)` — 24–30px | 700 | −0.035em |
| Section title (`h2`, card titles) | Plus Jakarta Sans | Section `clamp(1.125rem, 1.35vw, 1.375rem)`; card title 16px | 650–700 | −0.02em on h2 |
| Body | Source Sans 3 | 16px, line-height 1.6 | 400 | 0 |
| UI copy (`.text-sm`) | Source Sans 3 | 15px (0.9375rem), line-height 1.45 | 400–500 | 0 |
| Labels, breadcrumbs, badges (`.text-xs`) | Source Sans 3 | 13px (0.8125rem) | 600–700 | 0, except table heads |
| Table body | Source Sans 3 | 15px | 400; names 500 | 0 |
| Table head | Source Sans 3 | 13px, uppercase | 700 | 0.035em |
| KPI value | Plus Jakarta Sans | 24px (`text-2xl`) | medium/semibold | tight |

Plus Jakarta Sans is geometric and slightly square — confident at titles, loaded at 500, 600, and 700. Source Sans 3 is the workhorse: open counters, comfortable at 13–16px in tables. Fallback for both is Segoe UI, then sans-serif. Body enables `cv02`, `cv03`, `cv04`, `cv11` and antialiasing. Sentence case everywhere. Table heads are the only uppercase.

The utilities `.text-xs` and `.text-sm` are overridden in `index.css`. A class that looks like Tailwind’s 12px/14px is actually 13px/15px. Use those classes; do not invent a third size scale.

### Spacing Principles

Type sits on the same 4px grid as layout. Titles are tight (negative tracking, 1.25 line-height). Body and descriptions stay relaxed. Field labels sit 7px above controls; field groups gap 18px. Card titles and descriptions gap about 5px. Do not letter-space body or buttons.

## 4. Component Stylings

Controls come from `@/components/ui`. Icons come from `lucide-react` only. App chrome (layout, toolbar, module nav, pills, KPI grid) wraps those primitives. Do not add a second component library, and do not hand-roll buttons, inputs, selects, tables, or badges.

### Buttons

Radius 8px. Weight 600. Label size 14px. Single-line buttons, inputs, and selects are 44px tall (`--control-h`). Icon buttons inside the workspace are 44×44. Link buttons and textareas are the exceptions.

| Variant | Treatment |
|---|---|
| Default | Royal Violet fill, white label. Hover Pressed Violet in light, Electric Violet in dark |
| Outline | Transparent or background fill, hairline border. Dark outline sits on `#182337` with border `#33425b` |
| Secondary | Lilac Wash, Royal Violet text |
| Ghost | Muted text, muted hover, no fill at rest |
| Destructive | Tinted red fill and red text, not a solid red block |
| Link | Primary color, underline on hover. Height hugs the text |

Hover adds the small shadow. Press shifts the button 1px down and scales to 0.99. Disabled is 50% opacity. One primary button per page header or form footer. Outline carries secondary actions (Upload, Clear Filters, Reset). Transitions are 140ms on color.

### Cards & KPI tiles

Radius 12px (10px under 640px). 1px border. Padding from `--card-spacing` (16px, 14px on small screens). Resting shadow is the small elevation token; hover warms the border toward violet. No gradients, no glow, no tinted KPI backgrounds.

KPI tiles are a responsive grid: one column, two from `sm`, four from `xl` (five only when there are more than four). Each tile is a label in muted text, a 24px value, and an optional delta. Display only — filtering happens in the toolbar, not by clicking a tile.

Chart cards use the same shell, a 176px-tall bar chart, a title, and a one-line caption. Earlier bars are the muted violet; the latest bar uses the series color. Radius of each bar is 6px.

### Navigation

The shell is a collapsible sidebar plus a sticky top bar.

- Sidebar width 16rem, collapsed rail 76px. Below 768px it becomes a drawer.
- Header and sidebar header align around 64px.
- Logo is `brand.svg` at 32px with an 8px radius, wordmark in 16px semibold.
- Items are 44px, 15px type, 17px icons, 8px radius. Inactive labels are sidebar slate. Hover is an 8% wash. Active is Soft Violet text in Royal Violet, weight 600, plus a 3px rounded rail on the left.
- Footer holds the signed-in admin (avatar initials, name, role) and a theme toggle. The top bar repeats theme, notifications, and the same identity.
- Global search in the top bar is a muted input group, capped near 470px.
- Skip link: “Skip to content”, visible on focus, primary fill.

Module navigation (Assessments, Quizzes, Settings) is a separate pill row under the page title: card surface, 1px border, small shadow, 4px padding. Links are icon plus label, 44px, muted until active. The active link is Soft Violet with a border and a small shadow. On narrow screens the row scrolls horizontally and does not wrap into a broken stack.

### Inputs & Forms

Inputs, selects, and input groups: 44px, 9px radius, hairline border, no resting shadow. Placeholder is muted at 85% opacity. Focus is one treatment only: border becomes the ring color and a 3px glow at 22% of that color. Do not stack the browser outline on top.

Search debounces 300ms. Every search field has an accessible name. Selects show `Name: value` on the trigger and stay about 160px wide from `sm` up; full width below that.

Labels are persistent 14px medium text. Hints are 12–13px muted. Placeholder is not a label. Settings group related fields in cards with a 40px violet-tinted icon tile, a title, and a description, then a sticky footer: status line on the left, Reset (outline) and Save (primary) on the right. Boolean settings use `Switch` inside `ToggleRow` — label and hint on the left, switch on the right.

### Tables, status, and row actions

Tables sit inside a card. Header row is 42px, uppercase, muted, on a translucent muted wash. Body cells pad 12px at 1.4 line-height. Row hover is a light muted wash. A selected row mixes 12% primary into the card. Wide tables scroll inside the card (`min-width: 720px` below 640px). They do not drag the page sideways.

Name, ID, and title columns are text only. `font-medium` is enough for a person’s name. No avatars, initials, or decorative icons in those cells.

Status uses `StatusPill` (or `AccountStatusPill`, `FlowStatusPill`, `AssignmentStatusPill`, `AttemptStatusPill`). Pill radius is full, weight 600, with a 6px dot. Completed on an attempt is `ok`. Completed on an activity or question bank is `pr`. Do not invent a second green.

Row actions on list pages are a ghost icon button (vertical ellipsis) opening View and Edit. Sortable headers use `SortHeader`: ghost button, label, and an up/down icon, with an accessible name that states the next sort.

Footer copy is “Showing X to Y of Z …”, then rows per page 10 / 20 / 50, then previous, current page, next. Empty state is one centered muted sentence in the table, not a separate illustration.

### Alerts and feedback

One info alert when a page needs a note. Toasts go through Sonner. A success message appears only after a real save. Prototype copy must say that it is local. Focus-visible is a 2px ring in the ring color, offset 2px. Selection is Royal Violet with white text.

## 5. Layout Principles

### Grid & Structure

Content column is `max-w-[1600px]`, centered, full width of the inset. Page stack, top to bottom:

1. Breadcrumb at 13px muted. Parents link; the current crumb does not.
2. Title and description, with page actions on the right from `sm` (`PageHeaderActions`). Actions wrap full width below `sm`.
3. `ModuleNav` when the route is under Assessments, Quizzes, or Settings.
4. Page body.

List body, in order: optional KPI row, toolbar (search, filters, Clear Filters), table card, footer. Create, upload, and download live in the page header, not in the toolbar.

Dashboard body: KPI row, three chart cards (`lg:grid-cols-3`), then two cards (`lg:grid-cols-2`) for recent activity and quick actions.

Settings body: one column, then a wide primary column plus a narrow aside from `xl`. Field grids go to two columns from `md`.

### Whitespace Strategy

| Token | Value |
|---|---|
| Base unit | 4px |
| Page gap | 16px in component classes; the shell stylesheet also sets 20px on the main column |
| Page padding | 14px horizontal, growing to 28px from `md`. Under 900px the shell tightens padding |
| Card padding | 16px |
| Toolbar gap | 12px, row from `sm` |
| Control height | 44px |
| Sidebar | 256px open, 76px rail |

### Alignment & Visual Balance

Text is left aligned. Numbers in tables use tabular figures. Page actions align to the title on wide screens and stack under it on small ones. Toolbar actions follow the filters; below `sm`, search, each filter, and the action group are full width. Do not push actions with a flex spacer that collapses when the row wraps.

### Responsive Behavior & Touch

Mobile-first. Breakpoints in use: 640, 768 (sidebar drawer), 900 (shell density), 1024, 1280. Check about 375, 768, and 1280 before shipping a screen.

Tap targets for buttons, inputs, selects, sidebar items, and module links are 44px. Tables may scroll horizontally inside the card. Module tabs may scroll horizontally. The page itself should not. Theme, route, and form state survive a theme change. Reduced motion cuts transitions, the page-enter shift, and the circular theme reveal.

## 6. Design System Notes for Stitch Generation

### Language to Use

Calm admin console, cool porcelain and night navy, one royal violet for the action that matters, flat cards with a hairline border, compact tables, sentence case, no gradients, no glass panels, no rainbow metric tiles. Dark theme is the default.

### Color References

- Porcelain Mist `#fafaff` — page
- Paper White `#ffffff` — cards
- Ink Slate `#0f172a` — text
- Royal Violet `#45058f` — primary
- Soft Violet `#ede9fe` — selected and accent
- Slate Ink `#485563` — secondary text
- Hairline Silver `#e4e7f0` — borders
- Night Navy `#081020` — dark page
- Deep Graphite `#111827` — dark cards
- Vivid Violet `#7e22ce` — dark primary

### Component Prompts

- “Admin list page: breadcrumb, 24–30px title and one-line description, outline and primary actions on the right, a search field and a few selects with Clear Filters, then a white card containing a compact table with uppercase headers, a status pill, and a kebab. Footer reads Showing 1 to 10 of 42.”
- “Settings page: lavender sidebar, content cards with a small violet icon tile, title, description, 44px fields with labels above, and a sticky bar with Reset and Save.”
- “Dashboard: four flat metric cards in a row, three violet bar charts that emphasize the last bar, then a recent-activity list and a row of quick actions.”

### Incremental Iteration

Change one region at a time: header, module row, toolbar, table, or form. Keep 44px controls, 12px cards, 8px buttons, and the semantic color pairs. If a new color is required, add it to `:root`, `.dark`, and `@theme` in `admin/src/index.css`. Do not paste a hex into a component.

Before generating a screen, collapse the three theme blocks in `index.css` into one. Until then, read the last `:root` and the last `.dark`. Earlier hex values in that file, and the palette tables in `docs/COLOR_PALETTE.md` and `docs/design/DESIGN.md`, describe older passes and will drift from what the browser paints.

## 7. Consistency Contract

Follow this when adding or changing a screen.

**Stack.** shadcn primitives from `@/components/ui`. Lucide icons only. Semantic tokens only. Shared pieces: `Toolbar`, `ModuleNav`, `StatusPill`, `SortHeader`, `KpiGrid`, `PageHeaderActions`, `ToggleRow`.

**Page recipes**

| Page | Order |
|---|---|
| List | Meta title in `routes/meta.ts` → header actions → module nav if the section has one → optional KPI row → toolbar → card table with checkbox, sort, kebab → showing / page size / pager |
| Settings | Module nav → grouped cards → sticky save bar |
| Dashboard | KPI row → charts → lists and quick actions |

**Status map.** Use the tone table in section 2. Account rows use `AccountStatusPill`. Activity and bank flow use `FlowStatusPill`. Registrations use assignment and attempt pills.

**Do not.** Put Create in the toolbar. Put avatars in name columns. Tint KPI cards. Add a gradient, a glow, or a second green for Completed. Set a custom height on a single-line button, input, or select. Install another UI kit.

**Check.** Light and dark. About 375, 768, and 1280. Keyboard focus, labels, and empty results. One primary action. Contrast of white on Royal Violet and of muted text on porcelain and on night navy.
