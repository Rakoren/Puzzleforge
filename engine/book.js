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
const { withSeed } = require('./rng');
const { isActivityType } = require('../generators/registry');
const themes = require('../themes');
const breatherContent = require('../content/breathers');

const BREATHER_KINDS = ['quote', 'fact', 'divider', 'blank'];

// Theme-matched fun-fact pool for the book's theme. Combines facts stored in
// the theme file (e.g. AI-generated themes) with the curated built-in sets, for
// a single theme id, an array of ids, or a "cat:Category" that expands to its
// members. Empty when not theme-matched.
function themeFactPool(config, themeMatched) {
  if (!themeMatched || !config.theme) return [];
  const ref = config.theme;
  let ids;
  if (typeof ref === 'string' && ref.startsWith('cat:')) ids = themes.themesInCategory(ref.slice(4));
  else if (Array.isArray(ref)) ids = ref;
  else if (typeof ref === 'string') ids = [ref];
  else return [];

  const facts = [];
  for (const id of ids) {
    if (breatherContent.byTheme[id]) facts.push(...(breatherContent.byTheme[id].facts || []));
    try {
      const t = themes.loadTheme(id);
      if (Array.isArray(t.facts)) facts.push(...t.facts);
    } catch (_) {
      /* unknown id — skip */
    }
  }
  return [...new Set(facts)];
}

// Choose an unused item, preferring earlier pools; repeats only once all are
// exhausted. `key` maps an item to its dedupe string.
function chooseUnused(pools, used, key) {
  for (const pool of pools) {
    const fresh = pool.filter((x) => !used.has(key(x)));
    if (fresh.length) {
      const item = fresh[Math.floor(Math.random() * fresh.length)];
      used.add(key(item));
      return item;
    }
  }
  const all = pools.find((p) => p.length) || [];
  return all.length ? all[Math.floor(Math.random() * all.length)] : null;
}

// Build one breather page of the given kind, pulling content from the store.
function makeBreather(kind, config, themeMatched, state) {
  if (kind === 'quote') {
    const q = chooseUnused([breatherContent.general.quotes], state.usedQuotes, (x) => x.text);
    return generate({ type: 'breather', kind: 'quote', text: q ? q.text : '', source: q ? q.source : null });
  }
  if (kind === 'fact') {
    const f = chooseUnused(
      [themeFactPool(config, themeMatched), breatherContent.general.facts],
      state.usedFacts,
      (x) => x
    );
    return generate({ type: 'breather', kind: 'fact', text: f || '' });
  }
  return generate({ type: 'breather', kind }); // divider | blank
}

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

// Back-matter page descriptors (rendered after the answer key). All opt-in.
function buildBackMatter(config) {
  const bm = [];
  if (config.about && String(config.about).trim()) {
    bm.push({ kind: 'about', heading: config.aboutHeading || 'About the Author', text: String(config.about).trim() });
  }
  if (config.moreBooks && String(config.moreBooks).trim()) {
    bm.push({
      kind: 'morebooks',
      heading: config.moreBooksHeading || "More Books You'll Love",
      text: String(config.moreBooks).trim(),
    });
  }
  return bm;
}

function pickDifficulty(spec, rand) {
  const d = spec.difficulty;
  if (typeof d === 'string' && d.includes('-')) {
    const [lo, hi] = d.split('-').map((x) => parseInt(x, 10));
    return lo + Math.floor(rand() * (hi - lo + 1));
  }
  return d ? Number(d) : 1;
}

