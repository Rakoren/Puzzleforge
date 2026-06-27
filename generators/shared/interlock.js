/**
 * Shared crossword/kriss-kross interlock placement.
 *
 * Places words into a grid so they cross at shared letters, forming a single
 * connected component in the criss-cross style. Enforces clean separation:
 *   - a word may overlap an existing word only on a matching letter (a cross)
 *   - the cells just before and after a word must be empty (no run-on words)
 *   - a newly filled (non-crossing) cell may not sit directly beside a
 *     parallel word (no accidental adjacent words)
 *   - every word after the first must cross at least one existing word
 *
 * Returns a normalized grid plus placements with standard crossword numbering.
 */

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const KEY = (r, c) => `${r},${c}`;
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

// Is a newly-filled cell at (r,c) involved in a *pure* corner-touch — diagonally
// adjacent to an existing cell with no shared orthogonal corner between them? At
// a real crossing the shared corner (the crossing cell) is filled, so that case
// is allowed; only free-floating corner contacts between separate words count.
function hasPureCornerTouch(cellMap, r, c) {
  for (const [ddr, ddc] of DIAG) {
    if (!cellMap.has(KEY(r + ddr, c + ddc))) continue;
    const cornerA = cellMap.has(KEY(r, c + ddc));
    const cornerB = cellMap.has(KEY(r + ddr, c));
    if (!cornerA && !cornerB) return true;
  }
  return false;
}

// Check whether `word` fits at (row,col) in direction dir ('A' across / 'D'
// down) given the current cell map. Returns crossing count, or -1 if invalid.
//
// `strict` enforces clean separation for easy puzzles: words touch only at
// crossings, never at a free corner. Without it (loose mode, hard puzzles) only
// orthogonal parallel adjacency is forbidden, allowing a denser look.
function fitScore(cellMap, word, row, col, dir, strict) {
  const dr = dir === 'D' ? 1 : 0;
  const dc = dir === 'A' ? 1 : 0;
  let crossings = 0;

  // Cell before start and after end must be empty.
  if (cellMap.has(KEY(row - dr, col - dc))) return -1;
  if (cellMap.has(KEY(row + dr * word.length, col + dc * word.length))) return -1;

  for (let k = 0; k < word.length; k++) {
    const r = row + dr * k;
    const c = col + dc * k;
    const existing = cellMap.get(KEY(r, c));
    if (existing != null) {
      if (existing !== word[k]) return -1; // conflict at this cell
      crossings++;
    } else {
      // Empty cell to be filled — its perpendicular neighbors must be empty so
      // we don't create an unintended adjacent parallel word.
      if (dir === 'A') {
        if (cellMap.has(KEY(r - 1, c)) || cellMap.has(KEY(r + 1, c))) return -1;
      } else {
        if (cellMap.has(KEY(r, c - 1)) || cellMap.has(KEY(r, c + 1))) return -1;
      }
      // Strict: no free corner-touches with other words. Crossing geometry is
      // exempt because the shared corner cell is filled.
      if (strict && hasPureCornerTouch(cellMap, r, c)) return -1;
    }
  }
  return crossings;
}

function placeOnMap(cellMap, word, row, col, dir) {
  const dr = dir === 'D' ? 1 : 0;
  const dc = dir === 'A' ? 1 : 0;
  const cells = [];
  for (let k = 0; k < word.length; k++) {
    const r = row + dr * k;
    const c = col + dc * k;
    cellMap.set(KEY(r, c), word[k]);
    cells.push([r, c]);
  }
  return { word, row, col, dir, cells };
}

/**
 * @param {string[]} words upper-cased words (length >= 2)
 * @param {function} [rand=Math.random]
 * @param {object} [opts]
 * @param {'strict'|'loose'} [opts.separation='loose']  strict = words only meet
 *        at single crossings with empty space (incl. diagonals) around them
 * @param {'min'|'max'} [opts.preferCrossings='max']  bias toward sparse (min) or
 *        dense (max) interlocking
 * @returns {{ grid, width, height, placements, dropped }}
 *   grid        2D array of letters or null
 *   placements  [{ word, dir:'A'|'D', row, col, number, cells:[[r,c]] }]  (normalized coords)
 *   dropped     words that could not be interlocked
 */
