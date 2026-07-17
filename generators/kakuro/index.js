/**
 * Kakuro (cross sums) — generate().
 *
 * Generating a UNIQUE-solution Kakuro is the hard part: there are no clues to
 * remove (every sum is always shown), so uniqueness has to fall out of the grid
 * shape and the chosen digits. Two design choices make it reliable:
 *
 *  1. Layout by 2×2-block aggregation. The white region is a union of
 *     overlapping 2×2 blocks, so every white cell always has a horizontal AND a
 *     vertical white neighbour (i.e. it belongs to an across run and a down run
 *     of length ≥ 2) — the layout is valid by construction, and the overlaps
 *     lengthen runs enough to break the permutation symmetry that makes plain
 *     rectangular blocks non-unique.
 *  2. Fill, read off the sums, then keep only fills whose clues force a single
 *     solution (checked by the shared bounded solver). Layouts and fills are
 *     retried within a budget; a smaller reliable config and finally a tiny
 *     hand-safe board act as fallbacks so generate() always returns.
 *
 * Empirically the presets below generate in well under a second (p95).
 */
const { presetFor } = require('../../config/defaults');
const { acrossEntries, downEntries, countSolutions } = require('./core');

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const clue = () => ({ t: 'clue', right: null, down: null });

// Union of `blocks` random 2×2 all-white blocks over the interior (row 0 / col 0
// stay clue border). Valid by construction — every white cell is in a 2×2 block.
function blockLayout(rows, cols, blocks, rand) {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, clue));
  const tops = [];
  for (let r = 1; r <= rows - 2; r++) for (let c = 1; c <= cols - 2; c++) tops.push([r, c]);
  shuffle(tops, rand);
  const n = Math.min(blocks, tops.length);
  for (let i = 0; i < n; i++) {
    const [r, c] = tops[i];
    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) grid[r + dr][c + dc] = { t: 'fill' };
  }
  return grid;
}

function fillCount(grid, rows, cols) {
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c].t === 'fill') n++;
  return n;
}

// Assign digits so every across/down entry holds distinct digits (no sum target).
function randomFill(grid, rows, cols, rand) {
  const key = (r, c) => r * cols + c;
  const peers = new Map();
  const cells = new Set();
  const link = (entries) => {
    for (const e of entries) {
      for (const [r, c] of e.cells) {
        const k = key(r, c);
        cells.add(k);
        if (!peers.has(k)) peers.set(k, new Set());
      }
      for (const [r1, c1] of e.cells) for (const [r2, c2] of e.cells) {
        if (r1 === r2 && c1 === c2) continue;
        peers.get(key(r1, c1)).add(key(r2, c2));
      }
    }
  };
  link(acrossEntries(grid, rows, cols));
  link(downEntries(grid, rows, cols));

  const order = [...cells];
  const val = new Map();
  order.forEach((k) => val.set(k, 0));

  const candidates = (k) => {
    const used = new Set();
    for (const p of peers.get(k)) if (val.get(p)) used.add(val.get(p));
    const out = [];
    for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v);
    return shuffle(out, rand);
  };
  const select = () => {
    let best = null;
    for (const k of order) {
      if (val.get(k)) continue;
      const cs = candidates(k);
      if (cs.length === 0) return { k, cs };
      if (!best || cs.length < best.cs.length) { best = { k, cs }; if (cs.length === 1) return best; }
    }
    return best;
  };
  const recurse = () => {
    const cell = select();
    if (cell === null) return true;
    if (cell.cs.length === 0) return false;
    for (const v of cell.cs) {
      val.set(cell.k, v);
      if (recurse()) return true;
      val.set(cell.k, 0);
    }
    return false;
  };
  if (!recurse()) return null;

  const sol = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const k of order) sol[Math.floor(k / cols)][k % cols] = val.get(k);
  return sol;
}

// Write each entry's summed value onto the clue cell that precedes it.
function applyClues(grid, sol, rows, cols) {
  for (const e of acrossEntries(grid, rows, cols)) {
    const [cr, cc] = e.clue;
    grid[cr][cc].right = e.cells.reduce((s, [r, c]) => s + sol[r][c], 0);
  }
  for (const e of downEntries(grid, rows, cols)) {
    const [cr, cc] = e.clue;
    grid[cr][cc].down = e.cells.reduce((s, [r, c]) => s + sol[r][c], 0);
  }
}

// Search a single (rows,cols,blocks) config for a unique-solution board.
function search(rows, cols, blocks, rand, layoutTries, fillsPer, fillBudget) {
  const minFill = Math.round((rows - 1) * (cols - 1) * 0.35);
  let fillsUsed = 0;
  for (let lt = 0; lt < layoutTries && fillsUsed < fillBudget; lt++) {
    const layout = blockLayout(rows, cols, blocks, rand);
    if (fillCount(layout, rows, cols) < minFill) continue;
    for (let ft = 0; ft < fillsPer && fillsUsed < fillBudget; ft++) {
      fillsUsed++;
      const sol = randomFill(layout, rows, cols, rand);
      if (!sol) break; // this layout can't be filled distinctly — new layout
      const candidate = layout.map((row) => row.map((cell) => ({ ...cell })));
      applyClues(candidate, sol, rows, cols);
      if (countSolutions(candidate, rows, cols, 2) === 1) return { grid: candidate, sol };
    }
  }
  return null;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('kakuro', difficulty, config.audience) || { rows: 6, cols: 6, blocks: 3 };
  const rows = config.rows || preset.rows;
  const cols = config.cols || preset.cols;
  const blocks = preset.blocks;

  let found = search(rows, cols, blocks, rand, 50, 150, 3000);
  // Fallback to a smaller, near-always-solvable config, then a tiny safe board.
  if (!found) found = search(5, 5, 2, rand, 40, 120, 1200);
  if (!found) return tinyFallback(config, difficulty);

  const usedRows = found.grid.length;
  const usedCols = found.grid[0].length;
  return {
    type: 'kakuro',
    difficulty,
    theme: null,
    title: config.title || 'Kakuro',
    instructions: config.instructions ||
      'Fill the white cells with 1–9 so each run adds up to the clue above it (down) or to its left (across). A digit never repeats within a run.',
    data: { rows: usedRows, cols: usedCols, grid: found.grid },
    solution: { grid: found.sol },
  };
}

// Deterministic 4-cell safety net — used only if the search ever fails.
function tinyFallback(config, difficulty) {
  const B = () => ({ t: 'clue', right: null, down: null });
  const F = () => ({ t: 'fill' });
  const grid = [
    [B(), B(), B()],
    [B(), F(), F()],
    [B(), F(), F()],
  ];
  const sol = [
    [0, 0, 0],
    [0, 1, 2],
    [0, 3, 4],
  ];
  applyClues(grid, sol, 3, 3);
  return {
    type: 'kakuro', difficulty, theme: null,
    title: config.title || 'Kakuro',
    instructions: 'Fill the white cells with 1–9 so each run adds up to the clue. A digit never repeats within a run.',
    data: { rows: 3, cols: 3, grid },
    solution: { grid: sol },
  };
}

module.exports = { generate };
