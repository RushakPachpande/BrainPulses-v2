---
name: Project rules cleanup
overview: "Rewrite `.cursor/rules/` so every rule matches BrainPulses v2.0 as it exists today: a Vite + React admin app in `admin/`, with no API, Prisma, or other-product ports."
todos:
  - id: add-project-context
    content: Add always-on project-context.mdc for the admin Vite app, port 5173, and references/ as read-only
    status: completed
  - id: rewrite-dev-ui-rules
    content: Rewrite port, shadcn, control-height, Tailwind v4, and responsive rules to match admin/src
    status: completed
  - id: rewrite-workflow-rules
    content: Rewrite env, deps, skills, preservation, clarify, and commit-message rules; drop other-project examples
    status: completed
  - id: remove-obsolete-rules
    content: Delete immutable-migrations, conventional-commit RFC dump, and Next.js Tailwind prompt
    status: completed
isProject: false
---

# Align Cursor rules to BrainPulses admin

Rules stay in [`.cursor/rules/`](.cursor/rules/). No app code changes.

## What is wrong today

Copied rules still describe LevelUP, PGDM Induction, Next.js, and an API that does not exist. That makes the agent follow the wrong ports, paths, and commands.

- [close-terminals-after-work.mdc](.cursor/rules/close-terminals-after-work.mdc) tells the agent to spare port **3000** (LevelUP API) and Postgres **5432 / 5433** (LevelUP and Induction). This repo only serves `admin/` on **5173** (`strictPort` in [admin/vite.config.ts](admin/vite.config.ts)).
- [immutable-migrations.mdc](.cursor/rules/immutable-migrations.mdc) always applies and points at `api/prisma/`, including a PGDM migration name. There is no `api/` or Prisma schema in this repo. Root [package.json](package.json) says `client/` and `api/` come later.
- [tailwind-shadcn-ui-integration-cursorrules-prompt-.mdc](.cursor/rules/tailwind-shadcn-ui-integration-cursorrules-prompt-.mdc) is a Next.js prompt with `globs: **/*`. This app is Vite 8, React 19, React Router, Tailwind v4, shadcn `radix-nova`.
- [tailwind.mdc](.cursor/rules/tailwind.mdc) is a generic Tailwind v3 checklist (purge, `tailwind.config`). Styling is CSS-first in [admin/src/index.css](admin/src/index.css) via `@import 'tailwindcss'` and `@theme`. It also has no `description`.
- [git-conventional-commit-messages.mdc](.cursor/rules/git-conventional-commit-messages.mdc) dumps the Conventional Commits RFC and matches every file. It duplicates [ai-commit-messages.mdc](.cursor/rules/ai-commit-messages.mdc), whose examples are PGDM (assessments, Excel import, student routes).
- [control-height-and-toolbars.mdc](.cursor/rules/control-height-and-toolbars.mdc) still talks about `.btn` and `.toolbar`. Height is already enforced with `[data-slot='button'|'input'|'select-trigger'|'input-group']` and `--control-h: 44px`. Toolbars are the React [`Toolbar`](admin/src/components/toolbar.tsx) (`sm:ml-auto`), not those CSS classes.
- [no-env-file-access.mdc](.cursor/rules/no-env-file-access.mdc) requires `.env.dev.example` / `.env.prod.example` and a rule named `env-dev-prod-examples` that is not in this repo. [.gitignore](.gitignore) allows both `.env.example` and `.env.*.example`. This app has no env templates yet.
- [use-relevant-skills.mdc](.cursor/rules/use-relevant-skills.mdc) examples cite Prisma migrate and a VPS deploy rule. Project skills under `.agents/skills/` are only: `accessibility`, `bash-defensive-patterns`, `frontend-design`, `nodejs-backend-patterns`, `nodejs-best-practices`, `seo`, `vite`. There is no `.cursor/skills/`. `frontend-design` pushes a new visual direction; this admin already has fonts and tokens (Plus Jakarta Sans, Source Sans 3, shadcn tokens).
- [existing-behavior-preservation.mdc](.cursor/rules/existing-behavior-preservation.mdc) cites missing rules `no-regressions-clean-edits` and `code-quality-validation`. Real checks live in `admin/`: `npm run typecheck`, `npm run lint`, `npm run format:check` (root forwards them as `*:admin`).
- [responsive-first.mdc](.cursor/rules/responsive-first.mdc) is useful but missing a `description`.

