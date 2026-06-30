/**
 * Number Search — generate().
 *
 * A word-search variant that hides number sequences in a grid of digits.
 * Popular with seniors and for early-numeracy practice. Built on the shared
 * grid-search core, so it inherits the difficulty-based separation model.
 *
 * Config:
 *   numbers     string[]  optional explicit list (digits only)
 *   count       number    optional how many to generate
 *   length      number    optional digit length of generated numbers
 *   difficulty  1|2|3
 *   size        number    optional grid side length
 */
const { DIFFICULTY } = require('../../config/defaults');
const { resolveDirections, autoSize, placeTokens, fillGrid } = require('../shared/gridsearch');

const DIGITS = '0123456789';

function randomNumber(len, rand) {
  let s = String(1 + Math.floor(rand() * 9)); // no leading zero
  for (let i = 1; i < len; i++) s += String(Math.floor(rand() * 10));
  return s;
}

// Generate `count` distinct numbers of `len` digits, none a substring of
// another (so each has a single intended answer).
function makeNumbers(count, len, rand) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 200) {
    const n = randomNumber(len, rand);
    if (out.includes(n)) continue;
    if (out.some((m) => m.includes(n) || n.includes(m))) continue;
    out.push(n);
  }
  return out;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = DIFFICULTY.numbersearch[difficulty] || DIFFICULTY.numbersearch[1];
  const len = config.length || preset.len;
  const count = config.count || preset.count;
  const mode = config.directions || preset.directions;
  const allowBackwards =
    config.allowBackwards != null ? config.allowBackwards : preset.allowBackwards;
  const separation = config.separation || preset.separation || 'dense';

  let numbers = (config.numbers || []).map((n) => String(n).replace(/[^0-9]/g, '')).filter(Boolean);
  numbers = [...new Set(numbers)];
  if (numbers.length === 0) numbers = makeNumbers(count, len, rand);
  if (numbers.length < 2) {
    throw new Error('numbersearch.generate: need at least 2 numbers');
  }

  const longest = numbers.reduce((m, n) => Math.max(m, n.length), 0);
  const size = config.size || autoSize(numbers, separation);
  if (longest > size) {
    throw new Error(`numbersearch.generate: number length ${longest} exceeds grid size ${size}`);
  }

  const directions = resolveDirections(mode, allowBackwards);
  const { grid, placements } = placeTokens(numbers, { size, directions, separation, rand });
  fillGrid(grid, DIGITS, rand);

  return {
    type: 'numbersearch',
    difficulty,
    theme: null,
    title: config.title || 'Number Search',
    instructions:
      config.instructions ||
      'Find and circle all the hidden numbers. They may go across, down' +
        (mode === 'diagonal' ? ', and diagonally' : '') +
        (allowBackwards ? ', forwards and backwards.' : '.'),
    data: {
      size,
      grid,
      numbers: [...numbers].sort(),
      mode,
      allowBackwards,
      separation,
    },
    solution: {
      placements: placements.map((p) => ({
        word: p.word,
        row: p.row,
        col: p.col,
        dr: p.dr,
        dc: p.dc,
        cells: p.cells,
      })),
    },
  };
}

module.exports = { generate, makeNumbers };