function interlock(words, rand = Math.random, opts = {}) {
  const strict = opts.separation === 'strict';
  const preferMin = opts.preferCrossings === 'min';
  // Shuffle first, then stable-sort by length descending: longest words still
  // go down first (best for placement success) but ties are randomized, so
  // repeated generations with the same word list produce different layouts.
  const ordered = shuffle(words.slice(), rand).sort((a, b) => b.length - a.length);
  const cellMap = new Map();
  const placements = [];
  const dropped = [];

  if (ordered.length === 0) {
    return { grid: [[]], width: 0, height: 0, placements: [], dropped: [] };
  }

  // Running centroid of placed cells, used as a compactness tiebreaker.
  let sumR = 0;
  let sumC = 0;
  let nCells = 0;
  const addCentroid = (cells) => {
    for (const [r, c] of cells) {
      sumR += r;
      sumC += c;
      nCells++;
    }
  };

  // Better-placement test. Primary: crossing preference (min or max). Secondary:
  // keep the layout compact by minimizing distance from the new word's midpoint
  // to the current centroid.
  function midDist(word, row, col, dir) {
    if (nCells === 0) return 0;
    const dr = dir === 'D' ? 1 : 0;
    const dc = dir === 'A' ? 1 : 0;
    const mr = row + dr * ((word.length - 1) / 2);
    const mc = col + dc * ((word.length - 1) / 2);
    const cr = sumR / nCells;
    const cc = sumC / nCells;
    return Math.abs(mr - cr) + Math.abs(mc - cc);
  }
  function isBetter(cand, best) {
    if (!best) return true;
    if (cand.score !== best.score) {
      return preferMin ? cand.score < best.score : cand.score > best.score;
    }
    return cand.dist < best.dist;
  }

  // First (longest) word placed across at the origin.
  const first = placeOnMap(cellMap, ordered[0], 0, 0, 'A');
  placements.push(first);
  addCentroid(first.cells);

  for (let w = 1; w < ordered.length; w++) {
    const word = ordered[w];

    // Collect every valid placement, then shuffle so ties are broken randomly.
    const candidates = [];
    for (const [k, letter] of cellMap.entries()) {
      const [r, c] = k.split(',').map(Number);
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== letter) continue;
        const aScore = fitScore(cellMap, word, r, c - i, 'A', strict);
        if (aScore > 0) {
          candidates.push({ score: aScore, dist: midDist(word, r, c - i, 'A'), row: r, col: c - i, dir: 'A' });
        }
        const dScore = fitScore(cellMap, word, r - i, c, 'D', strict);
        if (dScore > 0) {
          candidates.push({ score: dScore, dist: midDist(word, r - i, c, 'D'), row: r - i, col: c, dir: 'D' });
        }
      }
    }
    shuffle(candidates, rand);
    let best = null;
    for (const cand of candidates) if (isBetter(cand, best)) best = cand;

    if (best) {
      const placed = placeOnMap(cellMap, word, best.row, best.col, best.dir);
      placements.push(placed);
      addCentroid(placed.cells);
    } else {
      dropped.push(word);
    }
  }

  // Normalize coordinates to a 0-based grid.
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  for (const k of cellMap.keys()) {
    const [r, c] = k.split(',').map(Number);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const height = maxR - minR + 1;
  const width = maxC - minC + 1;
  const grid = Array.from({ length: height }, () => Array(width).fill(null));
  for (const [k, letter] of cellMap.entries()) {
    const [r, c] = k.split(',').map(Number);
    grid[r - minR][c - minC] = letter;
  }

  const normPlacements = placements.map((p) => ({
    word: p.word,
    dir: p.dir,
    row: p.row - minR,
    col: p.col - minC,
    cells: p.cells.map(([r, c]) => [r - minR, c - minC]),
  }));

  // Standard crossword numbering: scan in reading order, number any cell that
  // begins an across and/or down word.
  const number = numberGrid(grid);
  for (const p of normPlacements) {
    p.number = number[p.row][p.col];
  }

  return { grid, width, height, placements: normPlacements, dropped };
}

