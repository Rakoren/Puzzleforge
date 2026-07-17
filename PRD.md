# PuzzleForge — Product Requirements Document

**Version:** 0.3 (Active Development)
**Status:** Publishable pipeline complete (interior + cover + KDP bundle); Page Editor now a full desktop-publishing app (ribbons, master pages, spreads, tables, team workspace) with **Publisher-parity contextual ribbons** (Shape Format / Table Design / Table Layout / Picture Format / QR Code / Text Box) and their tools — interactive crop, linked text-box flow, advanced OpenType typography, picture compress/swap, **Fit-to-margins**, and **Ctrl/Cmd + rubber-band multi-select**; the **QR digital layer** is live (hosted interactive hint / answer landing pages + end-of-book celebration, self-serve from the Book Builder); the app wears the **Nova Form Studios design system with dark mode**; Tier 3 puzzle types (Logic Grid, Word Ladder, Word Wheel, Cipher); KDP-verified pre-flight export gate live
**Last full docs sync:** 2026-07-16
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

### Engine (180 tests passing)

**20 puzzle types** — all conforming to the standard `generate / validate / solve / render` module interface:

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
| Riddles | ✅ Complete — family-friendly "what am I?" bank, 4 tiers, answer key |
| Brain Teasers | ✅ Complete — logic/math/word/lateral bank tagged by kind, explained answer key |
| Math Puzzles | ✅ Complete — self-checking missing-number equations + number sequences |
| X-Sudoku | ✅ Complete — diagonal sudoku, unique-solution guaranteed (diagonal-aware solver) |
| Mini Sudoku | ✅ Complete — gentler 6×6 grid, 2×3 boxes, digits 1–6, unique solution |
| Even-Odd Sudoku | ✅ Complete — 9×9 with parity shading (shaded even / plain odd), constraint enforced during dig |
| Logic Grid | ✅ Complete — constraint-solver-proven unique solutions, natural-language clues (Tier 2 now 12/12) |
| Word Ladder | ✅ Complete — common-word graph, minimal-hint unique solutions (Tier 3 started) |
| Word Wheel | ✅ Complete — 9-letter source, baked common-word dictionary, full findable-word key |
| Cipher | ✅ Complete — Caesar / Atbash / A1Z26 / Morse, decoder verified round-trip |

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

### Difficulty System ✅

Internal engine levels are **1–4**, but **kids and adults are two separate ladders — not one ladder with two labels.** `config/difficulty.js` is the single source of truth for the labels; `config/defaults.js` (`DIFFICULTY` + `KIDS_DIFFICULTY`, resolved by `presetFor(type, level, audience)`) is the source of truth for the **mechanics**. A kids "Independent" (L4) puzzle is deliberately far gentler than an adult "Expert" (L4).

| Level | Adult label | Kids label | Ages | Grade |
|---|---|---|---|---|
| 1 | Easy | Beginner | 4–6 | Pre-K – K |
| 2 | Medium | Early Reader | 6–8 | Grades 1–2 |
| 3 | Hard | Growing Reader | 8–10 | Grades 3–4 |
| 4 | **Expert** | Independent | 10–12 | Grades 5–6 |

**The two ladders are mechanically distinct** (verified in `tests/difficulty-ladder.test.js`):

| | Adult ramp (L1→L4) | Kids ramp (Beginner→Independent) |
|---|---|---|
| Word search grid | 10×10 → **20×20**, diagonal + backwards + *dense* (crossing) | 7×7 → **13×13**, never dense; backwards only at the very top tier |
| Maze grid | 10×10 → **25×33** | 7×7 → **13×17** (kids top ≈ adult Easy–Medium) |
| Theme vocabulary | exact tier per level (L4 → tier 4, the hardest) | easier tiers only (never tier 4), each capped ≤5 / ≤6 / ≤7 / ≤8 letters — hand-typed words are never dropped |
| Sudoku | 9×9, digs to ~20 givens at Expert | **not offered below Growing Reader (8–10)**; 9×9 with heavy givens (~43 / ~37) for the two older tiers |
| Cipher | Morse by Hard; key hidden from Hard | **never Morse**; Caesar key stays shown until the top tier |

- **Expert (level 4, adults)** added across every playable type: Word Search 20×20+ (tier `minSize` floor), Sudoku digs deeper by dropping 180° symmetry, Maze 25×33. Nonogram Expert stays 15×15 (a 20×20 unique-solution search costs ~8s/puzzle).
- **Audience threads into generation**, not just labels: `book.js` passes `audience` to every puzzle so `presetFor` picks the right ladder; the word-length cap and gentler presets apply automatically. Requesting a kids sudoku below Growing Reader throws a clear, actionable error rather than silently making an age-inappropriate puzzle.
- **Audience-aware labels in the UI** — the Kids/Adult toggle swaps the label set; the internal value never changes. Puzzle Maker shows age + grade; the Book Builder shows both sets with cross-tier ranges (e.g. Hard–Expert / Beginner–Growing Reader).
- Kids vocabulary targets these Lexile bands: Beginner BR–200L, Early Reader 200–500L, Growing Reader 500–820L, Independent 820–1100L (the per-tier length cap is the concrete enforcement today; full Lexile scoring is future work).
- **Publish Checklist** flags when the audience is unset or the listing's reading age contradicts it (e.g. a Kids book tagged "Adult").

**Displaying difficulty** (all off a shared descriptor — `config/difficulty.js` `summarizeLevels` + `book.meta.difficulty`; levels are known by construction, not estimated):
- **Per-page label** — optional badge printed in the top-right of each puzzle page (adults: ★-rating + label; kids: tier + age). Toggle in the Book Builder ("Label each page with its difficulty"); injected in `engine/export.js` like the border overlay so it prints vector-sharp.
- **Book difficulty summary** — the range + per-level spread ("Easy to Hard — Easy 4 · Medium 6 · Hard 2") shown live in the Book Builder summary and as an info row in the Publish Checklist.
- **Cover difficulty text** — an optional line on the front cover ("Easy to Hard · Large Print") for Amazon discoverability; a field in the Cover Builder.

### Layout & Export System ✅

- **4 KDP trim sizes**: 8×10, 8.5×11, 8.5×8.5, 6×9 — all with correct margins and gutters
- **Book pipeline**: title page → puzzles → auto answer key → full-book PDF via Chromium

### Theme System ✅

- 9 built-in themes, ~1,275 clued words
- Words organized by **four difficulty tiers** (Easy / Medium / Hard / **Expert**), matching the engine's four levels — a level-1 puzzle never pulls a tier-3 word, and adult **Expert (level 4)** pulls a genuinely harder tier than Hard (the built-ins' hardest vocabulary was split into Hard + Expert).
- **Audience-aware selection** — each theme carries an `audiences` field, and the word pull is audience-aware (`engine/book.js` `themeTierOpts`): adults draw the exact tier for the level (Expert → tier 4); kids draw the easier tiers with a per-tier word-length cap and **never** reach the hardest tier. Same theme, age-appropriate vocabulary for each audience.
- **AI Theme Generator** — topic + **audience** (Kids / Adults / Both) → Claude-written four-tier clued word list **plus fun facts**, vocabulary + clue reading-level calibrated to the audience, singular words, safety/dedup filtered before save, appears instantly in every picker
- **AI "Expand" (top-up)** — grow an existing theme in place: feeds Claude the words already present, asks for brand-new ones per level up to a target (default 40/level), then sanitizes, de-dupes, and merges them (facts/label/category/audience preserved). Respects the theme's audience ramp and reports when a topic is tapped out. This is the fix for word variety: a bigger pool lets "No repeated words" build several same-tier puzzles without reusing words. Available on each theme's manage row and inside the editor.
- **Word-search-safe word lists** — a word search rejects any target that is a substring of another (e.g. CONTROL inside CONTROLPAD). Selection de-dupes substrings within a draw *and* across the top-up refill draw, and Expand won't add a colliding word — so a themed book always builds.
- **Manual theme builder** and **Manage themes** — build a four-tier theme by hand (with an audience), re-run the filter over a saved theme ("Clean"), or delete it
- **Tag filter / search** on theme pickers
- **Whole-category selection** — e.g. "All Animals & Nature" merges animals + ocean + weather into one pool
- **Per-standard curriculum word banks** — puzzle-friendly, standards-tagged vocabulary sets (Dolch Sight-Word Nouns, Dolch Sight Words, Number Words) in a "Curriculum & Sight Words" category. Each theme carries a `standard` (CCSS code) that shows in the pickers and prefills worksheet/packet covers. Being ordinary themes, they flow through every puzzle type, book assembly, and the worksheet/packet tools.
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
- **"No repeated words" toggle** — each theme word used once across a book, respects difficulty tiers. A **low word-pool warning** flags *before* generating when the puzzles would need more unique words at some difficulty band than the theme has (e.g. "4 puzzles need ~56 words but Animals has 42 — 14 will repeat"), pointing at the fixes: Expand the theme, pick the merged "★ All …" category, fewer puzzles, or turn the toggle off. `engine/book.js` `analyzeWordPool` via `POST /api/book/wordpool`.
- **Shuffle puzzle order** — mix puzzle types instead of grouping by row (keeps fillers)
- **"Between puzzles, insert"** — drop coloring / drawing / blank page after each puzzle (with coloring style + after-last options)
- **Bleed-guard** — a blank page auto-inserted behind every coloring/drawing page (default on)
- **Breather pages** — quote / fun fact / divider between puzzle sets (theme-matched facts)
- **Front matter** — copyright, "this book belongs to", intro pages
- **Back matter** — about-the-author, more-books pages
- **Page numbers / footer** — optional, numbered from the first puzzle
- **Difficulty curve** — controls how difficulty is distributed across the book: Flat (all same level) / Easy-to-Hard (ramps up) / Hard-to-Easy (ramps down) / Mixed (randomized). Makes books feel intentional and well-designed rather than arbitrarily ordered.

