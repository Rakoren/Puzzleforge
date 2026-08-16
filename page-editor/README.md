# PuzzleForge Page Editor (standalone)

A fork of the PuzzleForge Web app trimmed to **just the Page Editor** — the
drag-and-arrange page designer where you lay out a puzzle book's pages, edit
objects, insert/reroll puzzles, run pre-flight checks, and export the interior
PDF. It runs on its own, without the rest of PuzzleForge (Book Builder, Themes,
Cover Builder, image tools, AI theme generator, LAN Team workspace).

It still uses the shared **PuzzleForge engine** (`require('..')` — the repo
root) for puzzle generation, layout, page splitting, and PDF export, so the
pages you arrange are the pages that print.

## Run

```bash
cd page-editor
npm install          # express, archiver, @anthropic-ai/sdk, qrcode-generator, + the engine (file:..)
npm start            # http://localhost:4100  (override with PORT=…)
```

PDF export drives Chromium through the engine's `puppeteer-core`; that comes
from the repo-root install (`npm install` at the repo root), same as the main
app.

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
- **Team (LAN workspace)** — the collaboration tab is present in the UI but its
  `/api/workspace/*` server is not included, so it stays inert (shows as
  disabled). Copy `workspace.js` and re-add the mount from the main app's
  `server.js` if you want it.

## Relationship to the main app

This is a genuine fork: the client files (`public/*`) and the trimmed
`server.js` are copies of the main app's editor surface. Changes here do not
affect `puzzleforge-web`, and vice-versa.
