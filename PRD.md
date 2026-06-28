# PuzzleForge — Product Requirements Document

**Version:** 0.1 (Draft)
**Status:** Pre-development
**Author:** Rakoren

---

## Overview

PuzzleForge is a puzzle generation engine and web platform designed to produce print-ready, publication-quality puzzle content at scale. It has two primary use cases:

1. **KDP Publishing** — Generate complete puzzle books exportable as print-ready PDFs for self-publishing on Amazon KDP and similar platforms. Target: passive income through puzzle book sales.

2. **Teacher Tool** — A public-facing web UI where educators can generate custom puzzles for their students, preview them, and print or download single-page PDFs.

---

## Repository Structure

PuzzleForge is split into two repositories:

### `puzzleforge-engine`
The core library. Contains all puzzle generators, validators, solvers, layout system, and PDF export pipeline. Also includes the CLI for batch book generation. Has no UI dependencies — it is a pure Node.js library and CLI tool.

### `puzzleforge-web`
The teacher-facing web application. Imports `puzzleforge-engine` as a local package. Handles UI, single-puzzle preview, and single-page print/download. No puzzle logic lives here.

---

## Target Audiences

| Audience | Use Case | Entry Point |
|---|---|---|
| Publisher (Rakoren) | Batch-generate full puzzle books for KDP | CLI |
| Teachers / Educators | Generate custom single puzzles for students | Web UI |
| Parents / Homeschoolers | Custom activity pages | Web UI |

---

## Puzzle Types

Puzzle types are prioritized by publishability, generator complexity, and market demand. Each type will be implemented as a standalone module conforming to the standard module interface.

### Tier 1 — Core (implement first)
These appear in nearly every activity book and have strong, consistent sales.

| Type | Notes |
|---|---|
| Word Search | Entry point module; most prior art from maze-books repo |
| Sudoku | Numbers only; highly algorithmic; high volume potential |
| Crossword | Complex generator; prior art exists; needs Golden Standards compliance |
| Maze | Visual; essential for kids books; path generation algorithm |

### Tier 2 — Strong Differentiators (implement second)
These expand the book catalog and increase per-book variety.

| Type | Notes |
|---|---|
| Cryptogram | Encode a quote via substitution cipher; decode to solve |
| Word Scramble | Anagram each word in a themed list |
| Kriss-Kross / Fill-In | Given all the words, place them in a blank crossword grid |
| Number Search | Word search variant using number sequences; popular with seniors |
| Logic Grid | "Who owns the cat?" deduction grids; Murdle-style; trending |
| Dot-to-Dot | Connect numbered dots to reveal an image; kids staple |
| Trivia / Quiz | Q&A pages with answer key; minimal generation complexity |

### Tier 3 — Niche / High Value (implement third)
Viable standalone book types for specific audiences.

| Type | Notes |
|---|---|
| Nonogram / Picross | Logic grid that reveals a pixel image; dedicated fanbase |
| Word Ladder | Change one letter at a time from word A to word B |
| Anagram Puzzles | Unscramble a themed set of words |
| Riddles | Text only; trivial to generate from a database |
| Math Puzzles | Addition/subtraction grids, magic squares; good for kids |
| Rebus Puzzles | Picture + letter combos spelling a word/phrase |
| Cipher / Code Puzzles | Full substitution alphabet puzzles beyond basic cryptogram |
| Brain Teasers | Lateral thinking questions with explanatory answers |
| Word Wheel | Circular letter arrangement; find all words using center letter |

### Tier 4 — Stretch Goals
| Type | Notes |
|---|---|
| Kakuro | Crossword-style with math sums; complex generator |
| Futoshiki | Number placement with inequality constraints |
| Hanjie | Alternate nonogram format |

---

## Architecture

### The Puzzle Lifecycle

Every puzzle type, regardless of complexity, follows the same lifecycle:

```
generate(config) → validate(puzzle) → solve(puzzle) → render(puzzle, layout)
```

The engine orchestrates this lifecycle. Puzzle modules implement it. Nothing reaches the export pipeline unless it has passed validation.

### Standard Puzzle Object

Every generated puzzle produces an object with this shape:

