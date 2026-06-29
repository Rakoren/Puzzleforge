/**
 * PuzzleForge Web — teacher tool server.
 *
 * A thin Express server over the PuzzleForge engine. The engine is Node-only
 * (themes read from disk, PDF export drives Chromium), so generation happens
 * server-side; the browser handles the form, live preview, and downloads.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const archiver = require('archiver');

// Import the engine as a package (file:.. dependency) with a relative fallback
// so the app runs whether or not it has been `npm install`ed.
let pf;
try {
  pf = require('puzzleforge-engine');
} catch (_) {
  pf = require('..');
}

const app = express();
// Larger limit so the Cover Builder can accept a full-bleed front image as a data URL.
app.use(express.json({ limit: '16mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
    recipeVersion: RECIPE_VERSION,
  });
});

app.post('/api/preview', (req, res) => {
  const recipe = req.body && req.body.recipe ? req.body.recipe : {};
  try {
    const config = configFromRecipe(recipe);
    const puzzle = pf.generate(config);
    cachePut(puzzle);

    const previewHtml = pf.renderHtml(puzzle, renderOpts(recipe, false));
    const answerHtml = pf.renderHtml(puzzle, renderOpts(recipe, true));

    res.json({
      puzzleId: puzzle.id,
      previewHtml,
      answerHtml,
      meta: {
        type: puzzle.type,
        title: puzzle.title,
        difficulty: puzzle.difficulty,
        score: puzzle.meta.validationScore,
        attempts: puzzle.meta.attempts,
        warnings: puzzle.meta.warnings,
        size: puzzle.data.size || null,
        wordCount: puzzle.data.words ? puzzle.data.words.length : null,
        droppedCount: puzzle.data.droppedCount != null ? puzzle.data.droppedCount : null,
      },
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.post('/api/pdf', async (req, res) => {
  const body = req.body || {};
  const recipe = body.recipe || {};
  const answerKey = Boolean(body.answerKey);
  try {
    // Reuse the previewed puzzle if supplied, otherwise generate fresh.
    let puzzle = body.puzzleId && puzzleCache.get(body.puzzleId);
    if (!puzzle) {
      puzzle = pf.generate(configFromRecipe(recipe));
      cachePut(puzzle);
    }

    const outPath = path.join(os.tmpdir(), `pf-${crypto.randomUUID()}.pdf`);
    const opts = renderOpts(recipe, false);
    await pf.exportPdf(puzzle, {
      outPath,
      trimSize: opts.trimSize,
      audience: opts.audience,
      textScale: opts.textScale,
      fontFamily: opts.fontFamily,
      border: opts.border,
      borderColor: opts.borderColor,
      answerKey,
    });

    const pdf = fs.readFileSync(outPath);
    fs.unlink(outPath, () => {});
    const name = (puzzle.title || 'puzzle').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Resolve the words + clues a clue-type puzzle would use, so the UI can offer
// an editable clue list.
app.post('/api/words', (req, res) => {
  const recipe = (req.body && req.body.recipe) || {};
  try {
    const config = configFromRecipe(recipe);
    const words = config.words || [];
    const clues = config.clues || {};
    res.json({ words, clues });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

const labeled = (puzzle, suffix) => ({ ...puzzle, title: `${puzzle.title} — ${suffix}` });

// Teacher sets: differentiation (one puzzle at each level) and class sets (N
// re-randomized copies). Returns a single combined PDF.
app.post('/api/set', async (req, res) => {
  const body = req.body || {};
  const recipe = body.recipe || {};
  const mode = body.mode || 'classset';
  const answers = body.answers || 'none'; // 'none' | 'end' | 'each'

  try {
    const trimSize = recipe.trimSize || '8.5x11';
    const audience = recipe.audience || (Number(recipe.difficulty) <= 1 ? 'kids' : 'adult');
    const puzzlePages = [];
    const answerPages = [];

    const push = (puzzle, opts) => {
      puzzlePages.push({ puzzle, trimSize, audience, answerKey: false });
      answerPages.push({ puzzle: labeled(puzzle, 'Answer Key'), trimSize, audience, answerKey: true });
    };

    if (mode === 'differentiation') {
      const levelName = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
      for (const level of [1, 2, 3]) {
        const puzzle = pf.generate(configFromRecipe({ ...recipe, difficulty: level }));
        push(labeled(puzzle, levelName[level]));
      }
    } else {
      let count = Math.max(2, Math.min(30, Number(body.count) || 5));
      for (let i = 1; i <= count; i++) {
        const puzzle = pf.generate(configFromRecipe(recipe));
        push(labeled(puzzle, `Copy ${i} of ${count}`));
      }
    }

    let entries;
    if (answers === 'each') {
      entries = [];
      for (let i = 0; i < puzzlePages.length; i++) {
        entries.push(puzzlePages[i], answerPages[i]);
      }
    } else if (answers === 'end') {
      entries = puzzlePages.concat(answerPages);
    } else {
      entries = puzzlePages;
    }

    const outPath = path.join(os.tmpdir(), `pf-set-${crypto.randomUUID()}.pdf`);
    await pf.exportPuzzlesPdf(entries, { outPath });
    const pdf = fs.readFileSync(outPath);
    fs.unlink(outPath, () => {});

    const base = (recipe.title || recipe.theme || recipe.type || 'puzzle')
      .toString()
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-${mode}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

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

app.post('/api/book/preview', (req, res) => {
  const config = (req.body && req.body.config) || {};
  try {
    const book = pf.assembleBook(config);
    const bookId = cacheBook(book);
    res.json({
      bookId,
      html: pf.renderBookHtml(book),
      editable: editablePages(book),
      meta: {
        title: book.title,
        trimSize: book.trimSize,
        puzzleCount: book.meta.puzzleCount,
        byType: book.meta.byType,
        pages:
          1 +
          (book.meta.frontMatterCount || 0) +
          book.pages.length +
          (book.answerKey && book.meta.puzzleCount > 0 ? 1 : 0) +
          (book.meta.backMatterCount || 0),
      },
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

app.post('/api/book/pdf', async (req, res) => {
  const body = req.body || {};
  try {
    let book = body.bookId && bookCache.get(body.bookId);
    if (!book) book = pf.assembleBook(body.config || {});
    const outPath = path.join(os.tmpdir(), `pf-book-${crypto.randomUUID()}.pdf`);
    await pf.exportBookPdf(book, { outPath });
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
app.post('/api/book/page', (req, res) => {
  const body = req.body || {};
  const book = body.bookId && bookCache.get(body.bookId);
  if (!book) return res.status(404).json({ error: 'Preview the book again, then change a page.' });
  const pg = book.pages[body.index];
  if (!pg) return res.status(400).json({ error: 'Invalid page.' });
  const word = String(body.word || '').trim();
  if (!word) return res.status(400).json({ error: 'Enter a word.' });
  try {
    const p = pg.puzzle;
    let np;
    if (p.type === 'drawing') {
      np = pf.generate({ type: 'drawing', words: [word], theme: p.theme || undefined });
    } else if (p.type === 'coloring') {
      np = pf.generate({ type: 'coloring', word, words: [word], style: p.data.style });
    } else {
      return res.status(400).json({ error: 'That page has no subject to change.' });
    }
    np.data.choices = p.data.choices || [];
    const pi = book.puzzles.indexOf(p);
    pg.puzzle = np;
    if (pi >= 0) book.puzzles[pi] = np;
    res.json({ html: pf.renderBookHtml(book), editable: editablePages(book) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Pre-flight publish checklist (logic checks). Renders the interior once to get
// an accurate page count (the answer key paginates), then runs the checks.
app.post('/api/book/checklist', async (req, res) => {
  const body = req.body || {};
  const config = body.config || {};
  let outPath;
  try {
    let book = body.bookId && bookCache.get(body.bookId);
    if (!book) book = pf.assembleBook(config);
    outPath = path.join(os.tmpdir(), `pf-chk-${crypto.randomUUID()}.pdf`);
    await pf.exportBookPdf(book, { outPath });
    const pageCount = countPdfPages(fs.readFileSync(outPath));
    const result = pf.runChecklist(book, { pageCount, specs: config.puzzles });
    res.json({ ...result, pageCount });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (outPath) fs.unlink(outPath, () => {});
  }
});

// KDP royalty estimate. Renders the interior for an accurate page count unless
// a pageCount is supplied directly.
app.post('/api/book/royalty', async (req, res) => {
  const body = req.body || {};
  let outPath;
  try {
    let pageCount = Number(body.pageCount) || 0;
    if (!pageCount) {
      let book = body.bookId && bookCache.get(body.bookId);
      if (!book) book = pf.assembleBook(body.config || {});
      outPath = path.join(os.tmpdir(), `pf-roy-${crypto.randomUUID()}.pdf`);
      await pf.exportBookPdf(book, { outPath });
      pageCount = countPdfPages(fs.readFileSync(outPath));
    }
    const paper = body.paper === 'standard-color' || body.paper === 'premium-color' ? body.paper : 'bw';
    res.json(pf.royaltyEstimate({ pageCount, paper, listPrice: body.listPrice }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (outPath) fs.unlink(outPath, () => {});
  }
});

// --- AI theme generator ---

const themegen = require('./themegen');

// Whether the server has an API key, so the UI can disable the feature
// gracefully instead of failing on click.
app.get('/api/theme/status', (req, res) => {
  res.json({ available: Boolean(process.env.ANTHROPIC_API_KEY) });
});

// Generate a theme from a topic. Returns a preview (not saved to disk).
app.post('/api/theme/generate', async (req, res) => {
  const body = req.body || {};
  try {
    const result = await themegen.generateTheme({
      topic: body.topic,
      wordsPerTier: body.wordsPerTier,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// Generate a whole category of related themes (preview, not saved).
app.post('/api/category/generate', async (req, res) => {
  const body = req.body || {};
  try {
    const result = await themegen.generateCategory({
      topic: body.topic,
      count: body.count,
      wordsPerTier: body.wordsPerTier,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// Save a batch of themes (a generated category) to the library.
app.post('/api/category/save', (req, res) => {
  const body = req.body || {};
  const themes = Array.isArray(body.themes) ? body.themes : [];
  const category = body.category ? String(body.category) : null;
  if (!themes.length) return res.status(400).json({ error: 'No themes to save.' });
  const saved = [];
  try {
    for (const theme of themes) {
      if (!theme || typeof theme !== 'object') continue;
      if (category) theme.category = category;
      saved.push(themegen.saveTheme(theme).id);
    }
    res.json({ saved });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, saved });
  }
});

// Delete a theme from the library.
app.post('/api/theme/delete', (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'No theme id.' });
  try {
    res.json(themegen.deleteTheme(id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Full contents of a saved theme (for the editor).
app.post('/api/theme/get', (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'No theme id.' });
  try {
    const t = pf.loadTheme(id);
    res.json({ id, label: t.label, category: t.category, tags: t.tags, facts: t.facts, tiers: t.tiers });
  } catch (err) {
    res.status(err.status || 404).json({ error: err.message });
  }
});

// Remove specific words and/or facts from a saved theme.
app.post('/api/theme/remove', (req, res) => {
  const body = req.body || {};
  if (!body.id) return res.status(400).json({ error: 'No theme id.' });
  try {
    res.json(themegen.removeFromTheme(body.id, { words: body.words, facts: body.facts }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Re-run the safety/dedup/length filter over an existing theme, in place.
app.post('/api/theme/clean', (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'No theme id.' });
  try {
    res.json(themegen.cleanTheme(id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Persist a previewed (or edited) theme to the themes library.
app.post('/api/theme/save', (req, res) => {
  const theme = req.body && req.body.theme;
  if (!theme || typeof theme !== 'object') {
    return res.status(400).json({ error: 'No theme to save.' });
  }
  try {
    const saved = themegen.saveTheme(theme);
    res.json({ id: saved.id, report: saved.report });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Cover Builder ---

// Preview a full-wrap cover: returns the HTML and computed dimensions.
app.post('/api/cover/preview', (req, res) => {
  const config = (req.body && req.body.config) || {};
  try {
    const { html, dims } = pf.renderCoverHtml(config);
    res.json({ html, dims });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Export the full-wrap cover as a print-ready PDF.
app.post('/api/cover/pdf', async (req, res) => {
  const config = (req.body && req.body.config) || {};
  try {
    const outPath = path.join(os.tmpdir(), `pf-cover-${crypto.randomUUID()}.pdf`);
    await pf.exportCoverPdf(config, { outPath });
    const pdf = fs.readFileSync(outPath);
    fs.unlink(outPath, () => {});
    const base = (config.title || 'cover').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-cover.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Image tools (publisher) ---

const imagetools = require('./imagetools');

// Preview: photo → coloring-page line art (returns a PNG data URL).
app.post('/api/image/coloring/preview', async (req, res) => {
  const body = req.body || {};
  if (!body.image) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const out = await imagetools.toColoringPage(body.image, { detail: body.detail, thickness: body.thickness });
    res.json({ image: out.dataUrl, width: out.width, height: out.height });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Export the coloring page as a print-ready PDF at the chosen trim size.
app.post('/api/image/coloring/pdf', async (req, res) => {
  const body = req.body || {};
  if (!body.image) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const out = await imagetools.toColoringPage(body.image, { detail: body.detail, thickness: body.thickness });
    const layout = pf.getLayout(body.trimSize || '8.5x11', { audience: 'kids' });
    const html = imagetools.coloringPageHtml(out.dataUrl, layout, body.title || null);
    const outPath = path.join(os.tmpdir(), `pf-color-${crypto.randomUUID()}.pdf`);
    await pf.exportHtmlPdf(html, { outPath });
    const pdf = fs.readFileSync(outPath);
    fs.unlink(outPath, () => {});
    const base = (body.title || 'coloring-page').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Preview: photo → color-by-number (outline + reference + palette + numbers).
app.post('/api/image/cbn/preview', async (req, res) => {
  const body = req.body || {};
  if (!body.image) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const out = await imagetools.toColorByNumber(body.image, { colors: body.colors, smoothing: body.smoothing });
    res.json({
      outline: out.outlineDataUrl,
      reference: out.referenceDataUrl,
      width: out.width,
      height: out.height,
      palette: out.palette,
      regions: out.regions,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Export the color-by-number page as a print-ready PDF.
app.post('/api/image/cbn/pdf', async (req, res) => {
  const body = req.body || {};
  if (!body.image) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const out = await imagetools.toColorByNumber(body.image, { colors: body.colors, smoothing: body.smoothing });
    const layout = pf.getLayout(body.trimSize || '8.5x11', { audience: 'kids' });
    const html = imagetools.colorByNumberHtml(out, layout, body.title || null, { showReference: Boolean(body.showReference) });
    const outPath = path.join(os.tmpdir(), `pf-cbn-${crypto.randomUUID()}.pdf`);
    await pf.exportHtmlPdf(html, { outPath });
    const pdf = fs.readFileSync(outPath);
    fs.unlink(outPath, () => {});
    const base = (body.title || 'color-by-number').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Preview: photo → dot-to-dot (ordered numbered dots + faint silhouette).
app.post('/api/image/dots/preview', async (req, res) => {
  const body = req.body || {};
  if (!body.image) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const out = await imagetools.toDotToDot(body.image, { dots: body.dots });
    res.json({ width: out.width, height: out.height, dots: out.dots, reference: out.referenceDataUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Export the dot-to-dot page as a print-ready PDF.
app.post('/api/image/dots/pdf', async (req, res) => {
  const body = req.body || {};
  if (!body.image) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const out = await imagetools.toDotToDot(body.image, { dots: body.dots });
    const layout = pf.getLayout(body.trimSize || '8.5x11', { audience: 'kids' });
    const html = imagetools.dotToDotHtml(out, layout, body.title || null, { showReference: Boolean(body.showReference) });
    const outPath = path.join(os.tmpdir(), `pf-dots-${crypto.randomUUID()}.pdf`);
    await pf.exportHtmlPdf(html, { outPath });
    const pdf = fs.readFileSync(outPath);
    fs.unlink(outPath, () => {});
    const base = (body.title || 'dot-to-dot').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- ComfyUI (publisher-only, local AI art) ---

const comfyui = require('./comfyui');

// Is a local ComfyUI server reachable? (lets the UI degrade gracefully)
app.get('/api/comfy/status', async (req, res) => {
  res.json(await comfyui.status());
});

// Installed checkpoints / LoRAs / ControlNets + the tuned workflow presets, for
// the dropdowns (model lists come back [] when ComfyUI is down; presets always).
app.get('/api/comfy/checkpoints', async (req, res) => {
  const workflows = Object.keys(comfyui.WORKFLOWS).map((id) => ({ id, label: comfyui.WORKFLOWS[id].label }));
  const [checkpoints, loras, controlnets] = await Promise.all([
    comfyui.listCheckpoints(),
    comfyui.listLoras(),
    comfyui.listControlnets(),
  ]);
  res.json({ checkpoints, loras, controlnets, workflows });
});

// Recommended settings for a checkpoint (the UI prefills the fields with these
// so Turbo/SDXL/SD1.5 models each get sane steps/cfg/resolution).
app.get('/api/comfy/tune', (req, res) => {
  res.json(comfyui.tuneForModel(req.query.ckpt || comfyui.DEFAULT_CKPT));
});

// Generate one image from a text prompt. Long-running (polls ComfyUI).
app.post('/api/comfy/generate', async (req, res) => {
  const body = req.body || {};
  try {
    const out = await comfyui.generate(body);
    res.json({ image: out.dataUrl, seed: out.seed });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
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

function buildInfoSheet(config, book, pageCount, paper, dims, meta) {
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
    '',
    `Trim size:        ${dims.trimWidthIn} x ${dims.trimHeightIn} in`,
    `Interior pages:   ${pageCount}`,
    `Paper:            ${paper}`,
    `Spine width:      ${dims.spineIn} in`,
    `Full cover size:  ${dims.fullWidthIn} x ${dims.fullHeightIn} in (includes 0.125" bleed)`,
    `Spine text:       ${dims.spineTextAllowed ? 'printed (book is long enough)' : 'hidden (KDP needs >= 79 pages)'}`,
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
app.post('/api/book/kdp', async (req, res) => {
  const body = req.body || {};
  const config = body.config || {};
  const coverIn = body.cover || {};
  let interiorPath;
  let coverPath;
  try {
    const book = pf.assembleBook(config);
    interiorPath = path.join(os.tmpdir(), `pf-int-${crypto.randomUUID()}.pdf`);
    await pf.exportBookPdf(book, { outPath: interiorPath });
    const interior = fs.readFileSync(interiorPath);

    const pageCount = countPdfPages(interior);
    const paper = coverIn.paper === 'cream' ? 'cream' : 'white';
    const coverConfig = {
      trimSize: book.trimSize,
      pageCount,
      paper,
      title: config.title,
      subtitle: config.subtitle,
      author: config.author,
      front: {
        bgColor: coverIn.bgColor,
        textColor: coverIn.textColor,
        titlePosition: coverIn.titlePosition || 'center',
        image: coverIn.image || null,
      },
      back: { bgColor: coverIn.backColor || coverIn.bgColor, textColor: coverIn.textColor, blurb: coverIn.blurb || null },
      spine: { bgColor: coverIn.bgColor, textColor: coverIn.textColor },
    };
    coverPath = path.join(os.tmpdir(), `pf-cov-${crypto.randomUUID()}.pdf`);
    await pf.exportCoverPdf(coverConfig, { outPath: coverPath });
    const cover = fs.readFileSync(coverPath);

    const dims = pf.coverDimensions(book.trimSize, pageCount, paper);
    const info = buildInfoSheet(config, book, pageCount, paper, dims, body.metadata);

    const base = (config.title || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-kdp.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
    archive.pipe(res);
    archive.append(interior, { name: 'interior.pdf' });
    archive.append(cover, { name: 'cover.pdf' });
    archive.append(info, { name: 'build-info.txt' });
    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (interiorPath) fs.unlink(interiorPath, () => {});
    if (coverPath) fs.unlink(coverPath, () => {});
  }
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`PuzzleForge Web running at http://localhost:${PORT}`);
  });
}

module.exports = { app, configFromRecipe };
