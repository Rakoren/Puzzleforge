/**
 * Theme loader.
 *
 * Themes are word lists tiered by difficulty. Each theme file has the shape:
 *
 *   { "id": "animals", "label": "Animals",
 *     "tiers": { "1": [ {"word":"CAT","clue":"..."}, "DOG", ... ],
 *                "2": [ ... ], "3": [ ... ] } }
 *
 * An entry may be a plain string or { word, clue } — the clue is optional and
 * only used by crosswords. Generators pull from the tier matching the puzzle's
 * difficulty so a level-1 puzzle never sees a level-3 word.
 */
const fs = require('fs');
const path = require('path');

const THEME_DIR = __dirname;
const TIERS = ['1', '2', '3'];

function themePath(id) {
  return path.join(THEME_DIR, `${id}.json`);
}

function listThemes() {
  return fs
    .readdirSync(THEME_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

// Normalize a raw entry (string or object) into { word, clue }.
function normEntry(entry) {
  if (typeof entry === 'string') return { word: entry.toUpperCase(), clue: null };
  return { word: String(entry.word || '').toUpperCase(), clue: entry.clue || null };
}

/**
 * Load a theme by id. Returns { id, label, tiers: { '1':[{word,clue}], ... } }.
 * Accepts the legacy flat format ({ words: [{word, clue, difficulty}] }) too.
 */
function loadTheme(id) {
  const p = themePath(id);
  if (!fs.existsSync(p)) {
    throw new Error(`Unknown theme "${id}". Available: ${listThemes().join(', ')}`);
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const tiers = { 1: [], 2: [], 3: [] };

  if (raw.tiers) {
    for (const t of TIERS) {
      for (const entry of raw.tiers[t] || []) tiers[t].push(normEntry(entry));
    }
  } else if (raw.words) {
    // Legacy: split a flat list by each word's `difficulty`.
    for (const entry of raw.words) {
      const tier = Math.min(3, Math.max(1, entry.difficulty || 1));
      tiers[tier].push(normEntry(entry));
    }
  }

  return {
    id: raw.id || id,
    label: raw.label || id,
    category: raw.category || 'Other',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    facts: Array.isArray(raw.facts) ? raw.facts : [],
    tiers,
  };
}

/**
 * List every theme with its display metadata, sorted by category then label.
 * @returns {Array<{id,label,category,tags,wordCount}>}
 */
function listThemesDetailed() {
  return listThemes()
    .map((id) => {
      const t = loadTheme(id);
      return { id, label: t.label, category: t.category, tags: t.tags, wordCount: wordCount(t) };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

function tierEntries(theme, tier) {
  return theme.tiers[String(tier)] || [];
}

function allEntries(theme) {
  return [...theme.tiers['1'], ...theme.tiers['2'], ...theme.tiers['3']];
}

/** Total number of words across all tiers. */
function wordCount(theme) {
  return allEntries(theme).length;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Theme ids belonging to a category (by the theme file's `category` field). */
function themesInCategory(category) {
  return listThemes().filter((id) => loadTheme(id).category === category);
}

// A theme reference of the form "cat:Animals & Nature" selects every theme in
// that category, merged into one pool.
const CATEGORY_PREFIX = 'cat:';

/**
 * Resolve a theme reference to a loaded theme object. Accepts:
 *   - a theme id ("animals")
 *   - an array of ids (merged)
 *   - a category reference ("cat:Animals & Nature" → all themes in it, merged)
 */
function resolveTheme(ref) {
  if (Array.isArray(ref)) return mergeThemes(ref);
  if (typeof ref === 'string' && ref.startsWith(CATEGORY_PREFIX)) {
    const category = ref.slice(CATEGORY_PREFIX.length);
    const ids = themesInCategory(category);
    if (ids.length === 0) throw new Error(`No themes found in category "${category}".`);
    const merged = mergeThemes(ids);
    merged.label = category;
    merged.category = category;
    merged.id = 'cat-' + category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return merged;
  }
  return loadTheme(ref);
}

/**
 * Merge themes into one pool, preserving tiers. Accepts ids and/or loaded
 * theme objects.
 */
function mergeThemes(themes) {
  const loaded = themes.map((t) => (typeof t === 'string' ? loadTheme(t) : t));
  const tiers = { 1: [], 2: [], 3: [] };
  const seen = new Set();
  for (const theme of loaded) {
    for (const t of TIERS) {
      for (const entry of theme.tiers[t]) {
        if (seen.has(entry.word)) continue;
        seen.add(entry.word);
        tiers[t].push(entry);
      }
    }
  }
  return {
    id: loaded.map((t) => t.id).join('+'),
    label: loaded.map((t) => t.label).join(' + '),
    tiers,
  };
}

/**
 * Select words from a theme.
 * @param {object} theme  loaded theme
 * @param {object} [opts]
 * @param {number} [opts.difficulty]    pull from this tier (1|2|3)
 * @param {number} [opts.maxDifficulty] cumulative: tiers 1..max (legacy)
 * @param {number} [opts.minLength=3]
 * @param {number} [opts.maxLength]     drop words longer than this (kids tiers)
 * @param {number} [opts.count]         random sample of this many (for variety)
 * @param {Set<string>|string[]} [opts.exclude] words to leave out (e.g. already
 *                                       used elsewhere in a book)
 * @returns {string[]} upper-cased words
 */
function selectWords(theme, opts = {}) {
  const minLength = opts.minLength != null ? opts.minLength : 3;
  const exclude =
    opts.exclude instanceof Set
      ? opts.exclude
      : Array.isArray(opts.exclude)
        ? new Set(opts.exclude)
        : null;

  let entries;
  if (opts.difficulty != null) {
    entries = tierEntries(theme, opts.difficulty);
    if (entries.length === 0) entries = allEntries(theme); // graceful fallback
  } else if (opts.maxDifficulty != null) {
    entries = [];
    for (let d = 1; d <= opts.maxDifficulty; d++) entries.push(...tierEntries(theme, d));
  } else {
    entries = allEntries(theme);
  }

  const maxLength = opts.maxLength != null ? opts.maxLength : Infinity;
  let pool = [...new Set(entries.map((e) => e.word))].filter(
    (w) => w.length >= minLength && w.length <= maxLength && !(exclude && exclude.has(w))
  );

  if (opts.count != null) {
    // Sample `count` words with no word a substring of another in the set
    // (word searches reject substrings; it's undesirable for crosswords too).
    const shuffled = shuffle(pool.slice());
    const chosen = [];
    for (const w of shuffled) {
      if (chosen.length >= opts.count) break;
      if (chosen.some((c) => c.includes(w) || w.includes(c))) continue;
      chosen.push(w);
    }
    return chosen;
  }
  return pool;
}

/** Build a { WORD: clue } map across all tiers (clues are optional). */
function clueMap(theme) {
  const map = {};
  for (const entry of allEntries(theme)) {
    if (entry.clue) map[entry.word] = entry.clue;
  }
  return map;
}

module.exports = {
  listThemes,
  listThemesDetailed,
  loadTheme,
  mergeThemes,
  resolveTheme,
  themesInCategory,
  selectWords,
  clueMap,
  wordCount,
  THEME_DIR,
};
