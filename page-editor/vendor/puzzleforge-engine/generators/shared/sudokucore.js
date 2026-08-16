/**
 * Shared sudoku engine, parameterized so every variant reuses one verified
 * constraint-propagating backtracker.
 *
 * A core is defined by the grid size N, its box dimensions (boxR × boxC), and an
 * optional `extraUsed(grid, r, c, used)` hook that adds variant-specific
 * forbidden values (diagonals, parity, cages, …) to the candidate set. From that
 * it derives candidate generation, a full-solution builder, a solution counter
 * (for the uniqueness guarantee), a solver, and a symmetric clue-digger.
 *
 * @param {object} spec { N, boxR, boxC, extraUsed? }
 */
function makeSudokuCore(spec) {
  const { N, boxR, boxC } = spec;
  const extraUsed = spec.extraUsed || null;

  const cloneGrid = (grid) => grid.map((row) => row.slice());

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Values 1..N that may legally go in (r,c): row, column, box, plus any
  // variant-specific constraint.
  function candidates(grid, r, c) {
    const used = new Set();
    for (let i = 0; i < N; i++) { used.add(grid[r][i]); used.add(grid[i][c]); }
    const br = Math.floor(r / boxR) * boxR;
    const bc = Math.floor(c / boxC) * boxC;
    for (let dr = 0; dr < boxR; dr++) for (let dc = 0; dc < boxC; dc++) used.add(grid[br + dr][bc + dc]);
    if (extraUsed) extraUsed(grid, r, c, used);
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

  function buildSolution(rand) {
    const grid = Array.from({ length: N }, () => Array(N).fill(0));
    function fill() {
      const cell = selectCell(grid);
      if (cell === null) return true;
      if (cell.cands.length === 0) return false;
      for (const v of shuffle(cell.cands.slice(), rand)) {
        grid[cell.r][cell.c] = v;
        if (fill()) return true;
        grid[cell.r][cell.c] = 0;
      }
      return false;
    }
    return fill() ? grid : null;
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

  // Remove clues (in 180° symmetric pairs by default) toward `target` givens
  // while keeping the solution unique. Returns the puzzle grid (0 = blank).
  function digGivens(solution, target, rand, opts = {}) {
    const symmetric = opts.symmetric !== false;
    const givens = cloneGrid(solution);
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push([r, c]);
    shuffle(cells, rand);
    let filled = N * N;
    for (const [r, c] of cells) {
      if (filled <= target) break;
      if (givens[r][c] === 0) continue;
      const pr = N - 1 - r, pc = N - 1 - c;
      const pair = symmetric && !(pr === r && pc === c) ? [[r, c], [pr, pc]] : [[r, c]];
      if (pair.some(([rr, cc]) => givens[rr][cc] === 0)) continue;
      const saved = pair.map(([rr, cc]) => givens[rr][cc]);
      pair.forEach(([rr, cc]) => { givens[rr][cc] = 0; });
      if (countSolutions(givens, 2) === 1) filled -= pair.length;
      else pair.forEach(([rr, cc], i) => { givens[rr][cc] = saved[i]; });
    }
    return { givens, givenCount: filled };
  }

  return { N, boxR, boxC, cloneGrid, candidates, buildSolution, countSolutions, solveGrid, digGivens };
}

module.exports = { makeSudokuCore };
