# BrainPulses UI/UX Design System

**Normative:** every new/modified UI must follow this unless an exception is approved. This is the strict design contract for developers and AI agents.

## 1. Non-negotiable
1. Use **shadcn/ui local components** for standard controls. No parallel design system.
2. Use **`lucide-react` only** for UI icons. No emoji icons, mixed packs or random SVGs.
3. Use semantic CSS tokens; no scattered raw hex colors or arbitrary dimensions.
4. Standard control height **44 px** (`--control-h`).
5. Default card radius **12 px** (`--radius`).
6. Default border **1 px** using semantic border token.
7. No decorative gradients, glow, glassmorphism, floating blobs, random colorful KPI cards or excessive pills.
8. Handle loading, empty, error, success, disabled, focus and responsive states.
9. Never report success until a trusted service confirms it.
10. Never present fixture values as production data.

## 2. Brand and theme
Brand name: **BrainPulses**. Primary `#45058F` (`rgb(69, 5, 143)`, `hsl(268, 93%, 29%)`). Dark-first navy theme with light theme support. Purple is for primary actions, active navigation and selected states, not every surface. Full palette: [`COLOR_PALETTE.md`](../../COLOR_PALETTE.md); implementation tokens: `admin/src/index.css`. Keep docs and CSS synchronized.

| Token | Light | Dark |
|---|---|---|
| Background | `#F5F7FB` | `#0D1321` |
| Foreground | `#17233F` | `#EDF2FF` |
| Card | `#FFFFFF` | `#151F31` |
| Popover | `#FFFFFF` | `#172236` |
| Primary | `#45058F` | `#45058F` |
| Primary foreground | `#FFFFFF` | `#FFFFFF` |
| Secondary | `#F3EAFB` | `#1B263A` |
| Muted | `#F0F3F9` | `#1A2538` |
| Muted foreground | `#71809D` | `#A1AEC4` |
| Border/input | `#E4E9F2` | `#2A3850` |
| Focus ring | `#45058F` | `#BD8BFF` |
| Sidebar | `#FFFFFF` | `#141E30` |
| Sidebar foreground | `#71809D` | `#A1AEC4` |
| Sidebar active bg | `#F3EAFB` | `#2A1844` |
| Sidebar active fg | `#45058F` | `#D8C0F5` |

Verify contrast of actual pairs. If white-on-purple fails, adjust the semantic pair globally, not one button at a time.

## 3. Typography and spacing
Headings: `Plus Jakarta Sans`, `Segoe UI`, sans-serif. Body: `Source Sans 3`, `Segoe UI`, sans-serif. Page title 24–28 px; section title 16–18 px; body/table 13–14 px; labels 13–14 px; helper text 12–13 px with contrast checked. Sentence case.

Use 4 px rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px.

| Element | Rule |
|---|---|
| Input/select/button | **44 px** |
| Icon-only workspace button | 44 × 44 px |
| Border | **1 px** |
| Card radius | **12 px** |
| Sub-panel radius | 8–10 px |
| Card padding | 16–24 px |
| Field gap | 16–20 px |
| Section gap | 20–24 px |
| Table row | 48–56 px typically; never clip |
| Focus | visible in both themes |

## 4. Required shadcn component mapping
Use imports from `@/components/ui/...` and existing wrappers.

| Need | Required pattern |
|---|---|
| Button | `Button` |
| Input/search | `Input` / shared `Toolbar` |
| Select | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` |
| Textarea | `Textarea` |
| Field/labels/errors | `Field`, `FieldLabel`, available description/error primitives |
| Cards | `Card` family |
| Boolean setting | `Switch` |
| Menu | `DropdownMenu` family |
| Confirmation | `Dialog` family |
| Mobile side panel | `Sheet` |
| Alert/toast | `Alert` / Sonner |
| Table | shadcn Table / shared `DataTable` |
| Status | `StatusBadge` / `StatusPill` |
| Tooltip | shadcn Tooltip |
| Loading | shadcn/shared Skeleton |
| Checkbox/radio | shadcn Checkbox / RadioGroup |
| Tabs | shadcn Tabs pattern; add via approved workflow if absent |
| Date picker | approved Popover + Calendar pattern |

Project `admin/components.json` config uses shadcn and `iconLibrary: "lucide"`. If a primitive is missing, add it via the supported shadcn workflow or a thin consistent wrapper. Do not paste unreviewed snippets.

Prefer existing `Toolbar`, `DataTable`, `StatusBadge`, `StatusPill`, `KpiGrid`, `RowActions`, `ModuleNav`, layout and theme controls. Extend rather than duplicate.

## 5. Lucide icon rules
Import only from `lucide-react`. Same meaning uses same icon. Dense controls 16 px; navigation 18–20 px; section headers 20 px. Default stroke. Icon-only controls need `aria-label` and tooltip when unclear. Use 8 px icon-label gap. No emoji icons.

## 6. Control rules
**Buttons:** semantic primary/default, secondary, outline, ghost, destructive and link variants. One dominant primary action per page/section. Explicit button type in forms. Disable duplicate submit while pending; confirm consequential destructive actions.

**Search:** 44 px; Lucide search icon; accessible label; descriptive placeholder; consistent debounce and stale-request handling.

**Select/dropdown:** 44 px trigger; shadcn primitives; consistent chevron alignment; keyboard and Escape behavior; long labels cannot collide with arrow.

**Forms:** persistent associated labels; helper/error text; visible focus/invalid/disabled states; preserve input after recoverable errors. Placeholder is not a label.

**Tables:** shared pattern, 1 px horizontal separators, aligned headers, accessible actions, status text plus color. Internal horizontal scrolling or intentional mobile card layout; never overflow whole viewport. Include loading/empty/error/pagination as applicable.

**Status:** shared semantic components and centrally defined meanings. Color alone never communicates status.

## 7. Layout recipes
**List:** breadcrumb if useful → title/description → primary action → optional module tabs → meaningful summary metrics only → search/filters → table/list → count/pagination. Avoid redundant stacked banners/cards/tab bars.

**Settings:** stable category navigation; related fields grouped; two columns only when comfortable; consistent Save/Cancel; dirty-state warning; success only after persistence.

**Dashboard:** only metrics with defined meaning and trusted source. No arbitrary charts or fake percentages. Accessible summary and empty state.

## 8. Responsive/accessibility
Validate 360, 390, 768, 1024, 1440 and 1920 px. Sidebar must collapse/drawer without overlap; actions wrap; filters wrap; tables scroll internally. Target WCAG 2.2 AA: keyboard focus, semantic landmarks, labels, contrast, non-color status, focus management, reduced motion and zoom/reflow. Theme switching must not reset form/route state.

## 9. UI definition of done
- [ ] shadcn/shared components reused
- [ ] lucide-react only
- [ ] semantic tokens; no arbitrary colors
- [ ] 44 px controls, 1 px borders, 12 px cards
- [ ] async states handled
- [ ] responsive + both themes checked
- [ ] keyboard/focus/labels checked
- [ ] no overlap/clipping/accidental overflow
- [ ] no decorative gradient/AI-slop
- [ ] checks run or explicitly reported not run
- [ ] docs updated
