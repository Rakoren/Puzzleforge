'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { generate } = require('../engine/generate');
const wordsearch = require('../generators/wordsearch');
const { validate } = require('../generators/wordsearch/validator');
const { solve } = require('../generators/wordsearch/solver');
const { renderPuzzleHtml } = require('../engine/export');
const { getLayout } = require('../layouts');
const offensive = require('../filters/offensive');
const themes = require('../themes');

test('engine generates a valid word search from a theme', () => {
  const theme = themes.loadTheme('animals');
  const words = themes.selectWords(theme, { difficulty: 1, count: 12 });
  const puzzle = generate({ type: 'wordsearch', theme: 'animals', words, difficulty: 1 });

  assert.equal(puzzle.type, 'wordsearch');
  assert.ok(puzzle.id, 'has an id');
  assert.ok(puzzle.meta.validationScore >= 0.85, 'meets the accept threshold');
  assert.equal(puzzle.data.grid.length, puzzle.data.size);
});

test('every target word is findable and the grid is full', () => {
  const puzzle = generate({
    type: 'wordsearch',
    words: ['CAT', 'DOG', 'FOX', 'BEAR', 'LION'],
    difficulty: 2,
  });
  const { missing } = solve(puzzle);
  assert.deepEqual(missing, [], 'no missing words');

  for (const row of puzzle.data.grid) {
    for (const cell of row) {
      assert.ok(cell && /[A-Z]/.test(cell), 'cell is a letter');
    }
  }
});

test('difficulty 1 uses only orthogonal directions', () => {
  const puzzle = generate({
    type: 'wordsearch',
    words: ['CAT', 'DOG', 'FOX', 'OWL', 'BEE'],
    difficulty: 1,
  });
  for (const p of puzzle.solution.placements) {
    const orthogonal = (p.dr === 0 || p.dc === 0);
    assert.ok(orthogonal, `placement of ${p.word} is orthogonal`);
    assert.ok(p.dr >= 0 && p.dc >= 0, `placement of ${p.word} is forward-only`);
  }
});

test('easy word search keeps words isolated; harder allows touching', () => {
  const { checkSeparation } = require('../generators/wordsearch/validator');
  const words = ['BEAR', 'LION', 'TIGER', 'ZEBRA', 'HORSE', 'EAGLE', 'SHARK'];

  const easy = generate({ type: 'wordsearch', words, difficulty: 1 });
  assert.equal(easy.data.separation, 'isolated');
  const e = checkSeparation(easy.solution.placements, 'isolated');
  assert.equal(e.shared, 0, 'no shared letters on easy');
  assert.equal(e.touching, 0, 'no touching words on easy');

  const medium = generate({ type: 'wordsearch', words, difficulty: 2 });
  assert.equal(medium.data.separation, 'noCross');
  assert.equal(checkSeparation(medium.solution.placements, 'noCross').shared, 0, 'no crossings on medium');
});

test('validator rejects an unfilled grid', () => {
  const puzzle = generate({ type: 'wordsearch', words: ['CAT', 'DOG', 'FOX'], difficulty: 1 });
  puzzle.data.grid[0][0] = null;
  const res = validate(puzzle);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /not fully filled/i.test(e)));
});

test('validator flags a substring relationship between target words', () => {
  // CAT is a substring of CATFISH — must be caught even before placement.
  assert.throws(
    () => generate({ type: 'wordsearch', words: ['CAT', 'CATFISH', 'DOG'], difficulty: 1 }),
    /substring|could not/i
  );
});

test('offensive filter is non-bypassable and catches blocked words', () => {
  assert.equal(offensive.isOffensiveWord('shit'), true);
  assert.equal(offensive.isOffensiveWord('SHIT'), true);
  assert.equal(offensive.isOffensiveWord('animal'), false);
  assert.ok(offensive.findOffensiveSubstrings('xxshitxx').includes('shit'));
});

test('engine surfaces a clear error for an impossible config', () => {
  assert.throws(
    () => generate({ type: 'wordsearch', words: ['ELEPHANT'], size: 4 }),
    /exceeds grid size/
  );
});

test('renderer produces print HTML sized to the trim', () => {
  const puzzle = generate({ type: 'wordsearch', words: ['CAT', 'DOG', 'FOX'], difficulty: 1 });
  const html = renderPuzzleHtml(puzzle, { trimSize: '8x10', audience: 'kids' });
  assert.match(html, /<table class="grid">/);
  assert.match(html, /size: 8in 10in/);
  assert.match(html, /Words to Find/);
});

test('layout resolves usable dimensions and cell sizing', () => {
  const layout = getLayout('8.5x11', { audience: 'adult' });
  assert.ok(layout.usableWidth > 0 && layout.usableHeight > 0);
  const cell = layout.cellSizeFor(15, 100);
  assert.ok(cell >= 12, 'cell size respects the floor');
});
