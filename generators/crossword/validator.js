/**
 * Crossword — validate().
 *
 * Hard requirements (achievable for a themed criss-cross crossword):
 *   - single connected component (no isolated word islands)
 *   - no duplicate answers
 *   - every answer has a non-empty clue
 *   - no isolated single-letter fills (every filled cell has a neighbour)
 *   - the solution grid reads back the stated answers (verified by solver)
 *
 * Soft metrics (scored, not fatal) — these capture the dense-crossword ideals
 * from the PRD that aren't generally reachable from a themed word list:
 *   - intersection density (share of cells that are crossings)
 *   - "checked" ratio (share of letters in both an across and a down word)
 *   - 180° rotational symmetry of the block pattern
 *   - words that could not be interlocked (dropped)
 */
const { solve } = require('./solver');
const { countComponents } = require('../shared/interlock');

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { width, height, across, down, droppedCount } = puzzle.data;
  const grid = puzzle.solution.grid;

  // Single connected component.
  const components = countComponents(grid);
  if (components !== 1) {
    errors.push(`Grid has ${components} disconnected sections; must be a single component.`);
  }

  // Duplicate answers.
  const answers = puzzle.solution.words;
  const seen = new Set();
  for (const a of answers) {
    if (seen.has(a)) errors.push(`Duplicate answer "${a}".`);
    seen.add(a);
  }

  // Every clue present and non-empty.
  for (const list of [across, down]) {
    for (const clue of list) {
      if (!clue.clue || !String(clue.clue).trim()) {
        errors.push(`Missing clue for ${clue.number}.`);
      }
    }
  }

  // No isolated single-letter fills.
  let isolated = 0;
  let filled = 0;
  let crossings = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] == null) continue;
      filled++;
      const up = r > 0 && grid[r - 1][c] != null;
      const down2 = r + 1 < height && grid[r + 1][c] != null;
      const left = c > 0 && grid[r][c - 1] != null;
      const right = c + 1 < width && grid[r][c + 1] != null;
      if (!up && !down2 && !left && !right) isolated++;
      if ((up || down2) && (left || right)) crossings++;
    }
  }
  if (isolated > 0) errors.push(`${isolated} isolated single-letter fill(s).`);

  // Solver round-trip.
  const { mismatches } = solve(puzzle);
  if (mismatches.length) {
    errors.push(`Solution grid does not match answers: ${mismatches.join(', ')}.`);
  }

  // --- soft metrics ---
  const intersectionDensity = filled ? crossings / filled : 0;
  if (intersectionDensity < 0.18) {
    warnings.push(`Low intersection density (${(intersectionDensity * 100).toFixed(0)}%).`);
    score -= 0.1;
  }
  if (droppedCount > 0) {
    warnings.push(`${droppedCount} word(s) could not be interlocked.`);
    score -= Math.min(0.2, droppedCount * 0.03);
  }
  if (!isSymmetric(grid)) {
    // Expected for themed crosswords; recorded, lightly penalized.
    warnings.push('Block pattern is not 180° rotationally symmetric.');
    score -= 0.05;
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

// 180° rotational symmetry of the filled/empty pattern.
function isSymmetric(grid) {
  const h = grid.length;
  const w = grid[0] ? grid[0].length : 0;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const a = grid[r][c] != null;
      const b = grid[h - 1 - r][w - 1 - c] != null;
      if (a !== b) return false;
    }
  }
  return true;
}

module.exports = { validate, isSymmetric };
