/**
 * Theme loader.
 *
 * Themes are word lists only — no visual assets. Each word carries a clue
 * (for crossword / kriss-kross use) and a difficulty rating so generators can
 * filter by level. Mixed themes are supported by merging word pools.
 */
const fs = require('fs');
const path = require('path');

const THEME_DIR = __dirname;

function themePath(id) {
  return path.join(THEME_DIR, `${id}.json`);
}

/** List available built-in theme ids. */
function listThemes() {
  return fs
    .readdirSync(THEME_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

/** Load a single theme by id. Throws if it does not exist. */
function loadTheme(id) {
  const p = themePath(id);
  if (!fs.existsSync(p)) {
    throw new Error(
      `Unknown theme "${id}". Available: ${listThemes().join(', ')}`
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Merge one or more themes into a single word pool. Accepts theme ids and/or
 * already-loaded theme objects. Later entries win on duplicate words.
 * @param {Array<string|object>} themes
 * @returns {{ id: string, label: string, words: Array }}
 */
function mergeThemes(themes) {
  const loaded = themes.map((t) => (typeof t === 'string' ? loadTheme(t) : t));
  const byWord = new Map();
  for (const theme of loaded) {
    for (const entry of theme.words) {
      byWord.set(entry.word.toUpperCase(), entry);
    }
  }
  return {
    id: loaded.map((t) => t.id).join('+'),
    label: loaded.map((t) => t.label).join(' + '),
    words: [...byWord.values()],
  };
}

/**
 * Select words from a theme (or merged themes) up to `count`, filtered by an
 * inclusive difficulty ceiling and a minimum length.
 * @param {object} theme    loaded theme (or merged pool)
 * @param {object} [opts]
 * @param {number} [opts.maxDifficulty=3]
 * @param {number} [opts.minLength=3]
 * @param {number} [opts.count]   max words to return (default: all matching)
 * @returns {string[]} upper-cased words
 */
function selectWords(theme, opts = {}) {
  const maxDifficulty = opts.maxDifficulty != null ? opts.maxDifficulty : 3;
  const minLength = opts.minLength != null ? opts.minLength : 3;
  let pool = theme.words
    .filter((w) => (w.difficulty || 1) <= maxDifficulty)
    .filter((w) => w.word.length >= minLength)
    .map((w) => w.word.toUpperCase());
  if (opts.count != null && pool.length > opts.count) {
    pool = pool.slice(0, opts.count);
  }
  return pool;
}

module.exports = {
  listThemes,
  loadTheme,
  mergeThemes,
  selectWords,
  THEME_DIR,
};
