/**
 * X-Sudoku (Diagonal Sudoku) — solver.
 *
 * Standard 9×9 sudoku plus the extra rule that each of the two main diagonals
 * must also contain 1–9. Same constraint-propagating backtracking as sudoku,
 * with the diagonal constraint added to the candidate check — so it verifies
 * puzzles and counts solutions for the uniqueness guarantee.
 */
const N = 9;
const BOX = 3;

const onMain = (r, c) => r === c;
const onAnti = (r, c) => r + c === N - 1;

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

// Candidates 1-9 that may legally go in (r,c): row, column, box, and — when the
// cell sits on a main diagonal — that diagonal too.
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
  if (onMain(r, c)) for (let i = 0; i < N; i++) used.add(grid[i][i]);
  if (onAnti(r, c)) for (let i = 0; i < N; i++) used.add(grid[i][N - 1 - i]);
  const out = [];
  for (let v = 1; v <= N; v++) if (!used.has(v)) out.push(v);
  return out;
}

// Empty cell with the fewest candidates (MRV heuristic).
function selectCell(grid) {
  let best = null;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] !== 0) continue;
      const cands = candidates(grid, r, c);
      if (cands.length === 0) return { r, c, cands };
      if (!best || cands.length < best.cands.length) {
        best = { r, c, cands };
        if (cands.length === 1) return best;
      }
    }
  }
  return best;
}

function countSolutions(grid, cap = 2) {
  const work = cloneGrid(grid);
  let count = 0;
  function recurse() {
    if (count >= cap) return;
    const cell = selectCell(work);
    if (cell === null) { count++; return; }
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

function solve(puzzle) {
  const givens = puzzle.data.givens;
  const solution = solveGrid(givens);
  const solutionCount = countSolutions(givens, 2);
  return { solution, solutionCount, unique: solutionCount === 1, solvable: solution !== null };
}

module.exports = { solve, solveGrid, countSolutions, candidates, cloneGrid, onMain, onAnti, N, BOX };
