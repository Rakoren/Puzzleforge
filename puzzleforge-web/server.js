/**
 * PuzzleForge Web — teacher tool server.
 *
 * A thin Express server over the PuzzleForge engine. The engine is Node-only
 * (themes read from disk, PDF export drives Chromium), so generation happens
 * server-side; the browser handles the form, live preview, and downloads.
 *
 * This is the public, accountless half of the original PuzzleForge web app.
 * The publisher-only half (Book Builder, Page Editor, Cover Builder, Image
 * Tools, AI Art, team workspace, KDP export) has moved to its own app —
 * see https://github.com/rakoren/publisher. The AI Theme Generator stays
 * here since it's the one tool that writes into this repo's own themes/
 * directory.
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
app.use(express.json({ limit: '16mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Browsers auto-request /favicon.ico; serve the SVG brand mark so it doesn't 404.
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml').sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

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

// --- Classroom worksheets + lesson packets ---

// Readable puzzle-type + difficulty labels for a packet's contents list.
const TYPE_LABELS = {
  wordsearch: 'Word Search', numbersearch: 'Number Search', crossword: 'Crossword',
  krisskross: 'Kriss-Kross', wordscramble: 'Word Scramble', sudoku: 'Sudoku', maze: 'Maze',
  cryptogram: 'Cryptogram', nonogram: 'Nonogram', trivia: 'Trivia', logicgrid: 'Logic Grid',
  wordladder: 'Word Ladder', wordwheel: 'Word Wheel', cipher: 'Cipher', riddles: 'Riddles',
  brainteasers: 'Brain Teasers', coloring: 'Coloring', drawing: 'Drawing',
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
app.post('/api/worksheet/preview', (req, res) => {
  const recipe = (req.body && req.body.recipe) || {};
  try {
    const puzzle = pf.generate(configFromRecipe(recipe));
    const opts = renderOpts(recipe, false);
    opts.worksheet = headerFromReq(req.body && req.body.header);
    res.json({ html: pf.renderHtml(puzzle, opts) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download a single worksheet PDF (optionally a teacher answer copy after it).
app.post('/api/worksheet/pdf', async (req, res) => {
  const recipe = (req.body && req.body.recipe) || {};
  const header = headerFromReq(req.body && req.body.header);
  const withAnswer = Boolean(req.body && req.body.answerKey);
  try {
    const puzzle = pf.generate(configFromRecipe(recipe));
    const entries = [{ puzzle, trimSize: recipe.trimSize || '8.5x11', audience: renderOpts(recipe).audience, worksheet: header, border: recipe.border || undefined, borderColor: recipe.borderColor || undefined }];
    if (withAnswer) entries.push({ ...entries[0], answerKey: true });
    const outPath = path.join(os.tmpdir(), `pf-ws-${crypto.randomUUID()}.pdf`);
    await pf.exportPuzzlesPdf(entries, { outPath });
    const pdf = fs.readFileSync(outPath); fs.unlink(outPath, () => {});
    const base = (recipe.title || recipe.theme || recipe.type || 'worksheet').toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-worksheet.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Download a lesson packet PDF: cover + worksheets + optional answer-key section.
app.post('/api/packet/pdf', async (req, res) => {
  const body = req.body || {};
  const trimSize = body.trimSize || '8.5x11';
  const audience = body.audience || 'adult';
  const header = headerFromReq(body.header);
  const rows = Array.isArray(body.pages) ? body.pages : [];
  if (!rows.length) return res.status(400).json({ error: 'Add at least one puzzle to the packet.' });
  try {
    const pages = [];
    const contents = [];
    for (const row of rows) {
      const recipe = { ...row, theme: row.theme || body.theme, trimSize, audience };
      const puzzle = pf.generate(configFromRecipe(recipe));
      pages.push({ puzzle });
      contents.push(row.label || `${typeLabel(row.type)} — ${diffLabel(row.difficulty, audience)}`);
    }
    const c = body.cover || {};
    const cover = c.enabled === false ? null : {
      title: c.title || body.title || 'Lesson Packet',
      subtitle: c.subtitle || '',
      kicker: c.kicker || 'Lesson Packet',
      teacher: c.teacher || '', className: c.className || '', dateline: c.dateline || '',
      objective: c.objective || '', standards: c.standards || '',
      footer: c.footer || '', contents: c.showContents === false ? [] : contents,
    };
    const html = pf.assemblePacketHtml({
      trimSize, audience, cover, worksheet: header, answers: body.answers === 'none' ? 'none' : 'end', pages,
    });
    const outPath = path.join(os.tmpdir(), `pf-packet-${crypto.randomUUID()}.pdf`);
    await pf.exportHtmlPdf(html, { outPath });
    const pdf = fs.readFileSync(outPath); fs.unlink(outPath, () => {});
    const base = ((cover && cover.title) || body.title || 'lesson-packet').toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-packet.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Curriculum grade presets (grade → difficulty, standards, puzzle mix).
app.get('/api/curriculum', (req, res) => {
  res.json({ grades: pf.listGrades() });
});

// Auto lesson-plan: grade + topic (+ count) → a packet config the Worksheets
// page loads into its form (the teacher can then tweak and download).
app.post('/api/packet/plan', (req, res) => {
  const body = req.body || {};
  try {
    res.json({ plan: pf.planLessonPacket({ grade: body.grade, topic: body.topic, count: body.count }) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
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
      audience: body.audience,
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
      audience: body.audience,
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

// Top up an existing theme with fresh AI-generated words (in place).
app.post('/api/theme/expand', async (req, res) => {
  const body = req.body || {};
  if (!body.id) return res.status(400).json({ error: 'No theme id.' });
  try {
    res.json(await themegen.expandTheme({ id: body.id, wordsPerTier: body.wordsPerTier }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// Split a "Both" theme into Kids + Adult variants (keeping the original).
app.post('/api/theme/split', (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: 'No theme id.' });
  try {
    res.json(themegen.splitTheme(id));
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

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`PuzzleForge Web running at http://localhost:${PORT}`);
  });
}

module.exports = { app, configFromRecipe };
