'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { generate } = require('../engine/generate');
const { validate } = require('../generators/sudoku/validator');
const { solve, countSolutions } = require('../generators/sudoku/solver');
const { DIFFICULTY } = require('../config/defaults');

test('generates a unique-solution sudoku at each difficulty', () => {
  for (const d of [1, 2, 3]) {
    const puzzle = generate({ type: 'sudoku', difficulty: d });
    const { unique, solvable } = solve(puzzle);
    assert.ok(solvable, `difficulty ${d} is solvable`);
    assert.ok(unique, `difficulty ${d} has a unique solution`);
  }
});

test('respects the minimum given count for its difficulty', () => {
  for (const d of [1, 2, 3]) {
    const puzzle = generate({ type: 'sudoku', difficulty: d });
    assert.ok(
      puzzle.data.givenCount >= DIFFICULTY.sudoku[d].minGivens,
      `difficulty ${d} keeps at least the minimum givens`
    );
  }
});

test('the generator solution matches the unique solver solution', () => {
  const puzzle = generate({ type: 'sudoku', difficulty: 1 });
  const { solution } = solve(puzzle);
  assert.deepEqual(solution, puzzle.solution.grid);
});

test('validator rejects a non-unique puzzle (empty grid)', () => {
  const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
  const fake = {
    type: 'sudoku',
    difficulty: 1,
    data: { size: 9, box: 3, givens: empty },
    solution: { grid: empty },
  };
  const res = validate(fake);
  assert.equal(res.valid, false);
});

test('countSolutions caps at 2 for an under-constrained grid', () => {
  const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
  assert.equal(countSolutions(empty, 2), 2);
});
