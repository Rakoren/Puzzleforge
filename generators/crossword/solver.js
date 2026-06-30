/**
 * Crossword — solve().
 *
 * Verifies the solution grid is internally consistent with the placements and
 * returns the answer key. Confirms each across/down answer reads correctly off
 * the solution grid.
 */
function readWord(grid, number, numbers, dir, width, height) {
  // Find the start cell for this number.
  let sr = -1;
  let sc = -1;
  for (let r = 0; r < height && sr < 0; r++) {
    for (let c = 0; c < width; c++) {
      if (numbers[r][c] === number) {
        sr = r;
        sc = c;
        break;
      }
    }
  }
  if (sr < 0) return null;
  const dr = dir === 'D' ? 1 : 0;
  const dc = dir === 'A' ? 1 : 0;
  let word = '';
  let r = sr;
  let c = sc;
  while (r >= 0 && c >= 0 && r < height && c < width && grid[r][c] != null) {
    word += grid[r][c];
    r += dr;
    c += dc;
  }
  return word;
}

function solve(puzzle) {
  const { grid, across, down } = puzzle.solution;
  const { numbers, width, height } = puzzle.data;
  const mismatches = [];

  for (const { number, answer } of across) {
    const read = readWord(grid, number, numbers, 'A', width, height);
    if (read !== answer) mismatches.push(`A${number}:${answer}≠${read}`);
  }
  for (const { number, answer } of down) {
    const read = readWord(grid, number, numbers, 'D', width, height);
    if (read !== answer) mismatches.push(`D${number}:${answer}≠${read}`);
  }

  return {
    grid,
    across,
    down,
    mismatches,
  };
}

module.exports = { solve, readWord };
