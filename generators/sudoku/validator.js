/**
 * Sudoku — validate().
 *
 * Golden Standards:
 *   - the givens contain no row/column/box conflict
 *   - exactly one solution (verified by the solver, not trusted)
 *   - at least the minimum given clues for the difficulty
 *   - (soft) a medium/hard puzzle should not be solvable by naked singles
 *     alone — that would make it trivial
 */
const { solve, candidates, cloneGrid, N, BOX } = require('./solver');
const { DIFFICULTY } = require('../../config/defaults');

const TRIVIAL_PENALTY = 0.2;

// True if the givens have no immediate conflict.
function givensConsistent(givens) {
  const seenRow = Array.from({ length: N }, () => new Set());
  const seenCol = Array.from({ length: N }, () => new Set());
  const seenBox = Array.from({ length: N }, () => new Set());
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = givens[r][c];
      if (v === 0) continue;
      const b = Math.floor(r / BOX) * BOX + Math.floor(c / BOX);
      if (seenRow[r].has(v) || seenCol[c].has(v) || seenBox[b].has(v)) return false;
      seenRow[r].add(v);
      seenCol[c].add(v);
      seenBox[b].add(v);
    }
  }
  return true;
}

// True if the puzzle solves to completion using only naked singles (cells with
// exactly one candidate) — i.e. no deduction beyond the obvious is required.
function solvableByNakedSingles(givens) {
  const grid = cloneGrid(givens);
  let progress = true;
  while (progress) {
    progress = false;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (grid[r][c] !== 0) continue;
        const cands = candidates(grid, r, c);
        if (cands.length === 1) {
          grid[r][c] = cands[0];
          progress = true;
        }
      }
    }
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) if (grid[r][c] === 0) return false;
  }
  return true;
}

function countGivens(givens) {
  let n = 0;
  for (const row of givens) for (const v of row) if (v !== 0) n++;
  return n;
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { givens } = puzzle.data;
  const difficulty = puzzle.difficulty || 1;
  const preset = DIFFICULTY.sudoku[difficulty] || DIFFICULTY.sudoku[1];

  if (!givensConsistent(givens)) {
    errors.push('Givens contain a row, column, or box conflict.');
  }

  const givenCount = countGivens(givens);
  if (givenCount < preset.minGivens) {
    errors.push(
      `Too few givens (${givenCount}); difficulty "${preset.label}" requires at least ${preset.minGivens}.`
    );
  }

  // Uniqueness — only meaningful if the givens are consistent.
  if (errors.length === 0) {
    const { unique, solutionCount, solvable } = solve(puzzle);
    if (!solvable) {
      errors.push('Puzzle has no solution.');
    } else if (!unique) {
      errors.push(`Puzzle does not have a unique solution (found ${solutionCount}+).`);
    }
  }

  // Soft: a medium/hard puzzle solvable by naked singles alone is too easy.
  if (errors.length === 0 && difficulty >= 2 && solvableByNakedSingles(givens)) {
    warnings.push('Puzzle is solvable by naked singles alone — easier than its difficulty.');
    score -= TRIVIAL_PENALTY;
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate, givensConsistent, solvableByNakedSingles };
