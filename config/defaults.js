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
  riddles: 0.9,
  brainteasers: 0.9,
  mathpuzzles: 0.9,
  xsudoku: 0.85,
  minisudoku: 0.85,
  evenodd: 0.85,
  kakuro: 0.85,
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
  // Riddles / brain teasers are longer to read, so fewer fit on a page than a
  // trivia sheet; higher levels pull the trickier items.
  riddles: {
    1: { count: 6, maxDifficulty: 1 },
    2: { count: 7, maxDifficulty: 2 },
    3: { count: 8, maxDifficulty: 3 },
    4: { count: 9, maxDifficulty: 4 },
  },
  brainteasers: {
    1: { count: 6, maxDifficulty: 1 },
    2: { count: 7, maxDifficulty: 2 },
    3: { count: 8, maxDifficulty: 3 },
    4: { count: 8, maxDifficulty: 4 },
  },
  // Math puzzles — operations widen and numbers grow with level; sequence
  // puzzles join at the harder tiers.
  mathpuzzles: {
    1: { count: 12, maxA: 10, maxFactor: 5, ops: ['+', '−'], blankFirst: false, seq: 0, maxStep: 5, seqBlanks: 1 },
    2: { count: 14, maxA: 20, maxFactor: 6, ops: ['+', '−'], blankFirst: true, seq: 2, maxStep: 6, seqBlanks: 1 },
    3: { count: 15, maxA: 25, maxFactor: 9, ops: ['+', '−', '×'], blankFirst: true, seq: 3, maxStep: 8, seqBlanks: 1 },
    4: { count: 16, maxA: 30, maxFactor: 12, ops: ['+', '−', '×', '÷'], blankFirst: true, seq: 4, maxStep: 10, seqBlanks: 2 },
  },
  // X-Sudoku (diagonal sudoku) — fewer givens (harder) as the level rises.
  xsudoku: {
    1: { givens: 40 },
    2: { givens: 34 },
    3: { givens: 30 },
    4: { givens: 26 },
  },
  // Mini Sudoku (6×6) — fewer givens as the level rises. 36 cells total.
  minisudoku: {
    1: { givens: 20 },
    2: { givens: 16 },
    3: { givens: 13 },
    4: { givens: 11 },
  },
  // Even-Odd Sudoku (9×9) — the parity shading is extra help, so it can start
  // with fewer givens than plain sudoku at the same tier.
  evenodd: {
    1: { givens: 34 },
    2: { givens: 30 },
    3: { givens: 26 },
    4: { givens: 22 },
  },
  // Kakuro (cross sums) — grid dimensions (incl. clue border) and the number of
  // aggregated 2×2 white blocks grow with difficulty. Every board is verified
  // unique-solution; these configs generate reliably in well under a second.
  kakuro: {
    1: { rows: 5, cols: 5, blocks: 2 },
    2: { rows: 6, cols: 6, blocks: 3 },
    3: { rows: 6, cols: 6, blocks: 4 },
    4: { rows: 7, cols: 7, blocks: 4 },
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
  // Word Wheel: `minLen` is the shortest word allowed; `sourceTop` biases the
  // 9-letter source word toward the common end of the list (lower = easier
  // target); `minWords` is the acceptance floor on findable words.
  wordwheel: {
    1: { minLen: 3, sourceTop: 0.35, minWords: 12 },
    2: { minLen: 4, sourceTop: 0.6, minWords: 12 },
    3: { minLen: 4, sourceTop: 1, minWords: 10 },
    4: { minLen: 5, sourceTop: 1, minWords: 8 },
  },
  // Cipher: which ciphers are drawn, the max message length, and whether the
  // Caesar shift is revealed (harder levels hide it).
  cipher: {
    1: { modes: ['caesar', 'a1z26'], maxLen: 24, showKey: true },
    2: { modes: ['caesar', 'atbash', 'a1z26'], maxLen: 34, showKey: true },
    3: { modes: ['caesar', 'atbash', 'morse'], maxLen: 44, showKey: false },
    4: { modes: ['caesar', 'atbash', 'morse'], maxLen: 60, showKey: false },
  },
};

