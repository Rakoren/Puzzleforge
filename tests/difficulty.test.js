'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const diff = require('../config/difficulty');
const { generate } = require('../engine/generate');
const { assembleBook } = require('../engine/book');
const { runChecklist } = require('../engine/checklist');

test('adult labels are Easy/Medium/Hard/Expert', () => {
  assert.equal(diff.difficultyLabel(1, 'adult'), 'Easy');
  assert.equal(diff.difficultyLabel(2, 'adult'), 'Medium');
  assert.equal(diff.difficultyLabel(3, 'adult'), 'Hard');
  assert.equal(diff.difficultyLabel(4, 'adult'), 'Expert');
});

test('kids labels carry age range + grade', () => {
  const t = diff.difficultyTier(1, 'kids');
  assert.equal(t.label, 'Beginner');
  assert.equal(t.ages, '4–6');
  assert.equal(t.grade, 'Pre-K – K');
  assert.equal(diff.difficultyTier(4, 'kids').label, 'Independent');
  assert.match(diff.difficultyLabel(3, 'kids'), /Growing Reader.*8–10.*Grades 3–4/);
});

test('level clamps to 1–4 and options cover every level', () => {
  assert.equal(diff.clampLevel(0), 1);
  assert.equal(diff.clampLevel(9), 4);
  assert.equal(diff.levelOptions('adult').length, 4);
  assert.equal(diff.levelOptions('kids').length, 4);
  assert.equal(diff.levelOptions('kids')[3].ages, '10–12');
});

test('Expert (level 4) is a real, harder tier — word search grows, sudoku digs deeper', () => {
  const words = ['cat', 'dog', 'fox', 'bear', 'lion', 'tiger', 'zebra', 'panda', 'koala', 'otter', 'rabbit', 'monkey'];
  const ws = generate({ type: 'wordsearch', difficulty: 4, words, seed: 5 });
  assert.ok(ws.data.size >= 20, `expert word search grid ${ws.data.size} should be ≥20`);
  assert.equal(ws.data.allowBackwards, true);

  // Average given-count: expert should be lower than hard.
  const avg = (d) => {
    let sum = 0; for (let s = 1; s <= 6; s++) sum += generate({ type: 'sudoku', difficulty: d, seed: s }).data.givenCount;
    return sum / 6;
  };
  assert.ok(avg(4) < avg(3), 'expert sudoku should average fewer givens than hard');
});

test('every playable type generates at Expert (no fallback to easy)', () => {
  const words = ['cat', 'dog', 'fox', 'bear', 'lion', 'tiger', 'zebra', 'panda', 'koala', 'otter', 'rabbit', 'monkey'];
  const wordy = new Set(['wordsearch', 'wordscramble', 'crossword', 'krisskross']);
  for (const type of ['maze', 'cryptogram', 'numbersearch', 'trivia', 'logicgrid', 'wordladder', ...wordy]) {
    const cfg = { type, difficulty: 4, seed: 2 };
    if (wordy.has(type)) cfg.words = words;
    const p = generate(cfg);
    assert.equal(p.difficulty, 4, `${type} kept difficulty 4`);
  }
});

test('checklist flags an audience/reading-age mismatch and passes when coherent', () => {
  const base = { title: 'B', puzzleforgeBook: 1, trimSize: '8.5x11', answerKey: true, puzzles: [{ type: 'sudoku', count: 2, difficulty: '2' }] };
  const item = (book) => runChecklist(book).items.find((i) => i.id === 'difficulty-audience');

  // Kids audience but "Adult" reading age → warning.
  const bad = assembleBook({ ...base, audience: 'kids', metadata: { readingAge: 'Adult' } });
  assert.equal(item(bad).status, 'fail');

  // Coherent adult book → pass.
  const good = assembleBook({ ...base, audience: 'adult', metadata: { readingAge: 'Adult' } });
  assert.equal(item(good).status, 'pass');

  // Coherent kids book → pass.
  const kids = assembleBook({ ...base, audience: 'kids', metadata: { readingAge: '6-9' } });
  assert.equal(item(kids).status, 'pass');
});
