'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { generate } = require('../engine/generate');
const { renderPuzzleHtml } = require('../engine/export');
const { validate } = require('../generators/nonogram/validator');
const { solve, countSolutions, clueOf, rowArrangements } = require('../generators/nonogram/solver');
const { rowCluesOf, colCluesOf } = require('../generators/nonogram');

test('clueOf computes run lengths', () => {
  assert.deepEqual(clueOf([true, true, false, true]), [2, 1]);
  assert.deepEqual(clueOf([false, false, false]), [0]);
  assert.deepEqual(clueOf([true, true, true]), [3]);
});

test('rowArrangements enumerates legal rows for a clue', () => {
  const opts = rowArrangements([1, 1], 4); // two single blocks in width 4
  // patterns: X.X. , X..X , .X.X
  assert.equal(opts.length, 3);
  for (const o of opts) assert.deepEqual(clueOf(o), [1, 1]);
});

test('generates a unique-solution nonogram at each difficulty', () => {
  for (const d of [1, 2, 3]) {
    const p = generate({ type: 'nonogram', difficulty: d });
    const { unique } = solve(p);
    assert.ok(unique, `difficulty ${d} is uniquely solvable`);
    assert.equal(p.data.width, p.data.height);
  }
});

test('clues describe the solution grid', () => {
  const p = generate({ type: 'nonogram', difficulty: 2 });
  assert.deepEqual(rowCluesOf(p.solution.grid), p.data.rowClues);
  assert.deepEqual(colCluesOf(p.solution.grid, p.data.width), p.data.colClues);
});

test('validator rejects a non-unique puzzle (all clues zero)', () => {
  const size = 4;
  const zero = Array.from({ length: size }, () => [0]);
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  const fake = {
    type: 'nonogram',
    difficulty: 1,
    data: { width: size, height: size, rowClues: zero, colClues: zero },
    solution: { grid },
  };
  const res = validate(fake);
  assert.equal(res.valid, false);
});

test('countSolutions finds exactly one for a generated puzzle', () => {
  const p = generate({ type: 'nonogram', difficulty: 1 });
  assert.equal(countSolutions(p.data.rowClues, p.data.colClues, p.data.width, p.data.height, 2), 1);
});

test('renders print HTML sized to the trim with an answer view', () => {
  const p = generate({ type: 'nonogram', difficulty: 1 });
  const html = renderPuzzleHtml(p, { trimSize: '8.5x11', answerKey: true });
  assert.match(html, /table class="nono"/);
  assert.match(html, /size: 8\.5in 11in/);
});
