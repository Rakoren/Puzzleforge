/**
 * Word Wheel — solve() + the word-finder.
 *
 * A wheel is a 9-letter multiset with one required centre letter. A word is
 * "findable" if it is a real word, at least minLen letters, uses the centre
 * letter, and uses each letter no more often than the wheel provides it. The
 * finder enumerates every such word from the baked dictionary — the source of
 * truth for the answer key and the scoring targets.
 */
const WORDS = require('./words');
const DICT = new Set(WORDS);

function letterCounts(str) {
  const c = {};
  for (const ch of str) c[ch] = (c[ch] || 0) + 1;
  return c;
}

// Can `word` be spelled from the wheel's letter budget?
function canMake(word, wheelCounts) {
  const c = {};
  for (const ch of word) {
    c[ch] = (c[ch] || 0) + 1;
    if (c[ch] > (wheelCounts[ch] || 0)) return false;
  }
  return true;
}

/** Every dictionary word findable in the wheel (uses the centre, ≥ minLen). */
function findWords(wheel, center, minLen, dict = WORDS) {
  const wc = letterCounts(wheel);
  const out = [];
  for (const w of dict) {
    if (w.length < minLen) continue;
    if (w.indexOf(center) < 0) continue;
    if (canMake(w, wc)) out.push(w);
  }
  return out;
}

// Engine verification: re-derive the findable set and confirm the stored key.
function solve(puzzle) {
  const { wheel, center, minLen } = puzzle.data;
  const words = findWords(wheel, center, minLen);
  const set = new Set(words);
  const missing = [];
  if (!set.has(puzzle.solution.pangram)) missing.push('the 9-letter word is not findable in the wheel');
  if (words.length < 4) missing.push('too few findable words');
  return { words, missing };
}

module.exports = { solve, findWords, canMake, letterCounts, DICT, WORDS };
