/**
 * Word Scramble — solve().
 *
 * Returns the original words (the answer key) and confirms each scramble is a
 * true anagram of its answer (same multiset of letters).
 */
function letterCounts(word) {
  const m = {};
  for (const ch of word) m[ch] = (m[ch] || 0) + 1;
  return m;
}

function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  const ca = letterCounts(a);
  const cb = letterCounts(b);
  for (const k of Object.keys(ca)) if (ca[k] !== cb[k]) return false;
  return Object.keys(ca).length === Object.keys(cb).length;
}

function solve(puzzle) {
  const words = puzzle.solution.words;
  const entries = puzzle.data.entries;
  const mismatches = [];
  entries.forEach((e, i) => {
    if (!isAnagram(e.scrambled, words[i])) mismatches.push(words[i]);
  });
  return { words, mismatches };
}

module.exports = { solve, isAnagram };
