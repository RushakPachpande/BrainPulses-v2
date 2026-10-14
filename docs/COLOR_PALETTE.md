# BrainPulses --- Brand & UI Color Palette

> **Purpose:** Canonical color reference for the BrainPulses web
> application and its AI coding agents.
>
> **Brand primary:** `#45058F` · RGB `69, 5, 143` · HSL `268°, 93%, 29%`
>
> Use semantic tokens in components. Avoid scattering raw hex values
> throughout the codebase.

------------------------------------------------------------------------

## 1. Color principles

-   Purple is the primary brand color and should identify primary
    actions, active navigation, links, and selected states.
-   Neutral colors carry most of the interface: backgrounds, surfaces,
    borders, and text.
-   Semantic colors communicate status, not decoration.
-   Maintain readable contrast in both light and dark themes.
-   Never communicate success, warning, error, or selection by color
    alone; include text, an icon, or another visual cue.
-   Avoid large decorative gradients. Prefer flat surfaces and use brand
    tints sparingly.
-   Validate contrast for the actual foreground/background pair before
    release. The palette is a starting system, not an automatic WCAG
    compliance guarantee.

## 2. Brand palette

  -----------------------------------------------------------------------
  Token             Hex               RGB               Intended use
  ----------------- ----------------- ----------------- -----------------
  `brand-50`        `#F7F0FF`         `247, 240, 255`   Very subtle
                                                        branded
                                                        backgrounds

  `brand-100`       `#EBD9FF`         `235, 217, 255`   Selected
                                                        backgrounds,
                                                        chips

  `brand-200`       `#D6B5FF`         `214, 181, 255`   Decorative
                                                        borders,
                                                        illustrations

  `brand-300`       `#BD8BFF`         `189, 139, 255`   Charts and
                                                        accents

  `brand-400`       `#A35FFF`         `163, 95, 255`    Dark-theme brand
                                                        accent

  `brand-500`       `#8740E0`         `135, 64, 224`    Strong secondary
                                                        brand tone

  `brand-600`       `#6B20BD`         `107, 32, 189`    Hover / pressed
                                                        states on light
                                                        surfaces

  `brand-700`       `#550D9F`         `85, 13, 159`     Strong brand
                                                        surfaces

  `brand-800`       `#45058F`         `69, 5, 143`      **Canonical brand
                                                        color**

  `brand-900`       `#320568`         `50, 5, 104`      Deep brand tone

  `brand-950`       `#210443`         `33, 4, 67`       Deepest accents
  -----------------------------------------------------------------------

**Primary brand token:** `--color-primary: #45058F`

Use white text on the canonical brand color for primary buttons, after
confirming contrast for the final font size and weight.

## 3. Neutral palette

  -----------------------------------------------------------------------
  Token                   Hex                     Intended use
  ----------------------- ----------------------- -----------------------
  `neutral-0`             `#FFFFFF`               White, light theme
                                                  surfaces

  `neutral-25`            `#FCFBFE`               Elevated page canvas

  `neutral-50`            `#F7F6FA`               Light page background

  `neutral-100`           `#F0EEF5`               Subtle panel / hover
                                                  backgrounds

  `neutral-200`           `#E3DFEB`               Default borders and
                                                  separators

  `neutral-300`           `#D0C9DD`               Stronger borders,
                                                  disabled outlines

  `neutral-400`           `#A9A1B8`               Placeholder /
                                                  decorative neutral

  `neutral-500`           `#81788F`               Muted icons and
                                                  secondary text (check
                                                  contrast)

  `neutral-600`           `#655C73`               Secondary text on light
                                                  surfaces

  `neutral-700`           `#4D455B`               Strong secondary text

  `neutral-800`           `#30283D`               Headings and
                                                  high-emphasis text

  `neutral-900`           `#20182C`               Primary text

  `neutral-950`           `#130D1C`               Highest-emphasis text
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. Semantic colors

Use these semantic roles consistently across banners, inline feedback,
badges, form validation, toasts, and data visualizations.

### Success

  Token           Hex         Intended use
  --------------- ----------- -----------------------------------------
  `success-50`    `#ECFDF5`   Success background
  `success-100`   `#D1FAE5`   Soft success surface
  `success-300`   `#6EE7B7`   Accent border / icon
  `success-500`   `#10B981`   Success icon and highlights
  `success-600`   `#047857`   Readable success text on light surfaces
  `success-700`   `#065F46`   High-emphasis success text
  `success-900`   `#064E3B`   Deep success tone

