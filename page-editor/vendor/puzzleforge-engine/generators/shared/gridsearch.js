/**
 * Shared grid-search core.
 *
 * Token-agnostic machinery for "find the hidden token" grids — used by both
 * Word Search (letters) and Number Search (digits). Tokens are plain strings;
 * the fill alphabet is supplied by the caller. Placement supports the same
 * difficulty-based separation model as word search:
 *   dense    — tokens may cross on matching characters
 *   noCross  — no shared cells, but tokens may sit next to each other
 *   isolated — no shared cells AND a one-cell buffer (tokens never touch)
 */

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

const ALL_DIRS = [
  [0, 1], [1, 0], [0, -1], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const NEIGHBORS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

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

// Can `token` be laid from (r,c) along (dr,dc) under the separation rule?
function canPlace(grid, token, r, c, dr, dc, separation = 'dense') {
  const n = grid.length;
  let overlaps = 0;
  const cells = [];
  for (let i = 0; i < token.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    if (rr < 0 || cc < 0 || rr >= n || cc >= n) return false;
    const cell = grid[rr][cc];
    if (cell !== null) {
      if (separation !== 'dense') return false;
      if (cell !== token[i]) return false;
      overlaps++;
    }
    cells.push([rr, cc]);
  }
  if (overlaps === token.length) return false;

  if (separation === 'isolated') {
    for (const [rr, cc] of cells) {
      for (const [nr, nc] of NEIGHBORS) {
        const ar = rr + nr;
        const ac = cc + nc;
        if (ar >= 0 && ac >= 0 && ar < n && ac < n && grid[ar][ac] !== null) return false;
      }
    }
  }
  return true;
}

function place(grid, token, r, c, dr, dc) {
  const cells = [];
  for (let i = 0; i < token.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    grid[rr][cc] = token[i];
    cells.push([rr, cc]);
  }
  return { word: token, row: r, col: c, dr, dc, cells };
}

function autoSize(tokens, separation = 'dense') {
  const longest = tokens.reduce((m, t) => Math.max(m, t.length), 0);
  const totalChars = tokens.reduce((s, t) => s + t.length, 0);
  const areaFactor = separation === 'isolated' ? 3.6 : separation === 'noCross' ? 2.8 : 2.2;
  const byArea = Math.ceil(Math.sqrt(totalChars * areaFactor));
  const longestFloor = separation === 'isolated' ? longest + 2 : longest + 1;
  return Math.max(longestFloor, byArea, 10);
}

/**
 * Place all tokens into a fresh grid. Throws a retryable error if any token
 * cannot be placed. Does not fill empty cells — the caller fills them with the
 * appropriate alphabet.
 * @returns {{ grid, placements, directionsUsed: Set<string> }}
 */
function placeTokens(tokens, { size, directions, separation = 'dense', rand = Math.random }) {
  const grid = makeGrid(size);
  const placements = [];
  const directionsUsed = new Set();
  const ordered = [...tokens].sort((a, b) => b.length - a.length);

  for (const token of ordered) {
    let placed = false;
    const positions = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) positions.push([r, c]);
    }
    shuffle(positions, rand);

    outer: for (const [r, c] of positions) {
      const dirs = shuffle(directions.map((d) => d.slice()), rand);
      for (const [dr, dc] of dirs) {
        if (canPlace(grid, token, r, c, dr, dc, separation)) {
          placements.push(place(grid, token, r, c, dr, dc));
          directionsUsed.add(`${dr},${dc}`);
          placed = true;
          break outer;
        }
      }
    }
    if (!placed) {
      const err = new Error(`gridsearch: could not place "${token}" in ${size}x${size} grid`);
      err.retryable = true;
      throw err;
    }
  }
  return { grid, placements, directionsUsed };
}

function fillGrid(grid, alphabet, rand = Math.random) {
  const n = grid.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === null) grid[r][c] = alphabet[Math.floor(rand() * alphabet.length)];
    }
  }
  return grid;
}

