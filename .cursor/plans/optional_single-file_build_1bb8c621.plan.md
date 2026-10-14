---
name: Optional single-file build
overview: Add vite-plugin-singlefile as an admin dev dependency and turn it on only for a dedicated build script, leaving the default Vite build unchanged.
todos:
  - id: install-plugin
    content: Install vite-plugin-singlefile as an admin devDependency and audit
    status: completed
  - id: wire-config
    content: Enable the plugin in vite.config.ts only for build mode singlefile
    status: completed
  - id: add-scripts
    content: Add admin build:single and root build:single:admin scripts
    status: completed
  - id: verify-build
    content: Typecheck, lint, format, and confirm the single-file dist HTML
    status: completed
isProject: false
---

# Optional single-file Vite build

`vite-plugin-singlefile` 2.3.x supports Vite 8 (Rolldown). Install it in [`admin/`](admin/) as a dev dependency. The default `build` script stays a normal multi-file Vite build. A new script passes `--mode singlefile`, and [`admin/vite.config.ts`](admin/vite.config.ts) adds the plugin only in that mode.

## Config

In [`admin/vite.config.ts`](admin/vite.config.ts), switch to the `defineConfig` callback and include the plugin only for a production single-file build:

```ts
export default defineConfig(({ command, mode }) => {
  const singleFile = command === 'build' && mode === 'singlefile';
  return {
    plugins: [react(), tailwindcss(), ...(singleFile ? [viteSingleFile()] : [])],
    // existing resolve, server, and build settings stay as they are
  };
});
```

The plugin’s own config hook already sets `assetsInlineLimit`, `cssCodeSplit: false`, and Rolldown `codeSplitting: false`. `vite build --mode singlefile` still sets `NODE_ENV` to `production`. Dev server behavior does not change.

Both builds write to `admin/dist` (already gitignored). Running one after the other replaces that folder.

## Scripts

[`admin/package.json`](admin/package.json):

- `build` — unchanged: `tsc -b && vite build`
- `build:single` — `tsc -b && vite build --mode singlefile`

[`package.json`](package.json) at the repo root only forwards scripts, so add `build:single:admin` the same way as `build:admin`.

## What the single file includes

Bundled JS and CSS are inlined into one HTML file. The Google Fonts `<link>` tags and `/favicon.svg` in [`admin/index.html`](admin/index.html) stay as external references, so those still need a network or the copied favicon file.

## Checks

After install, from `admin/`: `npm audit`, `npm run typecheck`, `npm run lint`, `npm run format:check`. Then run `npm run build:single` and confirm `admin/dist/index.html` contains the script and stylesheet inline, with no separate JS/CSS asset tags. Do not start a second dev server.