### Warning

  Token           Hex         Intended use
  --------------- ----------- -----------------------------------------
  `warning-50`    `#FFFBEB`   Warning background
  `warning-100`   `#FEF3C7`   Soft warning surface
  `warning-300`   `#FCD34D`   Accent border / icon
  `warning-500`   `#F59E0B`   Warning icon / emphasis
  `warning-600`   `#B45309`   Readable warning text on light surfaces
  `warning-700`   `#92400E`   High-emphasis warning text
  `warning-900`   `#78350F`   Deep warning tone

### Danger / Error

  Token          Hex         Intended use
  -------------- ----------- ---------------------------------
  `danger-50`    `#FEF2F2`   Error background
  `danger-100`   `#FEE2E2`   Soft error surface
  `danger-300`   `#FCA5A5`   Accent border / icon
  `danger-500`   `#EF4444`   Error icon / emphasis
  `danger-600`   `#DC2626`   Error actions and readable text
  `danger-700`   `#B91C1C`   High-emphasis error text
  `danger-900`   `#7F1D1D`   Deep error tone

### Info

  Token        Hex         Intended use
  ------------ ----------- --------------------------------------
  `info-50`    `#EFF6FF`   Informational background
  `info-100`   `#DBEAFE`   Soft information surface
  `info-300`   `#93C5FD`   Accent border / icon
  `info-500`   `#3B82F6`   Information icon / emphasis
  `info-600`   `#2563EB`   Readable info text on light surfaces
  `info-700`   `#1D4ED8`   High-emphasis info text
  `info-900`   `#1E3A8A`   Deep info tone

------------------------------------------------------------------------

## 5. Interaction and component tokens

These semantic tokens should be used by components instead of hard-coded
values.

  ----------------------------------------------------------------------------------------------
  Token                       Light theme               Dark theme             Use
  --------------------------- ------------------------- ---------------------- -----------------
  `--color-primary`           `#45058F`                 `#BD8BFF`              Primary actions,
                                                                               links, active
                                                                               controls

  `--color-primary-hover`     `#550D9F`                 `#D6B5FF`              Hover state

  `--color-primary-pressed`   `#320568`                 `#A35FFF`              Pressed state

  `--color-primary-subtle`    `#F7F0FF`                 `#26153D`              Selected
                                                                               backgrounds

  `--color-primary-border`    `#D6B5FF`                 `#553775`              Selected outlines

  `--color-bg`                `#F7F6FA`                 `#100D18`              Main application
                                                                               background

  `--color-surface`           `#FFFFFF`                 `#191422`              Cards, menus,
                                                                               sidebar

  `--color-surface-raised`    `#FFFFFF`                 `#211A2D`              Dialogs and
                                                                               popovers

  `--color-surface-muted`     `#F0EEF5`                 `#292235`              Inputs and
                                                                               secondary panels

  `--color-text`              `#20182C`                 `#F7F3FC`              Primary text

  `--color-text-secondary`    `#655C73`                 `#C2B8D2`              Supporting text

  `--color-text-muted`        `#81788F`                 `#A99EB9`              Tertiary text;
                                                                               check contrast

  `--color-border`            `#E3DFEB`                 `#3A3048`              Default borders
                                                                               and dividers

  `--color-border-strong`     `#D0C9DD`                 `#51435F`              Strong outlines

  `--color-focus-ring`        `#8740E0`                 `#BD8BFF`              Keyboard focus
                                                                               indicator

  `--color-overlay`           `rgba(19, 13, 28, .48)`   `rgba(0, 0, 0, .64)`   Modal and drawer
                                                                               backdrops

  `--color-disabled-bg`       `#F0EEF5`                 `#292235`              Disabled controls

  `--color-disabled-text`     `#A9A1B8`                 `#82788F`              Disabled labels;
                                                                               preserve
                                                                               discernibility

  `--color-selection`         `#EBD9FF`                 `#38204F`              Selected text /
                                                                               selected row

  `--color-link`              `#6B20BD`                 `#D6B5FF`              Inline links

  `--color-link-hover`        `#550D9F`                 `#EBD9FF`              Hovered links

  `--color-outline`           `#6B20BD`                 `#BD8BFF`              Outline button
                                                                               border/text

  `--color-ghost-hover`       `#F0EEF5`                 `#292235`              Ghost button
                                                                               hover background

  `--color-ghost-active`      `#E3DFEB`                 `#382D49`              Ghost button
                                                                               active background

  `--color-success`           `#047857`                 `#6EE7B7`              Success
                                                                               foreground/icon

  `--color-success-bg`        `#ECFDF5`                 `#102B23`              Success alert
                                                                               background

  `--color-success-border`    `#A7F3D0`                 `#245B48`              Success alert
                                                                               border

  `--color-warning`           `#92400E`                 `#FCD34D`              Warning
                                                                               foreground/icon

  `--color-warning-bg`        `#FFFBEB`                 `#332711`              Warning alert
                                                                               background

  `--color-warning-border`    `#FCD34D`                 `#6B5124`              Warning alert
                                                                               border

  `--color-danger`            `#B91C1C`                 `#FCA5A5`              Error
                                                                               foreground/icon

  `--color-danger-bg`         `#FEF2F2`                 `#351A21`              Error alert
                                                                               background

  `--color-danger-border`     `#FCA5A5`                 `#71313A`              Error alert
                                                                               border

  `--color-info`              `#1D4ED8`                 `#93C5FD`              Informational
                                                                               foreground/icon

  `--color-info-bg`           `#EFF6FF`                 `#15283D`              Informational
                                                                               alert background

  `--color-info-border`       `#93C5FD`                 `#2D5277`              Informational
                                                                               alert border
  ----------------------------------------------------------------------------------------------

