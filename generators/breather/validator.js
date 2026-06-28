/** Breather page — validate(). No solvable content; just screen the text. */
const offensive = require('../../filters/offensive');

function validate(puzzle) {
  const errors = [];
  const { text, source } = puzzle.data || {};
  const hits = offensive.scanText(`${text || ''} ${source || ''}`);
  if (hits.length) errors.push(`Offensive text: ${hits.join(', ')}.`);
  return { valid: errors.length === 0, errors, warnings: [], score: 1 };
}

module.exports = { validate };
