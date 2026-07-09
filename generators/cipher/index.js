/**
 * Cipher — generate().
 *
 * Encodes a short message with one of four classic ciphers (Caesar, Atbash,
 * A1Z26, Morse). Difficulty controls which ciphers are drawn, the message
 * length, and whether the key (the Caesar shift) is revealed. Correctness is
 * structural: the ciphertext is produced by the shared algorithm and the solver
 * decodes it straight back, so the answer key can never drift.
 *
 * Config:
 *   difficulty  1|2|3|4
 *   mode        optional — force a specific cipher
 *   message     optional — encode this text instead of a bank phrase
 *   title       str
 */
const BANK = require('./messages');
const { encode, MODES } = require('./ciphers');
const { DIFFICULTY, presetFor } = require('../../config/defaults');

const PRESETS = (DIFFICULTY.cipher) || {
  1: { modes: ['caesar', 'a1z26'], maxLen: 24, showKey: true },
  2: { modes: ['caesar', 'atbash', 'a1z26'], maxLen: 34, showKey: true },
  3: { modes: ['caesar', 'atbash', 'morse'], maxLen: 44, showKey: false },
  4: { modes: ['caesar', 'atbash', 'morse'], maxLen: 60, showKey: false },
};

const MODE_NAMES = {
  caesar: 'Caesar Shift', atbash: 'Atbash', a1z26: 'Number Code (A1Z26)', morse: 'Morse Code',
};
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

function instructionsFor(mode, showKey, shift) {
  switch (mode) {
    case 'caesar':
      return showKey
        ? `Each letter was shifted ${shift} place${shift === 1 ? '' : 's'} forward in the alphabet. Shift them back to read the message.`
        : 'Each letter was shifted the same number of places forward in the alphabet. Work out the shift, then decode the message.';
    case 'atbash':
      return 'The alphabet was reversed: A↔Z, B↔Y, and so on. Flip each letter back to read the message.';
    case 'a1z26':
      return 'Each number is a letter by its position (A=1, B=2, … Z=26). Turn the numbers back into letters.';
    case 'morse':
      return 'This message is in Morse code. Use the key to turn each pattern back into a letter.';
    default: return 'Decode the message.';
  }
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('cipher', difficulty, config.audience);
  const mode = MODES.includes(config.mode) ? config.mode : pick(preset.modes, rand);

  let message;
  if (config.message) {
    message = String(config.message);
  } else {
    const pool = BANK.filter((m) => m.difficulty <= difficulty && m.text.replace(/[^A-Z]/gi, '').length <= preset.maxLen);
    message = (pool.length ? pick(pool, rand) : pick(BANK, rand)).text;
  }

  const shift = mode === 'caesar' ? 1 + Math.floor(rand() * 25) : null;
  const enc = encode(mode, message, { shift });
  const showKey = mode === 'caesar' ? preset.showKey : true; // atbash/a1z26/morse always give the rule

  return {
    type: 'cipher',
    difficulty,
    theme: null,
    title: config.title || `Cipher — ${MODE_NAMES[mode]}`,
    instructions: config.instructions || instructionsFor(mode, showKey, shift),
    data: {
      mode,
      showKey,
      ...(mode === 'caesar' ? { shift, cipher: enc.cipher } : {}),
      ...(mode === 'atbash' ? { cipher: enc.cipher } : {}),
      ...(mode === 'a1z26' || mode === 'morse' ? { words: enc.words } : {}),
    },
    solution: { plaintext: enc.plaintext },
  };
}

module.exports = { generate, MODE_NAMES };
