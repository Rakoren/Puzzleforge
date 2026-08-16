/**
 * Sudoku — solve().
 *
 * A constraint-propagating backtracking solver used both to verify puzzles
 * and to count solutions (for the uniqueness guarantee). Grids are 9x9 arrays
 * of integers 0-9, where 0 is an empty cell.
 */
const N = 9;
const BOX = 3;

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

// Candidates 1-9 that may legally go in (r,c).
function candidates(grid, r, c) {
  const used = new Set();
  for (let i = 0; i < N; i++) {
    used.add(grid[r][i]);
    used.add(grid[i][c]);
  }
  const br = Math.floor(r / BOX) * BOX;
  const bc = Math.floor(c / BOX) * BOX;
  for (let dr = 0; dr < BOX; dr++) {
    for (let dc = 0; dc < BOX; dc++) used.add(grid[br + dr][bc + dc]);
  }
  const out = [];
  for (let v = 1; v <= N; v++) if (!used.has(v)) out.push(v);
  return out;
}

// Find the empty cell with the fewest candidates (MRV heuristic). Returns
// { r, c, cands } or null if the grid is full.
function selectCell(grid) {
  let best = null;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] !== 0) continue;
      const cands = candidates(grid, r, c);
      if (cands.length === 0) return { r, c, cands }; // dead end
      if (!best || cands.length < best.cands.length) {
        best = { r, c, cands };
        if (cands.length === 1) return best;
      }
    }
  }
  return best;
}

/**
 * Count solutions up to `cap` (default 2 — enough to test uniqueness).
 * @returns {number}
 */
function countSolutions(grid, cap = 2) {
  const work = cloneGrid(grid);
  let count = 0;

  function recurse() {
    if (count >= cap) return;
    const cell = selectCell(work);
    if (cell === null) {
      count++;
      return;
    }
    if (cell.cands.length === 0) return;
    for (const v of cell.cands) {
      work[cell.r][cell.c] = v;
      recurse();
      work[cell.r][cell.c] = 0;
      if (count >= cap) return;
    }
  }

  recurse();
  return count;
}

/**
 * Solve a grid, returning the first complete solution found, or null if
 * unsolvable. Does not mutate the input.
 * @returns {number[][]|null}
 */
function solveGrid(grid) {
  const work = cloneGrid(grid);

  function recurse() {
    const cell = selectCell(work);
    if (cell === null) return true;
    if (cell.cands.length === 0) return false;
    for (const v of cell.cands) {
      work[cell.r][cell.c] = v;
      if (recurse()) return true;
      work[cell.r][cell.c] = 0;
    }
    return false;
  }

  return recurse() ? work : null;
}

/**
 * Module solve(): independently solves the puzzle's given grid and reports
 * uniqueness. Source of truth for the answer key.
 * @param {object} puzzle with data.givens (9x9, 0 = blank)
 */
function solve(puzzle) {
  const givens = puzzle.data.givens;
  const solution = solveGrid(givens);
  const solutionCount = countSolutions(givens, 2);
  return {
    solution,
    solutionCount,
    unique: solutionCount === 1,
    solvable: solution !== null,
  };
}

module.exports = {
  solve,
  solveGrid,
  countSolutions,
  candidates,
  cloneGrid,
  N,
  BOX,
};
