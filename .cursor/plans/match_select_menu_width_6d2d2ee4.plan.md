---
name: Match select menu width
overview: Make every shadcn select menu the same width as its field. The controls are already shadcn; the popup is sized by the menu content, so it opens wider than the input.
todos:
  - id: select-width
    content: Lock SelectContent to the trigger width with popper alignment
    status: completed
  - id: toolbar-width
    content: Give toolbar filters a stable width that the menu can match
    status: completed
  - id: verify-selects
    content: Check toolbar and form selects at phone and desktop widths
    status: completed
isProject: false
---

# Match select menus to their fields

The filter and form dropdowns are already the shadcn `Select` in [admin/src/components/ui/select.tsx](admin/src/components/ui/select.tsx). They look oversized because `SelectContent` defaults to `position="item-aligned"` and `min-w-36`. In that mode the panel sizes to the menu, not the trigger. A short field such as Status or City then opens a wider list.

`position="popper"` is the mode that exposes `--radix-select-trigger-width`. Dropdown menus already use the matching trigger-width variable. Selects do not.

Unused pieces of the shadcn catalog (carousel, drawer, command, and the rest) stay uninstalled. There is no screen that needs them, and adding them would not change these fields. Native `<select>` is not used in the admin pages.

## Changes

- In `SelectContent`, default to `position="popper"` and `align="start"`. Set the panel to `w-(--radix-select-trigger-width)` and remove `min-w-36`, so the open list cannot grow past the field. Long labels wrap inside that width.
- Give each `SelectItem` a 44px minimum height so the options meet the same touch size as the field (`--control-h` already forces the trigger to 44px in [admin/src/index.css](admin/src/index.css)).
- In [admin/src/components/toolbar.tsx](admin/src/components/toolbar.tsx), give each filter a stable width (`w-full` on small screens, a fixed `sm` width beside the search field) instead of `sm:w-auto`, so the closed field and the open list share one edge.

Form selects in [admin/src/pages/settings-general.tsx](admin/src/pages/settings-general.tsx) and [admin/src/pages/create-activity.tsx](admin/src/pages/create-activity.tsx) already use `w-full` triggers, so they pick up the same popup width with no page-specific menu classes.

## Check

On the students page, open Status, Course, and City. Each list should line up with its field on both a phone width and a desktop toolbar. Then open the status select on create-assessment and a settings select and confirm those lists match their full-width fields. Keyboard focus and the existing 44px field height stay as they are.
