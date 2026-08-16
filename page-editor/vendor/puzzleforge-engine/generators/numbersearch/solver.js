/**
 * Number Search — solve().
 *
 * Independently locates each target number in the grid via the shared
 * grid-search core.
 */
const { solveTokens } = require('../shared/gridsearch');

function solve(puzzle) {
  return solveTokens(puzzle.data.grid, puzzle.data.numbers);
}

module.exports = { solve };
