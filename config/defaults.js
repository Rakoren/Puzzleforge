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
  // `minSize` sets a floor on the grid dimension per tier (Easy 10×10 →
  // Expert 20×20+); the generator still grows the grid if the word list needs
  // more room.
  wordsearch: {
    1: { directions: 'orthogonal', allowBackwards: false, minWordLen: 3, separation: 'isolated', minSize: 10 },
    2: { directions: 'diagonal', allowBackwards: false, minWordLen: 3, separation: 'noCross', minSize: 12 },
    3: { directions: 'diagonal', allowBackwards: true, minWordLen: 3, separation: 'dense', minSize: 15 },
    4: { directions: 'diagonal', allowBackwards: true, minWordLen: 3, separation: 'dense', minSize: 20 },
  },
  // Sudoku givens targets per difficulty. `target` is what generation aims for;
  // `minGivens` is the validation floor (a puzzle must keep at least this many).
  sudoku: {
    1: { label: 'easy', target: 36, minGivens: 34 },
    2: { label: 'medium', target: 28, minGivens: 26 },
    3: { label: 'hard', target: 24, minGivens: 22 },
    // Expert digs as deep as a unique solution allows (17 is the theoretical
    // floor). Dropping the 180° symmetry lets the digger remove single cells and
    // reach far fewer givens than the symmetric tiers.
    4: { label: 'expert', target: 20, minGivens: 17, symmetric: false },
  },
  // Maze grid dimensions (cells) per difficulty. `braid` removes a fraction of
  // dead ends (0 = perfect maze, single solution).
  maze: {
    1: { label: 'easy', width: 10, height: 10 },
    2: { label: 'medium', width: 15, height: 15 },
    3: { label: 'hard', width: 20, height: 25 },
    4: { label: 'expert', width: 25, height: 33 },
  },
  // Nonogram (picross) grid size per difficulty. `fill` is the target share of
  // filled cells in the hidden picture.
  nonogram: {
    1: { label: 'easy', size: 5, fill: 0.55 },
    2: { label: 'medium', size: 10, fill: 0.55 },
    3: { label: 'hard', size: 15, fill: 0.52 },
    // A 20×20 nonogram is legit "expert" but its unique-solution search costs
    // ~8s/puzzle — too slow for book assembly. Cap at the fast 15×15 with a
    // denser fill instead.
    4: { label: 'expert', size: 15, fill: 0.5 },
  },
  // Number Search: how many numbers, their digit length, directions, and
  // separation (mirrors word search).
  numbersearch: {
    1: { count: 10, len: 3, directions: 'orthogonal', allowBackwards: false, separation: 'isolated' },
    2: { count: 12, len: 4, directions: 'diagonal', allowBackwards: false, separation: 'noCross' },
    3: { count: 14, len: 5, directions: 'diagonal', allowBackwards: true, separation: 'dense' },
    4: { count: 16, len: 6, directions: 'diagonal', allowBackwards: true, separation: 'dense' },
  },
  // Trivia: how many questions per page and the max question difficulty drawn.
  trivia: {
    1: { count: 10, maxDifficulty: 1 },
    2: { count: 12, maxDifficulty: 2 },
    3: { count: 14, maxDifficulty: 3 },
    4: { count: 16, maxDifficulty: 3 },
  },
  // Logic Grid: `items` is the grid size (people & values per category), `cats`
  // the number of categories (incl. the primary), `ordinal` allows one numeric
  // category for comparison clues, and `style` biases the clue mix.
  logicgrid: {
    1: { items: 4, cats: 3, ordinal: false, style: 'positive' },
    2: { items: 4, cats: 4, ordinal: true, style: 'mixed' },
    3: { items: 5, cats: 4, ordinal: true, style: 'hard' },
    // Expert keeps the 5×4 grid (a 5th category explodes the solver) but uses
    // the hardest clue mix.
    4: { items: 5, cats: 4, ordinal: true, style: 'hard' },
  },
  // Word Ladder: `length` is the word length, `steps` the number of words in the
  // ladder (incl. both endpoints), and `style` how many letters are given
  // (guided = at most one blank per rung; minimal = only enough for a unique
  // answer).
  wordladder: {
    1: { length: 3, steps: 4, style: 'guided' },
    2: { length: 4, steps: 5, style: 'some' },
    3: { length: 4, steps: 6, style: 'minimal' },
    4: { length: 4, steps: 7, style: 'minimal' },
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
