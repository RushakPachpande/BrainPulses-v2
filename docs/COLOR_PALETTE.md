# BrainPulses — Brand and UI Color Palette

**Purpose:** Color reference for the BrainPulses admin app. These are the tokens that win in `admin/src/index.css` (the last `:root` and `.dark` blocks). Earlier blocks in that file are obsolete.

**Brand primary (light):** `#45058F` · RGB `69, 5, 143` · HSL `268°, 93%, 29%`

**Brand primary (dark):** `#7E22CE`

Use semantic utilities (`bg-primary`, `text-muted-foreground`, `border-border`). Do not paste these hex values into components. The UI contract is [`design/DESIGN.md`](design/DESIGN.md). The Stitch extraction of the same version is [`.stitch/DESIGN.md`](../.stitch/DESIGN.md).

## 1. Principles

- Royal Violet identifies the primary action, active navigation, links, and selection.
- Neutrals carry backgrounds, cards, borders, and text.
- Status colors communicate state, with a word and a dot. Color is never the only signal.
- Dark is the default theme unless `brainpulses-theme` in `localStorage` is `light`.
- Keep surfaces flat. Do not paint KPI cards with the KPI tint tokens.
- Check contrast on the real pair before release. This palette is not an automatic WCAG guarantee.

## 2. Brand ramp

Declared as `--brand-50` … `--brand-700` in the light theme. Components should keep using `primary`, `accent`, and `ring`.

| Token | Hex | Role |
|---|---|---|
| `brand-50` | `#F3E8FF` | Lightest brand wash |
| `brand-100` | `#E9D5FF` | Soft brand wash |
| `brand-200` | `#D8B4FE` | Muted chart bars (`--bar-muted` in light) |
| `brand-300` | `#C084FC` | Dark focus ring |
| `brand-400` | `#A855F7` | Dark sidebar active rail and dark sidebar primary |
| `brand-500` | `#7E22CE` | Light focus ring, light chart 1, **dark primary** |
| `brand-600` | `#45058F` | **Light primary** and canonical brand color |
| `brand-700` | `#3B0764` | Deepest brand tone in the ramp |

Light primary hover is `#550D9F`. Dark primary hover is `#9333EA`. Text on both primaries is `#FFFFFF`. Text selection is `#45058F` with white text.

## 3. Surfaces and text

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `#FAFAFF` | `#081020` | Page canvas |
| `--foreground` | `#0F172A` | `#F8FAFC` | Primary text |
| `--card` | `#FFFFFF` | `#111827` | Cards |
| `--card-foreground` | `#0F172A` | `#F8FAFC` | Card text |
| `--popover` | `#FFFFFF` | `#111827` | Menus and popovers |
| `--popover-foreground` | `#0F172A` | `#F8FAFC` | Popover text |
| `--muted` | `#F1F5F9` | `#1F2937` | Search fields, table header wash, quiet fills |
| `--muted-foreground` | `#485563` | `#CBD5E1` | Descriptions, placeholders, meta |
| `--border` | `#E4E7F0` | `#334155` | Hairline borders |
| `--input` | `#D6DDEB` | `#334155` | Field borders |
| `--sidebar` | `#F5F3FF` | `#0B1425` | Sidebar surface |
| `--sidebar-foreground` | `#334155` | `#CBD5E1` | Sidebar labels |
| `--sidebar-border` | `#E4E7F0` | `#1F2937` | Sidebar rule |
| `--sidebar-accent` | `#EDE9FE` | `#2D1B4E` | Active nav and accent fill |
| `--sidebar-accent-foreground` | `#45058F` | `#F3E8FF` | Active nav text |
| `--sidebar-primary` | `#45058F` | `#A855F7` | Sidebar brand mark |
| `--sidebar-ring` | `#7E22CE` | `#C084FC` | Sidebar focus |

Dark field fill used by inputs and selects is `#111D30`. Dark outline buttons use `#182337` with border `#33425B` and hover `#202D43`.

## 4. Interactive

| Token | Light | Dark | Role |
|---|---|---|---|
| `--primary` | `#45058F` | `#7E22CE` | Primary buttons and brand actions |
| `--primary-foreground` | `#FFFFFF` | `#FFFFFF` | Label on primary |
| `--secondary` | `#F3EFFB` | `#1F2937` | Secondary fill |
| `--secondary-foreground` | `#45058F` | `#E9D5FF` | Secondary label |
| `--accent` | `#EDE9FE` | `#2D1B4E` | Selected module tab, accent |
| `--accent-foreground` | `#45058F` | `#E9D5FF` | Accent label |
| `--ring` | `#7E22CE` | `#C084FC` | Focus |
| `--destructive` | `#DC2626` | `#F87171` | Destructive text and emphasis |

Focus on fields: border becomes `--ring`, plus a 3 px glow at 22% of that color. The browser outline is suppressed on those controls so the two rings do not stack.

Active sidebar item: accent fill, weight 600, and a 3 px rail (`#BD8BFF` light, `#A855F7` dark).

## 5. Status

| Tone | Light background | Light text | Dark background | Dark text |
|---|---|---|---|---|
| `ok` | `#D1FAE5` | `#065F46` | `#064E3B` | `#A7F3D0` |
| `wn` | `#FEF3C7` | `#92400E` | `#78350F` | `#FDE68A` |
| `er` | `#FEE2E2` | `#991B1B` | `#7F1D1D` | `#FECACA` |
| `gy` | `#E2E8F0` | `#334155` | `#273449` | `#E2E8F0` |
| `pr` | `#EDE9FE` | `#45058F` | `#2D1B4E` | `#E9D5FF` |

Single semantic colors: success `#047857` (dark `#34D399`), warning `#B45309` (dark `#FBBF24`). The `ok` dot uses success; the `wn` dot uses warning; the `er` dot uses destructive; the `pr` dot uses primary.

## 6. Charts

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `#7E22CE` | `#A855F7` |
| `--chart-2` | `#3B82F6` | `#3B82F6` |
| `--chart-3` | `#10B981` | `#10B981` |
| `--chart-4` | `#F59E0B` | `#F59E0B` |
| `--chart-5` | `#EF4444` | `#EF4444` |
| `--bar-muted` | `#D8B4FE` | `#4C1D95` |

Do not encode a series by color alone. Chart cards include a title and a caption.

KPI washes (`--kpi-0` … `--kpi-4`) are declared and then overridden so tinted cards use `--card`. Leave them unused.

## 7. Elevation

| Token | Light | Dark |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgb(15 23 42 / .05), 0 1px 1px rgb(15 23 42 / .03)` | `0 1px 2px rgb(0 0 0 / .24)` |
| `--shadow-md` | `0 8px 24px rgb(15 23 42 / .08)` | `0 8px 24px rgb(0 0 0 / .24)` |
| `--shadow-lg` | `0 18px 48px rgb(15 23 42 / .12)` | `0 18px 48px rgb(0 0 0 / .32)` |

Cards rest on `--shadow-sm`. Primary buttons pick up that shadow on hover. The settings save bar uses `--shadow-lg`.

## 8. Keeping this file true

When a color changes, edit the last `:root` and `.dark` blocks in `admin/src/index.css`, then update this file and [`design/DESIGN.md`](design/DESIGN.md) in the same change. Do not add a new theme block under the existing ones.
