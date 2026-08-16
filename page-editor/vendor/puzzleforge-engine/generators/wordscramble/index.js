/**
 * Word Scramble — generate().
 *
 * Anagrams each word in a themed list. Every scramble is guaranteed to differ
 * from the original (where the letters allow it). Difficulty controls whether a
 * first-letter hint is shown.
 *
 * Config:
 *   words       string[]  required (or supplied via theme by the book pipeline)
 *   clues       object?   optional map of WORD -> clue text
 *   difficulty  1|2|3      1 shows a first-letter hint, 3 shows none
 *   theme       string?    pass-through for labelling
 */
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Scramble a word so the result differs from the original when possible.
function scramble(word, rand) {
  const chars = word.split('');
  const distinct = new Set(chars).size;
  if (distinct < 2) return word; // e.g. "AAA" cannot be rearranged
  let out = word;
  for (let tries = 0; tries < 50 && out === word; tries++) {
    out = shuffle(chars.slice(), rand).join('');
  }
  return out;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const rawWords = (config.words || [])
    .map((w) => String(w).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length >= 3);
  const words = [...new Set(rawWords)];

  if (words.length === 0) {
    throw new Error('wordscramble.generate: config.words must contain words of length >= 3');
  }

  const clues = config.clues || {};
  const showHint = difficulty === 1;

  const entries = words.map((word) => ({
    scrambled: scramble(word, rand),
    length: word.length,
    hint: showHint ? word[0] : null,
    clue: clues[word] || null,
  }));

  return {
    type: 'wordscramble',
    difficulty,
    theme: config.theme || null,
    title: config.title || (config.theme ? `${cap(config.theme)} Word Scramble` : 'Word Scramble'),
    instructions:
      config.instructions || 'Unscramble each group of letters to spell a word.',
    data: {
      entries,
      theme: config.theme || null,
    },
    solution: {
      words,
    },
  };
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { generate, scramble };
