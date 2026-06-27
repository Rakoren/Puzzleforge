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

// Base forward directions per mode.
const FORWARD = {
  orthogonal: [
    [0, 1], // east
    [1, 0], // south
  ],
  diagonal: [
    [0, 1],
    [1, 0],
    [1, 1], // south-east
    [-1, 1], // north-east
  ],
};

function resolveDirections(mode, allowBackwards) {
  const fwd = FORWARD[mode] || FORWARD.orthogonal;
  if (!allowBackwards) return fwd.map((d) => d.slice());
  const all = [];
  for (const [dr, dc] of fwd) {
    all.push([dr, dc]);
    all.push([-dr, -dc]);
  }
  return all;
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeGrid(n) {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null));
}

// Can `word` be laid from (r,c) along (dr,dc)? Overlap permitted only where
// the existing letter matches (standard word-search crossing).
function canPlace(grid, word, r, c, dr, dc) {
  const n = grid.length;
  let overlaps = 0;
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n) return false;
    const cell = grid[rr][cc];
    if (cell !== null) {
      if (cell !== word[i]) return false;
      overlaps++;
    }
  }
  // Reject a placement that lands entirely on top of existing letters.
  if (overlaps === word.length) return false;
  return true;
}

function place(grid, word, r, c, dr, dc) {
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    grid[rr][cc] = word[i];
    cells.push([rr, cc]);
  }
  return { word, row: r, col: c, dr, dc, cells };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function autoSize(words) {
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  const totalLetters = words.reduce((s, w) => s + w.length, 0);
  // Enough room for the longest word plus margin, and roughly 2x the letters
  // worth of cells so fill isn't overcrowded.
  const byArea = Math.ceil(Math.sqrt(totalLetters * 2.2));
  return Math.max(longest + 1, byArea, 10);
}

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

  const tooShort = words.find((w) => w.length < minWordLen);
  if (tooShort) {
    throw new Error(
      `wordsearch.generate: word "${tooShort}" is shorter than the minimum length ${minWordLen}`
    );
  }

  const size = config.size || autoSize(words);
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  if (longest > size) {
    throw new Error(
      `wordsearch.generate: word length ${longest} exceeds grid size ${size}`
    );
  }

  const directions = resolveDirections(mode, allowBackwards);
  const grid = makeGrid(size);
  const placements = [];
  const directionsUsed = new Set();

  // Place longest words first — they are the hardest to fit.
  const ordered = [...words].sort((a, b) => b.length - a.length);

  for (const word of ordered) {
    let placed = false;
    // Try a bounded number of random positions/orientations per word.
    const positions = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) positions.push([r, c]);
    }
    shuffle(positions, rand);

    outer: for (const [r, c] of positions) {
      const dirs = shuffle(directions.map((d) => d.slice()), rand);
      for (const [dr, dc] of dirs) {
        if (canPlace(grid, word, r, c, dr, dc)) {
          const p = place(grid, word, r, c, dr, dc);
          placements.push(p);
          directionsUsed.add(`${dr},${dc}`);
          placed = true;
          break outer;
        }
      }
    }

    if (!placed) {
      // Signal a transient failure; the engine will retry with a fresh grid.
      const err = new Error(
        `wordsearch.generate: could not place "${word}" in ${size}x${size} grid`
      );
      err.retryable = true;
      throw err;
    }
  }

  // Fill empty cells with random letters.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = ALPHABET[Math.floor(rand() * 26)];
      }
    }
  }

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
