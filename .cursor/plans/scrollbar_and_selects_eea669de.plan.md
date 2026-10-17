---
name: Scrollbar and selects
overview: Style scrollbars to match the admin shell, and replace the native select arrow so it sits inset from the right edge instead of sticking to it.
todos:
  - id: select-arrow
    content: Replace the native select arrow with an inset chevron and extra right padding
    status: completed
  - id: scrollbar
    content: Add a shared thin scrollbar for the page, sidebar, and tables
    status: completed
  - id: verify-chrome
    content: Check dropdowns and scrollbars on desktop and a phone width
    status: completed
isProject: false
---

# Scrollbar and select arrow

## Selects

Native Windows arrows ignore the 12px padding on `select` in [src/styles/components.css](src/styles/components.css), so the chevron sits on the border. Remove the native arrow and paint one inset icon for every select (toolbar filters and form fields):

- `appearance: none`
- `padding-right: 40px` so the label does not run under the icon
- a 16px chevron as a `background-image`, placed at `right 14px center`, `no-repeat`
- keep the existing border, radius, height, hover, and focus ring

## Scrollbars

Add one shared scrollbar style in [src/styles/base.css](src/styles/base.css) for the page, the sidebar, and table regions:

- thin bar, 10px, fully rounded thumb
- light surfaces: thumb from `--mu` on a transparent track
- sidebar: keep the darker thumb using `--sidebar-2`
- `scrollbar-width` / `scrollbar-color` for Firefox, and `::-webkit-scrollbar` for Chromium
- no new colors outside the existing tokens

## Check

Look at a filter dropdown and a form dropdown, and scroll the sidebar and a wide table. The arrow should sit clear of the right edge, and the bars should match the shell on desktop and at 390px.