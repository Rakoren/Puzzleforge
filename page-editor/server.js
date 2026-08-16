/**
 * PuzzleForge Page Editor — standalone server.
 *
 * A fork of the PuzzleForge Web app trimmed to JUST the Page Editor: it serves
 * only the editor page and the API routes the editor calls (open/assemble a
 * book, insert/reroll a page, checklist, proofread, thesaurus, interior PDF,
 * and the KDP package zip), plus the engine scripts the editor shares
 * (element-html.js, decor.js, qrcode-generator.js).
 *
 * The engine is Node-only (themes read from disk, PDF export drives Chromium),
 * so generation happens server-side; the browser handles the editor UI and
 * downloads. `require('..')` resolves the engine from the repo root.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const archiver = require('archiver');
const Anthropic = require('@anthropic-ai/sdk');

// The PuzzleForge engine is vendored into ./vendor/puzzleforge-engine and wired
// in as a `file:` dependency, so this app is fully self-contained. Prefer the
// installed package; fall back to the vendored source directly so the server
// still boots from a bare checkout before `npm install`.
let pf;
try {
  pf = require('puzzleforge-engine');
} catch (_) {
  pf = require('./vendor/puzzleforge-engine');
}
// Absolute path to the engine package root, for serving the engine-side client
// scripts the editor shares (element-html.js, decor.js) regardless of where
// this app is installed.
let engineDir;
try {
  engineDir = path.dirname(require.resolve('puzzleforge-engine/package.json'));
} catch (_) {
  engineDir = path.join(__dirname, 'vendor', 'puzzleforge-engine');
}

const app = express();
// Larger limit so the Cover Builder can accept a full-bleed front image as a data URL.
app.use(express.json({ limit: '16mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Browsers auto-request /favicon.ico; serve the SVG brand mark so it doesn't 404.
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml').sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});
// The engine's element renderer is shared with the editor so on-screen objects
// and exported PDF pixels match exactly.
app.get('/element-html.js', (req, res) => {
  res.sendFile(path.join(engineDir, 'engine', 'element-html.js'));
});
// The engine's border renderer, shared with the editor so the live page border
// matches the printed one exactly.
app.get('/decor.js', (req, res) => {
  res.sendFile(path.join(engineDir, 'engine', 'decor.js'));
});

// QR encoder (qrcode-generator, MIT) served so the editor can build a QR's
// module matrix client-side — the same library the engine uses, so an editor
// QR matches a server-generated one.
app.get('/qrcode-generator.js', (req, res) => {
  res.sendFile(require.resolve('qrcode-generator'));
});

// Self-hosted LAN team workspace: shared roster, shared book library, live
// comments. Zero external services — persists to ./data. Optional token auth
// via PUZZLEFORGE_WORKSPACE_TOKEN.
const WORD_TYPES = new Set(['wordsearch', 'wordscramble', 'crossword', 'krisskross']);
const RECIPE_VERSION = 1;

// Small in-memory cache so a Download PDF reuses the exact puzzle that was
// previewed (generation is randomized). Bounded to avoid unbounded growth.
const puzzleCache = new Map();
const CACHE_LIMIT = 200;
function cachePut(puzzle) {
  puzzleCache.set(puzzle.id, puzzle);
  if (puzzleCache.size > CACHE_LIMIT) {
    puzzleCache.delete(puzzleCache.keys().next().value);
  }
}

// Resolve an engine generate() config from a recipe, mirroring the CLI.
function configFromRecipe(recipe) {
  const type = recipe.type || 'wordsearch';
  const difficulty = Number(recipe.difficulty) || 1;
  const config = {
    type,
    difficulty,
    size: recipe.size ? Number(recipe.size) : undefined,
    title: recipe.title || undefined,
    theme: recipe.theme || null,
  };

  if (WORD_TYPES.has(type)) {
    if (Array.isArray(recipe.words) && recipe.words.length) {
      config.words = recipe.words;
      config.clues = recipe.clues || {};
    } else if (recipe.theme) {
      const theme = pf.resolveTheme(recipe.theme); // id, array, or "cat:Category"
      const count = recipe.wordCount || 14;
      let words = pf.selectWords(theme, { difficulty, count });
      if (!words.length) words = pf.selectWords(theme, { count });
      config.words = words;
      config.clues = pf.clueMap(theme);
      config.theme = theme.label; // clean title for a merged category
    } else {
      const err = new Error('This puzzle type needs a theme or a custom word list.');
      err.status = 400;
      throw err;
    }
  } else if (pf.isActivityType(type) && recipe.theme) {
    // Coloring / drawing pages can take a few theme words for a prompt or
    // bubble-letter subject, but never require them.
    try {
      const theme = pf.resolveTheme(recipe.theme);
      config.words = pf.selectWords(theme, { difficulty, count: 12 });
      config.theme = theme.label;
    } catch (_) {
      /* theme optional for activity pages */
    }
  }
  return config;
}

function renderOpts(recipe, answerKey) {
  const difficulty = Number(recipe.difficulty) || 1;
  return {
    trimSize: recipe.trimSize || '8.5x11',
    audience: recipe.audience || (difficulty <= 1 ? 'kids' : 'adult'),
    answerKey: Boolean(answerKey),
    textScale: Number(recipe.fontScale) || 1,
    fontFamily: recipe.fontFamily || 'sans',
    border: recipe.border || null,
    borderColor: recipe.borderColor || null,
  };
}

