# PuzzleForge Engine

The core puzzle generation engine and print-ready PDF export pipeline behind
PuzzleForge. Pure Node.js library + CLI — no UI dependencies. The teacher-facing
web app lives in [`puzzleforge-web/`](./puzzleforge-web) and imports this package
as a local dependency (co-located for now; can be split into its own repository
later).

See [`PRD.md`](./PRD.md) for the full product spec.

## Quick start (run it on your computer)

**Prerequisites:** [Node.js](https://nodejs.org) 18 or newer. For PDF export you
also need Google Chrome, Chromium, or Microsoft Edge installed (the engine drives
your existing browser — it does not download one). Generating **HTML** needs no
browser at all.

```bash
# 1. Get the code
git clone <your-repo-url> puzzleforge
cd puzzleforge
git checkout claude/prd-review-next-steps-6lkbbb

# 2. Install the engine
npm install

# 3. Try the CLI — HTML needs no browser; open the file to view it
node cli/index.js --type wordsearch --theme animals --difficulty 1 --html my-puzzle.html

# 4. Make a print-ready PDF (needs Chrome/Chromium/Edge installed)
node cli/index.js --type sudoku --difficulty 2 --answers --out sudoku.pdf

# 5. Build a whole book from a config file
node cli/index.js --book examples/puzzle-sampler.json --out sampler.pdf

# 6. Run the tests
npm test
```

Standard Chrome/Edge install locations are auto-detected on macOS, Windows, and
Linux. If yours isn't found, point the engine at it:

```bash
# macOS / Linux
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Windows (PowerShell)
$env:PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### Teacher web app

```bash
cd puzzleforge-web
npm install
npm start
# open http://localhost:4000
```

See [`puzzleforge-web/README.md`](./puzzleforge-web/README.md) for details.

## Status

**Phases 1–5 complete; content depth + Page Editor ongoing (96 tests passing).**
Implemented so far:

- Standard module interface (`generate / validate / solve / render`)
- Layout system for all four KDP trim sizes (`8x10`, `8.5x11`, `8.5x8.5`, `6x9`)
- **Twelve puzzle types**, each with Golden Standards validation and an
  independent solver/verifier:
  - **Word Search** — direction mix and word separation by difficulty
    (easy: words fully isolated; medium: no crossings; hard: dense crossings)
  - **Sudoku** — unique-solution guarantee, difficulty-calibrated givens
  - **Maze** — perfect maze (single solution), SVG render with solution path
  - **Cryptogram** — derangement cipher (no fixed points), decoder strip
  - **Word Scramble** — verified anagrams, optional hints
  - **Crossword** — themed interlock, numbered Across/Down clues
  - **Kriss-Kross** — fill-in grid with a length-grouped word bank
  - **Nonogram** (Picross) — picture-logic grid with a unique-solution guarantee
  - **Number Search** — hidden number sequences in a digit grid (shares the
    word-search core)
  - **Trivia** — numbered quiz questions with an answer key
  - **Logic Grid** — deduction puzzle; a constraint solver proves each clue set
    has exactly one solution, with natural-language clues
  - **Word Ladder** — change one letter at a time (start → end); built on a
    common-word graph with the minimum hints needed for a unique answer
- Four **activity page** types (no answer key): coloring, drawing,
  blank/bleed-guard, breather (quote/fact/divider)
- Non-bypassable offensive-language filter (applied to words, fill, and clues)
- Engine orchestration with a retry loop and solution verification
- Book assembly (`engine/book.js`): multi-puzzle ordering, page assignment,
  front/back matter, and a back-of-book answer key (per-page CSS scoped so mixed
  puzzle types never collide in the combined PDF)
- Puppeteer-based PDF export for both single puzzles and full books
- CLI for single-puzzle and full-book generation/export

- **Web app** (`puzzleforge-web/`): Puzzle Maker (accountless), Book Builder with
  **starter templates** + one-click KDP export bundle, Cover Builder, image tools
  (coloring / color-by-number / dot-to-dot), AI + manual theme generators, and a
  full **Page Editor** (MS-Publisher-style ribbon, master pages, two-page spreads,
  tables, break-apart puzzles, scannable **QR codes**, My Books library +
  autosave, and a self-hosted LAN team workspace).

Not yet built (later phases): more Tier 3 puzzle types (Riddles, Word Wheel, …),
the QR digital layer (hosted hint/answer landing pages — the placeable QR
foundation is done), and teacher-tool extras (worksheet builder, lesson packets).
See [`PRD.md`](./PRD.md) for the full roadmap.

## Architecture

Every puzzle follows the same lifecycle, orchestrated by the engine:

```
generate(config) → validate(puzzle) → solve(puzzle) → render(puzzle, layout)
```

A puzzle type is a folder under `generators/<type>/` exporting four functions.
Adding a type does not change the engine — register it in
`generators/registry.js`.

```
generators/<type>/
  index.js      generate()  → puzzle data + solution
  validator.js  validate()  → { valid, errors, warnings, score }
  solver.js     solve()     → independently verified answer key
  renderer.js   render()    → print-ready HTML for a given layout

engine/
  generate.js   retry loop; produces the Standard Puzzle Object
  export.js     Puppeteer PDF pipeline

layouts/        four KDP trim sizes + resolver
themes/         word lists (word + clue + difficulty) and loader
filters/        offensive.js (gate) + common-words.js
config/         engine defaults (retry policy, thresholds, difficulty presets)
cli/            single-puzzle CLI entry point
mcp/            Model Context Protocol server (exposes the engine as tools)
tests/          node:test suites
```

## Install

```bash
npm install
```

This installs `puppeteer-core` (PDF export drives an existing Chromium binary —
no browser download). Set `PUPPETEER_EXECUTABLE_PATH` if Chromium is not in a
standard location.

## CLI

```bash
# List built-in themes / registered puzzle types
node cli/index.js --list-themes
node cli/index.js --list-types

# Generate a themed word search and write print HTML (no Chromium needed)
node cli/index.js --type wordsearch --theme space --difficulty 2 --html space.html

# Generate from a custom word list and export a PDF with an answer-key page
node cli/index.js --type wordsearch --words cat,dog,fox,bear --size 12 \
  --trim 8x10 --answers --out puzzle.pdf

# Other single puzzles
node cli/index.js --type sudoku --difficulty 2 --answers --out sudoku.pdf
node cli/index.js --type maze --difficulty 3 --answers --out maze.pdf
node cli/index.js --type crossword --theme space --answers --out crossword.pdf
node cli/index.js --type cryptogram --difficulty 2 --out cryptogram.pdf
node cli/index.js --type logicgrid --difficulty 2 --answers --out logic.pdf
node cli/index.js --type wordladder --difficulty 2 --answers --out ladder.pdf

# Assemble and export a full book from a config file
node cli/index.js --book examples/animals-activity-book.json --out book.pdf
node cli/index.js --book examples/puzzle-sampler.json --out sampler.pdf
```

Run `node cli/index.js --help` for all options. See `examples/` for sample
book configs (a themed activity book and a seven-type sampler).

## Library

```js
const pf = require('puzzleforge-engine');

const theme = pf.loadTheme('animals');
const words = require('./themes').selectWords(theme, { maxDifficulty: 2 });

const puzzle = pf.generate({ type: 'wordsearch', theme: 'animals', words, difficulty: 1 });
await pf.exportPdf(puzzle, { outPath: 'animals.pdf', trimSize: '8x10', answerKey: true });
```

## MCP server

PuzzleForge ships an [MCP](https://modelcontextprotocol.io) server so any MCP
client — Claude Desktop, Cursor, or an agent — can drive the engine as tools. It
wraps the same functions as the CLI and web app, so results are identical.

```bash
npm run mcp        # stdio transport (or: node mcp/server.js)
```

**Tools:** `list_puzzle_types`, `list_themes`, `list_trim_sizes`,
`generate_puzzle`, `export_puzzle_pdf`, `assemble_book`, `export_book_pdf`.
The `*_pdf` tools need a Chromium binary (set `PUPPETEER_EXECUTABLE_PATH` if it
isn't auto-detected, or pass `executablePath`).

Register it with a client, e.g. Claude Desktop's `claude_desktop_config.json`
(or a project `.mcp.json`):

```json
{
  "mcpServers": {
    "puzzleforge": {
      "command": "node",
      "args": ["/absolute/path/to/puzzleforge/mcp/server.js"],
      "env": { "PUPPETEER_EXECUTABLE_PATH": "/path/to/chrome" }
    }
  }
}
```

Then ask the client things like *"generate a hard word ladder"* or *"assemble a
50-page large-print word search book and export the PDF."*

## Tests

```bash
npm test
```
