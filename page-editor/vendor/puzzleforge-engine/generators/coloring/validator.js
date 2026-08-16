/**
 * Coloring page — validate(). No solvable content; just guard the inputs
 * (known style, and a clean bubble word if present).
 */
const offensive = require('../../filters/offensive');

const STYLES = new Set(['mandala', 'bubble', 'pattern']);

function validate(puzzle) {
  const errors = [];
  const { style, word } = puzzle.data || {};
  if (!STYLES.has(style)) errors.push(`Unknown coloring style "${style}".`);
  if (word && offensive.isOffensiveWord(word)) errors.push(`Offensive word "${word}".`);
  return { valid: errors.length === 0, errors, warnings: [], score: 1 };
}

module.exports = { validate };
