/**
 * Kriss-Kross — solve().
 *
 * Returns the solution grid and word list, verifying each placed word reads
 * correctly off the grid along its recorded cells.
 */
function solve(puzzle) {
  const grid = puzzle.solution.grid;
  const placements = puzzle.solution.placements || [];
  const mismatches = [];
  for (const p of placements) {
    const read = p.cells.map(([r, c]) => grid[r][c]).join('');
    if (read !== p.word) mismatches.push(`${p.word}≠${read}`);
  }
  return { grid, words: puzzle.solution.words, mismatches };
}

module.exports = { solve };
