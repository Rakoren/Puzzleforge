/**
 * Trivia — solve().
 *
 * Returns the answer key. (Trivia answers are authored, not derived, so the
 * "solver" simply surfaces them for verification and the answer page.)
 */
function solve(puzzle) {
  return { answers: puzzle.solution.answers };
}

module.exports = { solve };
