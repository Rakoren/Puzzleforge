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

// Import the engine as a package (file:.. dependency) with a relative fallback
// so the app runs whether or not it has been `npm install`ed.
let pf;
try {
  pf = require('puzzleforge-engine');
} catch (_) {
  pf = require('..');
}

const app = express();
app.use(express.json({ limit: '1mb' }));
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
      const theme = pf.loadTheme(recipe.theme);
      const count = recipe.wordCount || 14;
      let words = pf.selectWords(theme, { difficulty, count });
      if (!words.length) words = pf.selectWords(theme, { count });
      config.words = words;
      config.clues = pf.clueMap(theme);
    } else {
      const err = new Error('This puzzle type needs a theme or a custom word list.');
      err.status = 400;
      throw err;
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

app.post('/api/book/preview', (req, res) => {
  const config = (req.body && req.body.config) || {};
  try {
    const book = pf.assembleBook(config);
    const bookId = cacheBook(book);
    res.json({
      bookId,
      html: pf.renderBookHtml(book),
      meta: {
        title: book.title,
        trimSize: book.trimSize,
        puzzleCount: book.meta.puzzleCount,
        byType: book.meta.byType,
        pages: 1 + book.pages.length + (book.answerKey ? 1 : 0),
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

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`PuzzleForge Web running at http://localhost:${PORT}`);
  });
}

module.exports = { app, configFromRecipe };
