# PuzzleForge Web

The teacher-facing web app for PuzzleForge. A simple, accountless tool to
generate a single puzzle, preview it live, and download a print-ready PDF or a
reusable recipe file.

It imports the engine (`puzzleforge-engine`, the repository root) as a local
package and runs it server-side — the engine is Node-only (themes read from
disk, PDF export drives Chromium), so the browser handles only the form,
preview, and downloads.

> Co-located here as a subdirectory for now; it depends on the engine via
> `file:..` and can be extracted into its own repository later without code
> changes.

## Run

```bash
cd puzzleforge-web
npm install
npm start           # http://localhost:4000  (PORT env to change)
```

PDF export needs a Chromium binary (same as the engine). Set
`PUPPETEER_EXECUTABLE_PATH` if it is not auto-detected.

## What it does

- **Pick a puzzle** — any of the engine's types (word search, sudoku, maze,
  cryptogram, word scramble, crossword, kriss-kross)
- **Words** — choose a built-in theme or paste your own word list
- **Settings** — difficulty, page (trim) size, audience, optional grid size and title
- **Live preview** — puzzle and answer-key tabs
- **Download PDF** — print-ready at the chosen trim size, with optional answer key
- **Save / Upload recipe** — a `.json` of your settings. Re-upload later to
  regenerate (the grid re-rolls; your words, title, and options are preserved).
  Doubles as a share format.

No accounts, no database — recipes live on the teacher's own machine
(Option A in the PRD).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/meta` | types, themes, trim sizes, recipe version |
| POST | `/api/preview` | generate → `{ puzzleId, previewHtml, answerHtml, meta }` |
| POST | `/api/pdf` | export a print-ready PDF (reuses the previewed puzzle by `puzzleId`) |

### Recipe format

```json
{
  "puzzleforgeRecipe": 1,
  "type": "wordsearch",
  "theme": "animals",
  "words": null,
  "difficulty": 1,
  "trimSize": "8x10",
  "audience": "kids",
  "title": null,
  "size": null
}
```

`theme` and `words` are mutually exclusive (custom `words` win). The
`puzzleforgeRecipe` version field guards against future format changes.
