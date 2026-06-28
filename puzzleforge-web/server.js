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

function buildInfoSheet(config, book, pageCount, paper, dims) {
  const lines = [
    'PuzzleForge — KDP Build Info',
    '============================',
    '',
    `Title:            ${config.title || ''}`,
    config.subtitle ? `Subtitle:         ${config.subtitle}` : null,
    `Author:           ${config.author || ''}`,
    '',
    `Trim size:        ${dims.trimWidthIn} x ${dims.trimHeightIn} in`,
    `Interior pages:   ${pageCount}`,
    `Paper:            ${paper}`,
    `Spine width:      ${dims.spineIn} in`,
    `Full cover size:  ${dims.fullWidthIn} x ${dims.fullHeightIn} in (includes 0.125" bleed)`,
    `Spine text:       ${dims.spineTextAllowed ? 'printed (book is long enough)' : 'hidden (KDP needs >= 79 pages)'}`,
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
    const info = buildInfoSheet(config, book, pageCount, paper, dims);

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
