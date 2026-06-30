/**
 * Crossword — generate().
 *
 * Interlocks a themed word list into a single connected grid and builds
 * numbered Across/Down clue lists. This is a themed criss-cross crossword:
 * words cross at shared letters with clean separation. (Dense American-style
 * constraints — full 180° symmetry and zero unchecked squares — are tracked as
 * soft quality metrics by the validator rather than hard requirements, since
 * they are not generally achievable from an arbitrary themed word list. See
 * validator.js.)
 *
 * Config:
 *   words   string[]  required (or supplied via theme by the book pipeline)
 *   clues   object    map of WORD -> clue text (themes provide these)
 *   difficulty 1|2|3
 */
const { interlock, separationForDifficulty } = require('../shared/interlock');

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const words = [
    ...new Set(
      (config.words || [])
        .map((w) => String(w).toUpperCase().replace(/[^A-Z]/g, ''))
        .filter((w) => w.length >= 3)
    ),
  ];
  if (words.length < 3) {
    throw new Error('crossword.generate: need at least 3 words of length >= 3');
  }
  const clues = config.clues || {};

  const { grid, width, height, placements, dropped } = interlock(
    words,
    rand,
    separationForDifficulty(difficulty)
  );

  if (placements.length < 3) {
    const err = new Error('crossword.generate: too few words could be interlocked');
    err.retryable = true;
    throw err;
  }

  // numbers grid for the player view
  const numbers = Array.from({ length: height }, () => Array(width).fill(0));
  for (const p of placements) numbers[p.row][p.col] = p.number;

  const mkClue = (p) => ({
    number: p.number,
    answer: p.word,
    len: p.word.length,
    clue: clues[p.word] || `(${p.word.length} letters)`,
  });
  const across = placements.filter((p) => p.dir === 'A').sort((a, b) => a.number - b.number).map(mkClue);
  const down = placements.filter((p) => p.dir === 'D').sort((a, b) => a.number - b.number).map(mkClue);

  return {
    type: 'crossword',
    difficulty,
    theme: config.theme || null,
    title: config.title || (config.theme ? `${cap(config.theme)} Crossword` : 'Crossword'),
    instructions:
      config.instructions || 'Solve the clues and fill the grid. Numbers mark where each answer begins.',
    data: {
      width,
      height,
      numbers,
      // player grid: true = writable cell, false = block
      cells: grid.map((row) => row.map((ch) => ch != null)),
      across: across.map(({ number, clue, len }) => ({ number, clue, len })),
      down: down.map(({ number, clue, len }) => ({ number, clue, len })),
      droppedCount: dropped.length,
    },
    solution: {
      grid, // letters or null
      across: across.map(({ number, answer }) => ({ number, answer })),
      down: down.map(({ number, answer }) => ({ number, answer })),
      words: placements.map((p) => p.word),
      placements,
    },
  };
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { generate };