// --- Kids difficulty ladder (a SEPARATE, gentler ramp) --------------------
//
// Kids and adults are two different ladders, not one ladder with two labels.
// A kids book's top tier ("Independent", ages 10–12) tops out around where the
// adult ladder sits in its lower-middle — smaller grids, shorter/commoner words,
// gentler mechanics. When `audience === 'kids'`, `presetFor()` reads THIS table
// instead of `DIFFICULTY`; a type absent here falls back to the adult preset.
//
// Grounding (vs the adult numbers above):
//   • Word search: adult tops at 20×20 dense+backwards; kids top at 13×13, only
//     light backwards at the very top tier, never the "dense" (crossing) mode.
//   • Maze: adult tops at 25×33; kids top at 13×17 (≈ adult Easy–Medium).
//   • Sudoku is NOT offered below Growing Reader (8–10) — it isn't a 4–8 puzzle.
//     Kids sudoku is 9×9 with heavy givens only for the two older tiers.
const KIDS_DIFFICULTY = {
  wordsearch: {
    1: { directions: 'orthogonal', allowBackwards: false, minWordLen: 3, separation: 'isolated', minSize: 7 },
    2: { directions: 'orthogonal', allowBackwards: false, minWordLen: 3, separation: 'isolated', minSize: 9 },
    3: { directions: 'diagonal', allowBackwards: false, minWordLen: 3, separation: 'noCross', minSize: 11 },
    4: { directions: 'diagonal', allowBackwards: true, minWordLen: 3, separation: 'noCross', minSize: 13 },
  },
  maze: {
    1: { label: 'easy', width: 7, height: 7 },
    2: { label: 'easy', width: 9, height: 9 },
    3: { label: 'medium', width: 11, height: 13 },
    4: { label: 'medium', width: 13, height: 17 },
  },
  nonogram: {
    1: { label: 'easy', size: 5, fill: 0.55 },
    2: { label: 'easy', size: 5, fill: 0.55 },
    3: { label: 'medium', size: 8, fill: 0.55 },
    4: { label: 'medium', size: 10, fill: 0.52 },
  },
  numbersearch: {
    1: { count: 8, len: 3, directions: 'orthogonal', allowBackwards: false, separation: 'isolated' },
    2: { count: 10, len: 3, directions: 'orthogonal', allowBackwards: false, separation: 'isolated' },
    3: { count: 12, len: 4, directions: 'diagonal', allowBackwards: false, separation: 'noCross' },
    4: { count: 12, len: 4, directions: 'diagonal', allowBackwards: true, separation: 'noCross' },
  },
  // Sudoku: only the two older tiers (Growing Reader 8–10, Independent 10–12).
  // Requesting a kids sudoku below level 3 throws a helpful error (see presetFor).
  sudoku: {
    3: { label: 'easy', target: 44, minGivens: 40 },
    4: { label: 'medium', target: 38, minGivens: 34 },
  },
  trivia: {
    1: { count: 8, maxDifficulty: 1 },
    2: { count: 10, maxDifficulty: 1 },
    3: { count: 10, maxDifficulty: 2 },
    4: { count: 12, maxDifficulty: 2 },
  },
  // Kids stay in the easier riddle/teaser tiers (never the tricky level-4 ones).
  riddles: {
    1: { count: 5, maxDifficulty: 1 },
    2: { count: 6, maxDifficulty: 2 },
    3: { count: 6, maxDifficulty: 2 },
    4: { count: 7, maxDifficulty: 3 },
  },
  brainteasers: {
    1: { count: 5, maxDifficulty: 1 },
    2: { count: 6, maxDifficulty: 2 },
    3: { count: 6, maxDifficulty: 2 },
    4: { count: 7, maxDifficulty: 3 },
  },
  // Kids math stays with addition/subtraction longer; times tables arrive at the
  // top tiers, and numbers stay small.
  mathpuzzles: {
    1: { count: 10, maxA: 10, maxFactor: 5, ops: ['+', '−'], blankFirst: false, seq: 0, maxStep: 5, seqBlanks: 1 },
    2: { count: 12, maxA: 12, maxFactor: 5, ops: ['+', '−'], blankFirst: false, seq: 1, maxStep: 5, seqBlanks: 1 },
    3: { count: 12, maxA: 20, maxFactor: 6, ops: ['+', '−', '×'], blankFirst: true, seq: 2, maxStep: 6, seqBlanks: 1 },
    4: { count: 14, maxA: 20, maxFactor: 9, ops: ['+', '−', '×'], blankFirst: true, seq: 3, maxStep: 8, seqBlanks: 1 },
  },
  // Kids X-Sudoku keeps plenty of givens (gentler than the adult ladder).
  xsudoku: {
    1: { givens: 46 },
    2: { givens: 42 },
    3: { givens: 38 },
    4: { givens: 34 },
  },
  // Kids Mini Sudoku keeps plenty of givens (gentler than the adult ladder).
  minisudoku: {
    1: { givens: 26 },
    2: { givens: 23 },
    3: { givens: 20 },
    4: { givens: 17 },
  },
  // Kids Even-Odd Sudoku keeps plenty of givens.
  evenodd: {
    1: { givens: 42 },
    2: { givens: 38 },
    3: { givens: 34 },
    4: { givens: 30 },
  },
  // Kids Kakuro stays small (fewer, shorter runs) for gentler grids.
  kakuro: {
    1: { rows: 5, cols: 5, blocks: 2 },
    2: { rows: 5, cols: 5, blocks: 2 },
    3: { rows: 6, cols: 6, blocks: 3 },
    4: { rows: 6, cols: 6, blocks: 4 },
  },
  logicgrid: {
    1: { items: 4, cats: 3, ordinal: false, style: 'positive' },
    2: { items: 4, cats: 3, ordinal: false, style: 'positive' },
    3: { items: 4, cats: 4, ordinal: false, style: 'positive' },
    4: { items: 4, cats: 4, ordinal: true, style: 'mixed' },
  },
  wordladder: {
    1: { length: 3, steps: 3, style: 'guided' },
    2: { length: 3, steps: 4, style: 'guided' },
    3: { length: 4, steps: 4, style: 'some' },
    4: { length: 4, steps: 5, style: 'some' },
  },
  wordwheel: {
    1: { minLen: 3, sourceTop: 0.25, minWords: 8 },
    2: { minLen: 3, sourceTop: 0.35, minWords: 8 },
    3: { minLen: 3, sourceTop: 0.5, minWords: 10 },
    4: { minLen: 4, sourceTop: 0.7, minWords: 10 },
  },
  // Morse is never used for kids; the Caesar key stays shown until the top tier.
  cipher: {
    1: { modes: ['caesar'], maxLen: 18, showKey: true },
    2: { modes: ['caesar', 'atbash'], maxLen: 24, showKey: true },
    3: { modes: ['caesar', 'atbash', 'a1z26'], maxLen: 30, showKey: true },
    4: { modes: ['caesar', 'atbash', 'a1z26'], maxLen: 40, showKey: false },
  },
};

