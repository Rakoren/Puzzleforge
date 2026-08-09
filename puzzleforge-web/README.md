# PuzzleForge Web

The teacher-facing web app for PuzzleForge. A simple, accountless tool to
generate a single puzzle, preview it live, and download a print-ready PDF or
a reusable recipe file. Also home to the AI Theme Generator, since it's the
tool that maintains this repo's own `themes/` directory.

The publisher-only tooling that used to live here (Book Builder, Page
Editor, Cover Builder, Image Tools, AI Art, KDP export, team workspace) has
moved to its own app: [`rakoren/publisher`](https://github.com/rakoren/publisher).

It imports the engine (`puzzleforge-engine`, the repository root) as a local
package and runs it server-side — the engine is Node-only (themes read from
disk, PDF export drives Chromium), so the browser handles only the form,
preview, and downloads.

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

- **Pick a puzzle** — any of the engine's puzzle types (word search, number
  search, sudoku, maze, cryptogram, word scramble, crossword, kriss-kross,
  nonogram, trivia, logic grid, word ladder, word wheel, cipher, riddles,
  brain teasers)
- **Words** — choose a built-in theme or paste your own word list
- **Settings** — difficulty, page (trim) size, audience, optional grid size and title
- **Text size & font** — Normal / Large print / Extra large, and Sans / Serif / Rounded (large-print "senior" mode)
- **Page border** — a decorative vector frame (single / double / rounded / dashed / dots / scallop / stars) in any color, drawn around each puzzle page (skipped on blank and activity pages)
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
- **Worksheets & lesson packets** (`worksheets.html`) — turn any puzzle into a
  printable classroom handout with a student Name/Date header, or assemble a
  full lesson packet (cover + worksheets + answer-key section) into one PDF.
  An auto lesson-plan mode turns a grade + topic into a ready packet.

No accounts, no database — recipes live on the teacher's own machine
(Option A in the PRD).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/meta` | types, themes, trim sizes, recipe version |
| POST | `/api/preview` | generate → `{ puzzleId, previewHtml, answerHtml, meta }` |
| POST | `/api/pdf` | export a print-ready PDF (reuses the previewed puzzle by `puzzleId`) |
| POST | `/api/words` | resolve a recipe's words + clues (for the clue editor) |
| POST | `/api/set` | teacher sets → one PDF: `mode: "differentiation" \| "classset"`, `count`, `answers: "none" \| "end" \| "each"` |
| POST | `/api/worksheet/preview` | single worksheet HTML preview (with student header) |
| POST | `/api/worksheet/pdf` | worksheet PDF (+ optional answer copy) |
| POST | `/api/packet/pdf` | lesson packet PDF (cover + worksheets + answer section) |
| GET | `/api/curriculum` | grade presets |
| POST | `/api/packet/plan` | grade + topic → an auto lesson-plan config |
| GET | `/api/theme/status` | `{ available }` — whether an Anthropic API key is configured |
| POST | `/api/theme/generate` | topic → `{ theme, report, sample }` (preview, not saved) |
| POST | `/api/category/generate` | broad topic → `{ category, themes:[{theme,report,sample}] }` (preview) |
| POST | `/api/category/save` | save a batch of themes under one category → `{ saved:[id] }` |
| POST | `/api/theme/save` | persist a generated theme to the library → `{ id, report }` |
| POST | `/api/theme/clean` | re-run the safety/dedup/length filter over a saved theme → `{ id, report, removed }` |
| POST | `/api/theme/get` | full contents of a saved theme (for the editor) → `{ id, label, category, tags, facts, tiers }` |
| POST | `/api/theme/remove` | remove specific words / facts from a saved theme → `{ id, counts, factCount, removedWords, removedFacts }` |
| POST | `/api/theme/delete` | delete a saved theme → `{ id }` |

### Manual theme builder

Alongside the AI Theme Generator, the *Themes* page has a **manual mode** to
author a tiered, clued word list + fun facts by hand (name, category, tags,
easy/medium/hard tiers) — saved in the same on-disk format as every other theme.

### AI Theme Generator

The *AI Themes* page turns a topic ("dinosaurs", "ancient Egypt") into a
difficulty-tiered, clued word list in the same on-disk format as the built-in
themes. Claude writes the words and clues; the engine's offensive-word filter,
de-duplication, and length checks then sanitize the result before it is shown
or saved. Saved themes are ordinary `themes/*.json` files, so they immediately
appear in every theme picker and can be edited or deleted by hand — including
in `rakoren/publisher`, which reads this repo's themes read-only via the
engine's API.

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
