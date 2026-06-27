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
  crossword: 0.8,
  krisskross: 0.8,
};

// Per-type difficulty presets. Each generator interprets these.
const DIFFICULTY = {
  wordsearch: {
    1: { directions: 'orthogonal', allowBackwards: false, minWordLen: 3 },
    2: { directions: 'diagonal', allowBackwards: false, minWordLen: 3 },
    3: { directions: 'diagonal', allowBackwards: true, minWordLen: 3 },
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
