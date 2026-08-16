/**
 * Mini Sudoku (6×6) — solve(). Independently solves the givens and reports
 * uniqueness (source of truth for the answer key).
 */
const { makeSudokuCore } = require('../shared/sudokucore');

const core = makeSudokuCore({ N: 6, boxR: 2, boxC: 3 });

function solve(puzzle) {
  const givens = puzzle.data.givens;
  const solution = core.solveGrid(givens);
  const solutionCount = core.countSolutions(givens, 2);
  return { solution, solutionCount, unique: solutionCount === 1, solvable: solution !== null };
}

module.exports = { solve, core };
