/**
 * Mini Sudoku (6×6) — generate().
 *
 * A gentler sudoku on a 6×6 grid with 2×3 boxes, using digits 1–6. Same
 * unique-solution guarantee as full sudoku, sized for younger solvers. Built on
 * the shared parameterized sudoku core.
 */
const { presetFor } = require('../../config/defaults');
const { makeSudokuCore } = require('../shared/sudokucore');

const core = makeSudokuCore({ N: 6, boxR: 2, boxC: 3 });

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('minisudoku', difficulty, config.audience) || { givens: 16 };
  const target = config.givens || preset.givens;

  const solution = core.buildSolution(rand);
  const { givens, givenCount } = core.digGivens(solution, target, rand, { symmetric: config.symmetric !== false });

  return {
    type: 'minisudoku',
    difficulty,
    theme: null,
    title: config.title || 'Mini Sudoku',
    instructions: config.instructions || 'Fill the grid so every row, column, and 2×3 box contains 1–6.',
    data: { size: 6, boxR: 2, boxC: 3, givens, givenCount },
    solution: { grid: solution },
  };
}

module.exports = { generate };