// --- API ---

app.get('/api/meta', (req, res) => {
  const themes = pf.listThemesDetailed();
  res.json({
    types: pf.listTypes(),
    wordTypes: [...WORD_TYPES],
    themes,
    trimSizes: pf.listTrimSizes(),
    borderStyles: pf.borderStyles,
    // Audience-specific difficulty labels (internal levels 1–4).
    difficulty: {
      levels: pf.difficultyLevels,
      kids: pf.difficultyOptions('kids'),
      adult: pf.difficultyOptions('adult'),
    },
    recipeVersion: RECIPE_VERSION,
  });
});

// Resolve the words + clues a clue-type puzzle would use, so the UI can offer
// an editable clue list.
const labeled = (puzzle, suffix) => ({ ...puzzle, title: `${puzzle.title} — ${suffix}` });

// Teacher sets: differentiation (one puzzle at each level) and class sets (N
// re-randomized copies). Returns a single combined PDF.
// --- Classroom worksheets + lesson packets ---

// Readable puzzle-type + difficulty labels for a packet's contents list.
const TYPE_LABELS = {
  wordsearch: 'Word Search', numbersearch: 'Number Search', crossword: 'Crossword',
  krisskross: 'Kriss-Kross', wordscramble: 'Word Scramble', sudoku: 'Sudoku', maze: 'Maze',
  cryptogram: 'Cryptogram', nonogram: 'Nonogram', trivia: 'Trivia', logicgrid: 'Logic Grid',
  wordladder: 'Word Ladder', wordwheel: 'Word Wheel', cipher: 'Cipher', riddles: 'Riddles',
  brainteasers: 'Brain Teasers', mathpuzzles: 'Math Puzzles', xsudoku: 'X-Sudoku',
  minisudoku: 'Mini Sudoku', evenodd: 'Even-Odd Sudoku', kakuro: 'Kakuro',
  coloring: 'Coloring', drawing: 'Drawing',
};
const typeLabel = (t) => TYPE_LABELS[t] || String(t || '').replace(/\b\w/g, (c) => c.toUpperCase());
function diffLabel(d, audience) {
  const kids = String(audience).toLowerCase() === 'kids';
  const adult = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Expert' };
  const kid = { 1: 'Beginner', 2: 'Early Reader', 3: 'Growing Reader', 4: 'Independent' };
  const one = (n) => (kids ? kid[n] : adult[n]) || `L${n}`;
  const s = String(d == null ? 1 : d);
  if (s.includes('-')) { const [lo, hi] = s.split('-'); return `${one(+lo)}–${one(+hi)}`; }
  return one(parseInt(s, 10) || 1);
}

// Normalize the student-header options a worksheet carries.
function headerFromReq(h) {
  h = h || {};
  if (h.enabled === false) return null;
  return { classField: !!h.classField, footer: h.footer ? String(h.footer).slice(0, 120) : '' };
}

// Live worksheet preview (HTML for an iframe) — one puzzle with the teacher header.
// Download a single worksheet PDF (optionally a teacher answer copy after it).
// Download a lesson packet PDF: cover + worksheets + optional answer-key section.
// Curriculum grade presets (grade → difficulty, standards, puzzle mix).
// Auto lesson-plan: grade + topic (+ count) → a packet config the Worksheets
// page loads into its form (the teacher can then tweak and download).
// --- Book builder ---

const bookCache = new Map();
function cacheBook(book) {
  const id = crypto.randomUUID();
  bookCache.set(id, book);
  if (bookCache.size > 50) bookCache.delete(bookCache.keys().next().value);
  return id;
}

// Drawing / coloring-bubble pages whose subject word can be swapped.
function editablePages(book) {
  const out = [];
  book.pages.forEach((pg, index) => {
    const p = pg.puzzle;
    if (p.type === 'drawing') {
      out.push({ index, type: 'drawing', current: p.data.subject || '', label: p.data.prompt, choices: p.data.choices || [] });
    } else if (p.type === 'coloring' && p.data.word) {
      out.push({ index, type: 'coloring', current: p.data.subject || p.data.word, label: `Color: ${p.data.word}`, choices: p.data.choices || [] });
    }
  });
  return out;
}

