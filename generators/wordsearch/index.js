/**
 * Word Search — generate().
 *
 * Produces the type-specific `data` and `solution` for a word search puzzle.
 * The engine wraps this in the standard puzzle object and is responsible for
 * the validate/solve/retry lifecycle.
 *
 * Config:
 *   words        string[]   required — words to hide (upper-cased internally)
 *   size         number     optional — grid side length; auto-sized if omitted
 *   difficulty   1|2|3      optional — selects direction/backwards preset
 *   directions   string     optional — 'orthogonal' | 'diagonal' (overrides preset)
 *   allowBackwards boolean  optional — overrides preset
 *   theme        string     optional — passed through for labelling
 *   title        string     optional
 *   instructions string     optional
 */
const { DIFFICULTY } = require('../../config/defaults');
const {
  resolveDirections,
  autoSize,
  placeTokens,
  fillGridSafe,
  protectedMask,
} = require('../shared/gridsearch');
const offensive = require('../../filters/offensive');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Banned substrings to keep out of the random fill (same list the validator
// scans for). Length-3+ only, matching findOffensiveSubstrings.
const BANNED_TERMS = [...offensive.BLOCKLIST].filter((t) => t.length >= 3);

/**
 * @param {object} config
 * @param {function} [rand=Math.random] injectable RNG for deterministic tests
 * @returns {{ type, difficulty, theme, title, instructions, data, solution }}
 */
function generate(config = {}, rand = Math.random) {
  const rawWords = (config.words || [])
    .map((w) => String(w).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length > 0);

  if (rawWords.length === 0) {
    throw new Error('wordsearch.generate: config.words must be a non-empty list');
  }

  // De-duplicate while preserving order.
  const words = [...new Set(rawWords)];

  const difficulty = config.difficulty || 1;
  const preset = DIFFICULTY.wordsearch[difficulty] || DIFFICULTY.wordsearch[1];
  const mode = config.directions || preset.directions;
  const allowBackwards =
    config.allowBackwards != null ? config.allowBackwards : preset.allowBackwards;
  const minWordLen = preset.minWordLen || 3;
  const separation = config.separation || preset.separation || 'dense';

  const tooShort = words.find((w) => w.length < minWordLen);
  if (tooShort) {
    throw new Error(
      `wordsearch.generate: word "${tooShort}" is shorter than the minimum length ${minWordLen}`
    );
  }

  // Grid dimension: the caller's explicit size wins; otherwise auto-fit the
  // word list but never below the tier's floor (Easy 10 → Expert 20).
  const size = config.size || Math.max(autoSize(words, separation), preset.minSize || 0);
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  if (longest > size) {
    throw new Error(
      `wordsearch.generate: word length ${longest} exceeds grid size ${size}`
    );
  }

  const directions = resolveDirections(mode, allowBackwards);
  const { grid, placements } = placeTokens(words, { size, directions, separation, rand });
  fillGridSafe(grid, ALPHABET, {
    terms: BANNED_TERMS,
    protectedMask: protectedMask(size, placements),
    rand,
  });

  return {
    type: 'wordsearch',
    difficulty,
    theme: config.theme || null,
    title: config.title || (config.theme ? `${cap(config.theme)} Word Search` : 'Word Search'),
    instructions:
      config.instructions ||
      'Find and circle all the hidden words. They may go across, down' +
        (mode === 'diagonal' ? ', and diagonally' : '') +
        (allowBackwards ? ', forwards and backwards.' : '.'),
    data: {
      size,
      grid,
      words: [...words].sort(),
      mode,
      allowBackwards,
      separation,
    },
    solution: {
      placements: placements.map((p) => ({
        word: p.word,
        row: p.row,
        col: p.col,
        dr: p.dr,
        dc: p.dc,
        cells: p.cells,
      })),
    },
  };
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { generate, resolveDirections, autoSize };