// Distribute difficulty across the whole book by a curve, overriding per-row
// difficulty. Makes a book feel intentionally designed rather than arbitrary.
//   easy-to-hard / hard-to-easy → ramp in even thirds across the N puzzles
//   mixed                       → random 1–3 per puzzle
//   flat                        → every puzzle at `flatLevel`
const DIFFICULTY_CURVES = new Set(['flat', 'easy-to-hard', 'hard-to-easy', 'mixed']);
function curveLevel(i, n, curve, flatLevel, rand) {
  if (curve === 'mixed') return 1 + Math.floor(rand() * 3);
  if (curve === 'flat') return flatLevel;
  const step = Math.min(2, Math.floor((n > 1 ? i / n : 0) * 3)); // 0,1,2
  return curve === 'hard-to-easy' ? 3 - step : 1 + step;
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

// Pages a reader colors/draws on with markers — each should be backed by a
// blank page so ink doesn't bleed onto the next printed page.
const DRAWABLE_TYPES = new Set(['coloring', 'drawing']);

// Bleed-guard placement that respects the physical leaf. In a printed book a
// sheet has two sides — page p (recto, odd) and p+1 (verso, even) are the same
// leaf — so marker ink on a drawing/coloring page bleeds through to the OTHER
// side of that leaf, not merely the next page in reading order. To keep that
// back side blank we put every drawable on a recto (odd) page and a blank on its
// verso. `startAbs` is the absolute PDF page number of the first content page
// (after the title + front matter).
function addBleedGuards(pages, startAbs, guardLeaf) {
  const blank = () => generate({ type: 'bleedguard', label: '' });
  const out = [];
  let abs = startAbs;
  const pushBlank = () => { out.push(blank()); abs++; };
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    if (DRAWABLE_TYPES.has(pg.type)) {
      if (abs % 2 === 0) pushBlank(); // put the drawable onto a recto (odd)
      out.push(pg); abs++;
      // Consume an existing blank right after so we don't double it.
      if (pages[i + 1] && pages[i + 1].type === 'bleedguard') i++;
      pushBlank(); // blank verso = the drawable's blank physical back
      // Optional: a full blank leaf so the next puzzle starts on a fresh spread.
      if (guardLeaf) { pushBlank(); pushBlank(); }
    } else {
      out.push(pg);
      abs++;
    }
  }
  return out;
}

// Fisher-Yates shuffle returning a new array.
function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {object} config book config (see above)
 * @param {object} [opts]
 * @param {function} [opts.rand=Math.random]
 * @returns {object} book object with generated puzzles
 */
function assembleBook(config, opts = {}) {
  // Seed makes the whole book reproducible — page structure, word selection, and
  // puzzle content. A fresh seed is generated when none is supplied, recorded on
  // the book for saving. When we own the randomness (no injected rand), run the
  // entire assembly under a seeded Math.random so every module reproduces.
  const seed = Number.isFinite(config.seed) ? config.seed >>> 0 : (Math.random() * 0xffffffff) >>> 0;
  if (!opts.rand) return withSeed(seed, () => buildBook(config, opts, seed, Math.random));
  return buildBook(config, opts, seed, opts.rand);
}

