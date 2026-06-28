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
const { isActivityType } = require('../generators/registry');
const themes = require('../themes');

// How many words to draw into a single word-type puzzle by default.
const DEFAULT_WORD_COUNT = 14;

// Book-recipe format version (distinct from the single-puzzle recipe version).
const BOOK_RECIPE_VERSION = 1;

// Build the front-matter page descriptors from the book config. All opt-in.
function buildFrontMatter(config) {
  const fm = [];
  if (config.copyright) {
    const c = typeof config.copyright === 'object' ? config.copyright : {};
    fm.push({
      kind: 'copyright',
      year: c.year || config.year || new Date().getFullYear(),
      publisher: c.publisher || config.publisher || config.author || null,
      rights: c.rights || null,
    });
  }
  if (config.belongsTo) fm.push({ kind: 'belongsTo' });
  if (config.intro && String(config.intro).trim()) {
    fm.push({ kind: 'intro', heading: config.introHeading || 'Welcome!', text: String(config.intro).trim() });
  }
  return fm;
}

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
      } else if (isActivityType(spec.type)) {
        // Activity pages (coloring / drawing) can use a few theme words for a
        // prompt or bubble-letter subject, but never draw from the unique word
        // pool — they aren't puzzles.
        const themeRef = spec.theme || config.theme;
        if (themeRef) {
          const theme = themes.resolveTheme(themeRef);
          // Match the row's difficulty so an easy page never gets a hard subject.
          puzzleConfig.words = themes.selectWords(theme, { difficulty, count: 12 });
          puzzleConfig.theme = theme.label;
        }
      }
      const puzzle = generate(puzzleConfig);
      if (usedWords) for (const w of puzzleWords(puzzle)) usedWords.add(w);
      puzzles.push(puzzle);
    }
  }

  // Optional filler pages inserted in every gap between puzzles (20 puzzles →
  // 19 gaps). `interleave` is an ordered list of 'drawing' and/or 'blank'.
  const ordered = interleavePuzzles(puzzles, config);

  // Front matter (copyright / "belongs to" / intro) sits between the title page
  // and the puzzles; offset content page numbers past it.
  const frontMatter = buildFrontMatter(config);

  // Page assignment: title page (1) + front matter, then one page per content
  // page, then the answer key (computed by the matter template at render time;
  // here we record content page numbers for cross-referencing in the key).
  let page = 1 + frontMatter.length; // title + front matter
  const pages = ordered.map((puzzle) => {
    page += 1;
    return { puzzle, pageNumber: page };
  });

  const byType = {};
  for (const p of ordered) byType[p.type] = (byType[p.type] || 0) + 1;

  return {
    title: config.title,
    subtitle: config.subtitle || null,
    author: config.author || null,
    trimSize,
    audience,
    answerKey,
    frontMatter, // [{ kind, ... }] rendered after the title page
    pages, // [{ puzzle, pageNumber }]
    puzzles: ordered, // convenience: ordered puzzle objects (incl. fillers)
    meta: {
      generatedAt: Date.now(),
      puzzleCount: ordered.filter((p) => !isActivityType(p.type)).length,
      pageCount: ordered.length,
      frontMatterCount: frontMatter.length,
      byType,
      uniqueWords,
      ...(usedWords ? { distinctWords: usedWords.size } : {}),
    },
  };
}

// Insert filler pages after puzzles. `interleave` is an ordered list of
// 'coloring' | 'drawing' | 'blank'. By default fillers go in the gaps *between*
// puzzles; with `interleaveAfterLast` they also follow the final puzzle.
// `coloringStyle` controls coloring fillers: 'random' (default), 'rotate', or a
// fixed style ('mandala' | 'pattern' | 'bubble').
const COLORING_STYLES = ['mandala', 'pattern', 'bubble'];

function interleavePuzzles(puzzles, config) {
  const kinds = (Array.isArray(config.interleave) ? config.interleave : [])
    .map((k) => String(k).toLowerCase())
    .filter((k) => k === 'coloring' || k === 'drawing' || k === 'blank');
  if (kinds.length === 0 || puzzles.length === 0) return puzzles;

  const afterLast = config.interleaveAfterLast === true;
  const coloringStyle = config.coloringStyle || 'random';

  // Resolve the theme once for the label and as a difficulty-matched fallback
  // when the preceding puzzle has no words of its own (e.g. a maze or sudoku).
  let theme = null;
  let fillerLabel;
  if (config.theme) {
    try {
      theme = themes.resolveTheme(config.theme);
      fillerLabel = theme.label;
    } catch (_) {
      /* theme optional */
    }
  }

  // Candidate subject words for a filler: the words of the puzzle it follows
  // (already difficulty-appropriate), falling back to theme words at that
  // puzzle's difficulty so an easy puzzle never yields a hard subject.
  const subjectWords = (precedingPuzzle) => {
    const own = puzzleWords(precedingPuzzle);
    if (own.length) return own;
    if (theme) return themes.selectWords(theme, { difficulty: precedingPuzzle.difficulty, count: 12 });
    return [];
  };

  // Pick one subject per gap, avoiding recently-used words so the same "Draw a
  // …" / bubble word doesn't keep repeating across the book.
  const usedSubjects = [];
  const chooseSubject = (words) => {
    if (!words.length) return null;
    const recent = new Set(usedSubjects.slice(-Math.min(8, words.length - 1)));
    const fresh = words.filter((w) => !recent.has(w));
    const pool = fresh.length ? fresh : words;
    const w = pool[Math.floor(Math.random() * pool.length)];
    usedSubjects.push(w);
    return w;
  };

  let rotateIdx = 0;
  let lastStyle = null;
  // For 'random', pick a style at the book level so consecutive coloring pages
  // don't repeat the same one (bubble only when there's a subject word).
  const pickRandomStyle = (hasSubject) => {
    const cands = hasSubject ? COLORING_STYLES : COLORING_STYLES.filter((s) => s !== 'bubble');
    const fresh = cands.filter((s) => s !== lastStyle);
    const pool = fresh.length ? fresh : cands;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const makeFiller = (kind, subject) => {
    if (kind === 'drawing') {
      return generate({ type: 'drawing', words: subject ? [subject] : [], theme: fillerLabel });
    }
    if (kind === 'blank') return generate({ type: 'bleedguard', label: '' });
    const cfg = { type: 'coloring', word: subject || undefined, words: subject ? [subject] : [], theme: fillerLabel };
    if (coloringStyle === 'rotate') cfg.style = COLORING_STYLES[rotateIdx++ % COLORING_STYLES.length];
    else if (coloringStyle === 'random') cfg.style = pickRandomStyle(Boolean(subject));
    else cfg.style = coloringStyle;
    lastStyle = cfg.style;
    return generate(cfg);
  };

  const out = [];
  puzzles.forEach((p, i) => {
    out.push(p);
    const isLast = i === puzzles.length - 1;
    if (!isLast || afterLast) {
      const subject = chooseSubject(subjectWords(p)); // one subject, tied to this puzzle
      for (const kind of kinds) out.push(makeFiller(kind, subject));
    }
  });
  return out;
}

module.exports = { assembleBook };
