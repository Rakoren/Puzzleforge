/**
 * Cryptogram — validate().
 *
 * Golden Standards:
 *   - the cipher has no fixed points (no letter encodes to itself)
 *   - the ciphertext decodes exactly back to the plaintext (round-trips)
 *   - the plaintext is clean (offensive filter) and long enough to be a puzzle
 */
const { solve } = require('./solver');
const offensive = require('../../filters/offensive');

const MIN_LETTERS = 12;

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { ciphertext } = puzzle.data;
  const { plaintext, key } = puzzle.solution;

  // No fixed points: for every cipher->plain pair, they must differ.
  for (const [cipher, plain] of Object.entries(key)) {
    if (cipher === plain) errors.push(`Letter "${cipher}" maps to itself.`);
  }

  // Round-trip.
  const decoded = solve(puzzle).plaintext;
  if (decoded !== plaintext) {
    errors.push('Ciphertext does not decode back to the plaintext.');
  }

  // Content + length.
  const letterCount = (plaintext.match(/[A-Z]/gi) || []).length;
  if (letterCount < MIN_LETTERS) {
    errors.push(`Quote is too short (${letterCount} letters; need ${MIN_LETTERS}).`);
  }
  const offensiveHits = offensive.scanText(plaintext);
  if (offensiveHits.length) errors.push(`Offensive content in quote: ${offensiveHits.join(', ')}.`);

  // Soft: extremely repetitive quotes (few distinct letters) are easy/odd.
  const distinct = new Set(plaintext.replace(/[^A-Z]/g, '').split('')).size;
  if (distinct < 7) {
    warnings.push('Quote uses very few distinct letters.');
    score -= 0.1;
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