```js
{
  id: "uuid",
  type: "wordsearch",           // puzzle type identifier
  difficulty: 1 | 2 | 3,
  theme: "animals",             // optional
  title: "Animal Word Search",
  instructions: "Find all the hidden words...",

  data: { ... },                // type-specific puzzle data (grid, clues, etc.)
  solution: { ... },            // type-specific solution data

  meta: {
    generatedAt: timestamp,
    attempts: 3,                // how many generation attempts before valid
    validationScore: 0.94,      // quality score 0–1
    warnings: []                // non-fatal issues flagged during validation
  }
}
```

`data` and `solution` are type-specific. The outer shape is always identical.

### Standard Module Interface

Every puzzle type lives in `generators/<type>/` and exports four functions:

```js
{
  generate(config)     → puzzle       // produces a puzzle object
  validate(puzzle)     → result       // { valid: bool, errors: [], score: float }
  solve(puzzle)        → solution     // returns solution data for answer key
  render(puzzle, layout) → html       // produces print-ready HTML for this layout
}
```

Adding a new puzzle type = adding a new folder that exports these four functions. The engine does not need to change.

### Engine Modules

**`engine/generate.js`**
Calls `module.generate` then `module.validate`. Retries up to `MAX_ATTEMPTS` on validation failure. Throws with a descriptive reason if all attempts fail. The caller always receives a valid puzzle or a clear error — never a silently broken one.

**`engine/book.js`**
Assembles a sequence of puzzles into a book object. Handles ordering, page assignment, answer key section placement, and front/back matter.

**`engine/export.js`**
Puppeteer-based PDF export pipeline. Receives a book object and a layout config. Renders each puzzle's HTML into a headless Chrome instance and exports a single print-ready PDF at the target trim size and resolution.

### Layout System

A layout is a computed set of rendering constraints passed to every `render()` call:

```js
{
  trimSize: "8x10",
  usableWidth: 680,      // px
  usableHeight: 880,
  fontSize: 14,          // base font size; scales with audience
  cellSize: 48,          // grid cell px; computed from usableWidth / gridSize
  gutterPx: 72,
  audience: "kids" | "adult"
}
```

Layout configs live in `layouts/`. The engine selects the correct layout based on book config. Puzzle renderers use these values — they do not hardcode dimensions.

### Config System

**Book-level config:**
```js
{
  title: "Animals Activity Book",
  audience: "kids",
  trimSize: "8x10",
  theme: "animals",
  pageCount: 50,

  puzzles: [
    { type: "wordsearch", count: 10, difficulty: 1 },
    { type: "maze", count: 8, difficulty: "1-2" },
    { type: "sudoku", count: 5, difficulty: 1 },
    { type: "crossword", count: 3, difficulty: 2 }
  ]
}
```

**Puzzle-level config** (per generator, passed via `generate(config)`):
Type-specific options such as grid size, word list, theme, direction constraints, etc.

---

## KDP Publishing Specs

### Trim Sizes by Book Type

| Book Type | Trim Size | Notes |
|---|---|---|
| Adult puzzle (word search, crossword, sudoku) | **8.5 × 11"** | Industry standard; 92% of top sellers |
| Kids activity book (mixed puzzles) | **8 × 10"** | Best balance of space and print cost |
| Kids picture-book style | **8.5 × 8.5"** | Square format; familiar for young children |
| Compact / travel | **6 × 9"** | Pocket size; coat-pocket friendly |

### PDF Spec Requirements

