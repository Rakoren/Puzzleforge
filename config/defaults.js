/**
 * Engine-wide defaults: generation retry policy, difficulty presets,
 * audience presets, and per-type validation thresholds.
 *
 * Generators read their difficulty defaults from here so that "level 1"
 * means the same thing everywhere unless a caller overrides it.
 */

// Max generation attempts before engine/generate.js throws.
const MAX_ATTEMPTS = 10;

// Audience presets influence layout font scaling and generator defaults.
const AUDIENCE = {
  kids: { label: 'kids', fontScale: 1.25, defaultDifficulty: 1 },
  adult: { label: 'adult', fontScale: 1.0, defaultDifficulty: 2 },
};

// Minimum validation score a puzzle must reach to be accepted, per type.
// A type not listed here defaults to ACCEPT_THRESHOLD_DEFAULT.
const ACCEPT_THRESHOLD_DEFAULT = 0.8;
const ACCEPT_THRESHOLDS = {
  wordsearch: 0.85,
  sudoku: 0.85,
  maze: 0.85,
  cryptogram: 0.9,
  wordscramble: 0.9,
  // A themed criss-cross from a fixed word list can't reach NYT-grade density or
  // symmetry; 0.75 still rejects genuinely poor layouts (many dropped words) but
  // accepts the normal themed result.
  crossword: 0.75,
  krisskross: 0.8,
  nonogram: 0.85,
  numbersearch: 0.85,
  trivia: 0.9,
};

// Per-type difficulty presets. Each generator interprets these.
const DIFFICULTY = {
  // `separation` controls how hidden words may relate to each other:
  //   isolated — no shared letters and a 1-cell buffer (words never touch)
  //   noCross  — no shared letters, but words may sit next to each other
  //   dense    — words may cross on shared letters (hardest to scan)
  wordsearch: {
    1: { directions: 'orthogonal', allowBackwards: false, minWordLen: 3, separation: 'isolated' },
    2: { directions: 'diagonal', allowBackwards: false, minWordLen: 3, separation: 'noCross' },
    3: { directions: 'diagonal', allowBackwards: true, minWordLen: 3, separation: 'dense' },
  },
  // Sudoku givens targets per difficulty. `target` is what generation aims for;
  // `minGivens` is the validation floor (a puzzle must keep at least this many).
  sudoku: {
    1: { label: 'easy', target: 36, minGivens: 34 },
    2: { label: 'medium', target: 30, minGivens: 27 },
    3: { label: 'hard', target: 24, minGivens: 22 },
  },
  // Maze grid dimensions (cells) per difficulty. `braid` removes a fraction of
  // dead ends (0 = perfect maze, single solution).
  maze: {
    1: { label: 'easy', width: 10, height: 10 },
    2: { label: 'medium', width: 15, height: 15 },
    3: { label: 'hard', width: 20, height: 25 },
  },
  // Nonogram (picross) grid size per difficulty. `fill` is the target share of
  // filled cells in the hidden picture.
  nonogram: {
    1: { label: 'easy', size: 5, fill: 0.55 },
    2: { label: 'medium', size: 10, fill: 0.55 },
    3: { label: 'hard', size: 15, fill: 0.52 },
  },
  // Number Search: how many numbers, their digit length, directions, and
  // separation (mirrors word search).
  numbersearch: {
    1: { count: 10, len: 3, directions: 'orthogonal', allowBackwards: false, separation: 'isolated' },
    2: { count: 12, len: 4, directions: 'diagonal', allowBackwards: false, separation: 'noCross' },
    3: { count: 14, len: 5, directions: 'diagonal', allowBackwards: true, separation: 'dense' },
  },
  // Trivia: how many questions per page and the max question difficulty drawn.
  trivia: {
    1: { count: 10, maxDifficulty: 1 },
    2: { count: 12, maxDifficulty: 2 },
    3: { count: 14, maxDifficulty: 3 },
  },
  // Logic Grid: `items` is the grid size (people & values per category), `cats`
  // the number of categories (incl. the primary), `ordinal` allows one numeric
  // category for comparison clues, and `style` biases the clue mix.
  logicgrid: {
    1: { items: 4, cats: 3, ordinal: false, style: 'positive' },
    2: { items: 4, cats: 4, ordinal: true, style: 'mixed' },
    3: { items: 5, cats: 4, ordinal: true, style: 'hard' },
  },
};

function acceptThreshold(type) {
  return ACCEPT_THRESHOLDS[type] != null
    ? ACCEPT_THRESHOLDS[type]
    : ACCEPT_THRESHOLD_DEFAULT;
}

module.exports = {
  MAX_ATTEMPTS,
  AUDIENCE,
  ACCEPT_THRESHOLD_DEFAULT,
  ACCEPT_THRESHOLDS,
  DIFFICULTY,
  acceptThreshold,
};
