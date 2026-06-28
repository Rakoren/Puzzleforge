/**
 * Trivia — validate().
 *
 * Golden Standards:
 *   - a minimum number of questions
 *   - every question and answer is non-empty
 *   - no duplicate questions
 *   - questions and answers pass the offensive-content filter
 */
const offensive = require('../../filters/offensive');

const MIN_QUESTIONS = 5;

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const questions = puzzle.data.questions;
  const answers = puzzle.solution.answers;

  if (questions.length < MIN_QUESTIONS) {
    errors.push(`Only ${questions.length} questions; need at least ${MIN_QUESTIONS}.`);
  }
  if (questions.length !== answers.length) {
    errors.push('Question and answer counts do not match.');
  }

  const seen = new Set();
  questions.forEach((item, i) => {
    const q = (item.q || '').trim();
    const a = (answers[i] || '').trim();
    if (!q) errors.push(`Question ${i + 1} is empty.`);
    if (!a) errors.push(`Answer ${i + 1} is empty.`);
    const key = q.toLowerCase();
    if (seen.has(key)) errors.push(`Duplicate question: "${q}".`);
    seen.add(key);
    if (offensive.scanText(q).length || offensive.scanText(a).length) {
      errors.push(`Offensive content in question ${i + 1}.`);
    }
  });

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
