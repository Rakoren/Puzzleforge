/**
 * Riddles — validate().
 * Golden Standards: a minimum count, non-empty prompts/answers, no duplicates,
 * and offensive-content-clean text.
 */
const offensive = require('../../filters/offensive');

const MIN_RIDDLES = 5;

function validate(puzzle) {
  const errors = [];
  const warnings = [];

  const questions = puzzle.data.questions;
  const answers = puzzle.solution.answers;

  if (questions.length < MIN_RIDDLES) {
    errors.push(`Only ${questions.length} riddles; need at least ${MIN_RIDDLES}.`);
  }
  if (questions.length !== answers.length) {
    errors.push('Riddle and answer counts do not match.');
  }

  const seen = new Set();
  questions.forEach((item, i) => {
    const q = (item.q || '').trim();
    const a = (answers[i] || '').trim();
    if (!q) errors.push(`Riddle ${i + 1} is empty.`);
    if (!a) errors.push(`Answer ${i + 1} is empty.`);
    const key = q.toLowerCase();
    if (seen.has(key)) errors.push(`Duplicate riddle: "${q}".`);
    seen.add(key);
    if (offensive.scanText(q).length || offensive.scanText(a).length) {
      errors.push(`Offensive content in riddle ${i + 1}.`);
    }
  });

  return { valid: errors.length === 0, errors, warnings, score: errors.length === 0 ? 1 : 0 };
}

module.exports = { validate };