// Ahead-of-generation word-pool check: with "No repeated words" on, warn when
// the requested puzzles would need more unique theme words than a theme has.
// Cheap (counts words, generates nothing).
app.post('/api/book/pdf', async (req, res) => {
  const body = req.body || {};
  try {
    let book = body.bookId && bookCache.get(body.bookId);
    if (!book) book = pf.assembleBook(body.config || {});
    if (body.master !== undefined) book.master = body.master;
    book.customFonts = sanitizeCustomFonts(body.fonts);
    // The Page Editor sends live per-page state (decorations + per-page border)
    // to apply onto the cached (possibly rerolled) book before rendering. A
    // pagePlan additionally reorders / inserts blanks / deletes / duplicates.
    let leaves;
    if (Array.isArray(body.pagePlan)) { const r = pagePlanRender(book, body.pagePlan); book = r.view; leaves = r.leaves; }
    else applyPageState(book, body.pageState);
    const outPath = path.join(os.tmpdir(), `pf-book-${crypto.randomUUID()}.pdf`);
    await pf.exportBookPdf(book, { outPath, leaves });
    const pdf = fs.readFileSync(outPath);
    fs.unlink(outPath, () => {});
    const base = (book.title || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Swap the subject word on a single drawing/coloring page of a cached book.
// --- Page Editor ---

// Apply an editor pageState array (by content-page index) onto a cached book.
function applyPageState(book, pageState) {
  if (!Array.isArray(pageState) || !book || !Array.isArray(book.pages)) return;
  book.pages.forEach((pg, i) => {
    if (pageState[i] && typeof pageState[i] === 'object') pg.state = pageState[i];
  });
}

// Turn an editor "page plan" into an engine leaf list + a matching book VIEW.
// The plan is the final order of ALL pages (title, front matter, puzzles,
// answer key, back matter) with inserted blanks, deletions, duplicates, and
// per-page edit state. Each entry names a role:
//   { role:'content', src, state }   reuse cached content page `src`
//   { role:'blank', state }          fresh blank page
//   { role:'title'|'answerkey', state }
//   { role:'frontmatter'|'backmatter', matterKind, state }
// Returns { view, leaves }: `leaves` drives page order/rendering; `view` is a
// shallow book copy whose `.pages` are the plan's content pages (so the answer
// key + page counts reflect the arrangement). The cached book is never mutated.
// Human label for a non-content (title / matter / answer key) leaf.
function leafTitle(leaf) {
  if (leaf.role === 'title') return 'Title Page';
  if (leaf.role === 'answerkey') return leaf.akIndex ? `Answer Key (${leaf.akIndex + 1})` : 'Answer Key';
  return {
    copyright: 'Copyright', belongsTo: 'This Book Belongs To', intro: 'Introduction',
    about: 'About the Author', morebooks: 'More Books',
  }[leaf.matterKind] || leaf.matterKind || 'Page';
}

function pagePlanRender(book, plan) {
  if (!Array.isArray(plan) || !book || !Array.isArray(book.pages)) return { view: book, leaves: undefined };
  const frontByKind = {};
  (book.frontMatter || []).forEach((fm) => { frontByKind[fm.kind] = fm; });
  const backByKind = {};
  (book.backMatter || []).forEach((bm) => { backByKind[bm.kind] = bm; });

  const leaves = [];
  for (const e of plan) {
    if (!e || typeof e !== 'object') continue;
    const state = e.state && typeof e.state === 'object' ? e.state : null;
    if (e.role === 'content') {
      // A page inserted in the editor carries its own puzzle object; original
      // pages reference the cached book by index (src).
      const puzzle = (e.puzzle && typeof e.puzzle === 'object') ? e.puzzle : (book.pages[e.src] && book.pages[e.src].puzzle);
      if (!puzzle) continue;
      leaves.push({ role: 'content', puzzle, state, src: e.src });
    } else if (e.role === 'blank') {
      leaves.push({ role: 'content', puzzle: pf.generate({ type: 'bleedguard', label: '' }), state });
    } else if (e.role === 'title') {
      leaves.push({ role: 'title', state });
    } else if (e.role === 'answerkey') {
      leaves.push({ role: 'answerkey', akIndex: e.akIndex || 0, state });
    } else if (e.role === 'frontmatter') {
      const fm = frontByKind[e.matterKind]; if (!fm) continue;
      leaves.push({ role: 'frontmatter', matter: fm, matterKind: fm.kind, state });
    } else if (e.role === 'backmatter') {
      const bm = backByKind[e.matterKind]; if (!bm) continue;
      leaves.push({ role: 'backmatter', matter: bm, matterKind: bm.kind, state });
    }
  }
  if (!leaves.length) return { view: book, leaves: undefined };

  // Printed page numbers (content puzzles + answer key), by position.
  let n = 0;
  const pages = [];
  for (const leaf of leaves) {
    const numbered = (leaf.role === 'content' && leaf.puzzle.type !== 'bleedguard') || leaf.role === 'answerkey';
    if (numbered) n += 1;
    if (leaf.role === 'content') pages.push({ puzzle: leaf.puzzle, pageNumber: n, state: leaf.state });
  }
  const byType = {};
  for (const p of pages) byType[p.puzzle.type] = (byType[p.puzzle.type] || 0) + 1;
  const view = {
    ...book,
    pages,
    puzzles: pages.map((p) => p.puzzle),
    meta: {
      ...book.meta,
      pageCount: pages.length,
      puzzleCount: pages.filter((p) => !pf.isActivityType(p.puzzle.type)).length,
      byType,
    },
  };
  return { view, leaves };
}

// Sanitize the editor's uploaded custom fonts before they reach the PDF doc.
// Only data: URLs and pf-custom-<slug> family names survive; the font-face CSS
// is re-derived from the slug in the engine, so nothing here is trusted verbatim.
function sanitizeCustomFonts(fonts) {
  if (!Array.isArray(fonts)) return undefined;
  const out = [];
  for (const f of fonts.slice(0, 24)) {
    const family = String((f && f.family) || '');
    const dataUrl = String((f && f.dataUrl) || '');
    if (!/^pf-custom-[a-z0-9_-]+$/i.test(family)) continue;
    if (!/^data:[a-z0-9/+.-]+;base64,[a-z0-9+/=]+$/i.test(dataUrl)) continue;
    if (dataUrl.length > 2_000_000) continue; // ~1.5MB font, generous
    out.push({ family, dataUrl });
  }
  return out;
}

// Resolve a request into the FINAL book + leaf order to render. Honors the
// editor's pagePlan (hand arrangement + templates) so pre-flight checks,
// royalty, and the export package all reflect exactly what will print.
function resolveBook(body) {
  let book = body.bookId && bookCache.get(body.bookId);
  if (!book) book = pf.assembleBook(body.config || {});
  // The editor sends the live master-page overlay separately so it applies even
  // to a cached book (bookId) whose config predates the master.
  if (body.master !== undefined) book.master = body.master;
  book.customFonts = sanitizeCustomFonts(body.fonts);
  let leaves;
  if (Array.isArray(body.pagePlan)) { const r = pagePlanRender(book, body.pagePlan); book = r.view; leaves = r.leaves; }
  else if (Array.isArray(body.pageState)) applyPageState(book, body.pageState);
  return { book, leaves };
}

// Render `book` (with optional leaf order) to a temp PDF and return its bytes +
// page count. Caller deletes nothing — the temp file is unlinked here.
async function renderInterior(book, leaves) {
  const outPath = path.join(os.tmpdir(), `pf-int-${crypto.randomUUID()}.pdf`);
  try {
    await pf.exportBookPdf(book, { outPath, leaves });
    const buf = fs.readFileSync(outPath);
    return { buf, pageCount: countPdfPages(buf) };
  } finally {
    fs.unlink(outPath, () => {});
  }
}

// Render one content page's puzzle HTML (single-page doc) at the book's trim,
// honoring per-page border but NOT the decoration overlay (the editor draws
// that live on the Fabric canvas).
function pageHtml(book, puzzle, state) {
  const st = state || {};
  const border = st.border !== undefined ? st.border : book.border;
  const borderColor = st.borderColor !== undefined ? st.borderColor : book.borderColor;
  return pf.renderHtml(puzzle, {
    trimSize: book.trimSize,
    audience: book.audience,
    textScale: book.fontScale,
    fontFamily: book.fontFamily,
    border,
    borderColor,
  });
}

// Open a book in the editor: assemble (or reuse), return per-page background
// HTML + the usable-area dimensions the Fabric canvas maps onto.
app.post('/api/book/editor', (req, res) => {
  const body = req.body || {};
  try {
    let book = body.bookId && bookCache.get(body.bookId);
    let bookId = body.bookId;
    if (!book) {
      book = pf.assembleBook(body.config || {});
      bookId = cacheBook(book);
    }
    // Match the export layout (textScale + fontFamily), so what the editor
    // splits and shows is what the PDF prints — otherwise large-print / a custom
    // font can wrap text differently on export (e.g. a drawing-page title that
    // fits on one line in the editor wraps to two on export and runs off).
    const layout = pf.getLayout(book.trimSize, { audience: book.audience, textScale: book.fontScale, fontFamily: book.fontFamily });
    // The book's decorative page frame is applied at render/export time, not
    // baked into the split pieces — so seed it onto each eligible page's state
    // so the editor draws the same border the Book Builder preview and PDF show.
    // Match the exporter: the frame goes on real puzzle pages, never on activity
    // (coloring/drawing) pages or front/back matter.
    const bookBorder = book.border && book.border !== 'none' ? book.border : null;
    const withBorder = (state, wants) => {
      if (!bookBorder || !wants) return state || null;
      const s = { ...(state || {}) };
      if (s.border === undefined) s.border = bookBorder;
      if (s.borderColor === undefined && book.borderColor) s.borderColor = book.borderColor;
      return s;
    };
    // Every physical page (title, front matter, puzzles, answer key, back
    // matter) as an editable, splittable leaf — so the editor shows the whole
    // book, not only the puzzles.
    const pages = pf.defaultLeaves(book).map((leaf, index) => {
      let split, type, title, activity, src = null;
      if (leaf.role === 'content') {
        split = pf.splitPuzzle(leaf.puzzle, layout);
        type = leaf.puzzle.type;
        title = leaf.puzzle.title || leaf.puzzle.type;
        activity = pf.isActivityType(leaf.puzzle.type);
        src = leaf.src;
      } else {
        split = pf.splitHtml(pf.renderMatterDoc(book, layout, leaf));
        type = leaf.role === 'title' ? 'title' : leaf.role === 'answerkey' ? 'answerkey' : leaf.matterKind;
        title = leafTitle(leaf);
        activity = true; // matter pages carry no puzzle to reroll
      }
      return {
        index, role: leaf.role, matterKind: leaf.matterKind || null, src,
        akIndex: leaf.akIndex != null ? leaf.akIndex : null,
        type, title, activity,
        style: split.style, components: split.components,
        state: withBorder(leaf.state, leaf.role === 'content' && !activity),
      };
    });
    res.json({
      bookId,
      seed: book.seed,
      title: book.title,
      dims: {
        usableWidth: layout.usableWidth,
        usableHeight: layout.usableHeight,
        widthIn: layout.widthIn,
        heightIn: layout.heightIn,
      },
      pages,
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Generate fresh puzzle page(s) to insert into the open book, using the book's
// own settings (theme, audience, trim, tier/difficulty ladder). Returns each as
// an editor page (style + components) PLUS the raw puzzle object, so the editor
// carries it in the page plan and it survives export and recipe save/reload.
app.post('/api/book/insert-puzzle', (req, res) => {
  const body = req.body || {};
  try {
    const type = String(body.type || '').trim();
    if (!type) return res.status(400).json({ error: 'Pick a puzzle type.' });
    const count = Math.max(1, Math.min(50, Number(body.count) || 1));
    const difficulty = Math.max(1, Math.min(4, Number(body.difficulty) || 1));
    const theme = String(body.theme || '').trim();
    const audience = body.audience === 'adult' ? 'adult' : (body.audience === 'kids' ? 'kids' : undefined);
    const style = String(body.style || '').trim();
    // Inherit every setting from the open book, then override the puzzle list.
    // A per-insert theme/audience/style (if any) overrides the book's default.
    const base = { ...(body.config || {}) };
    delete base.seed; delete base.pageState;
    const spec = { type, count, difficulty, ...(theme ? { theme } : {}), ...(style ? { style } : {}) };
    const cfg = { ...base, titlePage: false, answerKey: false, puzzles: [spec], ...(audience ? { audience } : {}) };
    const gen = pf.assembleBook(cfg);
    const layout = pf.getLayout(gen.trimSize, { audience: gen.audience, textScale: gen.fontScale, fontFamily: gen.fontFamily });
    // Carry the book's page frame onto real puzzle pages (not activity pages),
    // so an inserted puzzle matches the rest of a bordered book.
    const bookBorder = gen.border && gen.border !== 'none' ? gen.border : null;
    const pages = (gen.pages || [])
      .filter((pg) => pg.puzzle && pg.puzzle.type !== 'bleedguard')
      .map((pg) => {
        const split = pf.splitPuzzle(pg.puzzle, layout);
        const activity = pf.isActivityType(pg.puzzle.type);
        return {
          role: 'content', type: pg.puzzle.type,
          title: pg.puzzle.title || pg.puzzle.type,
          activity,
          style: split.style, components: split.components, puzzle: pg.puzzle,
          state: (bookBorder && !activity)
            ? { border: bookBorder, ...(gen.borderColor ? { borderColor: gen.borderColor } : {}) }
            : null,
        };
      });
    if (!pages.length) return res.status(400).json({ error: 'Could not generate that puzzle type.' });
    res.json({ pages, dims: { usableWidth: layout.usableWidth, usableHeight: layout.usableHeight } });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Re-render one page's background HTML with a given per-page state (e.g. a
// border override), for live preview in the editor. Cheap (no PDF render).
// Rebuild a generation config from an existing puzzle so it can be re-rolled.
function configFromPuzzle(p) {
  const c = { type: p.type, difficulty: p.difficulty, theme: p.theme || undefined };
  const d = p.data || {};
  if (Array.isArray(d.words)) c.words = d.words.map((w) => (typeof w === 'string' ? w : w.word)).filter(Boolean);
  if (d.clues) c.clues = d.clues;
  if (d.size) c.size = d.size;
  return c;
}

// Reroll one puzzle page (new layout, same type/difficulty/words) with a fresh
// seed. Decorations live in the editor client and are unaffected.
app.post('/api/book/reroll', (req, res) => {
  const body = req.body || {};
  const book = body.bookId && bookCache.get(body.bookId);
  if (!book) return res.status(404).json({ error: 'Open the book in the editor again.' });
  const pg = book.pages[body.index];
  if (!pg) return res.status(400).json({ error: 'Invalid page.' });
  try {
    const p = pg.puzzle;
    if (pf.isActivityType(p.type)) return res.status(400).json({ error: 'Activity pages have no puzzle to reroll.' });
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const np = pf.generate(configFromPuzzle(p), { seed });
    const pi = book.puzzles.indexOf(p);
    pg.puzzle = np;
    if (pi >= 0) book.puzzles[pi] = np;
    const layout = pf.getLayout(book.trimSize, { audience: book.audience, textScale: book.fontScale, fontFamily: book.fontFamily });
    const split = pf.splitPuzzle(np, layout);
    res.json({ index: body.index, type: np.type, title: np.title, style: split.style, components: split.components, seed });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Pre-flight publish checklist (logic checks). Renders the interior once to get
// an accurate page count (the answer key paginates), then runs the checks.
app.post('/api/book/checklist', async (req, res) => {
  const body = req.body || {};
  try {
    const { book, leaves } = resolveBook(body);
    const { pageCount } = await renderInterior(book, leaves);
    const result = pf.runChecklist(book, { pageCount, specs: (body.config || {}).puzzles });
    res.json({ ...result, pageCount });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// KDP royalty estimate. Renders the interior for an accurate page count unless
// a pageCount is supplied directly.
// --- Publish flow: proofread + package export ---

// User-authored prose on the pages: template/matter text objects the user typed,
// plus the book title/subtitle. Puzzle grids and clues are excluded — they're
// generated and proofreading them just flags intentional puzzle words.
function collectProse(book) {
  const out = [];
  const push = (page, text) => { const t = String(text || '').trim(); if (t.length > 1) out.push({ page, text: t }); };
  if (book.title) push(1, book.title);
  if (book.subtitle) push(1, book.subtitle);
  (book.pages || []).forEach((pg, i) => {
    const els = pg.state && pg.state.layout && pg.state.layout.elements;
    if (Array.isArray(els)) els.forEach((e) => { if (e && e.kind === 'text') push(pg.pageNumber || i + 1, e.text); });
  });
  return out;
}

const PROOF_MODEL = process.env.PUZZLEFORGE_PROOF_MODEL || 'claude-opus-4-8';
async function proofreadSnippets(snippets) {
  const client = new Anthropic();
  const numbered = snippets.map((s, i) => `[#${i + 1} · page ${s.page}]\n${s.text}`).join('\n\n');
  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            page: { type: 'integer' },
            severity: { type: 'string', enum: ['error', 'suggestion'] },
            original: { type: 'string' },
            fix: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['page', 'severity', 'original', 'fix', 'note'],
        },
      },
    },
    required: ['issues'],
  };
  const prompt = [
    'You are proofreading the reader-facing text of a print puzzle/activity book.',
    'Report only real problems: spelling, grammar, punctuation, and clarity. Do NOT rewrite for style,',
    'do NOT flag intentional puzzle words, brand names, or proper nouns, and do NOT invent issues.',
    'Severity "error" = objectively wrong (misspelling, agreement); "suggestion" = a clear readability improvement.',
    'For each issue give the exact original phrase and a minimal corrected version. If everything is clean, return an empty list.',
    '',
    'Snippets (page numbers in brackets):',
    numbered,
  ].join('\n');

  const stream = client.messages.stream({
    model: PROOF_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const msg = await stream.finalMessage();
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let raw; try { raw = JSON.parse(text); } catch (_) { return []; }
  return Array.isArray(raw.issues) ? raw.issues.slice(0, 200) : [];
}

// Proofread the book's editable text (honors the editor's pagePlan).
app.post('/api/book/proofread', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'Proofreading needs an Anthropic API key. Set ANTHROPIC_API_KEY and restart the server.' });
  }
  try {
    const { book } = resolveBook(req.body || {});
    const snippets = collectProse(book);
    if (!snippets.length) {
      return res.json({ issues: [], checked: 0, note: 'No editable text to proofread yet. Add a title, intro, or copyright page (Insert → Page template), then run again.' });
    }
    const issues = await proofreadSnippets(snippets);
    res.json({ issues, checked: snippets.length, model: PROOF_MODEL });
  } catch (err) {
    const e = err instanceof Anthropic.AuthenticationError ? 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.' : err.message;
    res.status(err.status || 502).json({ error: e });
  }
});

// Content-quality pre-flight: one Claude pass over ALL the book's reader-facing
// text (titles, instructions, crossword clues, trivia Q&A, blurb, matter) that
// returns checklist-style findings — spelling/grammar plus weak clues, generic
// titles, dry blurbs, and reading-level mismatches.
const CONTENT_CATEGORY = {
  spelling: 'Spelling', grammar: 'Grammar', clue: 'Clue quality',
  title: 'Title', blurb: 'Blurb / description', 'reading-level': 'Reading level',
};
async function reviewBookContent(snippets, audience) {
  const client = new Anthropic();
  const numbered = snippets.map((s) => `[#${s.id} · ${s.kind}] ${s.text}`).join('\n');
  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id: { type: 'integer' },
            category: { type: 'string', enum: ['spelling', 'grammar', 'clue', 'title', 'blurb', 'reading-level'] },
            severity: { type: 'string', enum: ['error', 'suggestion'] },
            note: { type: 'string' },
            fix: { type: 'string' },
          },
          required: ['id', 'category', 'severity', 'note', 'fix'],
        },
      },
    },
    required: ['findings'],
  };
  const prompt = [
    'You are the quality reviewer for a print puzzle/activity book about to be published on Amazon KDP.',
    `The book's audience is "${audience}". Review the reader-facing snippets below and report only real problems:`,
    '- spelling / grammar: objective errors (severity "error"). Do NOT flag intentional puzzle words, brand names, or proper nouns.',
    '- clue: a crossword clue that is a placeholder like "(5 letters)", ambiguous, or unfair (severity "suggestion").',
    '- title: a generic puzzle or book title (e.g. "Word Search", "Sudoku — Medium") that could be more engaging (severity "suggestion").',
    '- blurb: a back-cover/description that is dry or unconvincing (severity "suggestion").',
    '- reading-level: instructions or clues that do not match the stated audience (severity "suggestion").',
    'Reference each finding by its #id. Give a short note and a concrete "fix" (a corrected phrase or a better alternative). If everything is clean, return an empty list. Do not invent issues.',
    '',
    'Snippets:',
    numbered,
  ].join('\n');
  const stream = client.messages.stream({
    model: PROOF_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const msg = await stream.finalMessage();
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let raw; try { raw = JSON.parse(text); } catch (_) { return []; }
  return Array.isArray(raw.findings) ? raw.findings.slice(0, 200) : [];
}

// Thesaurus: synonyms for a selected word/short phrase, so the editor can offer
// one-click replacements. Kept small — a single word/phrase in, a ranked list out.
async function synonymsFor(word) {
  const client = new Anthropic();
  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      synonyms: { type: 'array', items: { type: 'string' } },
      note: { type: 'string' },
    },
    required: ['synonyms', 'note'],
  };
  const prompt = [
    `Give up to 8 natural synonyms or close alternatives for the word or phrase: "${word}".`,
    'Match its likely part of speech and register. Order best-first. Single words or short phrases only.',
    'If it is a proper noun, number, or has no real synonyms, return an empty list and say why in "note" (else leave "note" empty).',
  ].join('\n');
  const stream = client.messages.stream({
    model: PROOF_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const msg = await stream.finalMessage();
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let raw; try { raw = JSON.parse(text); } catch (_) { return { synonyms: [], note: '' }; }
  return { synonyms: Array.isArray(raw.synonyms) ? raw.synonyms.slice(0, 8) : [], note: raw.note || '' };
}

app.post('/api/thesaurus', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'The thesaurus needs an Anthropic API key. Set ANTHROPIC_API_KEY and restart the server.' });
  }
  const word = String((req.body && req.body.word) || '').trim();
  if (!word) return res.status(400).json({ error: 'Select a text box (or type a word) to look up.' });
  if (word.length > 80) return res.status(400).json({ error: 'That is too long for a thesaurus lookup — select a single word or short phrase.' });
  try {
    res.json(await synonymsFor(word));
  } catch (err) {
    const e = err instanceof Anthropic.AuthenticationError ? 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.' : err.message;
    res.status(err.status || 502).json({ error: e });
  }
});

function renderChecklistText(chk, pageCount) {
  const lines = [
    'PuzzleForge — Pre-flight checklist',
    '==================================',
    '',
    `Pages: ${pageCount}`,
    `Blockers: ${chk.summary.blockers}   Warnings: ${chk.summary.warnings}   Passed: ${chk.summary.passes}`,
    '',
  ];
  chk.items.forEach((it) => {
    const tag = it.status === 'pass' ? 'PASS   ' : it.severity === 'blocker' ? 'BLOCKER' : 'WARN   ';
    lines.push(`[${tag}] ${it.label}${it.message ? ` — ${it.message}` : ''}`);
  });
  return lines.join('\n') + '\n';
}
function renderProofreadText(issues) {
  const lines = ['PuzzleForge — Proofread notes', '=============================', '', `${issues.length} item(s). AI-assisted — review each before accepting.`, ''];
  issues.forEach((it, i) => {
    lines.push(`${i + 1}. [page ${it.page || '?'}] (${it.severity || 'suggestion'})`);
    lines.push(`   original: ${it.original || ''}`);
    lines.push(`   fix:      ${it.fix || ''}`);
    if (it.note) lines.push(`   note:     ${it.note}`);
    lines.push('');
  });
  return lines.join('\n') + '\n';
}

// Export the finished book as one KDP upload package: interior PDF (honoring the
// editor's arrangement), full-wrap cover PDF, build-info sheet, pre-flight
// checklist, and (if supplied) proofread notes — zipped.
app.post('/api/book/package', async (req, res) => {
  const body = req.body || {};
  const coverIn = body.cover || {};
  const metadata = body.metadata || {};
  try {
    const { book, leaves } = resolveBook(body);
    const { buf: interior, pageCount } = await renderInterior(book, leaves);
    // A full Cover Builder design (via "Use for this book") takes precedence; the
    // simple color pickers are the fallback. Either way trim size and page count
    // are forced to the real book so the spine width is correct.
    const coverFull = body.coverFull && typeof body.coverFull === 'object' ? body.coverFull : null;
    const paper = metadata.paper === 'cream' || coverIn.paper === 'cream' || (coverFull && coverFull.paper === 'cream') ? 'cream' : 'white';

    const coverConfig = coverFull
      ? {
        ...coverFull,
        trimSize: book.trimSize, pageCount, paper,
        title: coverFull.title || book.title, subtitle: coverFull.subtitle || book.subtitle, author: coverFull.author || book.author,
      }
      : {
        trimSize: book.trimSize, pageCount, paper,
        title: book.title, subtitle: book.subtitle, author: book.author,
        front: { bgColor: coverIn.bgColor, textColor: coverIn.textColor, titlePosition: coverIn.titlePosition || 'center', image: coverIn.image || null },
        back: { bgColor: coverIn.backColor || coverIn.bgColor, textColor: coverIn.textColor, blurb: coverIn.blurb || metadata.description || null },
        spine: { bgColor: coverIn.bgColor, textColor: coverIn.textColor },
      };
    const coverPath = path.join(os.tmpdir(), `pf-cov-${crypto.randomUUID()}.pdf`);
    let cover;
    try { await pf.exportCoverPdf(coverConfig, { outPath: coverPath }); cover = fs.readFileSync(coverPath); } finally { fs.unlink(coverPath, () => {}); }

    const dims = pf.coverDimensions(book.trimSize, pageCount, paper);
    const info = buildInfoSheet({ title: book.title, subtitle: book.subtitle, author: book.author }, book, pageCount, paper, dims, metadata, coverConfig);
    const chkReport = renderChecklistText(pf.runChecklist(book, { pageCount }), pageCount);

    const base = (book.title || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-kdp-package.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
    archive.pipe(res);
    archive.append(interior, { name: 'interior.pdf' });
    archive.append(cover, { name: 'cover.pdf' });
    archive.append(info, { name: 'build-info.txt' });
    archive.append(chkReport, { name: 'preflight-checklist.txt' });
    if (Array.isArray(body.proofreadIssues) && body.proofreadIssues.length) {
      archive.append(renderProofreadText(body.proofreadIssues), { name: 'proofread-notes.txt' });
    }
    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
  }
});

// --- One-click KDP export bundle ---

// Count physical pages in a rendered PDF (the answer key paginates naturally,
// so the spine must be sized from the actual count, not an estimate).
function countPdfPages(pdfBuffer) {
  const s = pdfBuffer.toString('latin1');
  const pageObjs = (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  let maxCount = 0;
  for (const m of s.matchAll(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/g)) {
    maxCount = Math.max(maxCount, Number(m[1]));
  }
  return Math.max(pageObjs, maxCount) || pageObjs;
}

// Cover-image resolution lines for the build-info sheet (empty when no image).
function coverImageLines(coverConfig) {
  if (!coverConfig) return [];
  let d;
  try { d = pf.frontImageDpi(coverConfig); } catch (_) { d = null; }
  if (!d) return [];
  return [
    `Cover image:      ${d.width} x ${d.height}px → ~${d.dpi} DPI on the front panel` +
      (d.ok ? ' (OK)' : `  ⚠ BELOW ${d.minDpi} DPI — use a larger image`),
  ];
}

function buildInfoSheet(config, book, pageCount, paper, dims, meta, coverConfig) {
  const md = pf.normalizeMetadata(meta || {});
  const colorPaper = paper === 'cream' ? 'bw' : 'bw'; // interiors here are B&W
  const est = pf.royaltyEstimate({ pageCount, paper: colorPaper, listPrice: md.listPrice });
  const disc = pf.aiDisclosure(md);
  const usd = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
  const slot = (arr, n) =>
    Array.from({ length: n }, (_, i) => `  ${i + 1}. ${arr[i] || ''}`).join('\n');

  const lines = [
    'PuzzleForge — KDP Build Info',
    '============================',
    '',
    `Title:            ${config.title || ''}`,
    config.subtitle ? `Subtitle:         ${config.subtitle}` : null,
    `Author:           ${config.author || ''}`,
    md.seriesName ? `Series:           ${md.seriesName}${md.seriesNumber ? ` (book ${md.seriesNumber})` : ''}` : null,
    md.readingAge ? `Reading age:      ${md.readingAge}` : null,
    `Language:         ${md.language}`,
    '',
    `Trim size:        ${dims.trimWidthIn} x ${dims.trimHeightIn} in`,
    `Interior pages:   ${pageCount}`,
    `Paper:            ${paper}`,
    `Spine width:      ${dims.spineIn} in`,
    `Full cover size:  ${dims.fullWidthIn} x ${dims.fullHeightIn} in (includes 0.125" bleed)`,
    `Spine text:       ${dims.spineTextAllowed ? 'printed (book is long enough)' : 'hidden (KDP needs >= 79 pages)'}`,
    ...coverImageLines(coverConfig),
    '',
    'Description / blurb',
    '-------------------',
    md.description || '(none entered)',
    '',
    'Keywords (7 slots — fill all for discoverability)',
    '-------------------------------------------------',
    slot(md.keywords, 7),
    '',
    'Categories (3 slots)',
    '--------------------',
    slot(md.categories, 3),
    '',
    'Royalty estimate (US, 60%, B&W) — confirm rates on KDP',
    '------------------------------------------------------',
    `Printing cost:    ${usd(est.printCost)}  (rates as of ${est.ratesUpdated})`,
    `Breakeven price:  ${usd(est.breakeven)}  (minimum list price for any royalty)`,
    `Suggested range:  ${usd(est.suggestedLow)} – ${usd(est.suggestedHigh)}`,
    md.listPrice != null ? `At list ${usd(est.listPrice)}: royalty ${usd(est.royalty)} / sale${est.belowMinimum ? '  ⚠ BELOW BREAKEVEN' : ''}` : 'List price:       (not set)',
    '',
    'AI disclosure (KDP upload form — readers never see this)',
    '-------------------------------------------------------',
    `Used AI:          ${disc.usedAI ? 'Yes' : 'No'}`,
    `Content type(s):  ${disc.contentTypes.length ? disc.contentTypes.join('; ') : 'None'}`,
    `AI tool(s):       ${disc.tools.length ? disc.tools.join('; ') : 'None'}`,
    'Note: puzzle grids and answer keys are algorithmic — not AI — and are not disclosed.',
    '',
    'Files in this bundle',
    '--------------------',
    'interior.pdf  — upload as the book interior / manuscript',
    'cover.pdf     — upload as the full-wrap paperback cover',
    '',
    'When setting up the KDP paperback, match these exactly:',
    `  • Trim size: ${dims.trimWidthIn} x ${dims.trimHeightIn} in`,
    `  • Paper type: ${paper}`,
    '  • Bleed: Yes (the cover includes 0.125" bleed)',
  ];
  if (pageCount < 24) {
    lines.push('', `WARNING: KDP requires at least 24 pages — this book has ${pageCount}. Add more content.`);
  }
  if (pageCount % 2 !== 0) {
    lines.push('', `NOTE: page count is odd (${pageCount}) — add one blank page so KDP doesn't pad it unpredictably.`);
  }
  return lines.filter((l) => l !== null).join('\n') + '\n';
}

// Build interior PDF + cover PDF + build-info sheet, zipped, in one request.
// Upload note bundled with the landing pages.
function digitalReadme(plan) {
  return [
    'PuzzleForge — Digital layer (QR "scan for answers")',
    '===================================================',
    '',
    `These pages back the QR codes printed on your puzzle pages. Upload the`,
    `"${plan.slug}" folder to your web host so the QRs resolve, e.g.:`,
    '',
    `  ${plan.baseUrl}/${plan.slug}/p1.html`,
    '',
    'Each file is self-contained (no server, no dependencies) — any static host',
    '(Netlify, GitHub Pages, Cloudflare Pages, an S3 bucket, your own domain)',
    'works. index.html lists every puzzle. Re-export after any change so the',
    'printed QRs and these pages stay in sync.',
    '',
  ].join('\n') + '\n';
}

const PORT = process.env.PORT || 4100;
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`PuzzleForge Page Editor running at http://localhost:${PORT}`);
  });
}

module.exports = { app, configFromRecipe };
