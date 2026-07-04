/**
 * Cipher algorithms shared by generate / solve / validate.
 *
 * Four classic, teachable ciphers. Each is deterministic and reversible, so the
 * solver is the source of truth: decode(encode(x)) === x.
 *   caesar  — shift every letter forward by N (wraps A–Z)
 *   atbash  — mirror the alphabet (A↔Z, B↔Y, …); its own inverse
 *   a1z26   — letters as their position number (A=1 … Z=26)
 *   morse   — international Morse code
 */
const A = 'A'.charCodeAt(0);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const MODES = ['caesar', 'atbash', 'a1z26', 'morse'];
const isLetter = (ch) => ch >= 'A' && ch <= 'Z';
const norm = (s) => String(s == null ? '' : s).toUpperCase();
const wordsOf = (s) => norm(s).replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

function caesar(text, shift) {
  const n = ((shift % 26) + 26) % 26;
  let out = '';
  for (const ch of norm(text)) out += isLetter(ch) ? LETTERS[(ch.charCodeAt(0) - A + n) % 26] : ch;
  return out;
}
function atbash(text) {
  let out = '';
  for (const ch of norm(text)) out += isLetter(ch) ? LETTERS[25 - (ch.charCodeAt(0) - A)] : ch;
  return out;
}

/**
 * Encode a message for a mode. Returns everything both the renderer and the
 * solver need, plus the canonical plaintext (what decode() will reproduce).
 *   caesar / atbash → { cipher }
 *   a1z26 / morse   → { words: [[code, …], …] }  (punctuation dropped)
 */
function encode(mode, message, opts = {}) {
  const plainFull = norm(message);
  if (mode === 'caesar') {
    const shift = opts.shift != null ? opts.shift : 3;
    return { mode, shift, cipher: caesar(plainFull, shift), plaintext: plainFull };
  }
  if (mode === 'atbash') {
    return { mode, cipher: atbash(plainFull), plaintext: plainFull };
  }
  // Number / Morse: encode letters only, grouped by word.
  const words = wordsOf(plainFull);
  const plaintext = words.join(' ');
  const encWord = (w) => w.split('').map((ch) => (mode === 'a1z26' ? String(ch.charCodeAt(0) - A + 1) : MORSE[ch]));
  return { mode, words: words.map(encWord), plaintext };
}

/** Reverse of encode(): reconstruct the plaintext from stored cipher data. */
function decode(data) {
  switch (data.mode) {
    case 'caesar': return caesar(data.cipher, -data.shift);
    case 'atbash': return atbash(data.cipher);
    case 'a1z26':
      return data.words.map((w) => w.map((n) => LETTERS[Number(n) - 1] || '?').join('')).join(' ');
    case 'morse':
      return data.words.map((w) => w.map((c) => MORSE_REV[c] || '?').join('')).join(' ');
    default: return '';
  }
}

module.exports = { MODES, MORSE, MORSE_REV, LETTERS, caesar, atbash, encode, decode, wordsOf, norm };