// Every maximal straight line of the grid as a list of [r,c] cell coordinates
// (rows, columns, and both diagonal families) — the geometry the offensive
// scan and the safe-fill repair both walk.
function lineCells(n) {
  const lines = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push([r, c]);
    lines.push(row);
  }
  for (let c = 0; c < n; c++) {
    const col = [];
    for (let r = 0; r < n; r++) col.push([r, c]);
    lines.push(col);
  }
  for (let k = 0; k < 2 * n - 1; k++) {
    const d1 = [];
    const d2 = [];
    for (let r = 0; r < n; r++) {
      const c1 = k - r;
      if (c1 >= 0 && c1 < n) d1.push([r, c1]);
      const c2 = r - (k - (n - 1));
      if (c2 >= 0 && c2 < n) d2.push([r, c2]);
    }
    if (d1.length > 1) lines.push(d1);
    if (d2.length > 1) lines.push(d2);
  }
  return lines;
}

/**
 * Fill empty cells, then repair any banned substring a random fill happened to
 * spell — in any direction, forwards or backwards — by re-rolling a fill cell
 * inside the offending span. Word cells are never touched, so the puzzle's
 * answers are preserved. This makes a clean grid the norm instead of relying on
 * the validator to reject unlucky ones (random letters spell short slurs like
 * "ass"/"sex" surprisingly often).
 *
 * @param {string[][]} grid          grid with words already placed (nulls empty)
 * @param {string} alphabet          fill alphabet
 * @param {object} opts
 * @param {string[]} opts.terms      lowercase banned terms to avoid
 * @param {boolean[][]} [opts.protectedMask] true where a word letter sits
 * @param {function} [opts.rand]
 * @param {number} [opts.maxPasses=20]
 */
function fillGridSafe(grid, alphabet, opts = {}) {
  const n = grid.length;
  const rand = opts.rand || Math.random;
  const terms = (opts.terms || []).filter((t) => t && t.length >= 3).map((t) => t.toLowerCase());
  const mask = opts.protectedMask;
  const maxPasses = opts.maxPasses || 20;

  fillGrid(grid, alphabet, rand);
  if (!terms.length) return grid;

  const lines = lineCells(n);
  const isProtected = (r, c) => Boolean(mask && mask[r] && mask[r][c]);

  for (let pass = 0; pass < maxPasses; pass++) {
    let dirty = false;
    for (const cells of lines) {
      // Check the line in both reading directions.
      for (const seq of [cells, cells.slice().reverse()]) {
        let str = '';
        for (const [r, c] of seq) str += String(grid[r][c]).toLowerCase();
        for (const term of terms) {
          let idx = str.indexOf(term);
          while (idx !== -1) {
            // Re-roll a non-word cell inside the matched span to break it.
            const span = seq.slice(idx, idx + term.length);
            const editable = span.filter(([r, c]) => !isProtected(r, c));
            if (editable.length) {
              const [r, c] = editable[Math.floor(rand() * editable.length)];
              const cur = grid[r][c];
              let next = cur;
              for (let tries = 0; tries < 8 && next === cur; tries++) {
                next = alphabet[Math.floor(rand() * alphabet.length)];
              }
              grid[r][c] = next;
              dirty = true;
            }
            // Recompute this line's string after a possible edit before scanning on.
            str = '';
            for (const [r2, c2] of seq) str += String(grid[r2][c2]).toLowerCase();
            idx = str.indexOf(term, idx);
            if (idx !== -1 && span.every(([r, c]) => isProtected(r, c))) idx = str.indexOf(term, idx + 1);
          }
        }
      }
    }
    if (!dirty) break;
  }
  return grid;
}

// True if every cell of `span` belongs to one and the same placement — i.e. the
// substring is part of a single legitimately-placed word (e.g. "coon" inside
// RACCOON), not an accidental formation in the fill.
function spanWithinOnePlacement(span, placements) {
  for (const p of placements || []) {
    const set = new Set((p.cells || []).map(([r, c]) => `${r},${c}`));
    if (span.every(([r, c]) => set.has(`${r},${c}`))) return true;
  }
  return false;
}

/**
 * Coordinate-aware offensive scan. Walks every line in both directions and
 * reports banned terms — but ignores any occurrence that lies wholly inside a
 * single placed word, since curated target words (RACCOON, PEACOCK, BASS …) are
 * legitimate even when they embed a short banned substring.
 * @returns {string[]} offending terms (deduplicated)
 */
function scanGridOffensive(grid, { terms, placements = [] } = {}) {
  const n = grid.length;
  const tl = (terms || []).filter((t) => t && t.length >= 3).map((t) => t.toLowerCase());
  const hits = new Set();
  for (const cells of lineCells(n)) {
    for (const seq of [cells, cells.slice().reverse()]) {
      let str = '';
      for (const [r, c] of seq) str += String(grid[r][c]).toLowerCase();
      for (const term of tl) {
        let idx = str.indexOf(term);
        while (idx !== -1) {
          const span = seq.slice(idx, idx + term.length);
          if (!spanWithinOnePlacement(span, placements)) hits.add(term);
          idx = str.indexOf(term, idx + 1);
        }
      }
    }
  }
  return [...hits];
}

// Build a protected-cell mask (true where a placed token sits) from placements.
function protectedMask(n, placements) {
  const mask = Array.from({ length: n }, () => Array.from({ length: n }, () => false));
  for (const p of placements || []) {
    for (const [r, c] of p.cells || []) {
      if (r >= 0 && c >= 0 && r < n && c < n) mask[r][c] = true;
    }
  }
  return mask;
}

// All occurrences of `token` in the grid (8 directions).
function findToken(grid, token) {
  const n = grid.length;
  const matches = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] !== token[0]) continue;
      for (const [dr, dc] of ALL_DIRS) {
        const endR = r + dr * (token.length - 1);
        const endC = c + dc * (token.length - 1);
        if (endR < 0 || endC < 0 || endR >= n || endC >= n) continue;
        let ok = true;
        const cells = [];
        for (let i = 0; i < token.length; i++) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (grid[rr][cc] !== token[i]) {
            ok = false;
            break;
          }
          cells.push([rr, cc]);
        }
        if (ok) matches.push({ word: token, row: r, col: c, dr, dc, cells });
      }
    }
  }
  return matches;
}

// Independently locate each token. Returns canonical placements plus the lists
// of missing and ambiguous (multiply-found) tokens.
function solveTokens(grid, tokens) {
  const found = [];
  const missing = [];
  const ambiguous = [];
  for (const token of tokens) {
    const matches = findToken(grid, token);
    if (matches.length === 0) missing.push(token);
    else {
      found.push(matches[0]);
      if (matches.length > 1) ambiguous.push(token);
    }
  }
  return { found, missing, ambiguous };
}

// Every maximal line of the grid as a string, both orientations.
function gridLines(grid) {
  const n = grid.length;
  const lines = [];
  for (let r = 0; r < n; r++) lines.push(grid[r].join(''));
  for (let c = 0; c < n; c++) {
    let s = '';
    for (let r = 0; r < n; r++) s += grid[r][c];
    lines.push(s);
  }
  for (let k = 0; k < 2 * n - 1; k++) {
    let d1 = '';
    let d2 = '';
    for (let r = 0; r < n; r++) {
      const c1 = k - r;
      if (c1 >= 0 && c1 < n) d1 += grid[r][c1];
      const c2 = r - (k - (n - 1));
      if (c2 >= 0 && c2 < n) d2 += grid[r][c2];
    }
    if (d1) lines.push(d1);
    if (d2) lines.push(d2);
  }
  return lines.concat(lines.map((l) => l.split('').reverse().join('')));
}

// Inspect placements for separation violations (shared cells / touching).
function checkSeparation(placements, separation) {
  const owner = new Map();
  let shared = 0;
  placements.forEach((p, idx) => {
    for (const [r, c] of p.cells) {
      const k = `${r},${c}`;
      if (owner.has(k) && owner.get(k) !== idx) shared++;
      else owner.set(k, idx);
    }
  });

  let touching = 0;
  if (separation === 'isolated') {
    const pairs = new Set();
    placements.forEach((p, idx) => {
      for (const [r, c] of p.cells) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const k = `${r + dr},${c + dc}`;
            if (owner.has(k) && owner.get(k) !== idx) {
              const a = Math.min(idx, owner.get(k));
              const b = Math.max(idx, owner.get(k));
              pairs.add(`${a}|${b}`);
            }
          }
        }
      }
    });
    touching = pairs.size;
  }
  return { shared, touching };
}

module.exports = {
  FORWARD,
  ALL_DIRS,
  resolveDirections,
  shuffle,
  makeGrid,
  canPlace,
  place,
  autoSize,
  placeTokens,
  fillGrid,
  fillGridSafe,
  protectedMask,
  lineCells,
  scanGridOffensive,
  findToken,
  solveTokens,
  gridLines,
  checkSeparation,
};
