/**
 * Nonogram (Picross) — generate().
 *
 * Builds a random filled-cell "picture", derives the row and column clues, and
 * keeps the puzzle only if those clues yield a unique solution. Generation
 * draws fresh pictures until a uniquely-solvable one is found (bounded); if
 * none is found the engine retries.
 *
 * Config:
 *   difficulty 1|2|3   selects grid size and fill density
 *   size       number  optional explicit square size
 */
const { presetFor } = require('../../config/defaults');
const { countSolutions, clueOf } = require('./solver');

const INNER_TRIES = 40;

function randomPicture(size, fill, rand) {
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => rand() < fill)
  );
  // Avoid wholly empty rows/columns — they make dull, ambiguous puzzles.
  for (let r = 0; r < size; r++) {
    if (grid[r].every((v) => !v)) grid[r][Math.floor(rand() * size)] = true;
  }
  for (let c = 0; c < size; c++) {
    let any = false;
    for (let r = 0; r < size; r++) any = any || grid[r][c];
    if (!any) grid[Math.floor(rand() * size)][c] = true;
  }
  return grid;
}

function rowCluesOf(grid) {
  return grid.map((row) => clueOf(row));
}
function colCluesOf(grid, size) {
  const cols = [];
  for (let c = 0; c < size; c++) {
    const col = [];
    for (let r = 0; r < size; r++) col.push(grid[r][c]);
    cols.push(clueOf(col));
  }
  return cols;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('nonogram', difficulty, config.audience);
  const size = config.size || preset.size;
  const fill = config.fill || preset.fill;

  let solution = null;
  let rowClues = null;
  let colClues = null;

  for (let attempt = 0; attempt < INNER_TRIES; attempt++) {
    const grid = randomPicture(size, fill, rand);
    const rc = rowCluesOf(grid);
    const cc = colCluesOf(grid, size);
    if (countSolutions(rc, cc, size, size, 2) === 1) {
      solution = grid;
      rowClues = rc;
      colClues = cc;
      break;
    }
  }

  if (!solution) {
    const err = new Error(`nonogram.generate: no unique ${size}x${size} picture found`);
    err.retryable = true;
    throw err;
  }

  return {
    type: 'nonogram',
    difficulty,
    theme: null,
    title: config.title || `Nonogram — ${cap(preset.label)}`,
    instructions:
      config.instructions ||
      'Use the number clues to fill the grid. Each clue lists the lengths of the filled blocks in that row or column, in order.',
    data: {
      width: size,
      height: size,
      rowClues,
      colClues,
    },
    solution: {
      grid: solution,
    },
  };
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { generate, rowCluesOf, colCluesOf };
