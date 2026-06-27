/**
 * Kriss-Kross (Fill-In) — generate().
 *
 * Interlocks a word list into a single grid, exactly like the crossword, but
 * the player is given the full word bank (grouped by length) and an empty grid
 * to fit them into — no clues. Optionally one starter letter is revealed.
 *
 * Config:
 *   words       string[]  required (or supplied via theme by the book pipeline)
 *   difficulty  1|2|3      1 reveals a starter letter, 3 reveals none
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
  if (words.length < 4) {
    throw new Error('krisskross.generate: need at least 4 words of length >= 3');
  }

  const { grid, width, height, placements, dropped } = interlock(
    words,
    rand,
    separationForDifficulty(difficulty)
  );
  if (placements.length < 4) {
    const err = new Error('krisskross.generate: too few words could be interlocked');
    err.retryable = true;
    throw err;
  }

  const placedWords = placements.map((p) => p.word);

  // Word bank grouped by length, alphabetized within each group.
  const byLength = {};
  for (const w of placedWords) {
    (byLength[w.length] = byLength[w.length] || []).push(w);
  }
  const wordBank = Object.keys(byLength)
    .map(Number)
    .sort((a, b) => a - b)
    .map((len) => ({ len, words: byLength[len].sort() }));

  // Reveal a starter letter at difficulty 1: pick a crossing cell.
  let starter = null;
  if (difficulty === 1) {
    const crossingCell = placements
      .flatMap((p) => p.cells)
      .find(([r, c]) => {
        const up = r > 0 && grid[r - 1][c] != null;
        const dn = r + 1 < height && grid[r + 1][c] != null;
        const lf = c > 0 && grid[r][c - 1] != null;
        const rt = c + 1 < width && grid[r][c + 1] != null;
        return (up || dn) && (lf || rt);
      });
    if (crossingCell) {
      const [r, c] = crossingCell;
      starter = { row: r, col: c, letter: grid[r][c] };
    }
  }

  return {
    type: 'krisskross',
    difficulty,
    theme: config.theme || null,
    title: config.title || (config.theme ? `${cap(config.theme)} Kriss-Kross` : 'Kriss-Kross'),
    instructions:
      config.instructions || 'Fit every word from the list into the grid. Each word is used once.',
    data: {
      width,
      height,
      cells: grid.map((row) => row.map((ch) => ch != null)),
      wordBank,
      starter,
      droppedCount: dropped.length,
    },
    solution: {
      grid,
      words: placedWords,
      placements,
    },
  };
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { generate };
