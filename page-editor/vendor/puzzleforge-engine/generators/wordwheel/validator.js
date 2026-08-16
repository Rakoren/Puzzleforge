/**
 * Word Wheel — validate().
 *
 * Golden Standards:
 *   - the wheel is 9 letters and its multiset equals the 9-letter word's letters
 *   - the centre letter is on the wheel
 *   - every listed answer is a real word, ≥ minLen, uses the centre, and fits the
 *     wheel's letter budget
 *   - the 9-letter word is itself findable
 *   - there are enough words to be a worthwhile puzzle
 *   - all content is clean (offensive filter)
 */
const { findWords, canMake, letterCounts, DICT } = require('./solver');
const offensive = require('../../filters/offensive');

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { center, ring, wheel, minLen, count } = puzzle.data;
  const pangram = puzzle.solution.pangram;
  const words = puzzle.solution.words || [];

  if (!wheel || wheel.length !== 9) errors.push(`Wheel has ${wheel ? wheel.length : 0} letters; expected 9.`);
  if (!center || center.length !== 1 || wheel.indexOf(center) < 0) errors.push('Centre letter is missing from the wheel.');
  if (!Array.isArray(ring) || ring.length !== 8) errors.push('Wheel needs exactly eight outer letters.');

  // Wheel letters must match the 9-letter word.
  if (pangram) {
    const a = wheel.split('').sort().join('');
    const b = pangram.split('').sort().join('');
    if (a !== b) errors.push('Wheel letters do not match the 9-letter word.');
    if (pangram.length !== 9 || !DICT.has(pangram)) errors.push('The 9-letter word is not a valid dictionary word.');
  } else {
    errors.push('No 9-letter word set.');
  }

  // Every listed word must be legal for the wheel.
  const wc = letterCounts(wheel);
  let bad = 0;
  for (const w of words) {
    if (!DICT.has(w) || w.length < minLen || w.indexOf(center) < 0 || !canMake(w, wc)) { bad++; }
  }
  if (bad) errors.push(`${bad} listed answer(s) are not legal words for this wheel.`);
  if (pangram && !words.includes(pangram)) errors.push('The 9-letter word is missing from the answer list.');

  // The stored count should match a fresh enumeration.
  const fresh = findWords(wheel, center, minLen).length;
  if (fresh !== count) { warnings.push(`Stored count ${count} ≠ recomputed ${fresh}.`); score -= 0.1; }
  if (fresh < 6) { errors.push(`Only ${fresh} findable words — too thin.`); }

  const hits = offensive.scanText([pangram, ...words].join(' '));
  if (hits.length) errors.push(`Offensive content: ${hits.join(', ')}.`);

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
