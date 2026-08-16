/**
 * Even-Odd Sudoku (9×9) — generate().
 *
 * Standard sudoku with an extra rule: shaded cells must hold an even digit and
 * unshaded cells an odd digit. The parity pattern comes from a valid solution
 * (shade its even cells), and the shared sudoku core enforces the parity while
 * digging clues — so the puzzle is uniquely solvable using the shading.
 */
const { presetFor } = require('../../config/defaults');
const { makeSudokuCore } = require('../shared/sudokucore');

const plain = makeSudokuCore({ N: 9, boxR: 3, boxC: 3 });

// A core whose candidate check also enforces parity: shaded → even, else odd.
function evenOddCore(shaded) {
  return makeSudokuCore({
    N: 9, boxR: 3, boxC: 3,
    extraUsed: (grid, r, c, used) => {
      const mustBeEven = shaded.has(r * 9 + c);
      for (let v = 1; v <= 9; v++) {
        if (mustBeEven && v % 2 === 1) used.add(v);   // shaded cell can't be odd
        if (!mustBeEven && v % 2 === 0) used.add(v);   // unshaded cell can't be even
      }
    },
  });
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('evenodd', difficulty, config.audience) || { givens: 28 };
  const target = config.givens || preset.givens;

  const solution = plain.buildSolution(rand);
  const shaded = new Set();
  const shadedGrid = Array.from({ length: 9 }, () => Array(9).fill(false));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (solution[r][c] % 2 === 0) { shaded.add(r * 9 + c); shadedGrid[r][c] = true; }
    }
  }

  const core = evenOddCore(shaded);
  const { givens, givenCount } = core.digGivens(solution, target, rand, { symmetric: config.symmetric !== false });

  return {
    type: 'evenodd',
    difficulty,
    theme: null,
    title: config.title || 'Even-Odd Sudoku',
    instructions: config.instructions ||
      'Fill the grid with 1–9 by row, column, and 3×3 box. Shaded cells must be EVEN (2,4,6,8); unshaded cells must be ODD (1,3,5,7,9).',
    data: { size: 9, givens, shaded: shadedGrid, givenCount },
    solution: { grid: solution },
  };
}

module.exports = { generate, evenOddCore };
