/**
 * Even-Odd Sudoku — solve(). Rebuilds the parity-aware core from the puzzle's
 * shading and independently solves the givens, reporting uniqueness.
 */
const { evenOddCore } = require('./index');

function shadedSet(shadedGrid) {
  const s = new Set();
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (shadedGrid[r][c]) s.add(r * 9 + c);
  return s;
}

function solve(puzzle) {
  const core = evenOddCore(shadedSet(puzzle.data.shaded));
  const givens = puzzle.data.givens;
  const solution = core.solveGrid(givens);
  const solutionCount = core.countSolutions(givens, 2);
  return { solution, solutionCount, unique: solutionCount === 1, solvable: solution !== null };
}

module.exports = { solve, shadedSet };
