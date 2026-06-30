/**
 * Number Search — validate().
 *
 * Golden Standards (mirrors word search, minus the language checks). Unlike
 * letters, a 10-symbol digit grid produces many coincidental short sequences
 * in the random fill, so "appears more than once" is expected and not an error
 * — checks are made against the planted placements, not against every reading.
 *   - every listed number actually appears in the grid (planted)
 *   - no duplicate numbers; no number contained in another
 *   - grid fully filled with digits
 *   - planted placements respect the difficulty's directions and separation
 */
const { findToken, resolveDirections, checkSeparation } = require('../shared/gridsearch');
const { DIFFICULTY } = require('../../config/defaults');

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { grid, numbers, mode, allowBackwards } = puzzle.data;
  const difficulty = puzzle.difficulty || 1;
  const placements = puzzle.solution.placements || [];

  // grid filled with digits
  for (const row of grid) {
    for (const cell of row) {
      if (cell == null || !/[0-9]/.test(cell)) {
        errors.push('Grid is not fully filled with digits.');
        break;
      }
    }
  }

  // duplicates + substring relationship within the list
  const seen = new Set();
  for (const n of numbers) {
    if (seen.has(n)) errors.push(`Duplicate number "${n}".`);
    seen.add(n);
  }
  for (const a of numbers) {
    for (const b of numbers) {
      if (a !== b && b.includes(a)) {
        errors.push(`Number "${a}" is contained in another number "${b}".`);
      }
    }
  }

  // every listed number is actually present in the grid
  for (const n of numbers) {
    if (findToken(grid, n).length === 0) errors.push(`Number "${n}" is not in the grid.`);
  }

  // every listed number has a planted placement (so it has a known answer)
  const placedWords = new Set(placements.map((p) => p.word));
  for (const n of numbers) {
    if (!placedWords.has(n)) errors.push(`Number "${n}" has no planted location.`);
  }

  // planted placements use allowed directions
  const allowed = new Set(resolveDirections(mode, allowBackwards).map(([dr, dc]) => `${dr},${dc}`));
  for (const p of placements) {
    if (!allowed.has(`${p.dr},${p.dc}`)) {
      errors.push(`Number "${p.word}" uses a direction not allowed at difficulty ${difficulty}.`);
    }
  }

  // separation rule (on planted placements)
  const separation = puzzle.data.separation || 'dense';
  if (separation !== 'dense') {
    const sep = checkSeparation(placements, separation);
    if (sep.shared > 0) errors.push(`${sep.shared} number(s) share digits, not allowed here.`);
    if (separation === 'isolated' && sep.touching > 0) {
      errors.push(`${sep.touching} pair(s) of numbers touch; they must be separated.`);
    }
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
