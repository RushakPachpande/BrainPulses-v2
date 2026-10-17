---
name: Canonical Tailwind classes
overview: Enforce Tailwind v4 canonical classes in admin with the ESLint rule that matches IntelliSense, autofix the equivalent renames, and keep rounded-[4px] because rounded-lg is 12px in this theme.
todos:
  - id: add-eslint-canonical
    content: Add eslint-plugin-better-tailwindcss in admin with only enforce-canonical-classes, entryPoint src/index.css, and an ignore for rounded-[4px]
    status: pending
  - id: autofix-canonical
    content: Run eslint --fix, keep equivalent renames such as group-has-focus-visible, and revert any fix that changes a computed size
    status: pending
  - id: silence-duplicate-diagnostics
    content: Set tailwindCSS.lint.suggestCanonicalClasses to ignore in .vscode/settings.json so Problems uses the ESLint rule
    status: pending
  - id: add-canonical-rule
    content: Add a short Cursor rule that points at the ESLint rule and the 4px radius exception
    status: pending
isProject: false
---

# Canonical Tailwind classes

The Problems entries are Tailwind IntelliSense `suggestCanonicalClasses`. A canonical class is the shorter built-in form of the same utility ([border-radius](https://tailwindcss.com/docs/border-radius), [hover, focus, and other states](https://tailwindcss.com/docs/hover-focus-and-other-states)). `group-has-[:focus-visible]/field-label:` and `group-has-focus-visible/field-label:` are the same selector. `rounded-[4px]` and `rounded-lg` are not the same in this app.

## What not to install

The generic write-up names the wrong tools for this Vite admin app, which is already on Tailwind 4.3:

- Do not run `npx @tailwindcss/upgrade`. That migrates v3 projects. This app is already v4.
- Do not install `eslint-plugin-tailwindcss`. That plugin targets Tailwind v3.
- Do not treat official `prettier-plugin-tailwindcss` as a canonical rewriter. It sorts classes. It does not rewrite `mt-[16px]` to `mt-4`.
- Do not add `prettier-plugin-tailwindcss-canonical-classes` in this change. It rewrites on every format and cannot honor an ignore list, so a format would turn the checkbox `rounded-[4px]` into `rounded-lg` (12px here).

## ESLint (the autofix)

Install `eslint-plugin-better-tailwindcss` in [admin/](admin/) only. Its `enforce-canonical-classes` rule is the same suggestion engine as IntelliSense, with autofix, and it reads the project stylesheet. Enable that one rule in [admin/eslint.config.js](admin/eslint.config.js). Do not enable the plugin’s full recommended set.

- `settings["better-tailwindcss"].entryPoint`: `src/index.css` (the `@theme` file).
- Detect classes inside `cn()` and `cva()` (set `callees` if the defaults miss them).
- Rule level `warn`, with `ignore` for `rounded-[4px]`.
- Files: `src/**/*.{ts,tsx}`.

Then run ESLint with `--fix` from `admin/`. Review the diff:

- Keep equivalent renames in [checkbox.tsx](admin/src/components/ui/checkbox.tsx), [switch.tsx](admin/src/components/ui/switch.tsx), and [field.tsx](admin/src/components/ui/field.tsx): `group-has-[:focus-visible]` to `group-has-focus-visible`, and `has-[:focus-visible]` to `has-focus-visible`.
- Revert any fix whose computed value changes. In [admin/src/index.css](admin/src/index.css), `--radius` is `12px` and `--radius-lg` is `var(--radius)`, so `rounded-lg` is 12px. Default Tailwind maps 4px to `rounded-sm` and 8px to `rounded-lg`, but this theme overrides those steps. No theme step is 4px, so the checkbox stays `rounded-[4px]`.

## Problems tab

Add [.vscode/settings.json](.vscode/settings.json) with `tailwindCSS.lint.suggestCanonicalClasses` set to `ignore`, which is what the ESLint rule’s docs recommend. The same findings then come from ESLint, including the ignore for the checkbox. Do not turn on format-on-save in that file.

## Cursor rule

Add [.cursor/rules/tailwind-canonical-classes.mdc](.cursor/rules/tailwind-canonical-classes.mdc) for `admin/**/*.{tsx,css}` (`alwaysApply: false`):

- When IntelliSense or ESLint offers a canonical class, apply it if the selector or size is unchanged.
- Do not apply a suggestion that changes the computed value. `rounded-[4px]` stays; `rounded-lg` is 12px in this theme.
- New classes should use the named form first (`focus-visible:`, `has-focus-visible:`, `group-has-focus-visible/name:`). Keep arbitrary values for `calc()`, `inherit`, and sizes that are not on this theme’s scale.
