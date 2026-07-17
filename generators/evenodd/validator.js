/**
 * Even-Odd Sudoku — validate().
 * Golden Standards: solution obeys sudoku rules AND the parity of every cell
 * matches its shading, givens match the solution, and the solution is unique
 * under the parity constraint.
 */
const { evenOddCore } = require('./index');
const { shadedSet } = require('./solver');

const N = 9, BOX = 3;

function sudokuOk(grid) {
  const full = (vals) => { const s = new Set(vals); return s.size === N && !s.has(0); };
  for (let i = 0; i < N; i++) {
    if (!full(grid[i])) return false;
    if (!full(grid.map((row) => row[i]))) return false;
  }
  for (let br = 0; br < N; br += BOX) {
    for (let bc = 0; bc < N; bc += BOX) {
      const box = [];
      for (let dr = 0; dr < BOX; dr++) for (let dc = 0; dc < BOX; dc++) box.push(grid[br + dr][bc + dc]);
      if (!full(box)) return false;
    }
  }
  return true;
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  const { givens, shaded } = puzzle.data;
  const solution = puzzle.solution.grid;

  if (!sudokuOk(solution)) errors.push('Solution violates the row/column/box rules.');
  // Parity must match the shading everywhere.
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const even = solution[r][c] % 2 === 0;
      if (even !== !!shaded[r][c]) { errors.push(`Cell ${r},${c} parity does not match its shading.`); }
      if (givens[r][c] !== 0 && givens[r][c] !== solution[r][c]) errors.push(`Given at ${r},${c} disagrees with the solution.`);
    }
  }
  const core = evenOddCore(shadedSet(shaded));
  if (core.countSolutions(givens, 2) !== 1) errors.push('Puzzle does not have a unique solution.');

  return { valid: errors.length === 0, errors, warnings, score: errors.length === 0 ? 1 : 0 };
}

module.exports = { validate };
