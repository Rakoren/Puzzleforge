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

The **AI Theme Generator** (the *AI Themes* page) needs an Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # required for theme generation only
export PUZZLEFORGE_THEME_MODEL=claude-opus-4-8   # optional, this is the default
```

Without a key the rest of the app works normally; the AI Themes page shows a
notice instead of failing.

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

### Teacher tools

- **Custom clue editor** (crosswords) — load the theme's words and write your
  own clues to match a lesson
- **Differentiation set** — the same puzzle at Easy / Medium / Hard in one PDF
- **Class set** — N re-rolled copies (each student gets a different grid, same
  words), with answers off, interleaved, or collected at the back

No accounts, no database — recipes live on the teacher's own machine
(Option A in the PRD).

### Book Builder

A second page (**Book Builder**, linked in the header) assembles a whole book
visually — no JSON by hand:

- Set the title, subtitle, author, audience, page (trim) size, default theme,
  and answer-key toggle
- Add puzzle rows (type · count · difficulty, including mixed ranges), reorder
  or remove them
- Preview the assembled book, then download the print-ready PDF
- Save / load the book recipe (`.json`) — the same format the CLI's `--book`
  flag accepts

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/meta` | types, themes, trim sizes, recipe version |
| POST | `/api/preview` | generate → `{ puzzleId, previewHtml, answerHtml, meta }` |
| POST | `/api/pdf` | export a print-ready PDF (reuses the previewed puzzle by `puzzleId`) |
| POST | `/api/words` | resolve a recipe's words + clues (for the clue editor) |
| POST | `/api/set` | teacher sets → one PDF: `mode: "differentiation" \| "classset"`, `count`, `answers: "none" \| "end" \| "each"` |
| POST | `/api/book/preview` | assemble a book → `{ bookId, html, meta }` |
| POST | `/api/book/pdf` | export the book PDF (reuses the assembled book by `bookId`) |
| GET | `/api/theme/status` | `{ available }` — whether an Anthropic API key is configured |
| POST | `/api/theme/generate` | topic → `{ theme, report, sample }` (preview, not saved) |
| POST | `/api/theme/save` | persist a generated theme to the library → `{ id, report }` |

### AI Theme Generator

The *AI Themes* page turns a topic ("dinosaurs", "ancient Egypt") into a
difficulty-tiered, clued word list in the same on-disk format as the built-in
themes. Claude writes the words and clues; the engine's offensive-word filter,
de-duplication, and length checks then sanitize the result before it is shown
or saved. Saved themes are ordinary `themes/*.json` files, so they immediately
appear in every theme picker and can be edited or deleted by hand.

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
