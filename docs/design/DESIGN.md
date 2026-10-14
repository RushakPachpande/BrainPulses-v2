# BrainPulses UI/UX Design System

**Normative:** every new or modified admin screen follows this unless an exception is approved. This is the design contract for developers and AI agents.

**Version:** current admin theme, extracted in [`.stitch/DESIGN.md`](../../.stitch/DESIGN.md). Tokens below are the values that win in `admin/src/index.css` (the last `:root` and `.dark` blocks). Do not copy an earlier block in that file. Full swatches: [`COLOR_PALETTE.md`](../COLOR_PALETTE.md).

## 1. Non-negotiable
1. Use **shadcn/ui local components** (`radix-nova`) for standard controls. No parallel design system.
2. Use **`lucide-react` only** for UI icons. No emoji icons, mixed packs, or random SVGs.
3. Use semantic CSS tokens. Do not scatter raw hex colors or one-off control heights.
4. Standard control height **44 px** (`--control-h`).
5. Card radius **12 px** (`--radius`). Button radius **8 px**. Input and select radius **9 px**.
6. Default border **1 px** using the border token.
7. Flat surfaces. No decorative gradients, glassmorphism, floating blobs, or rainbow KPI cards.
8. Handle loading, empty, error, success, disabled, focus, and responsive states.
9. Never report success until a trusted service confirms it.
10. Never present fixture values as production data.

## 2. Brand and theme
Brand name: **BrainPulses**. Light-theme primary is Royal Violet `#45058F` (`rgb(69, 5, 143)`, `hsl(268, 93%, 29%)`). Dark theme is the default unless `localStorage` key `brainpulses-theme` is `light`. In dark theme the primary shifts to Vivid Violet `#7E22CE`. Purple marks the primary action, the active destination, links, and selection. Neutrals carry the page.

| Token | Light | Dark |
|---|---|---|
| Background | `#FAFAFF` | `#081020` |
| Foreground | `#0F172A` | `#F8FAFC` |
| Card / popover | `#FFFFFF` | `#111827` |
| Primary | `#45058F` | `#7E22CE` |
| Primary foreground | `#FFFFFF` | `#FFFFFF` |
| Primary hover | `#550D9F` | `#9333EA` |
| Secondary | `#F3EFFB` | `#1F2937` |
| Secondary foreground | `#45058F` | `#E9D5FF` |
| Muted | `#F1F5F9` | `#1F2937` |
| Muted foreground | `#485563` | `#CBD5E1` |
| Accent / selected | `#EDE9FE` | `#2D1B4E` |
| Accent foreground | `#45058F` | `#E9D5FF` |
| Destructive | `#DC2626` | `#F87171` |
| Border | `#E4E7F0` | `#334155` |
| Input border | `#D6DDEB` | `#334155` |
| Focus ring | `#7E22CE` | `#C084FC` |
| Sidebar | `#F5F3FF` | `#0B1425` |
| Sidebar foreground | `#334155` | `#CBD5E1` |
| Sidebar active background | `#EDE9FE` | `#2D1B4E` |
| Sidebar active foreground | `#45058F` | `#F3E8FF` |
| Sidebar active rail | `#BD8BFF` | `#A855F7` |
| Success | `#047857` | `#34D399` |
| Warning | `#B45309` | `#FBBF24` |

Verify contrast of the actual pair. If white on violet fails, change the semantic pair in `index.css`, not one button.

Status pills (`data-tone` on `Badge`) always include a word and a dot:

| Tone | Use | Light fill / text | Dark fill / text |
|---|---|---|---|
| `ok` | Active, Assigned, Enabled, Published, Healthy, Passed, Yes; Completed on an attempt | `#D1FAE5` / `#065F46` | `#064E3B` / `#A7F3D0` |
| `wn` | Draft, Pending, In Progress, Not Started, Invited | `#FEF3C7` / `#92400E` | `#78350F` / `#FDE68A` |
| `er` | Inactive, Failed, Disabled, Absent, No | `#FEE2E2` / `#991B1B` | `#7F1D1D` / `#FECACA` |
| `gy` | Neutral, Admin | `#E2E8F0` / `#334155` | `#273449` / `#E2E8F0` |
| `pr` | Completed on an activity or question bank | `#EDE9FE` / `#45058F` | `#2D1B4E` / `#E9D5FF` |

Charts: `#7E22CE`, `#3B82F6`, `#10B981`, `#F59E0B`, `#EF4444`. Earlier bars use `#D8B4FE` (dark `#4C1D95`); the latest bar uses the series color. KPI tint tokens exist and are flattened to the card surface. Do not paint metric cards in those tints.

## 3. Typography and spacing
Headings: `Plus Jakarta Sans`, `Segoe UI`, sans-serif. Body and UI: `Source Sans 3`, `Segoe UI`, sans-serif. Sentence case. Table heads are the only uppercase.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | `clamp(1.5rem, 2vw, 1.875rem)` (24–30 px) | 700 | Tracking −0.035em, line-height 1.25 |
| Section title | `clamp(1.125rem, 1.35vw, 1.375rem)` (18–22 px) | 650–700 | Tracking −0.02em |
| Card title | 16 px | 650 | Heading font |
| Body | 16 px | 400 | Line-height 1.6 |
| UI (`.text-sm`) | 15 px | 400–500 | Line-height 1.45. The utility is overridden in `index.css` |
| Label, breadcrumb, badge (`.text-xs`) | 13 px | 600–700 | Line-height 1.35 |
| Table body | 15 px | 400; names 500 | |
| Table head | 13 px | 700 | Uppercase, tracking 0.035em |
| KPI value | 24 px | medium | |

