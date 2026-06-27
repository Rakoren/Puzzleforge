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

// Check whether `word` fits at (row,col) in direction dir ('A' across / 'D'
// down) given the current cell map. Returns crossing count, or -1 if invalid.
function fitScore(cellMap, word, row, col, dir) {
  const dr = dir === 'D' ? 1 : 0;
  const dc = dir === 'A' ? 1 : 0;
  let crossings = 0;

  // Cell before start and after end must be empty.
  const beforeR = row - dr;
  const beforeC = col - dc;
  const afterR = row + dr * word.length;
  const afterC = col + dc * word.length;
  if (cellMap.has(KEY(beforeR, beforeC))) return -1;
  if (cellMap.has(KEY(afterR, afterC))) return -1;

  for (let k = 0; k < word.length; k++) {
    const r = row + dr * k;
    const c = col + dc * k;
    const existing = cellMap.get(KEY(r, c));
    if (existing != null) {
      if (existing !== word[k]) return -1; // conflict
      crossings++;
    } else {
      // Empty cell to be filled — its perpendicular neighbors must be empty so
      // we don't create an unintended adjacent parallel word.
      if (dir === 'A') {
        if (cellMap.has(KEY(r - 1, c)) || cellMap.has(KEY(r + 1, c))) return -1;
      } else {
        if (cellMap.has(KEY(r, c - 1)) || cellMap.has(KEY(r, c + 1))) return -1;
      }
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
 * @returns {{ grid, width, height, placements, dropped }}
 *   grid        2D array of letters or null
 *   placements  [{ word, dir:'A'|'D', row, col, number, cells:[[r,c]] }]  (normalized coords)
 *   dropped     words that could not be interlocked
 */
function interlock(words, rand = Math.random) {
  const ordered = words.slice().sort((a, b) => b.length - a.length);
  const cellMap = new Map();
  const placements = [];
  const dropped = [];

  if (ordered.length === 0) {
    return { grid: [[]], width: 0, height: 0, placements: [], dropped: [] };
  }

  // First (longest) word placed across at the origin.
  placements.push(placeOnMap(cellMap, ordered[0], 0, 0, 'A'));

  for (let w = 1; w < ordered.length; w++) {
    const word = ordered[w];
    let best = null; // { score, row, col, dir }

    // Try crossing each existing filled cell.
    for (const [k, letter] of cellMap.entries()) {
      const [r, c] = k.split(',').map(Number);
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== letter) continue;
        // Across placement crossing at (r,c): start col = c - i.
        const aScore = fitScore(cellMap, word, r, c - i, 'A');
        if (aScore > 0 && (!best || aScore > best.score)) {
          best = { score: aScore, row: r, col: c - i, dir: 'A' };
        }
        // Down placement crossing at (r,c): start row = r - i.
        const dScore = fitScore(cellMap, word, r - i, c, 'D');
        if (dScore > 0 && (!best || dScore > best.score)) {
          best = { score: dScore, row: r - i, col: c, dir: 'D' };
        }
      }
    }

    if (best) {
      placements.push(placeOnMap(cellMap, word, best.row, best.col, best.dir));
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

module.exports = { interlock, numberGrid, countComponents };
