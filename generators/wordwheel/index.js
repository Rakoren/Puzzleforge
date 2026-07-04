/**
 * Word Wheel — generate().
 *
 * A 9-letter word is split into a wheel: one required centre letter plus eight
 * around it. The solver makes as many words (≥ minLen, each using the centre)
 * as they can, aiming to find the hidden 9-letter word. Built from the baked
 * common-word dictionary so every listed answer is a real, recognizable word.
 *
 * Config:
 *   difficulty  1|2|3|4  minimum word length + how common the source word is
 *   title       str
 */
const WORDS = require('./words');
const { findWords } = require('./solver');
const { DIFFICULTY } = require('../../config/defaults');

const PRESETS = (DIFFICULTY.wordwheel) || {
  1: { minLen: 3, sourceTop: 0.35, minWords: 12 },
  2: { minLen: 4, sourceTop: 0.6, minWords: 12 },
  3: { minLen: 4, sourceTop: 1, minWords: 10 },
  4: { minLen: 5, sourceTop: 1, minWords: 8 },
};

// 9-letter source words with enough distinct letters to make a varied wheel.
const NINE = WORDS.filter((w) => w.length === 9 && new Set(w).size >= 6);

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Choose the centre letter that yields the most words (ties → prefer a vowel,
// which usually makes a friendlier puzzle).
function bestCenter(pan, minLen) {
  const distinct = [...new Set(pan)];
  let best = distinct[0];
  let bestN = -1;
  for (const ch of distinct) {
    const n = findWords(pan, ch, minLen).length + (VOWELS.has(ch) ? 0.5 : 0);
    if (n > bestN) { bestN = n; best = ch; }
  }
  return best;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = PRESETS[difficulty] || PRESETS[1];
  const minLen = preset.minLen;

  // Bias the source word toward the common end of the list for easier levels.
  const pool = NINE.slice(0, Math.max(40, Math.floor(NINE.length * preset.sourceTop)));
  let pan = null; let center = null; let words = null;
  for (let tries = 0; tries < 400; tries++) {
    const cand = pool[Math.floor(rand() * pool.length)];
    const c = bestCenter(cand, minLen);
    const w = findWords(cand, c, minLen);
    if (w.length >= preset.minWords && w.length <= 260 && w.includes(cand)) {
      pan = cand; center = c; words = w; break;
    }
  }
  if (!pan) { const err = new Error('wordwheel.generate: could not find a suitable word'); err.retryable = true; throw err; }

  // Wheel = centre + the other eight letters (shuffled for display).
  const rest = pan.split('');
  rest.splice(rest.indexOf(center), 1);
  const ring = shuffle(rest, rand);
  const wheel = center + ring.join('');

  // Scoring targets from the actual findable count.
  const total = words.length;
  const targets = {
    good: Math.max(3, Math.round(total * 0.35)),
    great: Math.max(5, Math.round(total * 0.55)),
    expert: Math.max(8, Math.round(total * 0.8)),
  };

  const sorted = words.slice().sort((a, b) => (a.length - b.length) || a.localeCompare(b));

  return {
    type: 'wordwheel',
    difficulty,
    theme: config.theme || null,
    title: config.title || 'Word Wheel',
    instructions: config.instructions
      || `Make as many words of ${minLen} or more letters as you can. Every word must use the centre letter “${center.toUpperCase()}”, and each letter can be used only as often as it appears. Can you find the 9-letter word that uses them all?`,
    data: {
      center,
      ring, // eight outer letters (display order)
      wheel, // centre + ring (full multiset the solver draws from)
      minLen,
      count: total,
      targets,
    },
    solution: {
      pangram: pan,
      words: sorted,
    },
  };
}

module.exports = { generate, bestCenter, NINE };
