/**
 * Nonogram — validate().
 *
 * Golden Standards:
 *   - the clues are consistent with the solution grid
 *   - exactly one solution (verified by the solver, not trusted)
 *   - the picture is non-trivial (not entirely empty or entirely filled)
 */
const { solve, clueOf } = require('./solver');

function cluesEqual(a, b) {
  const x = a[0] === 0 ? [] : a;
  const y = b[0] === 0 ? [] : b;
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { rowClues, colClues, width, height } = puzzle.data;
  const grid = puzzle.solution.grid;

  // Clues must describe the solution.
  for (let r = 0; r < height; r++) {
    if (!cluesEqual(clueOf(grid[r]), rowClues[r])) {
      errors.push(`Row ${r + 1} clue does not match the solution.`);
    }
  }
  for (let c = 0; c < width; c++) {
    const col = [];
    for (let r = 0; r < height; r++) col.push(grid[r][c]);
    if (!cluesEqual(clueOf(col), colClues[c])) {
      errors.push(`Column ${c + 1} clue does not match the solution.`);
    }
  }

  // Uniqueness (only worth checking if clues are consistent).
  if (errors.length === 0) {
    const { unique, solutionCount } = solve(puzzle);
    if (solutionCount === 0) errors.push('Puzzle has no solution.');
    else if (!unique) errors.push(`Puzzle does not have a unique solution (${solutionCount}+).`);
  }

  // Non-trivial picture.
  let filled = 0;
  for (const row of grid) for (const v of row) if (v) filled++;
  const ratio = filled / (width * height);
  if (ratio === 0 || ratio === 1) {
    errors.push('Picture is entirely empty or entirely filled.');
  } else if (ratio < 0.15 || ratio > 0.85) {
    warnings.push('Picture is very sparse or very dense.');
    score -= 0.1;
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
