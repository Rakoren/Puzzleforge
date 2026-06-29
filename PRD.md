# PuzzleForge — Product Requirements Document

**Version:** 0.2 (Active Development)
**Status:** Publishable pipeline complete (interior + cover + KDP bundle) — content depth next
**Repo:** `rakoren/maze-books` · **Active branch:** `claude/prd-review-next-steps-6lkbbb`
**Stack:** Node.js engine + Chromium PDF pipeline + vanilla JS web app (Express)
**Author:** Rakoren

---

## Overview

PuzzleForge is a puzzle generation engine and print-ready PDF pipeline for self-publishing activity books on Amazon KDP, plus a free browser tool for teachers and creators. No accounts, no database — settings save as portable "recipe" JSON files.

Two use cases:
1. **KDP Publishing** — Generate complete puzzle books as print-ready PDFs for self-publishing. Target: passive income through puzzle book sales.
2. **Teacher Tool** — Free public web UI where educators generate custom puzzles, preview them, and print or download single-page PDFs.

---

## Repository

Single repo for now: `rakoren/maze-books`
Active branch: `claude/prd-review-next-steps-6lkbbb`

Planned split (future):
- `puzzleforge-engine` — core library, private repo
- `puzzleforge-web` — teacher UI, MIT license

---

## Target Audiences

| Audience | Use Case | Entry Point |
|---|---|---|
| Publisher (Rakoren) | Batch-generate full puzzle books for KDP | Web Book Builder + PDF export |
| Teachers / Educators | Generate custom single puzzles for students | Web UI |
| Parents / Homeschoolers | Custom activity pages | Web UI |

---

## Current Status — What's Built ✅

### Engine (45 tests passing)

**10 puzzle types** — all conforming to the standard `generate / validate / solve / render` module interface:

| Puzzle Type | Status |
|---|---|
| Word Search | ✅ Complete — offensive-aware fill, reliable |
| Number Search | ✅ Complete |
| Sudoku | ✅ Complete |
| Maze | ✅ Complete |
| Cryptogram | ✅ Complete |
| Word Scramble | ✅ Complete |
| Crossword | ✅ Complete — recalibrated acceptance thresholds |
| Kriss-Kross | ✅ Complete |
| Nonogram | ✅ Complete |
| Trivia / Quiz | ✅ Complete |

