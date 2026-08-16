/**
 * X-Sudoku — validate().
 * Golden Standards: the solution obeys row/column/box AND both-diagonal rules,
 * the given grid is consistent with it, and it has a unique solution.
 */
const { countSolutions, N, BOX } = require('./solver');

function groupsOk(grid) {
  const full = (vals) => {
    const s = new Set(vals);
    return s.size === N && !s.has(0);
  };
  for (let i = 0; i < N; i++) {
    if (!full(grid[i])) return false; // row
    if (!full(grid.map((row) => row[i]))) return false; // column
  }
  for (let br = 0; br < N; br += BOX) {
    for (let bc = 0; bc < N; bc += BOX) {
      const box = [];
      for (let dr = 0; dr < BOX; dr++) for (let dc = 0; dc < BOX; dc++) box.push(grid[br + dr][bc + dc]);
      if (!full(box)) return false;
    }
  }
  const main = [], anti = [];
  for (let i = 0; i < N; i++) { main.push(grid[i][i]); anti.push(grid[i][N - 1 - i]); }
  return full(main) && full(anti);
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  const givens = puzzle.data.givens;
  const solution = puzzle.solution.grid;

  if (!groupsOk(solution)) {
    errors.push('Solution violates the row/column/box/diagonal rules.');
  }
  // Givens must match the solution.
  let count = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (givens[r][c] !== 0) {
        count++;
        if (givens[r][c] !== solution[r][c]) errors.push(`Given at ${r},${c} disagrees with the solution.`);
      }
    }
  }
  if (count < 17) warnings.push(`Only ${count} givens — may be very hard.`);
  if (countSolutions(givens, 2) !== 1) errors.push('Puzzle does not have a unique solution.');

  return { valid: errors.length === 0, errors, warnings, score: errors.length === 0 ? 1 : 0 };
}

module.exports = { validate };
