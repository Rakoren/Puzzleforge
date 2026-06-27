/**
 * Kriss-Kross — validate().
 *
 * Golden Standards:
 *   - single connected component
 *   - no duplicate words in the bank
 *   - no isolated single-letter fills
 *   - the grid reads back every placed word (verified by solver)
 *   - (soft) words that could not be interlocked are dropped from the bank
 */
const { solve } = require('./solver');
const { countComponents } = require('../shared/interlock');

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { width, height, droppedCount } = puzzle.data;
  const grid = puzzle.solution.grid;

  const components = countComponents(grid);
  if (components !== 1) {
    errors.push(`Grid has ${components} disconnected sections; must be a single component.`);
  }

  const words = puzzle.solution.words;
  const seen = new Set();
  for (const w of words) {
    if (seen.has(w)) errors.push(`Duplicate word "${w}".`);
    seen.add(w);
  }

  let isolated = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] == null) continue;
      const up = r > 0 && grid[r - 1][c] != null;
      const dn = r + 1 < height && grid[r + 1][c] != null;
      const lf = c > 0 && grid[r][c - 1] != null;
      const rt = c + 1 < width && grid[r][c + 1] != null;
      if (!up && !dn && !lf && !rt) isolated++;
    }
  }
  if (isolated > 0) errors.push(`${isolated} isolated single-letter fill(s).`);

  const { mismatches } = solve(puzzle);
  if (mismatches.length) errors.push(`Grid does not match words: ${mismatches.join(', ')}.`);

  if (droppedCount > 0) {
    warnings.push(`${droppedCount} word(s) could not be interlocked.`);
    score -= Math.min(0.2, droppedCount * 0.03);
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