4 px rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px.

| Element | Rule |
|---|---|
| Input, select, text button | **44 px** |
| Icon-only workspace button | 44 × 44 px |
| Sidebar item and module link | 44 px minimum |
| Border | **1 px** |
| Card radius / padding | **12 px** / 16 px (14 px padding under 640 px) |
| Button radius | 8 px |
| Input radius | 9 px |
| Field group gap | 18 px |
| Page content gap | 16–20 px |
| Content max width | 1600 px |
| Sidebar | 256 px open, 76 px rail; drawer below 768 px |
| Top bar and sidebar header | 64 px minimum |
| Page padding | 14 px, 28 px from `md` |
| Focus | 2 px ring, or the 3 px field glow at 22% of the ring color. One treatment, not both stacked |

## 4. Required component mapping
Import primitives from `@/components/ui`. `admin/components.json` uses shadcn with `iconLibrary: "lucide"`.

| Need | Required pattern |
|---|---|
| Button | `Button` |
| Input / search | `Input` or `InputGroup`; page filters use `Toolbar` |
| Select | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` |
| Textarea | `Textarea` |
| Field, label, hint | `Field`, `FieldLabel`, description text |
| Cards and KPIs | `Card` family; metrics use `KpiGrid` (flat cards) |
| Boolean setting | `Switch` inside `ToggleRow` |
| Menu | `DropdownMenu` |
| Confirmation | `Dialog` |
| Mobile side panel | `Sheet` |
| Alert / toast | `Alert` / Sonner |
| List table | shadcn `Table` inside `Card` |
| Compact results table | shared `DataTable` where that page already uses it |
| Status | `StatusPill` and the account, flow, assignment, and attempt wrappers |
| Sort | `SortHeader` |
| Section tabs | `ModuleNav` |
| Loading | `Skeleton` |
| Checkbox | `Checkbox` |

Extend `Toolbar`, `ModuleNav`, `StatusPill`, `SortHeader`, `KpiGrid`, `PageHeaderActions`, and `ToggleRow`. Do not copy their markup into a page.

## 5. Lucide icon rules
Import only from `lucide-react`. The same meaning uses the same icon. Dense controls 16 px; sidebar icons 17 px; section header tiles 20 px inside a 40 px violet-tinted tile. Icon-only controls need an accessible name. Gap between icon and label is 8 px. No emoji icons.

## 6. Control rules
**Buttons.** Variants: default, secondary, outline, ghost, destructive, link. Weight 600. One primary action per page header or form footer. Outline carries upload, clear, and reset. Explicit `type` in forms. Disable a second submit while a request is pending. Confirm a destructive action.

**Search.** 44 px, Lucide search icon, accessible name, descriptive placeholder, 300 ms debounce.

**Select.** 44 px trigger. Toolbar filters read `Name: value` and are full width below `sm`, about 160 px from `sm`.

**Forms.** Persistent labels. Hints in muted text. Placeholder is not a label. Focus, invalid, and disabled states stay visible. Keep the user’s input after a recoverable error.

**Tables.** Uppercase header, 1 px row borders, text-only name and ID columns, status pill, kebab with View and Edit. Selected row mixes 12% primary into the card. The table scrolls inside the card. Footer: “Showing X to Y of Z”, rows per page 10 / 20 / 50, previous, current page, next. Empty state is one muted sentence in the table.

**Status.** Use the tone table in section 2. Attempt Completed is `ok`. Activity and question-bank Completed is `pr`.

## 7. Layout recipes
**Shell.** Skip link, collapsible sidebar, sticky top bar (sidebar toggle, global search, theme, notifications, identity), then the content column.

**List.** Meta title and description in `admin/src/routes/meta.ts` → breadcrumb → title and `PageHeaderActions` → `ModuleNav` when the section has one → optional flat KPI row → `Toolbar` (search, filters, Clear Filters) → card table → footer. Create, upload, and download stay in the page header.

**Settings.** `ModuleNav` → grouped cards (icon tile, title, description, fields) → sticky bar with a status line, Reset, and Save. Two columns only from `xl` when the aside is a real second group.

**Dashboard.** Flat KPI row → chart cards → recent activity and quick actions. Metrics need a defined meaning. Do not present fixture numbers as live production data.

## 8. Responsive and accessibility
Check about 375 px, 768 px, and 1280 px. Also review 360, 390, 1024, 1440, and 1920 px before release. Sidebar collapses to a rail and becomes a drawer below 768 px. Actions and filters wrap. Tables scroll inside the card. Module tabs may scroll horizontally.

Target WCAG 2.2 AA: keyboard focus, landmarks, labels, contrast, status that is not color alone, focus return from drawers and dialogs, reduced motion, and reflow. Theme changes must not reset the route, form values, or filters.

## 9. UI definition of done
- [ ] shadcn and shared chrome reused
- [ ] lucide-react only
- [ ] semantic tokens from the current palette
- [ ] 44 px controls, 1 px borders, 12 px cards, 8 px buttons
- [ ] async, empty, and error states handled
- [ ] light and dark checked
- [ ] about 375, 768, and 1280 px checked
- [ ] keyboard, focus, and labels checked
- [ ] no page-level horizontal overflow
- [ ] no gradient, glass, or rainbow KPI treatment
- [ ] checks run, or the ones not run are named
- [ ] this doc and `COLOR_PALETTE.md` updated if a token changes