function buildBook(config, opts, seed, rand) {
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

  // Breather pages (adult): between puzzle sets, not between every puzzle.
  const breatherKinds = (Array.isArray(config.breathers) ? config.breathers : [])
    .map((k) => String(k).toLowerCase())
    .filter((k) => BREATHER_KINDS.includes(k));
  const breatherThemeMatched = config.breatherThemeMatched !== false;
  const breatherState = { usedQuotes: new Set(), usedFacts: new Set() };

  // Optional difficulty curve across the book (overrides per-row difficulty).
  // Applied in generation order, which is the final reading order unless the
  // book is shuffled (a ramp assumes grouped order).
  const curve = DIFFICULTY_CURVES.has(config.difficultyCurve) ? config.difficultyCurve : null;
  const flatLevel = Math.max(1, Math.min(3, Number(config.difficultyLevel) || 2));
  const totalPuzzles = config.puzzles.reduce((sum, sp) => sum + (sp.count || 1), 0);
  let gIdx = 0;

  // Generate each spec's puzzles as its own group so we can keep them grouped
  // (with breathers between sets) or shuffle them across the whole book.
  const groups = [];
  for (let si = 0; si < config.puzzles.length; si++) {
    const spec = config.puzzles[si];
    const count = spec.count || 1;
    const group = [];
    for (let i = 0; i < count; i++) {
      const difficulty = curve
        ? curveLevel(gIdx++, totalPuzzles, curve, flatLevel, rand)
        : pickDifficulty(spec, rand);
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
      // Activity rows: record swap options so a subject can be re-rolled later.
      if (isActivityType(spec.type) && Array.isArray(puzzleConfig.words) && puzzleConfig.words.length) {
        puzzle.data.choices = [...new Set(puzzleConfig.words)].slice(0, 30);
      }
      group.push(puzzle);
    }
    groups.push(group);
  }

  // Assemble the puzzle sequence: either shuffled across the whole book, or
  // grouped in row order with breathers between sets. (Shuffling randomizes the
  // order, so the between-sets breather concept doesn't apply.)
  let sequence;
  if (config.shuffle === true) {
    sequence = shuffled(groups.flat(), rand);
  } else {
    sequence = [];
    groups.forEach((group, gi) => {
      sequence.push(...group);
      if (breatherKinds.length && gi < groups.length - 1) {
        for (const kind of breatherKinds) {
          sequence.push(makeBreather(kind, config, breatherThemeMatched, breatherState));
        }
      }
    });
  }

  // Front matter (copyright / "belongs to" / intro) sits between the title page
  // and the puzzles; offset content page numbers past it. Back matter (about /
  // more books) is rendered after the answer key.
  const frontMatter = buildFrontMatter(config);
  const backMatter = buildBackMatter(config);

  // Optional filler pages inserted after puzzles (kids fillers / inserts).
  let ordered = interleavePuzzles(sequence, config);
  // Keep the back of every coloring/drawing leaf blank so markers don't bleed
  // through (on by default). Needs the first content page's absolute number
  // (title page = 1, then front matter) to reason about recto/verso.
  if (config.bleedGuard !== false) ordered = addBleedGuards(ordered, 2 + frontMatter.length, config.guardLeaf === true);

  // Page assignment: (optional) title page + front matter, then one page per
  // content page, then the answer key (computed by the matter template at render
  // time; here we record content page numbers for cross-referencing in the key).
  // The title page is on by default; the editor-driven flow turns it off and
  // adds a Title Page template instead, so it must not be counted here.
  const titlePage = config.titlePage !== false;
  let page = (titlePage ? 1 : 0) + frontMatter.length;
  // Per-page state layer (recipe v2): overrides + reserved Fabric canvasState,
  // keyed by content-page index. Stable across reloads because the seed fixes
  // the page sequence.
  const pageState = Array.isArray(config.pageState) ? config.pageState : [];
  const pages = ordered.map((puzzle, i) => {
    page += 1;
    const state = pageState[i] && typeof pageState[i] === 'object' ? pageState[i] : null;
    return { puzzle, pageNumber: page, state };
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
    titlePage, // whether an auto title page leads the book (off = template-driven)
    pageNumbers: config.pageNumbers === true, // footer page numbers on content pages
    footerText: config.footerText ? String(config.footerText).trim() : null,
    fontScale: Number(config.fontScale) || 1, // large-print text scaling
    fontFamily: config.fontFamily || 'sans',
    border: config.border && config.border !== 'none' ? String(config.border) : null, // decorative page frame
    borderColor: config.borderColor || null,
    master: config.master && typeof config.master === 'object' ? config.master : null, // master-page overlay (page numbers, headers, frames)
    seed, // recorded so a saved recipe reproduces the same page structure
    frontMatter, // [{ kind, ... }] rendered after the title page
    backMatter, // [{ kind, ... }] rendered after the answer key
    pages, // [{ puzzle, pageNumber }]
    puzzles: ordered, // convenience: ordered puzzle objects (incl. fillers)
    meta: {
      generatedAt: Date.now(),
      puzzleCount: ordered.filter((p) => !isActivityType(p.type)).length,
      pageCount: ordered.length,
      frontMatterCount: frontMatter.length,
      backMatterCount: backMatter.length,
      byType,
      uniqueWords,
      difficultyCurve: curve,
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

  const makeFiller = (kind, subject, choices) => {
    if (kind === 'blank') return generate({ type: 'bleedguard', label: '' });
    let page;
    if (kind === 'drawing') {
      page = generate({ type: 'drawing', words: subject ? [subject] : [], theme: fillerLabel });
    } else {
      const cfg = { type: 'coloring', word: subject || undefined, words: subject ? [subject] : [], theme: fillerLabel };
      if (coloringStyle === 'rotate') cfg.style = COLORING_STYLES[rotateIdx++ % COLORING_STYLES.length];
      else if (coloringStyle === 'random') cfg.style = pickRandomStyle(Boolean(subject));
      else cfg.style = coloringStyle;
      lastStyle = cfg.style;
      page = generate(cfg);
    }
    // Record swap options so a specific page's subject can be re-rolled later.
    if (choices && choices.length) page.data.choices = [...new Set(choices)].slice(0, 30);
    return page;
  };

  // Only attach fillers after real puzzles (not breathers or other activity
  // pages). "afterLast" refers to the last real puzzle.
  let lastReal = -1;
  puzzles.forEach((p, i) => {
    if (!isActivityType(p.type)) lastReal = i;
  });

  const out = [];
  puzzles.forEach((p, i) => {
    out.push(p);
    if (isActivityType(p.type)) return;
    if (i !== lastReal || afterLast) {
      const candidates = subjectWords(p);
      const subject = chooseSubject(candidates); // one subject, tied to this puzzle
      for (const kind of kinds) out.push(makeFiller(kind, subject, candidates));
    }
  });
  return out;
}

module.exports = { assembleBook };