### Button variants

  -----------------------------------------------------------------------
  Variant                 Default                 Hover / active guidance
  ----------------------- ----------------------- -----------------------
  Primary                 Brand background +      Darken brand on light
                          white text              theme; lighten
                                                  appropriately on dark
                                                  theme

  Secondary               Surface background +    Muted surface
                          border                  

  Outline                 Transparent             Primary-subtle
                          background + primary    background
                          border/text             

  Ghost                   Transparent             Ghost-hover background
                          background + no visible 
                          border                  

  Destructive             Danger background +     Darker danger surface
                          white text              on light theme

  Link                    Transparent, underlined Link-hover color
                          or clearly              
                          differentiated text     

  Disabled                Disabled surface/text   No hover effect; not
                                                  interactive
  -----------------------------------------------------------------------

Disabled states should remain legible. Do not rely on opacity alone to
communicate disabled status.

------------------------------------------------------------------------

## 6. Form and data visualization colors

### Form states

  ----------------------------------------------------------------------------------------------
  State             Border                    Background              Supporting text
  ----------------- ------------------------- ----------------------- --------------------------
  Default           `--color-border`          `--color-surface`       `--color-text-secondary`

  Hover             `--color-border-strong`   `--color-surface`       `--color-text-secondary`

  Focus             `--color-focus-ring`      `--color-surface`       Normal text

  Invalid           `--color-danger`          `--color-surface` or    `--color-danger`
                                              `--color-danger-bg`     

  Valid             `--color-success`         `--color-surface` or    `--color-success`
                                              `--color-success-bg`    

  Disabled          `--color-border`          `--color-disabled-bg`   `--color-disabled-text`
  ----------------------------------------------------------------------------------------------

Use visible labels, inline validation text, and programmatic error
associations. A red border alone is not sufficient error feedback.

### Chart palette

Use colors that remain distinguishable in both themes. Do not encode the
only meaning of a chart series by color.

  Series   Light       Dark
  -------- ----------- -----------
  Brand    `#6B20BD`   `#BD8BFF`
  Blue     `#2563EB`   `#93C5FD`
  Teal     `#0F766E`   `#5EEAD4`
  Green    `#047857`   `#6EE7B7`
  Amber    `#B45309`   `#FCD34D`
  Rose     `#BE123C`   `#FDA4AF`
  Slate    `#475569`   `#CBD5E1`

For multi-series charts, verify contrast against the chart surface and
provide labels, legends, patterns, or direct annotations.

------------------------------------------------------------------------

## 7. CSS Custom Properties

The following is a starter implementation. Extend it centrally rather
than defining separate colors inside components.

