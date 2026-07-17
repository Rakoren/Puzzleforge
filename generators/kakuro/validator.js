/**
 * Kakuro — validate().
 * Golden Standards: the stored solution obeys every run's sum and distinctness
 * rule, matches the clue on each entry, uses only 1–9 in white cells, and the
 * clues force exactly one solution.
 */
const { acrossEntries, downEntries, countSolutions } = require('./core');

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  const { rows, cols, grid } = puzzle.data;
  const sol = puzzle.solution.grid;

  // Every white cell holds a digit 1–9; every clue cell holds 0 in the solution.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].t === 'fill') {
        const v = sol[r][c];
        if (!Number.isInteger(v) || v < 1 || v > 9) errors.push(`Cell ${r},${c} is not a digit 1–9.`);
      } else if (sol[r][c] !== 0) {
        errors.push(`Clue cell ${r},${c} should be blank in the solution.`);
      }
    }
  }

  const checkEntries = (entries, sumKey, label) => {
    for (const e of entries) {
      const [cr, cc] = e.clue;
      const target = grid[cr][cc][sumKey];
      if (typeof target !== 'number') { errors.push(`Missing ${label} clue at ${cr},${cc}.`); continue; }
      const vals = e.cells.map(([r, c]) => sol[r][c]);
      const sum = vals.reduce((s, v) => s + v, 0);
      if (sum !== target) errors.push(`${label} run at ${cr},${cc} sums to ${sum}, clue says ${target}.`);
      if (new Set(vals).size !== vals.length) errors.push(`${label} run at ${cr},${cc} repeats a digit.`);
    }
  };
  checkEntries(acrossEntries(grid, rows, cols), 'right', 'Across');
  checkEntries(downEntries(grid, rows, cols), 'down', 'Down');

  if (countSolutions(grid, rows, cols, 2) !== 1) errors.push('Puzzle does not have a unique solution.');

  return { valid: errors.length === 0, errors, warnings, score: errors.length === 0 ? 1 : 0 };
}

module.exports = { validate };
