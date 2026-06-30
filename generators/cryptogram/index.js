/**
 * Cryptogram — generate().
 *
 * Encodes a quote with a random substitution cipher in which no letter maps to
 * itself (a derangement of the alphabet). Difficulty controls how many letters
 * are revealed as hints.
 *
 * Config:
 *   quote        string  optional — use this text instead of a built-in quote
 *   author       string  optional — attribution shown under the puzzle
 *   difficulty   1|2|3   optional — 1 reveals more letters, 3 reveals none
 */
const QUOTES = require('./quotes');

const A = 'A'.charCodeAt(0);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a substitution map (plain -> cipher) with no fixed points.
function makeCipher(rand) {
  for (let tries = 0; tries < 100; tries++) {
    const shuffled = shuffle(LETTERS.slice(), rand);
    let ok = true;
    for (let i = 0; i < 26; i++) {
      if (shuffled[i] === LETTERS[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const map = {};
      for (let i = 0; i < 26; i++) map[LETTERS[i]] = shuffled[i];
      return map;
    }
  }
  // Fallback: rotate by 1 (guaranteed derangement).
  const map = {};
  for (let i = 0; i < 26; i++) map[LETTERS[i]] = LETTERS[(i + 1) % 26];
  return map;
}

function encode(text, map) {
  let out = '';
  for (const ch of text.toUpperCase()) {
    out += /[A-Z]/.test(ch) ? map[ch] : ch;
  }
  return out;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;

  let quote;
  if (config.quote) {
    quote = { text: String(config.quote).toUpperCase(), author: config.author || null };
  } else {
    const pool = QUOTES.filter((q) => q.difficulty <= difficulty);
    const chosen = (pool.length ? pool : QUOTES)[Math.floor(rand() * (pool.length || QUOTES.length))];
    quote = { text: chosen.text.toUpperCase(), author: config.author || chosen.author };
  }

  const map = makeCipher(rand); // plain -> cipher
  const inverse = {}; // cipher -> plain (the answer key)
  for (const p of LETTERS) inverse[map[p]] = p;

  const ciphertext = encode(quote.text, map);

  // Reveal some cipher->plain pairs as hints, fewer at higher difficulty.
  const distinctCipher = [...new Set(ciphertext.split('').filter((c) => /[A-Z]/.test(c)))];
  const revealCount = difficulty === 1 ? Math.ceil(distinctCipher.length * 0.25) : difficulty === 2 ? 1 : 0;
  const hintCiphers = shuffle(distinctCipher.slice(), rand).slice(0, revealCount);
  const hints = hintCiphers.map((c) => ({ cipher: c, plain: inverse[c] }));

  return {
    type: 'cryptogram',
    difficulty,
    theme: null,
    title: config.title || 'Cryptogram',
    instructions:
      config.instructions ||
      'Each letter has been replaced by another. Crack the code to reveal the quote.',
    data: {
      ciphertext,
      author: quote.author || null,
      hints,
    },
    solution: {
      plaintext: quote.text,
      key: inverse, // cipher -> plain
    },
  };
}

module.exports = { generate, makeCipher, encode };
