/**
 * Word Search — solve().
 *
 * Independently scans the finished grid for each target word in all eight
 * directions. This is the source of truth for the answer key: the engine
 * cross-checks it against the generator's claimed placements so a silently
 * broken puzzle can never reach export.
 */

const ALL_DIRS = [
  [0, 1], [1, 0], [0, -1], [-1, 0], // orthogonal
  [1, 1], [1, -1], [-1, 1], [-1, -1], // diagonal
];

// Find every occurrence of `word` in the grid. Returns an array of matches,
// each with its start, direction, and cell coordinates.
function findWord(grid, word) {
  const n = grid.length;
  const matches = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] !== word[0]) continue;
      for (const [dr, dc] of ALL_DIRS) {
        const endR = r + dr * (word.length - 1);
        const endC = c + dc * (word.length - 1);
        if (endR < 0 || endC < 0 || endR >= n || endC >= n) continue;
        let ok = true;
        const cells = [];
        for (let i = 0; i < word.length; i++) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (grid[rr][cc] !== word[i]) {
            ok = false;
            break;
          }
          cells.push([rr, cc]);
        }
        if (ok) matches.push({ word, row: r, col: c, dr, dc, cells });
      }
    }
  }
  return matches;
}

/**
 * @param {object} puzzle a puzzle whose data has { grid, words }
 * @returns {{ found: object[], missing: string[], ambiguous: string[] }}
 *   found     — one canonical placement per word that was located
 *   missing   — target words not found anywhere in the grid
 *   ambiguous — target words found in more than one location
 */
function solve(puzzle) {
  const { grid, words } = puzzle.data;
  const found = [];
  const missing = [];
  const ambiguous = [];

  for (const word of words) {
    const matches = findWord(grid, word);
    if (matches.length === 0) {
      missing.push(word);
    } else {
      found.push(matches[0]);
      if (matches.length > 1) ambiguous.push(word);
    }
  }

  return { found, missing, ambiguous };
}

module.exports = { solve, findWord, ALL_DIRS };