| Requirement | Value |
|---|---|
| Grid / body text resolution | 300 DPI |
| Crossword cell numbers | 600 DPI |
| Fonts | Arial, Helvetica, Open Sans, Roboto (no decorative fonts) |
| Gutter (inside margin) | 0.75" for ≤150 pages; 0.875" for 151–300 pages; 1.0" for 300+ |
| Outside margin | 0.625" |
| Top / bottom margins | 0.75" |
| Bleed | None (unless decorative edge elements; then 0.125" all sides) |
| Answer key | Required; placed at back of book |
| Minimum page count | 24 pages (KDP minimum); 50+ recommended for perceived value |

### Recommended Book Volumes

| Type | Puzzle Count | Page Count |
|---|---|---|
| Word Search | 50–100 | 100–200 |
| Crossword | 50–80 | 100–160 |
| Sudoku | 100–300 | 100–300 |
| Mixed Activity (kids) | 50–80 mixed | 80–150 |

---

## Quality Standards ("Golden Standards")

Every puzzle type must pass its validator before it can be rendered or exported. Validation returns a score (0–1) and a list of errors/warnings.

### Universal Rules (all puzzle types)
- No puzzle is exported without passing validation
- Generator retries up to `MAX_ATTEMPTS` (configurable; default 10) before throwing
- Validation score must meet the type's minimum threshold
- Solution must be verified by the solver before export — not just trusted from the generator
- Offensive content filter applied to all text content

### Word Search Specific
- All words must be placed and findable by the solver
- No duplicate words in the grid
- Grid fully filled — no empty cells
- Direction mix matches difficulty level (level 1: H/V only; level 2: + diagonals; level 3: + backwards)
- Minimum word length: 3 characters
- No word is an accidental substring of another placed word
- Buffer zones between word endpoints prevent unintended adjacencies
- Fill letters scanned for accidental common words (configurable threshold)

### Sudoku Specific
- Exactly one valid solution — verified by solver
- Minimum given clues per difficulty (easy: ~36, medium: ~28, hard: ~22)
- No naked singles filling the entire puzzle at easy difficulty

### Crossword Specific
- Single connected component (no isolated word islands)
- Rotational symmetry (180°) — publishing convention
- No unchecked squares (every letter must be part of both an across and a down word)
- No duplicate words
- No isolated single-letter fills
- Intersection density appropriate for difficulty
- All clues present and non-empty
- Grid fully solvable from clues — verified by solver

### Maze Specific
- Exactly one solution path (or configurable: one primary + dead ends)
- Start and end are reachable
- No inaccessible regions
- Difficulty correlates to path length and dead-end density

---

## Folder Structure

### `puzzleforge-engine`
```
puzzleforge-engine/
  generators/
    wordsearch/
      index.js         ← generate()
      validator.js     ← validate()
      solver.js        ← solve()
      renderer.js      ← render()
    sudoku/
    crossword/
    maze/
    cryptogram/
    wordscrumble/
    krisscross/
    logicgrid/
    ...

  engine/
    generate.js        ← retry loop, orchestrates module lifecycle
    book.js            ← assembles puzzles into a book object
    export.js          ← Puppeteer PDF pipeline

  layouts/
    8x10.js
    8.5x11.js
    8.5x8.5.js
    6x9.js

  themes/
    animals.json
    space.json
    fruits.json
    ocean.json
    sports.json
    ...

  config/
    defaults.js        ← difficulty defaults, font scales, audience presets

  filters/
    offensive.js       ← blocked word list
    common-words.js    ← fill validation word list

  cli/
    index.js           ← batch book generation entry point

  tests/
    wordsearch.test.js
    sudoku.test.js
    crossword.test.js
    ...
```

### `puzzleforge-web`
```
puzzleforge-web/
  src/
    components/
      PuzzlePreview.jsx
      PuzzleConfig.jsx
      ThemePicker.jsx
      PrintButton.jsx
    pages/
      index.jsx        ← landing / puzzle picker
      generate.jsx     ← config UI + live preview
    lib/
      engine.js        ← thin wrapper importing puzzleforge-engine
  public/
  package.json
```

---

## Implementation Order

### Phase 1 — Foundation
1. Repo scaffolding (both repos, package.json, folder structure)
2. Layout system (all 4 trim sizes)
3. Word Search module (generate → validate → solve → render)
4. Engine orchestration (generate.js with retry loop)
5. Puppeteer export pipeline (single puzzle → PDF)
6. CLI: single puzzle export

### Phase 2 — Book Pipeline
7. `engine/book.js` — assembles multiple puzzles
8. Answer key generation
9. Front matter / back matter templates
10. CLI: full book export from config file
11. Sudoku module

### Phase 3 — More Puzzle Types
12. Maze
13. Crossword (port + upgrade from maze-books)
14. Cryptogram
15. Word Scramble
16. Kriss-Kross

### Phase 4 — Web UI
17. `puzzleforge-web` scaffolding
18. Single-puzzle generator UI
19. Live preview
20. Single-page print/PDF download

### Phase 5 — Expansion
21. Logic Grid
22. Nonogram
23. Dot-to-Dot
24. Remaining Tier 2/3 types
25. Theme expansion

---

## Web Platform (`puzzleforge-web`)

### Business Model

The book generator (CLI) funds the project. Revenue from KDP puzzle book sales covers hosting and operating costs. The teacher web tool is free, permanently. No ads, no paywalls, no freemium tiers.

### Authentication

**None — v1 is accountless.**

No logins, no profiles, no backend user storage. Teachers interact with the site, generate puzzles, and save their work locally. This eliminates auth complexity, privacy obligations, and maintenance overhead entirely.

If saved puzzle libraries become a strong user request in the future, Google sign-in via Clerk can be added in v2 with minimal architectural change. There is no plan to verify teacher identity — the tool is positioned for teachers but open to anyone making puzzles for kids.

### Save & Retrieve (Option A — Local Save)

After generating a puzzle the user receives two download options:

- **PDF** — print-ready single page, ready to hand to students
- **Recipe file (.json)** — the puzzle config (word list, theme, difficulty, grid size, title, instructions). Saved locally by the teacher.

To regenerate or modify a puzzle later, the teacher re-uploads their recipe file. The engine re-generates from that config. The grid will be re-randomized but all their customizations (words, title, clues) are preserved.

This also serves as a natural **share mechanism** — teachers can share recipe files with colleagues, post them in teacher forums, or upload them to curriculum sharing sites. Each shared recipe is implicit marketing for PuzzleForge.

### Teacher Tools

All tools use the same puzzle engine. No separate logic required.

| Tool | Description |
|---|---|
| **Single puzzle generator** | Core feature — configure and generate any puzzle type, preview, download PDF + recipe |
| **Worksheet builder** | Combine 3–4 puzzle types around one theme into a single printable page |
| **Differentiation mode** | Generate the same puzzle at all three difficulty levels simultaneously for tiered classrooms |
| **Class set export** | Generate N slightly-varied versions of the same puzzle (re-randomized grids, same words) so students can't copy — huge practical value, trivial for the engine |
| **Answer key toggle** | Print with or without answer key — separate PDF downloads |
| **Custom clue editor** | For crosswords — teacher writes their own clues instead of theme defaults, tying the puzzle to their actual curriculum |
| **Curriculum word lists** | Prebuilt themed word lists around common curriculum topics (US states, multiplication vocabulary, human body, planets, etc.) so teachers can generate without typing anything |

### Hosting

Vercel (free tier) for v1. Handles the web UI with no cost until traffic warrants an upgrade. The engine runs entirely client-side or as lightweight serverless functions — no persistent server required for Option A.

---



Themes are **word lists only** — no visual assets, no decorative page borders, no imagery tied to themes. A "space" theme is simply a curated word list with associated crossword clues. Visual presentation is handled entirely by the layout system and is consistent across all themes.

**Theme structure:**
```js
{
  id: "space",
  label: "Space",
  words: [
    { word: "ASTEROID", clue: "A rocky object orbiting the sun", difficulty: 2 },
    { word: "COMET", clue: "An icy body with a glowing tail", difficulty: 1 },
    ...
  ]
}
```

Each word carries a clue (for crossword/kriss-kross use) and a difficulty rating (so generators can filter by level).

**Mixed themes:** Fully supported. A book or single puzzle can draw from multiple theme word lists. The generator receives a merged word pool and selects from it based on difficulty and length requirements.

**Custom word lists:** Both the CLI and web UI support user-supplied word lists, bypassing the built-in themes entirely. This is the core teacher tool feature.

---

## Image-Dependent Puzzle Types

The following puzzle types require image assets and are **deferred to a later phase:**

- Hidden Pictures / Seek & Find
- Rebus Puzzles
- Dot-to-Dot (requires path data for the reveal image)

**Future: Color-by-Number / Picture Simplification Generator**
A planned feature that takes an uploaded image and:
1. Simplifies it into flat regions using edge detection / posterization
2. Assigns a number to each color region
3. Outputs a printable color-by-number puzzle page

This is a standalone generator module with its own image processing pipeline (likely using Canvas API or Sharp). Architecture is compatible — it will conform to the standard module interface when implemented. Flagged as a stretch goal.

**Future: Theme-Shaped (Silhouette) Coloring Pages**
An evolution of the procedural `coloring` page type. Today the coloring generator produces seed-driven, infinitely-varied geometric line art in three styles (mandala, shape-pattern, bubble-letter). The next step is **subject-shaped** coloring art: a mandala or pattern fill clipped to the outline of the page's theme — e.g. a cat-shaped or fish-shaped mandala for an animals book, tied to the same "word to find" the drawing/bubble pages already use.

Two implementation paths (not mutually exclusive):
1. **Curated SVG silhouettes** — a small library of clean outline shapes per theme. The procedural fill (mandala rings / shape pattern) is clipped inside the silhouette via an SVG `clipPath`. Reliable and offline; cost is sourcing/drawing the outlines.
2. **AI-generated line art** — reuse the planned ComfyUI pipeline (prompt → black line art → Potrace → SVG) to produce the silhouette on demand, then fill it the same way.

Compatible with the existing module interface — it's an additional coloring `style`, selectable in the Book Builder like mandala/pattern/bubble. Flagged as a stretch goal alongside the image tools.

---

## Offensive Language Filter

**Priority: Implement in Phase 1, before any puzzle ships.**

The filter runs on:
- All placed words in word search and crossword grids
- All fill letters in word search (scanned for accidental word formation)
- All user-supplied custom word lists (input sanitization)
- All clue text

**Implementation approach:**
Use the `bad-words` npm package as the base filter (maintained, configurable, widely used). Supplement with a custom blocklist for puzzle-specific edge cases (short words that appear accidentally in fill, e.g. common 3-letter slurs that a general filter might miss in a grid context).

The filter lives in `filters/offensive.js` and is imported by every generator's validator. It is not optional and cannot be bypassed by config.

---

## License Strategy

PuzzleForge has two components with different licensing needs.

### Why licensing matters
A license tells anyone who finds your code what they can and can't do with it. Without a license, copyright law defaults to "all rights reserved" — nobody can legally use or contribute to your code. With the wrong license, you could accidentally let competitors freely use your engine to publish their own puzzle books.

### The two repos have different goals

**`puzzleforge-engine` — keep it private or source-available**

This is your competitive advantage. The generator quality, the Golden Standards implementation, the export pipeline — this is what makes your books better than the generic KDP puzzle book noise. You don't want a competitor cloning it and flooding Amazon with the same output.

Options:
- **Private repo** (simplest) — code never public, nobody sees it, no license needed. Fine if you never want community contributions.
- **Business Source License (BUSL)** — code is visible on GitHub but commercial use is restricted. Converts to open source after a set period (e.g. 4 years). Used by HashiCorp, MariaDB. Good if you want transparency without giving it away.
- **Proprietary / All Rights Reserved** — public repo, visible code, but explicitly no reuse rights. Rare but valid if you want people to see the work without being able to use it.

**Recommendation: Private repo for now.** You can always open it later. You can't un-open it.

**`puzzleforge-web` — MIT is fine**

The teacher tool UI has no competitive moat. It's a form that calls your engine. Making it MIT (fully open, anyone can use/fork/modify) costs you nothing and could get you contributions or goodwill from the teacher community. It also makes it easier to deploy on free hosting tiers.

### Summary

| Repo | Recommended License | Reason |
|---|---|---|
| `puzzleforge-engine` | Private (no license) | Protects your publishing advantage |
| `puzzleforge-web` | MIT | Low risk, community-friendly |

You can revisit engine licensing once you're established. Plenty of successful tool makers start private and open source once the business is stable enough that giving the code away doesn't hurt.

---

## Open Questions

- [ ] Color-by-number image processing library — Sharp (Node.js) vs Canvas API — decide when scoping that feature
- [ ] Crossword clue database depth — built-in themed clues only, or integrate an external clue API for broader coverage?
- [ ] Sudoku difficulty calibration — define exact given-count ranges per difficulty level before implementing
- [ ] Logic grid puzzles — generate narrative/clues via AI assist, or from a static database?
- [ ] Recipe file format — finalize schema before v1 ships so saved files don't break on future engine updates. Needs a version field.

---

*Last updated: 2026-06-27*