**4 activity page types** (no answer key):
- **Coloring** — seed-driven unique line art: mandala / shape-pattern / bubble-letter
- **Drawing** — framed blank + prompt (subject pulled from the puzzle's words, singularized, difficulty-matched)
- **Blank / bleed-guard** — blank page so markers don't bleed through (auto-inserted behind coloring/drawing pages by default)
- **Breather** — quote / fun fact / divider page between puzzle sets (adult books)

**Engine features:**
- Retry-until-valid generation
- Solver-verified answer keys
- Per-type quality thresholds
- Non-bypassable offensive content filter (offensive-aware fill + word-aware scan — fixed false positives on legit words like RACCOON, PEACOCK)

### Layout & Export System ✅

- **4 KDP trim sizes**: 8×10, 8.5×11, 8.5×8.5, 6×9 — all with correct margins and gutters
- **Book pipeline**: title page → puzzles → auto answer key → full-book PDF via Chromium

### Theme System ✅

- 9 built-in themes, ~1,275 clued words
- Words organized by **difficulty tiers** (easy / medium / hard) — level 1 puzzles never pull hard words
- Categories + tags, grouped in pickers
- **AI Theme Generator** — topic → Claude-written tiered clued word list **plus fun facts**, singular words, safety/dedup filtered before save, appears instantly in every picker
- **Manage themes** — re-run the filter over a saved theme ("Clean") or delete it
- **Tag filter / search** on theme pickers
- **Whole-category selection** — e.g. "All Animals & Nature" merges animals + ocean + weather into one pool
- **Mixed themes** fully supported — generator receives a merged word pool
- Theme files carry curated/AI **fun facts** used by breather pages

### Web App ✅

**Puzzle Maker:**
- Type / theme / difficulty picker
- Live preview
- PDF + answer key download
- Recipe save / load (.json)
- Differentiation sets (same puzzle at all 3 difficulty levels)
- Class sets (N varied versions, same words, re-randomized grids)
- Custom crossword clue editor

**Book Builder:**
- Visual multi-puzzle assembly, preview, full-book PDF export, recipe save / load
- **"No repeated words" toggle** — each theme word used once across a book, respects difficulty tiers
- **Shuffle puzzle order** — mix puzzle types instead of grouping by row (keeps fillers)
- **"Between puzzles, insert"** — drop coloring / drawing / blank page after each puzzle (with coloring style + after-last options)
- **Bleed-guard** — a blank page auto-inserted behind every coloring/drawing page (default on)
- **Breather pages** — quote / fun fact / divider between puzzle sets (theme-matched facts)
- **Front matter** — copyright, "this book belongs to", intro pages
- **Back matter** — about-the-author, more-books pages
- **Page numbers / footer** — optional, numbered from the first puzzle

**Cover Builder:**
- Full-wrap KDP cover (back + spine + front) sized from trim + page count + paper
- Title/subtitle/author, front/back/spine colors, optional full-bleed front image, back blurb, barcode keep-out box

**One-click KDP export:**
- Single zip: interior PDF + cover PDF (spine sized from the *actual* rendered page count) + build-info sheet

---

## Puzzle Types — Full Scope

### Tier 1 — Core ✅ All Complete
| Type | Status |
|---|---|
| Word Search | ✅ |
| Sudoku | ✅ |
| Crossword | ✅ |
| Maze | ✅ |

### Tier 2 — Strong Differentiators
| Type | Status |
|---|---|
| Cryptogram | ✅ |
| Word Scramble | ✅ |
| Kriss-Kross / Fill-In | ✅ |
| Number Search | ✅ |
| Trivia / Quiz | ✅ |
| Nonogram / Picross | ✅ |
| Logic Grid | 🔲 Not started |
| Dot-to-Dot | 🔲 Deferred (needs image assets) |

### Tier 3 — Niche / High Value
| Type | Status |
|---|---|
| Word Ladder | 🔲 Roadmap |
| Spot the Difference | 🔲 Roadmap |
| Sudoku Variants | 🔲 Roadmap |
| Math Puzzles | 🔲 Roadmap |
| Riddles | 🔲 Roadmap |
| Brain Teasers | 🔲 Roadmap |
| Word Wheel | 🔲 Roadmap |
| Cipher / Code Puzzles | 🔲 Roadmap |

### Tier 4 — Stretch Goals
| Type | Status |
|---|---|
| Kakuro | 🔲 |
| Futoshiki | 🔲 |
| Color-by-Number (image input → puzzle) | 🔲 Future — image processing pipeline (Sharp or Canvas API) |
| Hidden Pictures / Seek & Find | 🔲 Future — requires original artwork |
| Rebus Puzzles | 🔲 Future — requires image assets |

---

## Architecture

### The Puzzle Lifecycle

Every puzzle type follows the same lifecycle:

```
generate(config) → validate(puzzle) → solve(puzzle) → render(puzzle, layout)
```

The engine orchestrates this. Puzzle modules implement it. Nothing reaches the export pipeline without passing validation.

### Standard Puzzle Object

```js
{
  id: "uuid",
  type: "wordsearch",
  difficulty: 1 | 2 | 3,
  theme: "animals",
  title: "Animal Word Search",
  instructions: "Find all the hidden words...",
  data: { ... },        // type-specific puzzle data
  solution: { ... },    // type-specific solution data
  meta: {
    generatedAt: timestamp,
    attempts: 3,
    validationScore: 0.94,
    warnings: []
  }
}
```

### Standard Module Interface

```js
{
  generate(config)        → puzzle
  validate(puzzle)        → { valid: bool, errors: [], score: float }
  solve(puzzle)           → solution
  render(puzzle, layout)  → html
}
```

Adding a new puzzle type = new folder, same four exports. Engine doesn't change.

### Layout System

```js
{
  trimSize: "8x10",
  usableWidth: 680,
  usableHeight: 880,
  fontSize: 14,
  cellSize: 48,
  gutterPx: 72,
  audience: "kids" | "adult"
}
```

### KDP Specs

| Book Type | Trim Size |
|---|---|
| Adult puzzle (word search, crossword, sudoku) | 8.5 × 11" |
| Kids activity book (mixed puzzles) | 8 × 10" |
| Kids picture-book style | 8.5 × 8.5" |
| Compact / travel | 6 × 9" |

| Requirement | Value |
|---|---|
| Grid resolution | 300 DPI |
| Crossword cell numbers | 600 DPI |
| Gutter (inside margin) | 0.75" ≤150pp / 0.875" 151–300pp / 1.0" 300+pp |
| Outside margin | 0.625" |
| Top / bottom margins | 0.75" |
| Bleed | None (0.125" if decorative edges) |
| Minimum page count | 24 (50+ recommended) |

---

## Theming Strategy

Themes are **word lists only** — no visual assets. Visual presentation is handled by the layout system.

**Theme structure:**
```js
{
  id: "space",
  label: "Space",
  words: [
    { word: "ASTEROID", clue: "A rocky object orbiting the sun", difficulty: 2 },
    { word: "COMET", clue: "An icy body with a glowing tail", difficulty: 1 },
  ]
}
```

- Words carry a clue (for crossword/kriss-kross) and a difficulty rating
- Mixed themes fully supported — generator receives a merged pool
- Custom word lists supported in both CLI and web UI
- AI Theme Generator available — topic → tiered clued word list via Claude API

---

## Web Platform

### Business Model
Book generator revenue funds the project. Teacher tool is free permanently. No ads, no paywalls.

### Authentication
**None — accountless by design.** No logins, no backend user storage.

Future: Google sign-in via Clerk if saved libraries become a strong request.

### Save & Retrieve
- **PDF** — print-ready, download and print
- **Recipe file (.json)** — portable puzzle config, re-upload to regenerate or modify

Recipe files also serve as a share mechanism — teachers share with colleagues, post in forums.

### Teacher Tools

| Tool | Status |
|---|---|
| Single puzzle generator | ✅ |
| Book Builder | ✅ |
| Differentiation sets | ✅ |
| Class sets | ✅ |
| Answer key toggle | ✅ |
| Custom crossword clue editor | ✅ |
| Recipe save / load | ✅ |
| AI Theme Generator | ✅ |
| Worksheet builder (3–4 types, one page) | 🔲 Roadmap |
| Curriculum word list presets | 🔲 Roadmap |
| Theme editing UI (edit/delete saved themes) | 🔲 Roadmap |

### Hosting
Vercel free tier for v1.

---

## Deployment Strategy

PuzzleForge has two distinct deployments with different audiences and access levels.

### Public Deployment (`puzzleforge-web`)
- Hosted on Vercel free tier
- Teacher tool only — Puzzle Maker, single puzzle generator, recipe save/load
- No book builder, no cover builder, no ComfyUI integration
- MIT licensed, open source
- No auth required

### Private / Local Deployment (publisher tools)
- Runs locally on Rakoren's machine
- Full app — everything in the public deployment plus Book Builder, Cover Builder, ComfyUI border generation, KDP export bundle
- Not deployed publicly — never exposed to the internet
- The engine (`puzzleforge-engine`) stays private repo
- ComfyUI integration is local-only by design (`http://localhost:8188`)

### Why this split
The book builder is the commercial advantage. Keeping it local means:
- No hosting costs for the heavy PDF generation workload
- ComfyUI integration works naturally (same machine)
- No risk of competitors accessing the publisher pipeline
- Teacher tool stays fast and lightweight on Vercel

### Repo Structure (post-cleanup)

| Repo | Visibility | License | Contents |
|---|---|---|---|
| `puzzleforge-engine` | Private | None | Generators, validators, solvers, layout system, PDF export, book pipeline |
| `puzzleforge-web` | Public | MIT | Teacher UI only — Puzzle Maker, single puzzle preview, recipe save/load |
| `maze-books` | Archived | — | Original sandbox repo, preserved for reference |

---

## Border System

A toggle on every puzzle page and book-level settings. Book-level applies to all pages by default with per-puzzle override available in advanced settings.

### Toggle & Modes

```
[ ] Add page border
```

Expands to a style picker with four modes:

**None** — no border (default)

**Simple line** — clean geometric border
- Line style: single / double / dashed
- Color picker
- Thickness slider

**Themed** — decorative border matching the active theme
- Swatches of available border styles for the current theme auto-shown
- Auto-selects the matching theme border by default
- Built using the same SVG tile pipeline as custom borders — just ships with the theme

**Custom** — user-supplied SVG
- Upload SVG field
- Mode toggle: **Tile icon** (repeats around perimeter) or **Full border strip** (stretches/tiles as top/bottom/side strips)
- If tiling: tile size slider, spacing slider, rotation option (0° / 45° / 90°)
- If full strip: corner handling — auto-scale (default) / mirror / repeat
- Optional corner icon upload (separate SVG for corners)

### Corner Handling (Tiled Mode)

Auto-scale default — spacing adjusts so icons land evenly and corners always get a full icon. Optional corner icon upload for polished results.

### Scope

- **Book-level** (default) — same border on every page
- **Per-puzzle override** — available in advanced puzzle settings, hidden by default

### ComfyUI Integration (Publisher Only)

A "Generate with AI" button in the border picker — local publisher deployment only.

Opens a generation panel:
- Text prompt field (e.g. "cute space rockets and stars, black line art, white background")
- Style preset: line art / silhouette / detailed — maps to different ComfyUI workflows
- Aspect ratio locked to tile or strip depending on selected mode
- Generate → calls ComfyUI API at `http://localhost:8188` via PuzzleForge Express proxy
- Result previews inline → Accept drops it into the border upload slot

**Image format note:** ComfyUI outputs PNG. Pipeline:
- Full border strips: use PNG directly
- Tiles: run through Potrace (Node.js) to convert PNG → SVG for clean scalable output

### Themed Border Assets

Built-in themed borders ship as SVG tile sets alongside the theme word list. Created in ComfyUI and traced to SVG. Same rendering pipeline as custom uploads.

---

## Image Upload Features

All image processing uses **Sharp** (Node.js) — handles resize, edge detection, posterization, and compositing. Single dependency covers all image-based features.

### Image-to-Coloring Page

Separate tool from color-by-number. Converts an uploaded photo into a clean black-and-white coloring page.

**Pipeline:**
1. Optional background removal (toggle, default on — produces much cleaner results)
2. Edge detection + contrast boost + threshold to pure black and white
3. Output sized to match selected page size (uses same trim size dropdown as rest of UI)

**Best results with:** clear subjects with defined edges (animals, objects, simple scenes). Busy backgrounds should use background removal.

**UI:**
- Upload image
- Background removal toggle (default on)
- Page size dropdown (matches book trim size)
- Preview
- Download PDF

---

### Image-to-Color-by-Number Page

Separate tool. Converts an uploaded photo into a numbered region color-by-number puzzle with a color reference key.

**Pipeline:**
1. Optional background removal (toggle, default on)
2. Posterization — reduce image to N colors (user-selected)
3. Region detection — identify contiguous areas of each color
4. Number assignment — each color gets a number, regions get labeled
5. Color key rendered at bottom of page
6. Optional small reference image showing the finished result

**UI controls:**
- Upload image
- Background removal toggle (default on)
- Color count slider — user picks number of colors (range: 5–15, default: 8)
- Show reference image toggle (default on — small finished image in corner, ~20% page size, motivates kids to complete the puzzle and looks more professional)
- Page size dropdown (matches book trim size)
- Preview
- Download PDF

**Output:** numbered regions only as the main puzzle, color key at bottom, optional reference image in corner.

---

### Book Cover Generator

Produces a KDP-ready cover with three components: front, spine, back. Spine width is auto-calculated from page count using KDP's formula (0.0025" × page count for white paper).

**Front Cover:**
- Upload a full bleed image
- Title text field — rendered on top of image
- Author name text field — rendered on top of image
- Font picker
- Text color picker
- Text position (top / center / bottom)

**Back Cover:**
- Solid background color picker
- Book description text field (blurb)
- KDP barcode placeholder — white box auto-positioned at bottom right (KDP fills this at upload)
- Author name optional repeat

**Spine:**
- Width auto-calculated from page count (user inputs page count or it pulls from book recipe)
- Title + author name rendered as rotated text
- Background color picker (independent from back cover)

**Output:**
- Single stitched full-wrap PDF (front + spine + back as one file) — what KDP requires
- Correct dimensions based on trim size and page count

**UI:** separate Cover Builder tool, not part of the Book Builder flow. User builds the book first, notes the page count, then goes to Cover Builder.

---

## Filler Pages & Breather Pages

### Overview

Filler behavior is audience-aware and configurable via a progressive disclosure UI panel — simple toggle by default, expandable for full control.

### Kids Mode — Filler Pages

Inserted after **every individual puzzle**, including after the last puzzle. Kids end the book on a creative note. If they don't want to use it they can skip it — but it's there.

**Default behavior (toggle on):**
- Coloring page → Bleed guard after every puzzle
- Coloring page style: random
- Included after last puzzle: yes

**Expanded customization:**
- Which filler types to include: coloring page / drawing prompt / bleed guard (checkboxes)
- Coloring page style: random / mandala / shape-pattern / bubble-letter / rotate through all
- Filler order: coloring first vs bleed first
- Include after last puzzle: toggle (default on)

### Adult Mode — Breather Pages

Optional, off by default. Inserted between **puzzle sets** (e.g. between word search section and crossword section), not between every individual puzzle.

**Default behavior:** off

**When enabled, content options (checkboxes):**
- Quote (themed or general)
- Fun fact (themed or general)
- Decorative divider
- Blank page

**Theme-matched content toggle:** when on, quotes and fun facts are pulled from the book's active theme. A space book gets NASA facts and Carl Sagan quotes. This is a perceived premium quality differentiator.

**Not inserted after the last puzzle** — adults go straight to the answer key.

### Quote & Fun Fact Content Strategy

**Phase 1 — Curated database per theme:**
A small hand-curated set of quotes and fun facts per built-in theme, stored alongside the theme's word list. Fast, free, no API dependency. Each theme gets ~20 quotes and ~20 fun facts to start.

**Phase 2 — AI fallback (future):**
When the curated database runs dry or a custom/AI-generated theme has no curated content, fall back to generating quotes and fun facts via Claude API at book-build time. Adds variety at minimal cost.

### UI Pattern — Progressive Disclosure

The filler panel in Book Builder starts collapsed:

```
[ ] Add filler pages between puzzles
```

Toggling on reveals sensible defaults based on audience. A "customize" link expands the full options panel. This covers the majority of users with zero friction while giving power users full control.

---

## Offensive Language Filter ✅ Complete

Runs on all placed words, fill letters, user-supplied word lists, and clue text. Non-bypassable. Fixed false positives where legit words (RACCOON, PEACOCK) were triggering — now uses offensive-aware fill + word-aware scan.

---

## Implementation Roadmap

### ✅ Phase 1 — Foundation (Complete)
- Repo scaffolding
- Layout system (4 trim sizes)
- Word Search module
- Engine orchestration with retry loop
- Chromium PDF export pipeline
- Offensive content filter

### ✅ Phase 2 — Book Pipeline (Complete)
- Book assembly
- Answer key generation
- Full-book PDF export
- Sudoku, Maze, Crossword modules

### ✅ Phase 3 — Puzzle Type Expansion (Complete)
- Cryptogram, Word Scramble, Kriss-Kross, Number Search, Trivia, Nonogram

### ✅ Phase 4 — Web UI (Complete)
- Puzzle Maker
- Book Builder
- Live preview
- Recipe save/load
- Differentiation + class sets
- AI Theme Generator
- Tag filter, category merge, no-repeated-words, between-puzzle inserts

### ✅ Phase 5 — Path to First Publishable Book (Complete)
- ✅ Filler page logic — insert after every puzzle (with after-last option)
- ✅ Filler UI — coloring/drawing/blank inserts, coloring style, bleed-guard
- ✅ Curated quotes + fun facts — general + theme-matched (built-in and AI themes)
- ✅ Front/back matter — copyright, "belongs to", intro, about, more-books
- ✅ Cover Builder — full-wrap cover PDF, auto spine from page count
- ✅ One-click KDP export bundle — interior + cover + build-info, zipped

**Bonus polish shipped alongside Phase 5:**
- ✅ Optional page numbers / running footer
- ✅ Shuffle puzzle order (keeps fillers)
- ✅ Auto bleed-guard behind coloring/drawing pages
- ✅ AI themes generate fun facts; words forced singular
- ✅ Singular draw/coloring prompts at build time (no regen needed)
- ✅ Theme management — re-run filter ("Clean") + delete

**Remaining (manual, do at PC, ~1 hour): repo split/cleanup**
1. Checkout `claude/prd-review-next-steps-6lkbbb` locally
2. Identify file split — engine files vs web app files
3. Create `puzzleforge-engine` (new private repo) — clean initial commit, no maze-books history
4. Create `puzzleforge-web` (new public repo, MIT license) — clean initial commit
5. Archive `maze-books` repo

### 🟡 Phase 6 — Content Depth (in progress)
- ✅ Theme editing UI — delete, "Clean", and in-browser word/fact removal
- ✅ Per-book style/font presets + large-print "senior" mode
- ✅ AI category generator — one broad topic → several related themes saved under a shared category
- 🔲 More built-in themes (hand-authored)
- 🔲 (optional) edit clues / add words to an existing theme

### 🔲 Phase 7 — More Puzzle Variety
10. Word Ladder
11. Spot the Difference
12. Sudoku variants
13. Logic Grid

### ✅ Phase 8 — Image-Based Tools (complete)
14. ✅ Image-to-Coloring Page — Sharp + JS Sobel edge detector → black line art, detail
    & thickness controls, trim-sized PDF. (Semantic background removal deferred —
    needs an ML model; "detail" trades line count for cleanliness.)
15. ✅ ComfyUI Integration (publisher-only AI art) — *AI Art* page generates art from a
    text prompt via a local ComfyUI (`http://localhost:8188`, configurable via
    `COMFYUI_URL`/`COMFYUI_CKPT`). Style presets (line art / silhouette / detailed),
    checkpoint auto-listed from the server, size/steps/CFG/seed controls, PNG download.
    Express proxy (`/api/comfy/*`) builds a canonical txt2img workflow, submits it,
    polls `/history`, and returns the image. Degrades gracefully when ComfyUI is down.
    (Potrace PNG→SVG tracing for border tiles still deferred.)
16. ✅ Image-to-Color-by-Number — Sharp + JS k-means posterization → flat color regions,
    connected-component numbering, printed color key, optional on-page reference guide.
    Colors (4–24) and smoothing controls. Numbers snap to a pixel inside each region.
17. ✅ Dot-to-Dot — Sharp + JS: Otsu threshold + auto fore/background detection + largest
    blob, outer boundary sampled at evenly spaced angles around the centroid → ordered
    numbered dots. Dot count (12–120) + optional faint guide silhouette. (Polar sampling
    handles star-convex subjects well; contour-tracing for deep concavities is a future
    refinement.)

### 🔲 Phase 9 — Stretch Goals
18. AI fallback for quotes/fun facts when curated database runs dry
19. Hidden Pictures / Seek & Find (requires original artwork)
20. Color-by-Number as a bookable puzzle type (generate from theme-matched procedural art, no upload required)

---

## License Strategy

| Repo | License | Reason |
|---|---|---|
| `puzzleforge-engine` (future) | Private | Protects publishing advantage |
| `puzzleforge-web` (future) | MIT | Low risk, teacher community friendly |

Current single repo: no license assigned yet. Keep private until split.

---

## Open Questions

- [x] Color-by-number reference image — shipped as an optional small "color guide" below the page (toggle)
- [ ] Cover Builder — should it pull page count automatically from the book recipe, or manual entry?
- [ ] KDP metadata sheet — what fields does KDP actually require at upload? Research before Phase 5.
- [ ] Logic grid — AI-generated narrative/clues vs static database?
- [x] Dot-to-dot — shipped photo-traced (polar boundary sampling); curated SVG paths / contour tracing for concave shapes is a future refinement
- [ ] Recipe file versioning — needs a `version` field before any public release so future engine changes don't break saved files

---

*Last updated: 2026-06-28*