`references/` holds old BrainPulses, LevelUP, and PGDM. Rules must treat that folder as read-only reference, not as this app’s source of truth.

## Target set

**Add** one always-on context rule:

- `project-context.mdc` — BrainPulses v2.0 is the `admin/` Vite app only. Stack, port 5173, root scripts (`dev:admin`, `typecheck:admin`, `lint:admin`, `format:admin`), Node `>=22`, PowerShell. Do not scaffold `api/` or `client/` unless asked. Do not copy ports, Prisma, env layout, or product behavior out of `references/`.

**Rewrite in place** (keep the filename, cut each under ~50 lines, one concern, concrete good/bad examples):

- `close-terminals-after-work.mdc` and `reuse-existing-dev-servers.mdc` — only port **5173**. Start with `npm run dev:admin` from the repo root (or `npm run dev` inside `admin/`) and only if nothing is listening. Never kill a listener that was already up.
- `shadcn-only-ui.mdc` — scope to `admin/**/*.tsx`. Controls from `@/components/ui`, icons from `lucide-react`, style `radix-nova`. App chrome (`layouts/`, `components/` outside `ui/`) stays outside generated primitives.
- `control-height-and-toolbars.mdc` — keep `--control-h` (44px) on the existing `data-slot` selectors in `index.css`. New single-line buttons, inputs, and selects use that height. Toolbars use [`Toolbar`](admin/src/components/toolbar.tsx): search and filters in the row, actions with `sm:ml-auto`, full width under `sm`.
- `tailwind.mdc` — replace the generic list with Tailwind v4 for this app: tokens live in `admin/src/index.css`, no `tailwind.config`, semantic colors already defined (`primary`, `sidebar`, `success`, `warning`, kpi tints). Utilities for layout; do not invent a second palette.
- `responsive-first.mdc` — keep the mobile-first guidance; add `description`; point examples at admin pages.
- `secure-dependencies.mdc` — install only inside `admin/`. Root `package.json` is a script forwarder, not an install target.
- `no-env-file-access.mdc` — still forbid real `.env` files. Templates, when needed, follow `.gitignore`: `.env.example` or `.env.*.example`, placeholders only. Drop the missing `env-dev-prod-examples` rule.
- `use-relevant-skills.mdc` — discovery order stays `.agents/skills/` then global. Examples use skills that exist here (`frontend-design`, `vite`, `accessibility`). For admin UI, match the current design system; do not restyle from the generic `frontend-design` skill. Do not pull in `nodejs-*` or `seo` until an API or public site exists. Shell work on this machine is PowerShell, not bash.
- `existing-behavior-preservation.mdc` — same smallest-change rule. Validation is the admin typecheck, lint, and format check. Drop references to rules and a database that are not in this repo.
- `ai-commit-messages.mdc` — keep the Source Control format (type, imperative summary, short bullets). Replace PGDM examples with this admin (dashboard, activities, students, question banks, sidebar).
- `clarify-before-acting.mdc` — keep; swap examples for this admin (pages, fixtures, layout) so they do not imply a hero site or an auth stack that is not here.

**Remove** (content that fights this repo, or is fully covered by a rewritten rule):

- `immutable-migrations.mdc` — nothing to protect until `api/` and Prisma exist. Re-add then, pointed at that future tree.
- `git-conventional-commit-messages.mdc` — RFC duplicate of the commit-message rule.
- `tailwind-shadcn-ui-integration-cursorrules-prompt-.mdc` — wrong framework; covered by the shadcn and Tailwind rules.

Every kept file gets YAML frontmatter with `description` and `alwaysApply: true`, except `shadcn-only-ui.mdc`, which applies when `admin/**/*.{tsx,css}` is in play (`alwaysApply: false`).
