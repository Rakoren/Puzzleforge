/**
 * Word Ladder — validate().
 *
 * Golden Standards:
 *   - the stored ladder is real: every word is in the dictionary, consecutive
 *     words differ by exactly one letter, and no word repeats
 *   - endpoints and the ladder line up (start/end match, right length)
 *   - the revealed letters are consistent with the ladder
 *   - the revealed letters make the answer unique (fair & solvable)
 *   - all words are clean (offensive filter)
 */
const { countLadders, isNeighbor, dictFor, patternsFrom } = require('./solver');
const offensive = require('../../filters/offensive');

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { start, end, steps, rungs, length } = puzzle.data;
  const ladder = puzzle.solution.ladder;
  const dict = dictFor(length);

  if (!Array.isArray(ladder) || ladder.length !== steps) {
    errors.push(`Ladder has ${ladder ? ladder.length : 0} rungs; expected ${steps}.`);
    return { valid: false, errors, warnings, score: 0 };
  }
  if (ladder[0] !== start) errors.push('Ladder does not start at the start word.');
  if (ladder[steps - 1] !== end) errors.push('Ladder does not end at the end word.');

  const seen = new Set();
  for (let i = 0; i < ladder.length; i++) {
    const w = ladder[i];
    if (w.length !== length) errors.push(`"${w}" is not ${length} letters.`);
    if (!dict.has(w)) errors.push(`"${w}" is not in the word list.`);
    if (seen.has(w)) errors.push(`"${w}" repeats in the ladder.`);
    seen.add(w);
    if (i > 0 && !isNeighbor(ladder[i - 1], w)) {
      errors.push(`"${ladder[i - 1]}" → "${w}" changes more than one letter.`);
    }
  }

  // Revealed letters must match the intended ladder.
  for (let i = 0; i < rungs.length; i++) {
    const word = ladder[i + 1];
    rungs[i].forEach((ch, j) => {
      if (ch != null && ch !== word[j]) errors.push(`Rung ${i + 2} reveals "${ch}" but the answer is "${word[j]}".`);
    });
  }

  // Uniqueness.
  const { count, overBudget } = countLadders(start, end, steps, patternsFrom(puzzle), { limit: 2 });
  if (overBudget) errors.push('Solver could not confirm uniqueness within its budget.');
  else if (count === 0) errors.push('No ladder satisfies the revealed letters.');
  else if (count > 1) errors.push('The revealed letters allow more than one ladder.');

  const hits = offensive.scanText(ladder.join(' '));
  if (hits.length) errors.push(`Offensive word in ladder: ${hits.join(', ')}.`);

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate };
