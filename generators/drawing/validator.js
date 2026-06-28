/**
 * Drawing page — validate(). Activity pages have no solvable content, so the
 * only requirement is that a prompt exists.
 */
const offensive = require('../../filters/offensive');

function validate(puzzle) {
  const errors = [];
  const prompt = (puzzle.data && puzzle.data.prompt) || '';
  if (!String(prompt).trim()) errors.push('Drawing page has no prompt.');
  const hits = offensive.scanText(`${puzzle.title} ${prompt}`);
  if (hits.length) errors.push(`Offensive text: ${hits.join(', ')}.`);
  return { valid: errors.length === 0, errors, warnings: [], score: 1 };
}

module.exports = { validate };
