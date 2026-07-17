/**
 * Kakuro — solve(). Independently solves the clued grid and reports uniqueness
 * (the source of truth for the answer key).
 */
const { solveGrid, countSolutions } = require('./core');

function solve(puzzle) {
  const { rows, cols, grid } = puzzle.data;
  const solution = solveGrid(grid, rows, cols);
  const solutionCount = countSolutions(grid, rows, cols, 2);
  return {
    solution,
    solutionCount,
    unique: solutionCount === 1,
    solvable: solution !== null,
  };
}

module.exports = { solve };
