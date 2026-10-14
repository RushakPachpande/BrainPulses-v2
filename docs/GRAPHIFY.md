# Graphify — generate & update the knowledge graph

This folder holds the **project knowledge graph** produced by [graphify](https://github.com/). Use it so agents and humans can answer architecture questions from structure (imports, calls, communities) instead of scanning the whole tree.

The steps below are **project-agnostic**. Run them from the **repository root** (the directory that contains `.gitignore` and where you want `graphify-out/`).

---

## Prerequisites

1. Install the `graphify` CLI and make sure `graphify` is on your `PATH`.
2. Prefer running from a **git** repo so freshness can be tied to `HEAD`.
3. Keep secrets and bulky deps out of the index via `.gitignore` (and optionally `.graphifyignore`).

**Ignore behavior (important):**

| Flag / file | Effect |
|-------------|--------|
| Default | Respects `.gitignore` and `.git/info/exclude` |
| `.graphifyignore` | Extra ignore patterns (same spirit as gitignore) |
| `--no-gitignore` | Do **not** use gitignore; `.graphifyignore` still applies |

Do **not** pass `--no-gitignore` unless you intentionally want `node_modules/`, build outputs, and other ignored paths in the graph.

---

## What lives in `graphify-out/`

| Path | Purpose |
|------|---------|
| `graph.json` | Canonical graph (nodes + edges) |
| `GRAPH_REPORT.md` | Summary: communities, hubs, cycles, surprises |
| `graph.html` | Interactive visualization |
| `wiki/` | Markdown wiki (`wiki/index.md` is the entry point) |
| `.graphify_analysis.json` | Clustering / analysis side data |
| `cache/` | Extractor cache (safe to delete; will rebuild) |

Graph artifacts are usually **gitignored**. This README is often the only tracked file in the folder (see your root `.gitignore`).

---

## First-time build (any project)

From the **repo root**:

```bash
# 1) AST extract — local, no API key; skips docs/papers/images
graphify extract . --code-only

# 2) Cluster + report + graph.html (no LLM community names)
graphify cluster-only . --no-label

# 3) Optional: markdown wiki for navigation
graphify export wiki
```

**Outputs:** `graphify-out/graph.json`, `GRAPH_REPORT.md`, `graph.html`, and (if exported) `wiki/`.

### Variants

```bash
# Full extract (AST + semantic LLM) — needs a configured backend / API key
graphify extract .

# Deeper inferred edges (more LLM cost)
graphify extract . --mode deep

# Name communities with the LLM (after cluster or extract)
graphify label .
# or only fill missing / placeholder names:
graphify label . --missing-only

# Re-cluster and keep placeholder community names
graphify cluster-only . --no-label
```

---

## After you change code (day-to-day)

Cheap, no LLM:

```bash
graphify update .
```

Then refresh derived views if you use them:

```bash
graphify cluster-only . --no-label   # if communities look stale
graphify export wiki                 # if you rely on wiki/
graphify export html                 # regenerate graph.html only
```

| Situation | Command |
|-----------|---------|
| Normal code edits | `graphify update .` |
| Large delete / refactor and the rebuild looks too small | `graphify update . --force` or `GRAPHIFY_FORCE=1 graphify update .` |
| Continuous rebuild while editing | `graphify watch .` |
| Cron / CI: notify if semantic refresh is pending | `graphify check-update .` |

---

## Query the graph (agents & humans)

Run from the repo root (defaults to `graphify-out/graph.json`):

```bash
graphify query "How does the admin layout relate to the sidebar?"
graphify path "SymbolA" "SymbolB"
graphify explain "Toolbar"
graphify god-nodes --top 10
graphify affected "SomeSymbol" --depth 2
```

Useful options:

```bash
graphify query "..." --budget 2000
graphify query "..." --dfs
graphify path "A" "B" --undirected
graphify explain "X" --graph path/to/graph.json
```

---

## Exports (optional)

```bash
graphify export wiki
graphify export html
graphify export svg
graphify export graphml
graphify export callflow-html
graphify export obsidian
# graphify export neo4j / falkordb — see `graphify --help`
```

---

## Suggested `.gitignore` (reuse in other repos)

Ignore generated graph data; keep this README if you want the workflow documented in-repo:

```gitignore
graphify-out/*
!graphify-out/README.md
```

Optional: add a `.graphifyignore` next to `.gitignore` for paths that must stay in git but should never enter the graph (e.g. large fixtures, vendor snapshots).

---

## Cursor / agent rule (optional)

If the project installs the Cursor integration (`graphify cursor install`), agents are steered to use `query` / `path` / `explain` **before** blind Grep/Read. After local code edits, prefer:

```bash
graphify update .
```

so `graph.json` stays current without an API call.

---

## Quick checklist

- [ ] CLI works: `graphify --help`
- [ ] First build: `extract . --code-only` → `cluster-only . --no-label` → optional `export wiki`
- [ ] After changes: `update .`
- [ ] gitignore excludes `node_modules`, build dirs, secrets, and bulky trees you do not want indexed
- [ ] Do not commit `graph.json` / `wiki/` unless your team explicitly wants the graph in VCS

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Graph includes `node_modules` or build output | Ensure those paths are in `.gitignore`; do not use `--no-gitignore` |
| Update refuses a smaller graph | `graphify update . --force` |
| Empty or thin graph | Confirm you are at the repo root; check that source extensions are supported; review extract warnings |
| Community names are “Community N” | Expected with `--no-label`; run `graphify label .` when an LLM backend is configured |
| Stale answers after a big rename | `graphify update . --force`, then re-cluster / re-export wiki |

For the full command surface: `graphify --help`.
