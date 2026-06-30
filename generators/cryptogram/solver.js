/**
 * Cryptogram — solve().
 *
 * Decodes the ciphertext using the solution key and returns the plaintext.
 * Used to verify the puzzle round-trips: the engine/validator confirm this
 * decoded text matches the stored plaintext.
 */
function solve(puzzle) {
  const { ciphertext } = puzzle.data;
  const key = puzzle.solution.key; // cipher -> plain
  let plaintext = '';
  for (const ch of ciphertext) {
    plaintext += /[A-Z]/.test(ch) ? key[ch] || '?' : ch;
  }
  return { plaintext };
}

module.exports = { solve };
