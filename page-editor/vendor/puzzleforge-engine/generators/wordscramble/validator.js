/**
 * Word Scramble — validate().
 *
 * Golden Standards:
 *   - every scramble is a true anagram of its answer
 *   - a scramble differs from its answer (unless the letters make that
 *     impossible, e.g. a single repeated letter)
 *   - minimum word length, no duplicate answers
 *   - offensive filter on the answer words
 */
const { solve, isAnagram } = require('./solver');
const offensive = require('../../filters/offensive');

const MIN_LEN = 3;

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const words = puzzle.solution.words;
  const entries = puzzle.data.entries;

  if (words.length === 0) errors.push('No words in the puzzle.');

  const seen = new Set();
  let unscrambledCount = 0;
  words.forEach((word, i) => {
    if (word.length < MIN_LEN) errors.push(`Word "${word}" is shorter than ${MIN_LEN}.`);
    if (seen.has(word)) errors.push(`Duplicate word "${word}".`);
    seen.add(word);
    if (offensive.isOffensiveWord(word)) errors.push(`Offensive word "${word}".`);

    const e = entries[i];
    if (!e || !isAnagram(e.scrambled, word)) {
      errors.push(`Scramble for "${word}" is not a valid anagram.`);
    } else if (e.scrambled === word && new Set(word.split('')).size > 1) {
      // Could have been scrambled but wasn't.
      unscrambledCount++;
    }
  });

  if (unscrambledCount > 0) {
    warnings.push(`${unscrambledCount} word(s) were not actually rearranged.`);
    score -= Math.min(0.3, unscrambledCount * 0.1);
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
