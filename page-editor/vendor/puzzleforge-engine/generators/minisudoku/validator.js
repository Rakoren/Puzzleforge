/**
 * Mini Sudoku (6×6) — validate().
 * Golden Standards: the solution obeys row/column/2×3-box rules, the givens
 * match it, and the puzzle has a unique solution.
 */
const { makeSudokuCore } = require('../shared/sudokucore');

const N = 6, BR = 2, BC = 3;
const core = makeSudokuCore({ N, boxR: BR, boxC: BC });

function groupsOk(grid) {
  const full = (vals) => { const s = new Set(vals); return s.size === N && !s.has(0); };
  for (let i = 0; i < N; i++) {
    if (!full(grid[i])) return false;
    if (!full(grid.map((row) => row[i]))) return false;
  }
  for (let br = 0; br < N; br += BR) {
    for (let bc = 0; bc < N; bc += BC) {
      const box = [];
      for (let dr = 0; dr < BR; dr++) for (let dc = 0; dc < BC; dc++) box.push(grid[br + dr][bc + dc]);
      if (!full(box)) return false;
    }
  }
  return true;
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  const givens = puzzle.data.givens;
  const solution = puzzle.solution.grid;

  if (!groupsOk(solution)) errors.push('Solution violates the row/column/box rules.');
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (givens[r][c] !== 0 && givens[r][c] !== solution[r][c]) {
        errors.push(`Given at ${r},${c} disagrees with the solution.`);
      }
    }
  }
  if (core.countSolutions(givens, 2) !== 1) errors.push('Puzzle does not have a unique solution.');

  return { valid: errors.length === 0, errors, warnings, score: errors.length === 0 ? 1 : 0 };
}

module.exports = { validate };
