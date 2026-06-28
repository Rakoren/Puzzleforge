/**
 * Word Search — solve().
 *
 * Independently scans the finished grid for each target word in all eight
 * directions (via the shared grid-search core). This is the source of truth
 * for the answer key: the engine cross-checks it against the generator's
 * claimed placements so a silently broken puzzle can never reach export.
 */
const { findToken, solveTokens, ALL_DIRS } = require('../shared/gridsearch');

const findWord = findToken;

/**
 * @param {object} puzzle a puzzle whose data has { grid, words }
 * @returns {{ found: object[], missing: string[], ambiguous: string[] }}
 */
function solve(puzzle) {
  return solveTokens(puzzle.data.grid, puzzle.data.words);
}

module.exports = { solve, findWord, ALL_DIRS };