**Cover Builder:**
- Full-wrap KDP cover (back + spine + front) sized from trim + page count + paper
- Title/subtitle/author, front/back/spine colors, optional full-bleed front image, back blurb, barcode keep-out box

**One-click KDP export:**
- Single zip: interior PDF + cover PDF (spine sized from the *actual* rendered page count) + build-info sheet

**Starter book templates:**
- "Start from a template" gallery in the Book Builder — six ready-to-publish books (Large-Print Senior Word Search, Kids Animal Activity Book, Travel Pocket Puzzles, Sudoku Workout, Brain Training Variety, Coffee Break Crosswords), each a full config (puzzle mix + trim + cover colors + KDP metadata) that drops into the builder and is editable from there. Zero-to-book on-ramp.

**Worksheets & lesson packets (`worksheets.html/js`) — classroom handouts:**
- **Single worksheet** — turn any puzzle into a printable handout with a student **Name / Date** header (optional **Class / Period** line + footer), a live scaled preview, and one-click PDF; optionally append a **teacher answer copy**.
- **Lesson packet** — a **cover page** (title, kicker, teacher/class, learning objective, standards line, auto **contents list**) + one worksheet per puzzle + an **answer-key section**, combined into one PDF.
- **Auto lesson-plan (curriculum presets)** — pick a **grade (K–6 / adults)** + topic + puzzle count and "Build plan from grade" fills the entire packet: a grade-appropriate puzzle mix at the right difficulty, plus a cover title, objective, and the **Common Core ELA standards** a word puzzle actually supports (`engine/curriculum.js`: vocabulary L.x.4/L.x.5 + K–5 phonics RF.x.3). Everything stays editable before download. Endpoints: `GET /api/curriculum`, `POST /api/packet/plan`.
- Built on the engine's own primitives: a new `reserveTopIn` sizes the puzzle below the header band, `renderPuzzleHtml`'s `worksheet` option injects the header/footer (same path as borders/QR so it prints vector-sharp), and `engine/worksheet.js` assembles the packet via `combinePages`. Endpoints: `POST /api/worksheet/preview|pdf`, `POST /api/packet/pdf`.

