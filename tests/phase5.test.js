'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { generate } = require('../engine/generate');
const { renderPuzzleHtml } = require('../engine/export');
const { listTypes } = require('../generators/registry');
const { checkSeparation, findToken } = require('../generators/shared/gridsearch');

test('number search and trivia are registered (ten puzzle types + activity pages)', () => {
  const types = listTypes();
  assert.ok(types.includes('numbersearch'));
  assert.ok(types.includes('trivia'));
  // Ten puzzle types plus the three kids-book activity pages.
  assert.ok(types.includes('coloring'));
  assert.ok(types.includes('drawing'));
  assert.ok(types.includes('bleedguard'));
  assert.equal(types.length, 13);
});

// --- Number Search ---
test('number search hides every listed number with the right separation', () => {
  const easy = generate({ type: 'numbersearch', difficulty: 1 });
  assert.equal(easy.data.separation, 'isolated');
  const sep = checkSeparation(easy.solution.placements, 'isolated');
  assert.equal(sep.shared, 0);
  assert.equal(sep.touching, 0);
  for (const n of easy.data.numbers) {
    assert.ok(findToken(easy.data.grid, n).length >= 1, `${n} is in the grid`);
  }
});

test('number search respects a custom number list', () => {
  const p = generate({ type: 'numbersearch', numbers: ['111', '222', '333', '444'], difficulty: 2 });
  assert.deepEqual(p.data.numbers, ['111', '222', '333', '444']);
});

test('word search still works after sharing the grid-search core', () => {
  const p = generate({ type: 'wordsearch', words: ['CAT', 'DOG', 'FOX', 'OWL'], difficulty: 1 });
  const { missing } = require('../generators/wordsearch/solver').solve(p);
  assert.deepEqual(missing, []);
});

// --- Trivia ---
test('trivia generates a quiz with matching answers', () => {
  const p = generate({ type: 'trivia', difficulty: 2 });
  assert.ok(p.data.questions.length >= 5);
  assert.equal(p.data.questions.length, p.solution.answers.length);
  for (const a of p.solution.answers) assert.ok(a && a.length, 'answer is non-empty');
});

test('trivia accepts custom questions', () => {
  const questions = [
    { q: 'Q1?', a: 'A1' }, { q: 'Q2?', a: 'A2' }, { q: 'Q3?', a: 'A3' },
    { q: 'Q4?', a: 'A4' }, { q: 'Q5?', a: 'A5' }, { q: 'Q6?', a: 'A6' },
  ];
  const p = generate({ type: 'trivia', questions, count: 6, difficulty: 1 });
  assert.equal(p.data.questions.length, 6);
});

test('trivia validator rejects too few questions', () => {
  const { validate } = require('../generators/trivia/validator');
  const fake = {
    type: 'trivia',
    data: { questions: [{ q: 'only one?' }] },
    solution: { answers: ['yes'] },
  };
  assert.equal(validate(fake).valid, false);
});

test('new types render print HTML with answer views', () => {
  for (const cfg of [{ type: 'numbersearch', difficulty: 1 }, { type: 'trivia', difficulty: 1 }]) {
    const p = generate(cfg);
    const puzzle = renderPuzzleHtml(p, { trimSize: '8.5x11', answerKey: false });
    const answer = renderPuzzleHtml(p, { trimSize: '8.5x11', answerKey: true });
    assert.match(puzzle, /size: 8\.5in 11in/);
    assert.match(answer, /Answer Key/);
  }
});
