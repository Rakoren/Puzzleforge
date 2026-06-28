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

// How many words to draw into a single word-type puzzle by default.
const DEFAULT_WORD_COUNT = 14;

function pickDifficulty(spec, rand) {
  const d = spec.difficulty;
  if (typeof d === 'string' && d.includes('-')) {
    const [lo, hi] = d.split('-').map((x) => parseInt(x, 10));
    return lo + Math.floor(rand() * (hi - lo + 1));
  }
  return d ? Number(d) : 1;
}

// Select the word list for a word-type puzzle from an already-resolved theme.
// When `exclude` is a Set, words already used elsewhere in the book are avoided;
// if uniqueness leaves the puzzle short, it tops up (allowing repeats, but never
// from a harder tier) so a puzzle is never starved of words.
function wordsFromTheme(theme, difficulty, count, exclude) {
  // Pull from the difficulty's tier; sample `count` so each puzzle differs.
  let words = themes.selectWords(theme, { difficulty, count, exclude });

  if (words.length < count) {
    // `inThis` only guards against duplicates *within* this one puzzle; repeats
    // across puzzles are what the no-words-left fallback deliberately allows.
    const inThis = new Set(words);
    const fill = (opts) => {
      for (const w of themes.selectWords(theme, opts)) {
        if (words.length >= count) break;
        if (inThis.has(w)) continue;
        inThis.add(w);
        words.push(w);
      }
    };
    if (exclude) {
      // This difficulty's tier is exhausted of unused words. Borrow still-unused
      // words from this and easier tiers (never harder than requested, so the
      // level stays valid), keeping uniqueness across the book…
      fill({ maxDifficulty: difficulty, count, exclude });
      // …then, only if still short, repeat words from the same/easier tiers so
      // the puzzle stays full — still never pulling a harder word into an easier
      // puzzle.
      if (words.length < count) fill({ maxDifficulty: difficulty, count });
    } else if (words.length === 0) {
      // No uniqueness constraint and this tier came back empty (e.g. a theme
      // with no words at this level) — fall back to the whole theme.
      fill({ count });
    }
  }
  return words;
}

// Puzzle types that consume a themed word list.
const WORD_TYPES = new Set(['wordsearch', 'wordscramble', 'crossword', 'krisskross']);

// The words that actually appear in a generated puzzle. Interlock types
// (crossword/kriss-kross) drop words that couldn't be placed, so prefer the
// solution's placed words; word search keeps them all on data.words.
function puzzleWords(puzzle) {
  const sol = puzzle.solution || {};
  if (Array.isArray(sol.words)) {
    return sol.words.map((w) => (typeof w === 'string' ? w : w.word)).filter(Boolean);
  }
  const data = puzzle.data || {};
  if (Array.isArray(data.words)) {
    return data.words.map((w) => (typeof w === 'string' ? w : w.word)).filter(Boolean);
  }
  return [];
}

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
  // When on, no theme word appears in more than one puzzle across the book.
  const uniqueWords = config.uniqueWords === true;
  const usedWords = uniqueWords ? new Set() : null;

  const puzzles = [];
  const byType = {};

  for (const spec of config.puzzles) {
    const count = spec.count || 1;
    for (let i = 0; i < count; i++) {
      const difficulty = pickDifficulty(spec, rand);
      const puzzleConfig = { type: spec.type, difficulty, size: spec.size };
      if (WORD_TYPES.has(spec.type)) {
        if (spec.words) {
          puzzleConfig.words = spec.words;
          puzzleConfig.clues = spec.clues || {};
          puzzleConfig.theme = spec.theme || config.theme || undefined;
        } else {
          const themeRef = spec.theme || config.theme;
          if (!themeRef) {
            throw new Error(
              `book: puzzle type "${spec.type}" needs a word list — set spec.words or a theme`
            );
          }
          const theme = themes.resolveTheme(themeRef);
          const count = spec.count_words || DEFAULT_WORD_COUNT;
          puzzleConfig.words = wordsFromTheme(theme, difficulty, count, usedWords);
          puzzleConfig.clues = themes.clueMap(theme);
          puzzleConfig.theme = theme.label; // clean title even for a merged category
        }
      }
      const puzzle = generate(puzzleConfig);
      if (usedWords) for (const w of puzzleWords(puzzle)) usedWords.add(w);
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
      uniqueWords,
      ...(usedWords ? { distinctWords: usedWords.size } : {}),
    },
  };
}

module.exports = { assembleBook };