// Assign numbers to cells that start an across or down word. Returns a 2D
// array of numbers (0 = no number).
function numberGrid(grid) {
  const height = grid.length;
  const width = grid[0] ? grid[0].length : 0;
  const num = Array.from({ length: height }, () => Array(width).fill(0));
  let n = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] == null) continue;
      const leftEmpty = c === 0 || grid[r][c - 1] == null;
      const rightFilled = c + 1 < width && grid[r][c + 1] != null;
      const upEmpty = r === 0 || grid[r - 1][c] == null;
      const downFilled = r + 1 < height && grid[r + 1][c] != null;
      const startsAcross = leftEmpty && rightFilled;
      const startsDown = upEmpty && downFilled;
      if (startsAcross || startsDown) num[r][c] = ++n;
    }
  }
  return num;
}

/** Count connected components of filled cells (4-neighbour). */
function countComponents(grid) {
  const height = grid.length;
  const width = grid[0] ? grid[0].length : 0;
  const seen = Array.from({ length: height }, () => Array(width).fill(false));
  let components = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] == null || seen[r][c]) continue;
      components++;
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= height || nx >= width) continue;
          if (grid[ny][nx] == null || seen[ny][nx]) continue;
          seen[ny][nx] = true;
          stack.push([ny, nx]);
        }
      }
    }
  }
  return components;
}

/**
 * Count orthogonal adjacencies between filled cells that are NOT consecutive
 * letters of a single placed word — i.e. two different words running alongside
 * each other. A clean interlock has zero of these. If `diagonal` is true,
 * diagonal corner-touches between different words are counted too.
 */
function touchViolations(grid, placements, diagonal = false) {
  const height = grid.length;
  const width = grid[0] ? grid[0].length : 0;

  // Allowed adjacency pairs: consecutive cells within each placed word.
  const allowed = new Set();
  for (const p of placements) {
    for (let i = 0; i + 1 < p.cells.length; i++) {
      const [r1, c1] = p.cells[i];
      const [r2, c2] = p.cells[i + 1];
      allowed.add(`${r1},${c1}|${r2},${c2}`);
      allowed.add(`${r2},${c2}|${r1},${c1}`);
    }
  }
  const ok = (r1, c1, r2, c2) => allowed.has(`${r1},${c1}|${r2},${c2}`);

  const filled = (r, c) =>
    r >= 0 && c >= 0 && r < height && c < width && grid[r][c] != null;

  let violations = 0;
  const dirs = diagonal ? [[0, 1], [1, 0], [1, 1], [1, -1]] : [[0, 1], [1, 0]];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] == null) continue;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (!filled(nr, nc)) continue;
        if (dr !== 0 && dc !== 0) {
          // Diagonal contact is only a violation if it is a *pure* corner-touch:
          // neither shared orthogonal corner is filled. At a real crossing one
          // corner (the crossing cell) is filled, so that geometry is exempt.
          if (!filled(r, nc) && !filled(nr, c)) violations++;
        } else if (!ok(r, c, nr, nc)) {
          violations++;
        }
      }
    }
  }
  return violations;
}

/**
 * Map a difficulty (1|2|3) to interlock separation options.
 *   1 (easy)   — strict separation, sparse: words meet only at single
 *                crossings with clear space (incl. diagonals) around them
 *   2 (medium) — strict separation, denser interlocking
 *   3 (hard)   — loose: dense, words may corner-touch
 */
function separationForDifficulty(difficulty) {
  if (difficulty >= 3) return { separation: 'loose', preferCrossings: 'max' };
  if (difficulty === 2) return { separation: 'strict', preferCrossings: 'max' };
  return { separation: 'strict', preferCrossings: 'min' };
}

module.exports = {
  interlock,
  numberGrid,
  countComponents,
  touchViolations,
  separationForDifficulty,
};