**Page Editor (`editor.html/js`) — a full MS-Publisher-style desktop-publishing app:**
- **Ribbon UI** — Home / Insert / Page Design / Team / Review / View / Help tabs, each a single dense Publisher-style row, plus **contextual tabs** that appear only when the matching object is selected: **Shape Format**, **Table Design**, **Table Layout**, **Picture Format**, **QR Code**, and **Text Box** (a text box shows Shape Format + Text Box together, a table shows Table Design + Table Layout, matching Publisher)
- **Contextual tab tools (Publisher-parity):**
  - **Text Box** — Text Fit, Text Direction, Hyphenation, Font/Alignment/WordArt with Text Fill & Outline colour palettes, Columns, Margins, Drop Cap, Number Style, Ligatures, **Stylistic Sets / Swash / Stylistic & Contextual Alternates** (OpenType `font-feature-settings`), and **Linking** — Create / Break Link + Previous / Next that flow a box's overflow into the next box (true text flow with a draggable flow-region height)
  - **Picture Format** — Corrections, Recolor washes, Picture Border / Effects / Styles, Caption, **interactive Crop** (drag-handle crop with a `{l,t,r,b}` model), **Compress Pictures** (downsample to 300/220/150/96 ppi, optional delete-cropped-areas), and **Swap** (exchange two pictures' contents while each keeps its frame)
  - **Table Design / Layout** — styles, borders, header/cell fills, insert/delete rows & columns, cell **merge / split**, and **diagonal split** cells
  - **Shape Format** — fill/outline styles, text-box frame (fill/border/radius/shadow), arrange, size
  - **QR Code** — edit link, error-correction level, dark/light (or transparent) colours, colour presets, test-link, size
- **Break-apart puzzle** — title / instructions / word-list become individually editable objects (word list can convert to a table); the grid stays protected. On import the broken-apart pieces keep their original stacked positions (no top-of-page pile-up), and the book's decorative page **border imports with the page** so the editor matches the Book Builder preview and the PDF
- **Fit to margins** — right-click → "Fit page / selection to margins" (also under Page Design → Margins ▾) scales and re-centres a page's objects inside the current margin box, preserving relative layout and aspect ratio
- **Free elements** — text, images, shapes (rect/ellipse/triangle/star/line + **speech/thought chat bubbles**), and **editable multi-column tables**; z-order incl. send-behind-the-puzzle
- **Master pages** (page numbers / headers / repeating frames) and **two-page facing spreads**
- Desktop-publishing toolset: undo/redo, zoom + rulers, numeric X/Y/size/angle, rotation, smart snapping + snap-to-grid, **multi-select (Shift / Ctrl / Cmd click to toggle, plus a rubber-band marquee that starts even from atop an object with a modifier held)**, align/distribute, group/ungroup, arrange, flip, lock, copy/paste, nudge
- **Custom font upload** (`@font-face` data-URLs sanitized server-side and embedded in the exported PDF) — 12 web-safe families plus your own
- **Word-list consistency pre-flight** — flags mismatches between an edited word list and the grid
- Editor == PDF parity: a shared renderer (`element-html.js`) draws every object identically on screen and in the exported PDF (vector-sharp at 300 DPI). Every contextual-tab tool above — crop, text flow, typography, compress, table spans — renders through this same renderer, so what you see prints

**Book library + autosave:**
- **My Books** dashboard (`library.html`, IndexedDB) — every project saved locally, change-detecting autosave, reopen/duplicate/delete

**Self-hosted team workspace (LAN, publisher-only):**
- `workspace.js` — a lightweight self-hosted backend (JSON-file store) for a small local team: shared roster, shared book library, live comments via Server-Sent Events, "Save to my library" fork + team notifications. No hosted accounts required (optional `PUZZLEFORGE_WORKSPACE_TOKEN`; email left as an optional SMTP hook)
- **Identity / sign-in** (`workspace.js` profiles + sessions + invites, client `identity.js`): each person is a **profile** (name, email, role, pen name, avatar colour, optional PIN). Sign-in = pick your profile (+PIN if set) → a session token remembered in the browser; a self-mounting "Signed in as …" chip on every page (menu → Profile settings, Switch user, Sign out). The first profile bootstraps as **Owner**; owners expand the team with **single-use invite links** (`profile.html?invite=<token>`) that register the new person and sign them in. A dedicated **Profile & Team** page (`profile.html`) edits your profile and, for owners, manages the roster. The book Author field prefills from your pen name. A reserved `google` slot on each profile lets **"Sign in with Google"** drop in later (once the app is behind an HTTPS address) with no data migration.

**Manual (non-AI) theme builder:**
- Build a themed word list + facts by hand (tiers, category, tags) — an alternative to the AI Theme Generator

**Design system + dark mode:**
- The teacher web app wears the **Nova Form Studios design system** — warm-paper palette, teal→green brand, Space Grotesk / Manrope / JetBrains Mono type — with a **light/dark toggle** (`theme.js`) that persists per browser and follows the OS by default. Teacher pages carry the toggle; the Page Editor keeps its own workspace theme.
- **Loading bars** on the Theme and Category generators while Claude works.

**Mobile:**
- Responsive phone/tablet layout and touch controls across the maker, builder, and editor

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
| Logic Grid | ✅ |
| Dot-to-Dot | 🔲 Deferred (needs image assets) |

### Tier 3 — Niche / High Value
| Type | Status |
|---|---|
| Word Ladder | ✅ |
| Word Wheel | ✅ |
| Cipher / Code Puzzles | ✅ |
| Riddles | ✅ Shipped — family-friendly "what am I?" bank, 4 tiers, answer key |
| Brain Teasers | ✅ Shipped — logic/math/word/lateral bank tagged by kind, 4 tiers, explained answer key |
| Math Puzzles | ✅ Shipped — self-checking missing-number equations + number sequences, 4 tiers |
| Sudoku Variants (X-Sudoku, Mini 6×6, Even-Odd) | ✅ Shipped — diagonal, gentler 6×6, and parity-shaded 9×9; all unique-solution guaranteed on a shared engine |
| Spot the Difference | 🔲 Roadmap — needs original artwork |
| Kakuro | 🔲 Roadmap — needs a unique-solution cross-sum generator |
| Sudoku Variants (6×6, Killer, …) | 🔲 Roadmap |

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
| Gutter (inside margin) — **KDP minimums, verified July 2026** | ≤150pp → 0.375" · 151–300 → 0.5" · 301–500 → 0.625" · 501–700 → 0.75" · 701–828 → 0.875" (source of truth: `engine/kdp.js` `gutterMinInches`; our trim specs exceed these) |
| Outside / top / bottom margin (KDP minimum) | ≥ 0.25" (≥ 0.375" with bleed) |
| Image resolution | ≥ 300 DPI (600 recommended); interior file ≤ 650 MB |
| Bleed | None (0.125" if decorative edges) |
| Minimum page count | 24 (50+ recommended) |
| Maximum page count | 828pp B&W / 550pp premium color |
| Page count | Must be even — add blank page if odd |
| Fonts | Must be embedded in PDF |
| Color mode | Grayscale for B&W interiors / sRGB or CMYK for color |

### KDP Export Bundle — Metadata Sheet Fields

The one-click KDP export zip includes a build-info sheet with all required metadata pre-filled from the book recipe. Fields:

| Field | Notes |
|---|---|
| Title | Must match cover exactly |
| Subtitle | Optional |
| Author name | |
| Series name | Optional — if part of a series |
| Series number | Digits only (e.g. "3" not "Book 3") |
| Description / blurb | Back cover copy, also used as Amazon listing description |
| Keywords (×7) | Seven keyword slots for Amazon search discoverability |
| Categories (×3) | Amazon store categories |
| Reading age | Required for children's books to appear in age-specific search |
| Trim size | Pulled from book config |
| Page count | Pulled from rendered PDF (must be even) |
| Paper type | Black & white / standard color / premium color |
| Interior color mode | Grayscale / sRGB / CMYK |
| AI disclosure — content type | Which content is AI-generated: text / images / translations (checkboxes, auto-flagged by PuzzleForge based on tools used) |
| AI disclosure — tool used | Which AI tool was used (e.g. Claude, ComfyUI/Stable Diffusion) — KDP asks this specifically |

### KDP AI Disclosure

KDP requires disclosure of AI-generated content via a form during upload. Readers never see this — it is for Amazon's internal compliance only. Disclosure is not required for AI-assisted content. Failure to disclose can result in book removal or account suspension.

**KDP asks two specific questions (confirmed via real upload):**
1. What content was AI-generated? (text / images / translations)
2. What AI tool was used? (e.g. Claude, Stable Diffusion/ComfyUI)

The PuzzleForge export bundle should pre-fill both fields based on which tools were used during book creation so the user can copy-paste answers directly into KDP without guessing.

**PuzzleForge content disclosure matrix:**

| Content | Disclose? | Reason |
|---|---|---|
| Puzzle grids (word search, sudoku, maze, crossword, etc.) | **No** | Algorithmic generation — not generative AI |
| Puzzle solution answer keys | **No** | Algorithmic |
| AI Theme Generator word lists and clues (Claude) | **Yes** | Claude generated the first version |
| ComfyUI cover art | **Yes** | AI generated the images |
| ComfyUI border tiles / clipart | **Yes** | AI generated |
| Breather page quotes/fun facts (curated database) | **No** | Human curated |
| Breather page quotes/fun facts (AI fallback) | **Yes** | AI generated |
| Your own cover text, blurb, front/back matter | **No** | Human written |
| Filler coloring pages (procedural mandala/shapes) | **No** | Algorithmic — not generative AI |

### KDP Royalty Estimator

*Shipped (v1): `engine/kdp.js` + "Estimate royalty" button and a listing-metadata fieldset in the Book Builder. US paperback, 60%, B&W modeled precisely (color approximate); renders the book for an accurate page count; build-info sheet now includes metadata, royalty estimate, and pre-filled AI disclosure. The pre-flight checklist also warns (`price-breakeven`) when a set list price falls below the printing break-even (no royalty). Multi-marketplace currency and IngramSpark/Books.by are still to come.*

Built into the export bundle screen. Calculates estimated royalty per sale before upload so you can set pricing confidently without switching to KDP's external calculator.

**Inputs (pulled from book config):**
- Trim size
- Page count
- Paper type (B&W / standard color / premium color)
- List price (user enters)
- Marketplace (US / UK / EU / etc.)

**Output:**
- Printing cost per unit
- Royalty per sale at 60% royalty rate
- Breakeven price (minimum list price for any royalty)
- Suggested price range for the puzzle book category

KDP royalty formula: `(list price × 0.60) - printing cost = royalty per sale`

**Real example (Sara's book):** 8.5×11, B&W, $6.99 list price. KDP did not prominently display the royalty estimate during setup — PuzzleForge's estimator fills this gap so publishers know their margin before committing to a price.

Printing cost varies by trim size, page count, and paper. Values pulled from KDP's published cost tables and updated when KDP announces changes (last update: June 2025).

---

**Quality note:** KDP specifically scrutinizes puzzle books for puzzle accuracy, print quality, and appropriate difficulty levels. PuzzleForge's solver-verified answer keys and per-type validation pipeline directly satisfy this requirement.

---

## Theming Strategy

Themes are **word lists only** — no visual assets. Visual presentation is handled by the layout system.

**Theme structure:**
```js
{
  id: "space",
  label: "Space",
  audiences: ["kids", "adult"],   // who the theme suits; missing = both
  tiers: {                         // four vocabulary tiers (1 easiest → 4 hardest)
    1: [{ word: "MOON", clue: "It orbits the Earth" }, "STAR"],
    2: [{ word: "COMET", clue: "An icy body with a glowing tail" }],
    3: [{ word: "ASTEROID", clue: "A rocky object orbiting the sun" }],
    4: [{ word: "CONSTELLATION", clue: "A pattern of stars in the sky" }]
  }
}
```

- An entry is a plain string or `{ word, clue }` (clue for crossword/kriss-kross)
- **Four tiers** matching the four difficulty levels; adults draw the exact tier for a level (Expert → tier 4), kids draw the easier tiers with a length cap (never tier 4)
- `audiences` marks suitability; the AI generator sets it from the chosen audience, and any theme missing it counts as both
- Mixed themes fully supported — generator receives a merged pool (audiences unioned)
- Custom word lists supported in both CLI and web UI
- AI Theme Generator — topic + audience → four-tier clued word list via Claude API

---

## Web Platform

### Business Model
Book generator revenue funds the project. Teacher tool is free permanently. No ads, no paywalls.

### Authentication

**Teacher tool — accountless.** No logins, no backend storage. Teachers generate, download, and go.

**Publisher app — account required.** Google sign-in via Clerk. Two current users: Rakoren and Sara. Accounts let each user have their own saved state without stepping on each other.

**What is saved per account:**
- ComfyUI style library presets
- Saved/custom themes
- Book recipes and catalog
- Tool preferences (which tools appear in the nav)
- Cover Builder saved configs
- Accessibility and font preferences

**Onboarding tool picker:**
On first login a setup screen lets the user choose which tool categories they want. Unchecked tools are hidden from the nav but accessible later in Settings → Tools.

| Tool Category | Default for Rakoren | Default for Sara |
|---|---|---|
| Book Builder + KDP export | ✅ | ❌ |
| Cover Builder | ✅ | ❌ |
| AI Art (ComfyUI) | ✅ | ✅ |
| Image tools (coloring, color-by-number, dot-to-dot) | ✅ | ✅ |
| Theme generator + custom clues | ✅ | ✅ |
| Puzzle Maker (single puzzle) | ✅ | ✅ |

Sara's default setup surfaces the creative tools she actually uses without the publishing pipeline cluttering her view. Both users can add or remove any tool at any time in Settings.

**Implementation:** Clerk free tier, Google OAuth only. No passwords, no email verification flows. User ID stored locally alongside saved data — no personal info collected beyond what Google provides.

**Account isolation — catalogs are per-publisher:**
Each account is an independent author identity. Sara's books are Sara's. Rakoren's books are Rakoren's. No crossover. The "More Books" back matter page pulls only from the logged-in publisher's own catalog. Think of it as multiple independent authors who share the same app — like multiple people using Canva — each with their own completely separate workspace.

**Roles:**
- **Owner (Rakoren)** — full access, can invite new publisher accounts, manages who has access to the app
- **Publisher (Sara, future team members)** — full access to their own workspace, no visibility into other publishers' catalogs or recipes

**Future — Novaform Studios imprint:**
If PuzzleForge grows enough to publish under a business license, an optional Imprint setting on an account would allow books to be listed under a business name (e.g. "Novaform Studios") instead of a personal author name on Amazon. This affects KDP account registration and how the publisher field appears on book listings. Flagged as a future open question — legal/business decision, not a software decision right now.

### Save & Retrieve
- **PDF** — print-ready, download and print
- **Recipe file (.json)** — portable puzzle config, re-upload to regenerate or modify

Recipe files also serve as a share mechanism — teachers share with colleagues, post in forums.

### Tooltips

Every control in the UI has a mouseover tooltip — no exceptions. This applies to both the public teacher tool and the publisher tools.

Tooltips should be:
- **Short** — one sentence max, plain language
- **Descriptive not instructional** — explain what it is, not how to click it
- **Consistent** — same tone throughout, written for a non-technical teacher audience

Examples:
- "Difficulty" → "Controls word length and grid complexity. Easy uses short common words, Hard uses longer less familiar words."
- "Bleed guard" → "Adds a blank page after coloring pages so marker ink doesn't bleed through to the next puzzle."
- "Class set" → "Generates multiple versions of the same puzzle with different grid layouts. Students get the same words but can't copy each other's answers."
- "Nonogram" → "A logic puzzle where players fill in grid squares based on number clues to reveal a hidden picture."
- "Kriss-Kross" → "A crossword-style puzzle where all the words are given — players figure out where each one fits in the grid."
- "Differentiation set" → "Generates the same puzzle at all three difficulty levels at once, so you can hand different versions to different students."

Tooltip copy should be written for every control before the teacher tool goes public. Publisher-only controls can use more technical language.

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
| Theme editing UI (edit/delete saved themes) | ✅ |
| Worksheet builder (any puzzle → printable handout with Name/Date header) | ✅ Shipped — `worksheets.html`; live preview + one-click PDF, optional teacher answer copy |
| Lesson packets (cover + several worksheets + answer-key section) | ✅ Shipped — cover with objective/standards/contents; one PDF |
| Common Core standards alignment | ✅ Shipped — grade presets map to the CCSS ELA vocabulary (L.x.4/L.x.5) + K–5 phonics (RF.x.3) standards a word puzzle supports; codes print on the packet cover |
| Curriculum grade presets | ✅ Shipped — `engine/curriculum.js`: grade (K–6 / adults) → difficulty, audience, puzzle mix, standards, objective |
| Auto lesson-plan mode (grade + topic → packet) | ✅ Shipped — "Build plan from grade" fills the whole packet (rows + cover + objective + standards); editable before download |
| Per-standard word banks (standard-specific vocabulary) | ✅ Shipped — Dolch Sight-Word Nouns (RF.K.3), Dolch Sight Words (RF.1.3), Number Words (K.CC.A.3) under a "Curriculum & Sight Words" category; the standard shows in every picker and prefills the packet cover |
| Puzzle packs by subject (pre-built curriculum sets) | 🔲 Phase 11 |
| Puzzle of the week (public free weekly puzzle) | 🔲 Phase 11 |
| Email subscribe for weekly puzzle | 🔲 Phase 11 |
| Classroom competition mode (class set + scoring sheet) | 🔲 Phase 11 |
| QR hint / answer reveal on printed puzzles | ✅ Shipped — interactive tap-for-hint pages (grid puzzles) + static answer reveal (others), auto-QR on the page |
| QR bonus digital puzzle | 🔲 Phase 10 |
| QR audio read-aloud (early readers, accessibility) | 🔲 Phase 10 |
| QR parent/teacher page (discussion questions, extension) | 🔲 Phase 10 |

### Mobile Responsiveness

The teacher tool web UI is fully responsive — designed to work on phone and tablet, not just desktop. Teachers frequently work from tablets in classrooms, and the publisher needs to be able to queue up book configs from a phone while away from the PC.

**Target devices:**
- Phone (375px+) — puzzle config, theme picker, recipe save/load, single puzzle preview
- Tablet (768px+) — full teacher tool including worksheet builder
- Desktop (1024px+) — full publisher suite including Book Builder and page editor

**Mobile workflow split:**
- Phone/tablet: planning, config, theme generation, recipe management
- Desktop: heavy generation, PDF export, ComfyUI, page editor

**The Page Editor is desktop-first but now has a phone-friendly responsive view** — a reduced touch layout for review/light edits ships today; heavy layout work is still best on a pointer device. All other tools are fully functional on mobile.

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

## Answer Key Design

*Spec in progress — reference images being reviewed.*

The answer key appears at the back of every published book. Each puzzle type has its own answer key format. Quality of the answer key is part of KDP's puzzle book review criteria.

### Per-Type Format (to be finalized)
- **Word Search** — solution grid with found words highlighted or circled, word list with coordinates
- **Crossword** — filled grid with all answers
- **Sudoku** — completed grid
- **Maze** — grid with solution path drawn in
- **Cryptogram** — decoded message + substitution key
- **Word Scramble** — unscrambled word list
- **Kriss-Kross** — filled grid
- **Number Search** — solution grid with found sequences highlighted
- **Nonogram** — completed filled grid
- **Trivia** — question list with correct answers

### Layout
- Answer key pages use a smaller layout to fit multiple solutions per page where possible
- Clear puzzle title and page number reference on each answer entry
- Consistent visual style matching the book interior

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

## Publish Checklist

A pre-flight checklist that runs before export. Three severity levels — blockers must be fixed, warnings should be fixed, passes are good to go. Available as an on-demand "Run Checklist" button and auto-runs when export is triggered, showing a summary before the PDF generates.

Each checklist item has a **"Fix it" shortcut** that jumps directly to the relevant field or page. No hunting through the UI.

### Severity Levels

- 🔴 **Blocker** — KDP will reject this or the book will have errors. Export is blocked until resolved.
- 🟡 **Warning** — won't break anything but hurts quality or discoverability. Should fix before publishing.
- 🟢 **Pass** — good to go.

---

### Implementation status (verified July 2026)

**Shipped** (`engine/checklist.js`, checked against KDP's published rules) and **gated on export** — "Download KDP bundle" / "Download PDF" run the checklist first and block on 🔴 blockers unless the user overrides; 🟡 warnings never block:

- **Structural** — page count 24–828 · even (with an optional "Pad to an even page count" toggle that appends a blank leaf where you control it) · puzzle count matches config · no empty puzzle pages · answer key present + complete · bleed guards placed · copyright / back matter · word list matches grid · difficulty↔audience coherence + range summary.
- **Print readiness** — single trim set · within KDP page limit · gutter (inside) margin per page-count table (`engine/kdp.js`) · interior images ≥ 300 DPI (`engine/imagesize.js`) · front cover-image effective DPI ≥ 300 (`engine/cover.js` `frontImageDpi`, surfaced inline in the Cover Builder and on the build-info sheet) · content inside the safe area.
- **KDP listing metadata + pricing** (warnings) — description present · 7 keywords · 3 categories · reading age set (kids) · list price clears the printing break-even (`engine/kdp.js` `royaltyEstimate` — a price below break-even earns no royalty).
- **Content quality (Claude API)** — an on-demand "AI content review" button runs one Claude pass over all reader-facing text (`engine/booktext.js` collects titles, instructions, crossword clues, trivia Q&A, blurb, matter) and returns findings: spelling/grammar errors, placeholder/ambiguous clues, generic titles, dry blurbs, reading-level mismatches. Results render in the checklist panel; reuses the editor proofread's SDK path.

**Still to come** (tracked below): cover-dimension formula check, AI-disclosure completeness, per-item "Fix it" jumps, folding the AI review into the export gate, and server-side gate enforcement (today's gate is client-side — right for the local single-user tool, bypassable via direct API).

---

### Content Quality Checks (Claude API) — ✅ shipped (on-demand review)

These checks use the Claude API to evaluate subjective quality. Run as a batch — one API call covers all text content in the book.

| Check | Severity | Notes |
|---|---|---|
| Grammar and spelling | 🔴 | All text fields: titles, instructions, clues, front/back matter, blurb, cover text |
| Reading level match | 🟡 | Instructions and clue text match the book's audience setting (kids vs adult) |
| Crossword clue quality | 🟡 | Clues are clear, unambiguous, age-appropriate for audience |
| Instructions clarity | 🟡 | Puzzle instructions are understandable for the target audience — "find words going diagonally" not assumed knowledge |
| Puzzle titles engaging | 🟡 | Flags generic titles like "Word Search #7" — suggests alternatives |
| Intro page reads naturally | 🟡 | Front matter text sounds like a real published book, not a template placeholder |
| Blurb compelling | 🟡 | Back cover / Amazon description is engaging and not just a dry description |
| Title consistency | 🔴 | Cover title matches interior title page exactly |
| Author name consistency | 🔴 | Author name matches everywhere it appears |

---

### Structural Checks (Logic — no AI)

| Check | Severity | Notes |
|---|---|---|
| Page count even | 🟡 ✅ | KDP requires even page count — a "Pad to an even page count" toggle appends a blank leaf; the checklist also warns on an odd count |
| Answer key present | 🔴 | At least one answer key page exists |
| Answer key complete | 🔴 | Every puzzle has a corresponding answer key entry |
| No blank puzzle pages | 🔴 | Generator failure edge case — puzzle page with no content |
| Front matter complete | 🟡 | Copyright page and title page present |
| Back matter present | 🟡 | At least one back matter page exists |
| Page numbers sequential | 🟡 | If page numbers enabled, they run correctly with no gaps |
| Filler pages placed correctly | 🟡 | Bleed guard pages follow coloring/drawing pages as configured |
| Puzzle count matches config | 🔴 | Number of generated puzzles matches the book config |

---

### Print Readiness Checks (Logic — no AI)

| Check | Severity | Notes |
|---|---|---|
| Images at correct DPI | 🟡 ✅ | Interior images ≥300 DPI (`engine/imagesize.js`) and the front cover image ≥300 DPI (`engine/cover.js` `frontImageDpi`) — warned in the checklist, inline in the Cover Builder, and on the build-info sheet |
| Nothing in margin zone | 🔴 | No content bleeds into KDP minimum margin area |
| Spine text threshold | 🟡 | Spine text only shown if page count ≥80 pages — warn if spine text enabled on thin book |
| Trim size consistent | 🔴 | All pages match the configured trim size — no mixed dimensions |
| Cover dimensions correct | 🔴 | Cover PDF dimensions match trim + page count + spine width formula |

---

### KDP Compliance Checks (Logic — no AI)

| Check | Severity | Notes |
|---|---|---|
| AI disclosure fields filled | 🔴 | Both AI content type and AI tool fields completed if any AI content used |
| Reading age set | 🟡 | Required for kids books to appear in age-specific search — warn if audience is kids and field is empty |
| All 3 categories filled | 🟡 | Leaving category slots empty hurts discoverability |
| All 7 keywords filled | 🟡 | Leaving keyword slots empty hurts discoverability |
| Description/blurb present | 🔴 | Cannot publish without a book description |
| Price above KDP minimum | 🟡 ✅ | List price must clear the printing break-even or the book earns no royalty — the checklist warns (`price-breakeven`) using `royaltyEstimate`, showing the break-even and a suggested price |
| ISBN field decision made | 🟡 | Prompt user to confirm KDP free ISBN or own ISBN — don't leave ambiguous |
| Series fields consistent | 🟡 | If series name is set, series number must also be set |

---

### Polish Checks (Claude API — optional)

Run separately from the main checklist. These are nice-to-have improvements, not blockers or warnings.

| Check | Notes |
|---|---|
| Suggest better puzzle titles | Claude generates 3 alternatives for any generic-sounding titles |
| Blurb rewrite suggestion | Claude offers an improved version of the back cover blurb |
| Keyword suggestions | Claude suggests 7 relevant Amazon keywords based on book content and audience |
| Category suggestions | Claude suggests the best 3 KDP categories for this book type |

---

### UI Flow

**On export click:**
1. Structural + KDP compliance checks run instantly (no API call)
2. If any 🔴 blockers found → show checklist, block export
3. If only 🟡 warnings → show checklist summary, offer "Export Anyway" or "Fix Issues"
4. If all 🟢 → export proceeds, checklist summary shown briefly as a confirmation

**"Run Checklist" button (manual):**
- Runs all checks including Claude content quality scan
- Full checklist panel opens showing all results
- Each item has a "Fix it" button that navigates directly to the relevant UI element
- "Run Polish Checks" secondary button at the bottom for the optional suggestions

**"Fix it" navigation targets:**

| Item | Fix it destination |
|---|---|
| Title mismatch | Opens Cover Builder → title field |
| Grammar in instructions | Opens puzzle page in Book Builder → instruction field |
| Missing blurb | Opens Cover Builder → back blurb field |
| Page count odd | Auto-adds blank page at end, confirms with user |
| Missing categories | Opens export metadata sheet → categories field |
| Reading age not set | Opens export metadata sheet → reading age field |

---

## Print Preview & AI Proofread

### Print Preview / Soft Proof
A page-accurate preview mode showing the book at actual print dimensions before export. Catches layout issues, margin violations, and text cut-off before committing to a full PDF render. Shows spine width visually. Available in Book Builder before the export step.

### AI Proofread (Publisher Only)
The content quality and polish checks from the Publish Checklist (see above) constitute the AI proofread layer. The Print Preview triggers the full checklist before export. No separate proofread button needed — it's integrated into the checklist flow.

---

## Accessibility

Accessibility is a first-class feature across both the teacher tool and all exported PDFs. Every item below is required before the teacher tool goes public.

### Dyslexia-Friendly Typography

- **Font toggle** — OpenDyslexic as primary option, Lexie Readable and Atkinson Hyperlegible as alternatives. Available in both the web UI and exported PDFs.
- **Minimum font sizes** — enforced per audience: kids 14pt minimum, adult 11pt minimum, large-print/senior mode 18pt minimum (senior mode already planned in Phase 6)
- **Line spacing** — 1.5× line height minimum across all puzzle instructions and word lists
- **Letter spacing** — slightly increased tracking on body text and word lists
- **No justified text** — ragged right alignment throughout. Justified text creates uneven word spacing that hurts dyslexic readers.
- **Font weight** — no light or thin weight fonts in any puzzle instructions or UI labels

### Color & Contrast

- **High contrast mode** — pure black on white, no gray backgrounds or fills. Toggle in UI, applies to both preview and exported PDF.
- **Color blind safe palette** — no red/green combinations for any UI elements, borders, difficulty indicators, or decorative colors. Use blue/orange or other colorblind-safe pairs.
- **Never rely on color alone** — any information conveyed by color must also have a text label or shape indicator (e.g. difficulty shown as colored dot + "Easy/Medium/Hard" label)
- **WCAG AA contrast ratio** — minimum 4.5:1 for normal text, 3:1 for large text, enforced across all UI controls and exported content

### Puzzle-Specific Accessibility

- **Minimum grid cell size** — enforced per audience and puzzle type so letters and numbers are never cramped. Kids and dyslexic users get larger cells by default.
- **Bold grid borders** — clear cell boundaries in word search and sudoku grids to aid visual tracking
- **Sudoku number clarity** — font must clearly distinguish 1, 7, l and similar ambiguous characters
- **Maze line thickness** — minimum wall thickness enforced so paths are easy to trace, especially for kids and users with motor difficulties
- **Crossword cell numbering** — small cell numbers must remain legible at print size across all trim sizes

### Page Layout Consistency

- **Fixed layout structure** — every puzzle page follows the same order: title → instructions → puzzle → word list (where applicable). No layout surprises between pages.
- **Consistent element placement** — instructions always same position, word lists always same position (bottom or right panel)
- **Adequate white space** — minimum padding around all puzzle elements, never cramped. Especially important for kids books.
- **Clear visual hierarchy** — title largest, instructions second, puzzle content dominant, supplementary elements (word list, clues) subordinate

### Web UI Accessibility

- **Full keyboard navigation** — every control reachable and operable without a mouse
- **ARIA labels** — screen reader labels on every interactive element (pairs with tooltip copy — same text reused as aria-label)
- **Visible focus indicators** — clear focus ring on all interactive elements, not just the browser default
- **Alt text** — descriptive alt text on all puzzle preview images
- **Touch target size** — minimum 44×44px for all interactive controls (WCAG 2.1 AA standard for mobile)
- **No motion without consent** — any animations or transitions respect prefers-reduced-motion media query

### Print Accessibility

- **High contrast print mode** — pure black ink, no gray fills or tinted backgrounds. Toggle per book or per page.
- **Large print export** — larger grid cells, larger fonts, fewer puzzles per page. Ties into senior mode (Phase 6). Available as a trim size / layout preset.
- **Accessible PDF metadata** — exported PDFs include title, author, and language metadata for screen reader compatibility

### Implementation Notes

- Dyslexia font toggle and high contrast mode are the highest priority — implement before teacher tool launch
- ARIA labels and tooltip copy can be written in the same pass (reuse tooltip text as aria-label)
- Color blind palette should be chosen once and applied as a design token system — don't make ad-hoc color decisions
- WCAG AA is the target standard (not AAA) — AA covers the vast majority of users with a realistic implementation effort
- Accessibility should be tested with keyboard-only navigation and at least one screen reader (NVDA or VoiceOver) before public launch

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
- ✅ Manual (non-AI) theme builder — author a tiered clued word list + facts by hand
- ✅ Starter book templates — six ready-to-publish books in the Book Builder
- 🔲 More built-in themes (hand-authored)
- 🔲 (optional) edit clues / add words to an existing theme

### 🔲 Phase 6.5 — Publisher Accounts
- Google sign-in via Clerk (publisher app only, teacher tool stays accountless)
- Per-account saved state: themes, recipes, catalog, ComfyUI style library, Cover Builder configs
- Onboarding tool picker on first login — choose which tool categories appear in nav
- Settings → Tools page to add/remove tools after onboarding
- UI cleanup pass — tidy up nav and layout now that tool visibility is per-user controlled

### 🟡 Phase 7 — More Puzzle Variety
- ✅ Logic Grid — constraint-solver-verified unique solutions, natural-language clues, book + answer-key support
- ✅ Word Ladder — common-word graph (frequency list ∩ dictionary), minimal-hint unique solutions, book + answer-key support
- ✅ Word Wheel — 9-letter source word, baked common-word dictionary (50k-freq ∩ dictionary), full findable-word key + scoring targets
- ✅ Cipher — Caesar / Atbash / A1Z26 / Morse; the shared algorithm encodes and the solver decodes straight back (answer key can't drift)
- 🔲 Spot the Difference
- 🔲 Sudoku variants
- 🔲 Riddles / Brain Teasers (Tier 3)

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
    Tuned **workflow presets** (coloring / color-by-number base / silhouette / cover
    illustration / clip art / border), each setting prompt + negative + sampler/scheduler/
    steps, with automatic post-processing (line-art traced to crisp B/W, silhouette
    thresholded) so output is print-ready. **Checkpoint auto-tuning** picks sampler/steps/
    CFG/resolution per model family (Turbo/Lightning → low steps + low CFG, SDXL → 1024,
    SD1.5 → 768). **LoRA + ControlNet** support (dynamic workflow graph: LoraLoader chain,
    ControlNetApplyAdvanced with an uploaded reference image; models auto-listed from
    ComfyUI). **Hand-off** buttons send a generated image straight into the Color-by-Number
    or Coloring-Page tools. (Potrace PNG→SVG tracing for border tiles still deferred.) **Style library** — "Save Style" button saves the current checkpoint/LoRA/seed/CFG/sampler combo with a user-given name; style picker dropdown recalls saved presets. Personal library built up over time through use.
16. ✅ Image-to-Color-by-Number — Sharp + JS k-means posterization → flat color regions,
    connected-component numbering, printed color key, optional on-page reference guide.
    Noise control: median despeckle before clustering, perceptual color merging (so
    "Colors" is a soft max with no duplicate shades), and small-region dissolving into
    neighbours. Colors (4–24) + Cleanup (0–5) controls; numbers snap inside each region.
17. ✅ Dot-to-Dot — Sharp + JS: Otsu threshold + auto fore/background detection + largest
    blob, outer boundary sampled at evenly spaced angles around the centroid → ordered
    numbered dots. Dot count (12–120) + optional faint guide silhouette. (Polar sampling
    handles star-convex subjects well; contour-tracing for deep concavities is a future
    refinement.)
- ✅ Page borders — procedural vector frames (`engine/decor.js`: single / double / rounded /
    dashed / dots / scallop / stars) in any color, drawn around puzzle pages in both the
    Puzzle Maker and Book Builder (skipped on blank/activity pages). AI border + clip-art
    workflow presets on the AI Art page for custom decorations. (Clip-art *placement* onto
    pages — corner/scatter — still to come.)

### 🟡 Phase 9 — Page Editor + QR Basics (Publisher Only)
- ✅ Recipe format v2 (prerequisite) — done; seeded generators give full reproduction
- ✅ Freeform page editor (`editor.html/js`) — opt-in "Open in Editor" from the
  Book Builder. Each puzzle is **split into movable/resizable pieces** (grid,
  title, instructions, word list) via `engine/components.js`; pieces stay crisp
  HTML positioned with CSS transforms (no rasterizing). Plus add text / clip art.
- ✅ Per-page reroll for individual puzzles (seeded; same type/difficulty/words);
  piece positions + decorations preserved
- ✅ Text box placement (move/resize/recolor/align, double-click to edit)
- ✅ Clipart upload → place on page (AI Art PNGs work)
- ✅ Per-page border override; hide pieces; reset layout
- ✅ Desktop-publishing toolset: undo/redo (Ctrl+Z/Y), zoom + rulers, numeric
  X/Y/size/angle panel, rotation, smart snapping guides + snap-to-grid, multi-select
  (shift-click), align (page or to-each-other) + distribute, arrange (front/back),
  flip H/V, lock, duplicate/copy/paste, arrow-key nudge
- ✅ Export — engine composes placed pieces + elements per page
  (`pageState[i].layout`) via the normal book pipeline; vector-sharp at 300 DPI
- ✅ **Full MS-Publisher-style ribbon** — Home / Insert / Page Design / Team /
  Review / View / Help, each a single dense one-row ribbon (multi-button groups
  collapse into dropdowns to match Publisher's density), plus **contextual tabs**
  that appear only when the object is selected: **Shape Format**, **Table Design**,
  **Table Layout**, **Picture Format**, **QR Code**, **Text Box** (Publisher shows
  two at once for a text box or table — Shape Format + Text Box, Table Design +
  Table Layout — and this matches that)
- ✅ **Picture Format contextual tab** — Corrections, Recolor washes, Picture
  Border / Effects / Styles, Caption (all via CSS filters that render in the PDF)
- ✅ **Interactive crop** — drag the 8 handles with a live darkened mask; a
  `{l,t,r,b}` edge-fraction model plus captured natural size, so the crop clips
  identically in the editor viewport and the exported PDF
- ✅ **Compress Pictures / Swap** — Compress downsamples the stored image to a
  target print resolution (300/220/150/96 ppi, since the page is 96 CSS-ppi),
  optionally baking the crop, and keeps PNG/GIF/WebP alpha; Swap exchanges two
  pictures' contents (image + crop + adjustments) while each keeps its own frame
- ✅ **QR Code contextual tab** — dedicated tab to edit the link, error-correction
  level, dark/light (or transparent) colours, colour presets, test-link and size
  (also fixed a serialization gap where QR data was lost on save/export)
- ✅ **Table Design / Table Layout tabs** — styles, borders, header/cell fills,
  insert/delete rows & columns, cell **merge / split**, and **diagonal-split** cells
- ✅ **Text Box + Shape Format tabs** — Font/Alignment/WordArt with Text Fill &
  Outline palettes, Text Fit, Text Direction, Columns, Margins, Drop Cap, Number
  Style, Ligatures; the text-box frame (fill/border/radius/shadow) on Shape Format
- ✅ **Advanced OpenType typography** — Stylistic Sets, Swash, and Stylistic /
  Contextual Alternates via `font-feature-settings` (renders on screen and in the
  PDF for any font that ships the feature; custom uploads especially)
- ✅ **Linked text boxes (text flow)** — Create / Break Link + Previous / Next
  flow a box's overflow into the next box; chains are keyed by serialization-safe
  scalars, each box persists its own computed slice + flow-region height, so the
  PDF reproduces the flow with no server-side measurement
- ✅ **Break-apart puzzle** — title / instructions / word-list become editable
  objects (word list → table); the grid stays protected. Send-behind z-order.
- ✅ **Shapes incl. speech/thought chat bubbles**, and **editable multi-column tables**
- ✅ **Master pages** (page numbers / headers / frames) and **two-page facing spreads**
- ✅ **Word-list consistency pre-flight** (edited list vs. grid)
- ✅ **Editor==PDF parity** via a shared `element-html.js` renderer
- ✅ **My Books library + change-detecting autosave** (`library.html`, IndexedDB)
- ✅ **Self-hosted LAN team workspace** (`workspace.js`) — shared roster, shared
  books, live comments via SSE, "Save to my library" fork + notifications
- ✅ Grouping/ungrouping; page add / duplicate / delete / reorder in the sidebar; responsive mobile view
- ✅ Marquee (rubber-band) select — capture-phase drag over the stage or a
  piece lassos the enclosed free objects (shift-drag adds); free-element and
  piece click/drag are preserved
- 🔲 Filler page swap inline; layers panel; multiple named master pages
- 🔲 Cross-page text-box linking (chains are per-page today; cross-page flow needs a global element registry)
- 🔲 Swap-formatting-only variant; text-box Stylistic Set gallery previews
- 🔲 **Switchable editor "skins"** (future) — the layout model (`pageState`) is
  decoupled from the editor chrome, so a future setting could re-skin the editor
  to look/behave like MS Publisher, InDesign, Canva, etc. over the same data
- **QR code basics** — hint and answer reveal per page, auto-generated URLs, static landing pages deployed at export, QR embedded in PDF corner. *(Shipped: the QR foundation — `engine/qr.js` encodes offline via `qrcode-generator`; the shared `element-html.js` draws it as a crisp vector so it stays scannable at any print size; placeable/editable in the Page Editor as a QR element pointing at any URL, editor==PDF. Now with a **dedicated QR Code contextual tab** — link, error-correction level, dark/light-or-transparent colours, colour presets, test-link, size — and a fixed serialization gap so QR data survives save/export. **Per-puzzle answer landing pages + auto-QR shipped** (`engine/digital.js`): every real puzzle gets a self-contained mobile "reveal the answer" page and a "Scan for the answer" QR printed in the page corner (encoding `<baseUrl>/<book-slug>/pN.html`); the KDP bundle now includes an `html/` folder of these pages, and `POST /api/book/digital` returns them standalone for deploying to any static host. **Word/number search pages are interactive** — tap a token for an escalating hint (3×3 box around the start → exact start cell → full reveal); other puzzle types keep the static answer reveal. There's an **end-of-book celebration** page (confetti "You did it!") linked from the index and every puzzle page. The printed QR reserves a foot band so it never overlaps puzzle content. The whole thing is **self-serve from the Book Builder** — a "Digital layer" section takes a hosting base URL and a "Download answer pages (.zip)" button, and setting the URL makes the KDP bundle print the QR codes and include the pages under `html/`. Book-level analytics (needs a backend) and richer content (bonus puzzles, audio) still to come.)*
- **ComfyUI visibility** — WebSocket progress display, live latent preview, workflow debug panel
- **ComfyUI prompt helper** — Claude-powered prompt optimizer, context-aware per preset, positive + negative prompt output, "explain changes" toggle
- **Publish Checklist** — pre-flight checklist with 🔴 blockers / 🟡 warnings / 🟢 passes, structural + KDP compliance checks (logic), content quality checks (Claude API), "Fix it" shortcuts per item, auto-runs on export. *(Shipped: `engine/checklist.js` — structural/print checks verified against KDP's published rules (July 2026): page count 24–828, even, gutter table per page count, trim set; plus image ≥300 DPI (`engine/imagesize.js`) and content-inside-safe-area checks, answer-key completeness, word-list match, difficulty/audience coherence, bleed guards, copyright/back-matter. **Export gate**: the KDP bundle / PDF download runs the checklist first and blocks on 🔴 blockers unless the user overrides (warnings never block). Fixed a stale `hasPuzzleContent` whitelist that had false-flagged sudoku/logic-grid/etc. as "empty". Still to come: Claude content-quality checks, "Fix it" jumps, cover-image DPI, server-side gate enforcement.)*

### 🔲 Phase 10 — Digital Layer + Multi-Platform (Publisher)
- **QR full digital layer** — celebration animations, story continuation, bonus puzzles, audio, parent/teacher pages
- **QR analytics dashboard** — scan data, completion rates, difficulty signals per page
- **IngramSpark export preset** — correct spine calc, ONIX metadata, own-ISBN workflow
- **Books.by export preset** — direct sales storefront bundle
- **Batch book export** — generate N books in one run from a config list (CLI, publisher only)
- **Puzzle title generator** — Claude API generates engaging titles ("Safari Seek & Find" vs "Animals Word Search")
- **"Inspire me" random book config** — generates a complete random book config as a starting point
- **Catalog management UI** — full table view, status tracking, ASIN field, recipe re-open

### 🔲 Phase 11 — Teacher Tool Expansion
- Lesson plan mode — topic + grade level → full worksheet packet (vocab list, word search, crossword, trivia quiz)
- Common Core / state standards alignment tags
- Puzzle packs by subject — pre-built curriculum-aligned puzzle sets
- Worksheet builder spec (3–4 puzzle types, one page)
- Curriculum word list presets — US states, multiplication vocabulary, human body, planets, periodic table, sight words, world capitals
- Puzzle of the week — public page, free weekly puzzle, email subscribe option
- Classroom competition mode — class set + scoring sheet

### 🔲 Phase 12 — Stretch Goals
- AI fallback for quotes/fun facts when curated database runs dry
- Hidden Pictures / Seek & Find (requires original artwork)
- Color-by-Number as a bookable puzzle type (procedural art, no upload required)
- Built-in clipart library (saved assets from ComfyUI generations over time)
- Potrace PNG→SVG tracing for border tiles
- Contour tracing for concave dot-to-dot shapes
- Puzzle birthday cards — personalized puzzle as a printable/shareable card
- Seasonal QR surprises — QR destination changes on holidays
- Choose your own adventure activity book mode

---

## ComfyUI Integration — Improvement Plan

The current ComfyUI integration works but is a black box — PuzzleForge sends a prompt and gets an image back with no visibility into what's happening or why results vary. This section documents the improvement roadmap.

### Phase 1 — Visibility (do first)

**WebSocket progress display**
ComfyUI exposes a WebSocket at `ws://localhost:8188/ws` that streams real-time node execution status. PuzzleForge should listen to it and display progress in the AI Art page instead of a spinner:
```
Loading checkpoint... ████░░░░ 
Applying LoRA...      ████████
Sampling step 8/20... ████░░░░  (40%)
```
Catches errors early, shows exactly what's running, makes the experience feel responsive.

**Live latent preview during sampling**
ComfyUI supports live image previews while still generating — the image forms step by step. Enabled by adding a `LatentPreview` node to the workflow. Users can cancel early if generation is going wrong. Makes a 20-second wait feel like 5 seconds.

**Workflow debug panel (publisher only)**
A collapsible panel in the AI Art page showing:
- Which workflow JSON was sent
- Which checkpoint and LoRA loaded
- Seed used for this generation
- Node execution log from WebSocket
- Any errors or warnings

This surfaces what's actually happening so output can be tuned intelligently.

### Phase 2 — Consistency

**Seed management**
Every generation should display the seed used. "Save Style" captures the seed alongside checkpoint/LoRA/CFG. Same prompt + same seed = reproducible composition. Critical for character mascot consistency across book pages.

**Locked settings per preset**
Each workflow preset locks the settings that shouldn't vary:
- Border tile: square aspect ratio, white background enforced
- Coloring page: portrait ratio, grayscale output, line art post-processing
- Cover illustration: trim-size-matched aspect ratio
- Clip art: square, transparent or white background

**Per-preset negative prompts**
Negative prompts are tuned per workflow preset — not shared globally:
- Line art / coloring page: `gray, shadow, gradient, texture, shading, blur, noise`
- Border tile: `text, watermark, frame, border, busy background, photorealistic`
- Cover illustration: `blurry, low quality, amateur, watermark, ugly, deformed`
- Silhouette: `gray, detail, texture, color, gradient, outline`

### Phase 3 — Output Quality

**Line art LoRA**
A LoRA trained on flat black line art produces dramatically cleaner coloring page output than prompting a base model. Models like `lineart_anime` or a custom-trained one. Should be the default LoRA for coloring page and border tile presets.

**Style reference via ControlNet**
Upload a reference image and ControlNet steers the generation toward that style. Critical for:
- Character mascot consistency (same character, different poses)
- Matching border style across multiple generations
- Maintaining a consistent art style across an entire book

**Checkpoint recommendations per use case**
Different checkpoints excel at different tasks. Document which checkpoints work best for each PuzzleForge use case as the style library grows:
- Flat line art → SD1.5 or SDXL with line art LoRA
- Painterly cover illustration → SDXL or Flux
- Kids illustration style → specific fine-tuned checkpoints

### Workflow Setup Guide (for Rakoren)

Before tuning outputs programmatically, do this manually first:

1. Open `localhost:8188` in browser
2. Load current PuzzleForge workflow (File → Load)
3. Export as API format (Settings → Enable Dev Mode → Save API Format)
4. Read the JSON — see exactly what nodes are running
5. Run a generation inside ComfyUI UI directly — watch node execution
6. Find a result you like → note the seed number
7. Save seed + settings as first named style preset in PuzzleForge

This 10-minute session will reveal more about what's happening than anything else.

---

## ComfyUI Prompt Helper

A prompt optimization tool built into the AI Art page. Takes the user's rough description and rewrites it into a proper Stable Diffusion prompt — positive and negative — tailored to the selected workflow preset.

### Flow

```
User types:  "cute space rocket, black outline"
             [Preset: Border Tile]
             [Optimize Prompt ▶]

Claude sees: rough prompt + selected preset + current checkpoint family

Returns:     Positive: "cute cartoon space rocket, flat vector illustration, 
                        bold black outline, white background, icon style, 
                        isolated element, clean edges, seamless tile ready,
                        simple shapes, minimal detail"
                        
             Negative: "text, watermark, frame, border, busy background, 
                        photorealistic, shadow, gradient, gray fill,
                        complex texture, multiple elements"

Both fields update — user edits before generating
```

### Context Awareness

The optimizer knows which preset is active and tailors accordingly:

| Preset | Optimization Focus |
|---|---|
| **Line art / coloring page** | Flat, clean, no shading, high contrast, simple shapes, black outlines, no gray |
| **Border tile** | Seamless, repeating, isolated element, white background, icon style, consistent scale |
| **Cover illustration** | Rich detail, painterly, vibrant, professional composition, trim-size aware |
| **Silhouette** | Pure black shape, solid fill, no internal detail, white background, clean edges |
| **Clip art** | Flat vector style, bold outlines, simple palette, transparent/white background |
| **Color-by-number base** | Clear distinct color regions, flat fills, minimal gradients, well-defined boundaries |

### UI

- **"Optimize Prompt" button** — appears next to the prompt field, always visible
- **"Explain changes" toggle** — when on, Claude adds a brief explanation of what was changed and why. Good for learning. Off by default.
- Optimized prompt populates both positive and negative fields
- User can edit either field after optimization before generating
- Original prompt preserved in a "restore original" link until the next generation

### Implementation

Single Claude API call per optimization. System prompt includes:
- The selected workflow preset name and its goals
- The current checkpoint family (SD1.5 / SDXL / Flux) for style-appropriate keywords
- Instruction to return structured JSON: `{ positive: string, negative: string, explanation: string }`
- Explanation field only populated if "Explain changes" is toggled on

Fast and cheap — Haiku model is sufficient for prompt optimization. No need for Sonnet.

### Prompt Library (future)

Save optimized prompts that produced great results alongside the style preset. Over time builds a personal library of proven prompts per use case. Pairs with the style library — a saved style can optionally include a saved prompt as its starting point.

---

## Print on Demand Platform Strategy

PuzzleForge supports export bundles for multiple POD platforms. Each platform serves a different sales channel — the smart strategy is to use all three.

### Platform Overview

| Platform | Best For | Cost | Royalty Structure |
|---|---|---|---|
| **Amazon KDP** | Marketplace discovery, Amazon sales | Free | 60% of (list price − print cost) |
| **IngramSpark** | Bookstores, libraries, 40,000+ retailers | $49/title + own ISBN | ~45% after print cost — lower royalty, far wider reach |
| **Books.by** | Direct sales, highest royalties, daily payouts | $99/year | ~80% of (list price − print cost) |
| **Lulu** | Specialty formats, unusual trim sizes, direct store | Free | ~80% on Lulu store, lower through distribution |
| **Barnes & Noble Press** | B&N marketplace and readership | Free | Similar to KDP |

### Recommended Strategy

- **KDP** — publish everything here first. Largest audience, free, lowest friction.
- **IngramSpark** — add after KDP is established. Gets books into physical bookstores and libraries. Requires $49/title and your own ISBN (Bowker ISBN ~$125 each or $295 for 10).
- **Books.by** — direct sales storefront. Highest royalty per sale. Good for building a direct reader relationship outside Amazon.

### Export Bundle — Platform Presets

The one-click export bundle supports a platform selector. Choosing a platform auto-applies the correct specs:

| Spec | KDP | IngramSpark | Lulu |
|---|---|---|---|
| Spine width formula | KDP calculator | Ingram calculator | Lulu calculator |
| Bleed | 0.125" | 0.125" | 0.125" |
| Gutter | KDP table | Ingram table | Lulu table |
| Cover file | Full wrap PDF | Full wrap PDF | Full wrap PDF |
| Metadata format | KDP fields | ONIX | Lulu fields |
| ISBN required | KDP free or own | Own ISBN required | Free or own |

### Future — Novaform Studios Imprint
If publishing under a business imprint, IngramSpark is the right platform for the publisher of record setup. KDP allows a custom publisher name with your own ISBN. Decide when ready — doesn't affect software until then.

---

## QR Code & Digital Layer

Every puzzle page can have an optional QR code (small, auto-positioned in a corner) linking to a unique PuzzleForge-hosted URL. This turns a print book into a hybrid print+digital experience — and drives traffic back to the PuzzleForge platform with every book sold.

### How It Works

At export time PuzzleForge generates a unique URL per page:
```
puzzleforge.com/book/[bookId]/page/[pageId]
```

QR codes are auto-embedded on pages where the feature is enabled. The destination page is auto-created and hosted by PuzzleForge. Content behind each QR is configured in the Book Builder or Page Editor per page.

### QR Destination Types

| Type | Description | Best For |
|---|---|---|
| **Hint** | A gentle nudge without the answer — "The word starts with S and lives in the ocean" | Kids books, when stuck |
| **Answer reveal** | Full solution shown digitally | Any puzzle type |
| **Celebration animation** | Confetti, character animation, story payoff — "You saved the princess! 🎉" | Kids narrative books |
| **Bonus puzzle** | Unlock a harder version or a different puzzle type too complex to print | Engagement, replay value |
| **Story continuation** | Next chapter of the narrative — kids must solve the puzzle to unlock what happens next | Story-driven activity books |
| **Audio** | Puzzle instructions read aloud | Early readers, accessibility |
| **Parent/teacher page** | Discussion questions, extension activities, curriculum notes | Teacher tool, homeschool |

### Narrative Integration

The celebration animation and story continuation types tie directly into the book's narrative layer. If the book has a story threaded through it (via the page editor), the QR destination can advance that story. Solve the maze → scan → the next scene plays. This is a genuinely differentiated feature — no KDP puzzle book mill is doing this.

### Platform Advantages

**Every book sold drives traffic to PuzzleForge.** Every kid who scans a QR code lands on the PuzzleForge domain. That's:
- Exposure for the teacher tool
- Future book discovery ("more books by this author" shown on QR landing pages)
- Analytics — scan = completion signal, know which puzzles kids actually finish
- Updateable content — fix a puzzle error digitally without reprinting
- Seasonal surprises — QR destination can change on holidays

### Analytics (Publisher Only)

The PuzzleForge dashboard shows per-book QR scan data:
- Scans per page — which puzzles are being completed
- Hint vs answer reveal ratio — difficulty signal
- Geographic data — where your readers are
- Completion rate per book

This data informs future book design — if page 12 gets 10× more hint scans than other pages, that puzzle is too hard for the audience.

### UI — Configuring QR Content

In the Book Builder, each puzzle row has a "QR" button that opens a small panel:
- Toggle QR on/off for this page
- Destination type picker
- Content field (hint text, story text, animation picker, etc.)

In the Page Editor, the QR content panel is in the right contextual panel when a puzzle page is selected.

### Hosting

QR landing pages are lightweight static pages hosted on the PuzzleForge Vercel deployment. No database needed — page content is stored in the book recipe and deployed as static pages at export time. Works even if the publisher app is local-only.

### Implementation Phase

QR code generation (basic — hint + answer reveal) in Phase 9 alongside the page editor.
Full digital layer (animations, story continuation, analytics) in Phase 10.

---

## Book Catalog Management

A local catalog tracks every book exported from PuzzleForge. Stored as `catalog.json` alongside the publisher app. Publisher-only feature — not part of the teacher tool.

### What Gets Logged Per Book
```js
{
  id: "uuid",
  title: "Animals Activity Book",
  subtitle: "",
  audience: "kids",
  trimSize: "8x10",
  pageCount: 96,
  theme: ["animals", "ocean"],
  puzzleTypes: ["wordsearch", "maze", "sudoku"],
  exportedAt: timestamp,
  interiorPdf: "path/to/interior.pdf",
  coverPdf: "path/to/cover.pdf",
  asin: "",           // filled in after KDP publish
  publishedAt: null,  // filled in after KDP publish
  notes: ""
}
```

### Catalog UI (Publisher Only)
- Table view of all exported books — title, date, trim, page count, status
- Status field: Draft / Exported / Under Review / Published
- ASIN field — fill in after KDP assigns one
- Notes field — track what worked, what to change next time
- Quick re-open — load any book's recipe back into Book Builder
- "Include in back matter" toggle per entry — controls whether the book appears in the "More Books" page (default on for Published status)
- "More Books" back matter page auto-generates from all Published entries where toggle is on

### Per-Account Isolation
Each publisher's catalog is completely private to their account. Sara's exported books feed Sara's "More Books" page under her author name. Rakoren's feed his. No crossover. This reflects how Amazon KDP works — each author has their own identity and book list.

### Why This Matters
- Know what's in your catalog at a glance
- Track review status without logging into KDP
- "More Books" back matter is always current with zero manual work
- Over time becomes a reference for what themes/formats sell
- Foundation for future imprint grouping if Novaform Studios becomes the publisher identity

---

## License Strategy

| Repo | License | Reason |
|---|---|---|
| `puzzleforge-engine` (future) | Private | Protects publishing advantage |
| `puzzleforge-web` (future) | MIT | Low risk, teacher community friendly |

Current single repo: no license assigned yet. Keep private until split.

---

## Storytelling & Creative Concepts

These are creative design patterns that the Page Editor (Phase 9) unlocks naturally. They are not separate features to build — they are ways to USE the editor once it exists. Documented here so they aren't lost.

### Choose Your Own Adventure Activity Book
Puzzles that are part of a branching story. Solve the maze to escape the dungeon. Find the hidden words to decode the magic spell. The Page Editor provides the text box and clipart layer. The QR digital layer provides the story continuation unlock. No new engine features required beyond what's already planned.

**Structure:**
- Each puzzle page has a story snippet (text box) setting up the challenge
- QR code on completion reveals the next story beat or a branching choice
- Wrong path leads to a harder puzzle, right path advances the story
- Kids have to earn story progress by solving puzzles

### Character Mascot System
A recurring illustrated character that appears throughout a book. The wizard who gives you each puzzle. The explorer who needs your help. Generated via ComfyUI with ControlNet for visual consistency across pages. Kids books with a mascot feel like a brand, not just a book.

**How it works with existing tools:**
- Generate character poses in ComfyUI (pointing, thinking, celebrating, scared, etc.)
- Place via clipart layer in Page Editor — different pose per page based on story beat
- ControlNet reference image keeps the character visually consistent across generations
- Celebration animation on QR completion can feature the character

### Narrative Difficulty Curve
Easy puzzles early when the story is safe, harder puzzles when the story gets tense. The difficulty curve feature already planned in Book Builder, reframed as a storytelling tool. The mechanics are identical — the framing makes books feel intentional.

### Puzzle as Story Gate
The QR story continuation destination type combined with narrative text boxes creates a natural story gate mechanic — kids cannot see what happens next until they solve the puzzle. The print book and digital layer work together. No additional features required beyond Phase 9 + 10.

### Series Character Continuity
If a mascot character appears across multiple books in a series, ComfyUI ControlNet reference images ensure visual consistency volume to volume. The catalog tracks which character assets were used per book. This is what turns a single activity book into a recognizable brand.

---

## Open Questions

- [x] Color-by-number reference image — shipped as optional small "color guide" below the page (toggle)
- [x] Cover Builder — pulls page count automatically from book recipe; manual override field available
- [x] KDP metadata sheet — resolved. See KDP Export Bundle — Metadata Sheet Fields section above.
- [x] KDP category strategy — Sara only used 1 of 3 available category slots. PuzzleForge export bundle should prompt user to fill all 3 and suggest relevant categories based on book audience and puzzle types.
- [x] Reading age guidance — Sara set maximum age not knowing what to pick. Export bundle should recommend age ranges: kids activity books → 4-8 or 6-10, adult puzzle books → leave blank or 18+.
- [ ] Logic grid — all three sources supported: AI-generated (Claude), manual/custom (Sara's creative input), and static pre-written database. Same puzzle grid regardless of source.
- [x] Dot-to-dot — shipped photo-traced (polar boundary sampling); contour tracing for concave shapes is Phase 10
- [ ] **Novaform Studios imprint** — if publishing under a business license, how does that affect KDP account setup, the publisher field on book listings, and royalty payments? Legal/business question to resolve before scaling up publishing. Does not affect software architecture until then.
- [x] **Recipe file v2 — shipped, with full reproduction.** `engine/recipe.js`: versioned format (`recipeVersion: 2`) wrapping the book config with a `seed` and a `pageState[]` per-page layer (overrides today, reserved Fabric `canvasState` for the editor). **Seedable generators** (`engine/rng.js` `withSeed` swaps a seeded PRNG in for `Math.random` during synchronous generation) make the *entire* book — structure, word selection, and exact puzzle grids — reproduce from the seed, with no per-generator changes. `generate(config, { seed })` reproduces a single puzzle (the basis for per-page reroll). v1 recipes migrate automatically; Book Builder saves/loads v2; per-page border override honored at render.
- [x] ComfyUI style library — "Save Style" button on the AI Art page saves the current checkpoint/LoRA/seed/CFG/sampler combo with a user-given name. Style picker dropdown recalls saved presets. Personal library built up over time through use. No pre-built presets shipped.
- [x] KDP AI disclosure — resolved. See KDP AI Disclosure section. Puzzle grids are algorithmic (no disclosure). AI theme word lists, ComfyUI art, and AI fallback quotes require disclosure. Private checkbox — readers never see it.

---

*Last updated: 2026-06-29*

---

## Page Editor (Phase 9 — Publisher Only)

The page editor sits between bulk generation and PDF export. It replaces the current read-only preview with a full layout canvas giving surgical control over individual pages without regenerating the entire book.

### Workflow
```
Generate book → Export PDF  (default, fast path)
                    ↓ optional
              "Open in Editor" → Page Editor → Export PDF
```

The bulk generator stays exactly as-is — fast, batch, automated. Export straight from Book Builder if the book looks good. The editor is opt-in, only when you want to polish a specific book before publishing. It never gets in the way of the fast workflow.

**"Open in Editor" button** appears in the Book Builder after generation. Skipping it and exporting directly remains the default path.

### UI Layout
- **Left sidebar** — page thumbnail strip, drag to reorder, click to select, add/remove pages inline
- **Main canvas** — Fabric.js editor for the selected page
- **Right panel** — contextual controls for whatever element is selected (puzzle settings, text formatting, image sizing, border override)

### Per-Page Controls
- **Reroll individual puzzle** — regenerates just that puzzle (same type/theme/difficulty/seed range), drops it back in without touching any other page. The key feature — surgical fixes without blowing up the whole book.
- Resize and reposition the puzzle grid on the page
- Change border style per page (overrides book-level default)
- Swap filler page type (coloring → drawing → blank)
- Add or remove pages from the sidebar

### Freeform Content Layer
Fabric.js canvas sits as an editable overlay on top of the locked puzzle background.

**Text boxes:**
- Add anywhere on the page
- Free font / size / color / alignment control
- Used for story snippets, captions, chapter titles, custom instructions

**Clipart:**
- Upload an image directly or pull from the AI Art page with one click
- Drag to position, resize, rotate, layer above or below other elements
- No built-in library in v1 — build your own library over time from uploads and ComfyUI generations

**Story threading:**
- No structured story mode — purely freeform
- Thread a narrative by adding text boxes and clipart to each page as you see fit
- Chapter title pages: add a blank page, fill it with a large text box and a full-page illustration

### Layers
- **Background layer** (locked) — rendered puzzle content
- **Decoration layer** (editable) — Fabric.js: text boxes, clipart, overlays

### Export
- Chromium composites both layers at correct trim size and DPI
- Export triggers from the editor — replaces the current one-click export

### Recipe Format v2 — Required Prerequisite
The current recipe format saves book config only. The page editor requires saving full layout state per page:
- Per-page puzzle seed (so reroll knows what it's replacing)
- Text box positions, content, and formatting
- Clipart references and transform state
- Decoration layer JSON (Fabric.js canvas state)

**Recipe v2 schema additions:**
```js
{
  version: "2.0",         // required — enables future migration
  bookConfig: { ... },    // existing config
  pages: [
    {
      puzzleId: "uuid",
      puzzleSeed: 12345,
      canvasState: { ... }  // Fabric.js JSON
    }
  ]
}
```

**Recipe v2 must be designed and implemented before the page editor is built.** Saves made in v1 format are migrated automatically on load (canvasState defaults to empty).

