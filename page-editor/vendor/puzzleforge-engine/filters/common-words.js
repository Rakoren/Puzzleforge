/**
 * Common-words dictionary used to flag *accidental* real words formed by
 * word-search fill letters (a Word Search Golden Standard). This is distinct
 * from the offensive filter: these words are not banned, they are merely
 * undesirable when they appear unintentionally in the random fill, because a
 * solver may mistake them for a planted answer.
 *
 * Kept intentionally short and high-frequency. The validator treats matches
 * as warnings weighted against the validation score, subject to a configurable
 * threshold — it does not hard-fail on them.
 */

// 3+ letter high-frequency English words likely to form by chance in fill.
const COMMON_WORDS = new Set([
  'the', 'and', 'are', 'for', 'not', 'you', 'all', 'can', 'her', 'was',
  'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man',
  'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its',
  'let', 'put', 'say', 'she', 'too', 'use', 'dad', 'mom', 'cat', 'dog',
  'sun', 'run', 'eat', 'red', 'big', 'box', 'car', 'cup', 'egg', 'hat',
  'that', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know',
  'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come',
  'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take',
  'than', 'them', 'well', 'were', 'play', 'jump', 'love', 'tree', 'book',
]);

/** True if `token` (case-insensitive) is a flagged common word. */
function isCommonWord(token) {
  return COMMON_WORDS.has(String(token || '').toLowerCase());
}

module.exports = { COMMON_WORDS, isCommonWord };
