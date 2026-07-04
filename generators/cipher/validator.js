/**
 * Cipher — validate().
 *
 * Golden Standards:
 *   - the ciphertext decodes exactly back to the plaintext (round-trips)
 *   - the message is long enough to be a puzzle
 *   - the plaintext is clean (offensive filter)
 *   - Caesar uses a real shift (never 0)
 */
const { decode } = require('./ciphers');
const offensive = require('../../filters/offensive');

const MIN_LETTERS = 6;

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { mode, shift } = puzzle.data;
  const plaintext = puzzle.solution.plaintext;

  const decoded = decode(puzzle.data);
  if (decoded !== plaintext) errors.push('Ciphertext does not decode back to the plaintext.');

  if (mode === 'caesar' && (!Number.isInteger(shift) || ((shift % 26) + 26) % 26 === 0)) {
    errors.push('Caesar shift must be a non-zero value.');
  }

  const letters = (plaintext.match(/[A-Z]/g) || []).length;
  if (letters < MIN_LETTERS) errors.push(`Message is too short (${letters} letters; need ${MIN_LETTERS}).`);

  const hits = offensive.scanText(plaintext);
  if (hits.length) errors.push(`Offensive content in message: ${hits.join(', ')}.`);

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
