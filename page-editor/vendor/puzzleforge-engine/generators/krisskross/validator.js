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
const { countComponents, touchViolations } = require('../shared/interlock');

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

  // Separation: never allow words to run alongside each other; on easy/medium
  // (strict layouts) forbid diagonal corner-touches too.
  const placements = puzzle.solution.placements;
  if (placements) {
    const orthoTouches = touchViolations(grid, placements, false);
    if (orthoTouches > 0) {
      errors.push(`${orthoTouches} place(s) where words run alongside each other.`);
    }
    if ((puzzle.difficulty || 1) <= 2) {
      const diagTouches = touchViolations(grid, placements, true) - orthoTouches;
      if (diagTouches > 0) {
        errors.push(`${diagTouches} corner-touch(es) between words (not allowed at this difficulty).`);
      }
    }
  }

  if (droppedCount > 0) {
    warnings.push(`${droppedCount} word(s) could not be interlocked.`);
    score -= Math.min(0.2, droppedCount * 0.03);
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
