/**
 * Word Search — validate().
 *
 * Enforces the Word Search "Golden Standards" from the PRD. Returns:
 *   { valid: boolean, errors: string[], warnings: string[], score: number }
 *
 * Hard errors (any one => invalid):
 *   - a target word is not findable in the grid
 *   - a duplicate target word
 *   - the grid is not fully filled
 *   - a placement uses a direction not allowed at this difficulty
 *   - a target word is shorter than the minimum length
 *   - a target word is an accidental substring of another target word
 *   - offensive content appears in a grid line, a word, or the clue text
 *
 * Soft warnings (reduce score, do not invalidate on their own):
 *   - a word is findable in more than one location (ambiguous answer)
 *   - accidental common words detected in the fill
 */
const { solve } = require('./solver');
const { resolveDirections } = require('./index');
const { gridLines, checkSeparation } = require('../shared/gridsearch');
const { DIFFICULTY } = require('../../config/defaults');
const offensive = require('../../filters/offensive');
const { isCommonWord } = require('../../filters/common-words');

const MIN_WORD_LEN = 3;

// Penalty weights for soft issues.
const PENALTY = {
  ambiguous: 0.05,
  commonWord: 0.02,
};
// Cap so a flood of accidental common words can't drive the score below the
// floor on its own.
const COMMON_WORD_PENALTY_CAP = 0.2;

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { grid, words, mode, allowBackwards } = puzzle.data;
  const difficulty = puzzle.difficulty || 1;

  // --- grid fully filled ---
  let filled = true;
  for (const row of grid) {
    for (const cell of row) {
      if (cell == null || cell === '') filled = false;
    }
  }
  if (!filled) errors.push('Grid is not fully filled — empty cells remain.');

  // --- duplicates & min length ---
  const seen = new Set();
  for (const w of words) {
    if (seen.has(w)) errors.push(`Duplicate target word "${w}".`);
    seen.add(w);
    if (w.length < MIN_WORD_LEN) {
      errors.push(`Word "${w}" is shorter than the minimum length ${MIN_WORD_LEN}.`);
    }
  }

  // --- substring relationship between target words ---
  for (const a of words) {
    for (const b of words) {
      if (a !== b && b.includes(a)) {
        errors.push(`Word "${a}" is a substring of another target word "${b}".`);
      }
    }
  }

  // --- findability + ambiguity (independent solve) ---
  const { found, missing, ambiguous } = solve(puzzle);
  for (const w of missing) errors.push(`Word "${w}" is not findable in the grid.`);
  for (const w of ambiguous) {
    warnings.push(`Word "${w}" appears in more than one location (ambiguous answer).`);
    score -= PENALTY.ambiguous;
  }

  // --- directions allowed at this difficulty ---
  const preset = DIFFICULTY.wordsearch[difficulty] || DIFFICULTY.wordsearch[1];
  const allowedDirs = new Set(
    resolveDirections(mode, allowBackwards).map(([dr, dc]) => `${dr},${dc}`)
  );
  for (const p of found) {
    const key = `${p.dr},${p.dc}`;
    if (!allowedDirs.has(key)) {
      errors.push(
        `Word "${p.word}" is placed in a direction not allowed at difficulty ${difficulty}.`
      );
    }
  }

  // --- separation rule for the difficulty ---
  const separation = puzzle.data.separation || 'dense';
  if (separation !== 'dense') {
    const sep = checkSeparation(puzzle.solution.placements || [], separation);
    if (sep.shared > 0) {
      errors.push(`${sep.shared} word(s) share letters, not allowed at this difficulty.`);
    }
    if (separation === 'isolated' && sep.touching > 0) {
      errors.push(`${sep.touching} pair(s) of words touch; words must be fully separated.`);
    }
  }

  // --- offensive content (hard fail) ---
  for (const w of words) {
    if (offensive.isOffensiveWord(w)) errors.push(`Offensive target word "${w}".`);
  }
  for (const text of [puzzle.title, puzzle.instructions]) {
    const hits = offensive.scanText(text || '');
    if (hits.length) errors.push(`Offensive text in clue/title: ${hits.join(', ')}.`);
  }
  const lines = gridLines(grid);
  const offensiveInGrid = new Set();
  for (const line of lines) {
    for (const term of offensive.findOffensiveSubstrings(line)) offensiveInGrid.add(term);
  }
  if (offensiveInGrid.size) {
    errors.push(
      `Offensive words formed by grid letters: ${[...offensiveInGrid].join(', ')}.`
    );
  }

  // --- accidental common words in fill (soft) ---
  const targetSet = new Set(words);
  const commonHits = new Set();
  for (const line of lines) {
    // Scan for common words of length >= 4 to limit false positives; skip any
    // that are themselves a target word.
    for (let i = 0; i < line.length; i++) {
      for (let len = 4; len <= 6 && i + len <= line.length; len++) {
        const seg = line.slice(i, i + len);
        if (!targetSet.has(seg) && isCommonWord(seg)) commonHits.add(seg);
      }
    }
  }
  if (commonHits.size) {
    warnings.push(`Accidental common words in fill: ${[...commonHits].join(', ')}.`);
    score -= Math.min(COMMON_WORD_PENALTY_CAP, commonHits.size * PENALTY.commonWord);
  }

  score = Math.max(0, Math.min(1, score));
  const valid = errors.length === 0;

  return { valid, errors, warnings, score };
}

module.exports = { validate, gridLines, checkSeparation };
