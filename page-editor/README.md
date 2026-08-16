# PuzzleForge Page Editor (standalone)

A fork of the PuzzleForge Web app trimmed to **just the Page Editor** — the
drag-and-arrange page designer where you lay out a puzzle book's pages, edit
objects, insert/reroll puzzles, run pre-flight checks, and export the interior
PDF. It runs on its own, without the rest of PuzzleForge (Book Builder, Themes,
Cover Builder, image tools, AI theme generator, LAN Team workspace).

**Fully self-contained.** The PuzzleForge **engine** (puzzle generation,
layout, page splitting, PDF export) is vendored into
[`vendor/puzzleforge-engine/`](vendor/puzzleforge-engine) and wired in as a
`file:` dependency, so this folder is everything you need — copy it anywhere
and it runs. It does not read from a parent repo.

## Run

```bash
cd page-editor          # (or wherever you copied this folder)
npm install             # express, archiver, @anthropic-ai/sdk, qrcode-generator,
                        #   + the vendored engine and its deps (puppeteer-core, …)
npm start               # http://localhost:4100  (override with PORT=…)
```

PDF export drives Chromium through the vendored engine's `puppeteer-core`,
installed by the single `npm install` above. On a machine without a bundled
Chromium, point it at an installed browser with
`PUPPETEER_EXECUTABLE_PATH=/path/to/chrome`.

## What it serves

Only the routes the editor calls:

| Route | Purpose |
|---|---|
| `GET /` | the editor page (`public/index.html`) |
| `GET /element-html.js`, `/decor.js`, `/qrcode-generator.js` | engine renderers the editor shares, so on-screen pixels match the PDF |
| `GET /api/meta` | puzzle types, themes, trim sizes, difficulty labels |
| `POST /api/book/editor` | assemble/open a book and return every page as editable pieces |
| `POST /api/book/insert-puzzle` | generate fresh puzzle page(s) to drop in |
| `POST /api/book/reroll` | regenerate one page |
| `POST /api/book/pdf` | render the arranged interior to a PDF |
| `POST /api/book/package` | zip a KDP interior bundle |
| `POST /api/book/checklist`, `/api/book/proofread`, `/api/thesaurus` | pre-flight + writing helpers (need an Anthropic API key; degrade gracefully without one) |
| `/api/workspace/*` | the self-hosted LAN Team workspace (shared roster, shared book library, live comments over SSE) |

## Team (LAN workspace)

The **Team** tab is backed by `workspace.js`, a self-contained Express router
(standard library + express only — no engine, no external services). It
persists to `./data` next to the app:

- `PUZZLEFORGE_DATA_DIR` — where the roster, shared books, and comments are
  stored (default `./data`).
- `PUZZLEFORGE_WORKSPACE_TOKEN` — set it to require an `x-pf-workspace` token
  header on every workspace call (leave unset for an open LAN).

It's a single-process store — run one instance and point the team's browsers at
it over the LAN.

## Opening a book

In the full app the Page Editor receives a book handed off from the Book
Builder. This fork has no Book Builder, so `public/index.html` **seeds a sample
book** (a title page, four puzzles — maze, sudoku, kakuro, nonogram — and an
answer key) the first time it loads, and the empty state offers **Load a sample
book** to reseed. You can also use **Open recipe** in the toolbar to load a
book recipe you exported elsewhere.

To wire this editor to your own source, `POST /api/book/editor` with either a
`{ config }` (a book recipe — see the sample in `index.html`) or a `{ bookId }`
returned from a previous call.

## Excluded from the fork

- **Book Builder, Themes, Cover Builder, image tools, AI theme/category
  generation** — separate features, not part of the editor.

(The **Team / LAN workspace** IS included — see the Team section above.)

## Relationship to the main app

This is a genuine fork: the client files (`public/*`), the trimmed `server.js`,
`workspace.js`, and the vendored engine (`vendor/puzzleforge-engine/`) are
copies. Changes here
do not affect the main `puzzleforge-engine` / `puzzleforge-web`, and vice-versa.
To pull in later engine fixes, re-copy the engine source over
`vendor/puzzleforge-engine/` (keeping its `package.json`).
