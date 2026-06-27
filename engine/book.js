/**
 * Engine — book assembly.
 *
 * Assembles a sequence of generated puzzles into a book object: ordering,
 * page assignment, and answer-key placement at the back. The book object is
 * consumed by the exporter (engine/export.js) and the matter templates
 * (engine/matter.js).
 *
 * Book config:
 *   {
 *     title, subtitle?, author?,
 *     audience: 'kids' | 'adult',
 *     trimSize: '8x10' | '8.5x11' | '8.5x8.5' | '6x9',
 *     theme?: string | string[],        // default theme for word puzzles
 *     answerKey?: boolean,              // include a back-of-book key (default true)
 *     puzzles: [
 *       { type, count, difficulty, theme?, size?, ... }
 *     ]
 *   }
 *
 * `difficulty` may be a number (1|2|3) or a range string like "1-2"; a value
 * is chosen per puzzle.
 */
const { generate } = require('./generate');
const themes = require('../themes');

function pickDifficulty(spec, rand) {
  const d = spec.difficulty;
  if (typeof d === 'string' && d.includes('-')) {
    const [lo, hi] = d.split('-').map((x) => parseInt(x, 10));
    return lo + Math.floor(rand() * (hi - lo + 1));
  }
  return d ? Number(d) : 1;
}

// Resolve the word list (and clue map) for a word-type puzzle from its (or the
// book's) theme.
function wordsForSpec(spec, bookTheme, difficulty) {
  if (spec.words) return { words: spec.words, clues: spec.clues || {} };
  const themeRef = spec.theme || bookTheme;
  if (!themeRef) {
    throw new Error(
      `book: puzzle type "${spec.type}" needs a word list — set spec.words or a theme`
    );
  }
  const theme = Array.isArray(themeRef)
    ? themes.mergeThemes(themeRef)
    : themes.loadTheme(themeRef);
  let words = themes.selectWords(theme, { maxDifficulty: difficulty, count: spec.count_words });
  if (words.length === 0) words = themes.selectWords(theme);
  return { words, clues: themes.clueMap(theme) };
}

// Puzzle types that consume a themed word list.
const WORD_TYPES = new Set(['wordsearch', 'wordscramble', 'crossword', 'krisskross']);

/**
 * @param {object} config book config (see above)
 * @param {object} [opts]
 * @param {function} [opts.rand=Math.random]
 * @returns {object} book object with generated puzzles
 */
function assembleBook(config, opts = {}) {
  const rand = opts.rand || Math.random;
  if (!config.title) throw new Error('book: config.title is required');
  if (!Array.isArray(config.puzzles) || config.puzzles.length === 0) {
    throw new Error('book: config.puzzles must be a non-empty array');
  }

  const trimSize = config.trimSize || '8.5x11';
  const audience = config.audience || 'adult';
  const answerKey = config.answerKey !== false;

  const puzzles = [];
  const byType = {};

  for (const spec of config.puzzles) {
    const count = spec.count || 1;
    for (let i = 0; i < count; i++) {
      const difficulty = pickDifficulty(spec, rand);
      const puzzleConfig = {
        type: spec.type,
        difficulty,
        size: spec.size,
        theme: spec.theme || (WORD_TYPES.has(spec.type) ? config.theme : undefined),
      };
      if (WORD_TYPES.has(spec.type)) {
        const { words, clues } = wordsForSpec(spec, config.theme, difficulty);
        puzzleConfig.words = words;
        puzzleConfig.clues = clues;
      }
      const puzzle = generate(puzzleConfig);
      puzzles.push(puzzle);
      byType[spec.type] = (byType[spec.type] || 0) + 1;
    }
  }

  // Page assignment: 1 title page, then one page per puzzle, then the answer
  // key pages (computed by the matter template at render time; here we record
  // the puzzle page numbers for cross-referencing in the key).
  let page = 1; // title page
  const pages = puzzles.map((puzzle) => {
    page += 1;
    return { puzzle, pageNumber: page };
  });

  return {
    title: config.title,
    subtitle: config.subtitle || null,
    author: config.author || null,
    trimSize,
    audience,
    answerKey,
    pages, // [{ puzzle, pageNumber }]
    puzzles, // convenience: ordered puzzle objects
    meta: {
      generatedAt: Date.now(),
      puzzleCount: puzzles.length,
      byType,
    },
  };
}

module.exports = { assembleBook };
