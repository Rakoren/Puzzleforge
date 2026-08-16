/**
 * Cipher — solve().
 *
 * Decodes the puzzle straight back to plaintext using the shared algorithm and
 * confirms it matches the stored solution. The decoder is the source of truth
 * for the answer key.
 */
const { decode } = require('./ciphers');

function solve(puzzle) {
  const decoded = decode(puzzle.data);
  const missing = [];
  if (decoded !== puzzle.solution.plaintext) missing.push('ciphertext does not decode back to the message');
  return { plaintext: decoded, missing };
}

module.exports = { solve };
