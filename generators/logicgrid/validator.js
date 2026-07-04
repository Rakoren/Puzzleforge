/**
 * Logic Grid — validate().
 *
 * Golden Standards:
 *   - every clue is true under the stored solution (clues never lie)
 *   - the clue set yields exactly one solution (the puzzle is fair & solvable)
 *   - the grid is well-formed (square, distinct values, keys line up)
 *   - clue text is clean (offensive filter)
 * Soft signals nudge the score toward puzzles that aren't trivially short or
 * bloated with clues.
 */
const { enumerate } = require('./solver');
const offensive = require('../../filters/offensive');

function entityOf(rows, cats, c, v) {
  const key = cats[c].key;
  return rows.findIndex((r) => String(r[key]) === String(v));
}

function clueHoldsUnderSolution(rows, cats, clue) {
  const ordIdx = cats.findIndex((c) => c.kind === 'ordinal');
  const iA = entityOf(rows, cats, clue.ca, clue.va);
  const iB = entityOf(rows, cats, clue.cb, clue.vb);
  if (iA < 0 || iB < 0) return false;
  const ordVal = (i) => (ordIdx >= 0 ? Number(rows[i][cats[ordIdx].key]) : 0);
  switch (clue.kind) {
    case 'same': return iA === iB;
    case 'diff': return iA !== iB;
    case 'gt': return ordVal(iA) > ordVal(iB);
    case 'delta': return ordVal(iA) - ordVal(iB) === clue.n;
    default: return false;
  }
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const cats = puzzle.data.categories;
  const clues = puzzle.data.clues;
  const rows = puzzle.solution.rows;
  const N = cats[0].values.length;

  // Shape: square grid, ≥ 2 categories, distinct values, rows line up.
  if (cats.length < 2) errors.push('A logic grid needs at least two categories.');
  for (const c of cats) {
    if (c.values.length !== N) errors.push(`Category "${c.label}" has ${c.values.length} values; expected ${N}.`);
    if (new Set(c.values.map(String)).size !== c.values.length) errors.push(`Category "${c.label}" has duplicate values.`);
  }
  if (rows.length !== N) errors.push(`Solution has ${rows.length} rows; expected ${N}.`);

  // Every clue must be true under the stored solution.
  for (const clue of clues) {
    if (!clueHoldsUnderSolution(rows, cats, clue)) {
      errors.push(`Clue ${clue.index} ("${clue.text}") is not consistent with the solution.`);
    }
  }

  // Exactly one solution.
  const solverCats = cats.map((c) => ({ key: c.key, kind: c.kind, values: c.values.slice() }));
  const { count, overBudget } = enumerate(solverCats, clues, { limit: 2 });
  if (overBudget) errors.push('Solver could not confirm uniqueness within its budget.');
  else if (count === 0) errors.push('No solution satisfies the clues.');
  else if (count > 1) errors.push('The clues allow more than one solution.');

  // Content.
  const hits = offensive.scanText(clues.map((c) => c.text).join(' '));
  if (hits.length) errors.push(`Offensive content in clues: ${hits.join(', ')}.`);

  // Soft: too few or too many clues for the grid size.
  if (clues.length < N) { warnings.push('Very few clues for this grid.'); score -= 0.05; }
  if (clues.length > N * N) { warnings.push('More clues than needed.'); score -= 0.1; }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate, clueHoldsUnderSolution };