// Max word length for AUTO-SELECTED kids theme words, per tier. Keeps a
// Beginner grid from hiding an 11-letter word. Applies only to words drawn from
// a theme — never to words a publisher typed in by hand.
const KIDS_WORD_MAXLEN = { 1: 5, 2: 6, 3: 7, 4: 8 };

const isKidsAudience = (a) => String(a || '').toLowerCase() === 'kids';
const clampLvl = (lv) => Math.max(1, Math.min(4, Math.round(Number(lv) || 1)));

/**
 * Resolve the difficulty preset for a type at a level, for an audience.
 * Kids books read the gentler KIDS_DIFFICULTY ladder; adults (or any type not
 * in that table) read the standard DIFFICULTY ladder.
 * @throws when a kids book requests a tier a type doesn't offer for kids
 *   (e.g. sudoku below Growing Reader).
 */
function presetFor(type, level, audience) {
  const lv = clampLvl(level);
  if (isKidsAudience(audience) && KIDS_DIFFICULTY[type]) {
    const k = KIDS_DIFFICULTY[type][lv];
    if (k) return k;
    // The type exists for kids but not at this (too-easy) tier — sudoku only.
    if (type === 'sudoku') {
      throw new Error(
        'Sudoku isn’t offered for Beginner/Early Reader (ages 4–8). Use Growing Reader (8–10) or older, or pick a word search or maze for younger kids.'
      );
    }
  }
  return (DIFFICULTY[type] && (DIFFICULTY[type][lv] || DIFFICULTY[type][1])) || null;
}

/** Max auto-selected word length for a kids tier (null for adults). */
function kidsWordMaxLen(level, audience) {
  return isKidsAudience(audience) ? KIDS_WORD_MAXLEN[clampLvl(level)] : null;
}

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
  KIDS_DIFFICULTY,
  KIDS_WORD_MAXLEN,
  presetFor,
  kidsWordMaxLen,
  acceptThreshold,
};