``` css
:root {
  color-scheme: light;

  --color-primary: #45058F;
  --color-primary-hover: #550D9F;
  --color-primary-pressed: #320568;
  --color-primary-subtle: #F7F0FF;
  --color-primary-border: #D6B5FF;

  --color-bg: #F7F6FA;
  --color-surface: #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-surface-muted: #F0EEF5;

  --color-text: #20182C;
  --color-text-secondary: #655C73;
  --color-text-muted: #81788F;

  --color-border: #E3DFEB;
  --color-border-strong: #D0C9DD;
  --color-focus-ring: #8740E0;
  --color-overlay: rgba(19, 13, 28, .48);

  --color-link: #6B20BD;
  --color-link-hover: #550D9F;
  --color-outline: #6B20BD;
  --color-ghost-hover: #F0EEF5;
  --color-ghost-active: #E3DFEB;

  --color-success: #047857;
  --color-success-bg: #ECFDF5;
  --color-success-border: #A7F3D0;

  --color-warning: #92400E;
  --color-warning-bg: #FFFBEB;
  --color-warning-border: #FCD34D;

  --color-danger: #B91C1C;
  --color-danger-bg: #FEF2F2;
  --color-danger-border: #FCA5A5;

  --color-info: #1D4ED8;
  --color-info-bg: #EFF6FF;
  --color-info-border: #93C5FD;

  --color-disabled-bg: #F0EEF5;
  --color-disabled-text: #A9A1B8;
  --color-selection: #EBD9FF;
}

[data-theme="dark"] {
  color-scheme: dark;

  --color-primary: #BD8BFF;
  --color-primary-hover: #D6B5FF;
  --color-primary-pressed: #A35FFF;
  --color-primary-subtle: #26153D;
  --color-primary-border: #553775;

  --color-bg: #100D18;
  --color-surface: #191422;
  --color-surface-raised: #211A2D;
  --color-surface-muted: #292235;

  --color-text: #F7F3FC;
  --color-text-secondary: #C2B8D2;
  --color-text-muted: #A99EB9;

  --color-border: #3A3048;
  --color-border-strong: #51435F;
  --color-focus-ring: #BD8BFF;
  --color-overlay: rgba(0, 0, 0, .64);

  --color-link: #D6B5FF;
  --color-link-hover: #EBD9FF;
  --color-outline: #BD8BFF;
  --color-ghost-hover: #292235;
  --color-ghost-active: #382D49;

  --color-success: #6EE7B7;
  --color-success-bg: #102B23;
  --color-success-border: #245B48;

  --color-warning: #FCD34D;
  --color-warning-bg: #332711;
  --color-warning-border: #6B5124;

  --color-danger: #FCA5A5;
  --color-danger-bg: #351A21;
  --color-danger-border: #71313A;

  --color-info: #93C5FD;
  --color-info-bg: #15283D;
  --color-info-border: #2D5277;

  --color-disabled-bg: #292235;
  --color-disabled-text: #82788F;
  --color-selection: #38204F;
}
```

------------------------------------------------------------------------

## 8. Accessibility and contrast

-   Target WCAG 2.2 AA for the full interface.
-   Normal text should meet a contrast ratio of at least **4.5:1**.
-   Large text should meet at least **3:1**.
-   Essential UI boundaries and graphical indicators should generally
    meet **3:1** against adjacent colors.
-   Verify primary button text against the exact brand background. Do
    not assume the brand purple and white pass for every text size and
    weight.
-   Verify muted text, disabled text, focus rings, placeholders, and
    status colors separately.
-   Preserve a visible keyboard focus indicator in both themes.
-   Pair semantic color with a label or icon, e.g. "Failed" plus an
    error icon, rather than a red dot alone.
-   Run an automated contrast checker and manually inspect key workflows
    before release.

------------------------------------------------------------------------

## 9. Usage rules for AI agents

1.  Read this file before creating or modifying UI components.
2.  Use semantic tokens (`--color-primary`, `--color-danger`, etc.)
    rather than raw hex values in component styles.
3.  Do not invent new brand colors without updating this palette.
4.  Keep light and dark theme tokens in sync.
5.  Do not use semantic success/warning/danger colors for decorative
    accents.
6.  Do not add gradients unless the design explicitly calls for one.
7.  Verify all new controls in default, hover, focus, active, disabled,
    loading, and error states as applicable.
8.  Never claim contrast compliance without checking the actual
    foreground/background pair.
9.  When changing a token, search for dependent components and test both
    themes.
10. If a required color role is missing, add it here first and document
    its use.

------------------------------------------------------------------------

## 10. Maintenance

When the palette changes: 1. Update the token tables and CSS reference
together. 2. Record the reason for the change. 3. Check contrast for
affected text and control combinations. 4. Check both themes and
semantic status components. 5. Remove obsolete tokens after migrating
their usages.
