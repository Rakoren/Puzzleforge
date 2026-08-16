/**
 * Offensive-language filter.
 *
 * Per the PRD this is NOT optional and cannot be bypassed by config. It is
 * imported by every generator's validator and applied to:
 *   - all placed words (word search / crossword)
 *   - all fill letters (scanned for accidental word formation across a line)
 *   - all user-supplied custom word lists (input sanitization)
 *   - all clue / instruction text
 *
 * Implementation: a built-in custom blocklist (always present, tuned for the
 * short slurs that slip into grid fill) augmented by the `bad-words` package
 * when it is installed. The built-in list guarantees the filter still works
 * with zero dependencies.
 */

// Built-in blocklist. Lowercase, letters only. Kept deliberately compact and
// focused on terms that matter in a children's-puzzle grid context, including
// short forms a general profanity filter may miss when embedded in fill.
const BUILTIN_BLOCKLIST = [
  'ass', 'arse', 'damn', 'crap', 'piss', 'dick', 'cock', 'cunt', 'twat',
  'fuck', 'shit', 'slut', 'whore', 'bitch', 'bastard', 'wank', 'prick',
  'fag', 'faggot', 'nigger', 'nigga', 'spic', 'chink', 'kike', 'coon',
  'retard', 'rape', 'nazi', 'kill', 'sex', 'porn',
];

const BLOCKLIST = new Set(BUILTIN_BLOCKLIST);

// Optionally augment with the `bad-words` package. Loaded lazily and guarded
// so a missing dependency never breaks the engine.
let badWordsFilter = null;
try {
  // eslint-disable-next-line global-require
  const BadWords = require('bad-words');
  badWordsFilter = new BadWords();
} catch (_) {
  badWordsFilter = null;
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z]/g, '');
}

/** True if a single word exactly matches a blocked term (normalized). */
function isOffensiveWord(word) {
  const w = normalize(word);
  if (!w) return false;
  if (BLOCKLIST.has(w)) return true;
  if (badWordsFilter && badWordsFilter.isProfane(w)) return true;
  return false;
}

/**
 * Return blocklist terms that appear as a substring of `text` (after
 * normalization). Used to scan grid lines (rows / columns / diagonals) for
 * accidental slurs formed by fill letters.
 * @returns {string[]} matched terms (may be empty)
 */
function findOffensiveSubstrings(text) {
  const t = normalize(text);
  if (!t) return [];
  const hits = [];
  for (const term of BLOCKLIST) {
    // Only substring-scan for terms long enough to matter; 3+ chars covers
    // the short slurs while avoiding excessive false positives.
    if (term.length >= 3 && t.includes(term)) hits.push(term);
  }
  return hits;
}

/**
 * Scan free text (clues, instructions, titles) for profanity on word
 * boundaries. Less aggressive than substring scanning — appropriate for
 * human-authored prose.
 * @returns {string[]} offending tokens
 */
function scanText(text) {
  const tokens = String(text || '').split(/[^A-Za-z]+/).filter(Boolean);
  return tokens.filter((tok) => isOffensiveWord(tok));
}

/**
 * Sanitize a user-supplied word list. Splits into accepted/rejected so the
 * caller can surface what was dropped.
 * @returns {{ accepted: string[], rejected: string[] }}
 */
function sanitizeWordList(words) {
  const accepted = [];
  const rejected = [];
  for (const word of words || []) {
    if (isOffensiveWord(word)) rejected.push(word);
    else accepted.push(word);
  }
  return { accepted, rejected };
}

module.exports = {
  BLOCKLIST,
  isOffensiveWord,
  findOffensiveSubstrings,
  scanText,
  sanitizeWordList,
  usingBadWords: () => Boolean(badWordsFilter),
};
