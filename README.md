# PuzzleForge Engine

The core puzzle generation engine and print-ready PDF export pipeline behind
PuzzleForge. Pure Node.js library + CLI — no UI dependencies. The teacher-facing
web app (`puzzleforge-web`) will live in a separate repository and import this
package.

See [`PRD.md`](./PRD.md) for the full product spec.

## Status

**Phase 1 — Foundation (in progress).** Implemented so far:

- Standard module interface (`generate / validate / solve / render`)
- Layout system for all four KDP trim sizes (`8x10`, `8.5x11`, `8.5x8.5`, `6x9`)
- Word Search module with Golden Standards validation and an independent solver
- Non-bypassable offensive-language filter (applied to words, fill, and clues)
- Engine orchestration with a retry loop and solution verification
- Puppeteer-based single-puzzle PDF export
- CLI for single-puzzle generation and export

Not yet built (later phases): book assembly (`engine/book.js`), additional
puzzle types (Sudoku, Maze, Crossword, …), and the web UI.

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
```

Run `node cli/index.js --help` for all options.

## Library

```js
const pf = require('puzzleforge-engine');

const theme = pf.loadTheme('animals');
const words = require('./themes').selectWords(theme, { maxDifficulty: 2 });

const puzzle = pf.generate({ type: 'wordsearch', theme: 'animals', words, difficulty: 1 });
await pf.exportPdf(puzzle, { outPath: 'animals.pdf', trimSize: '8x10', answerKey: true });
```

## Tests

```bash
npm test
```
