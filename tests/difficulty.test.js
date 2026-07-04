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

test('summarizeLevels reports range, counts, and a label', () => {
  const s = diff.summarizeLevels([1, 3, 3, 2], 'adult');
  assert.equal(s.min, 1);
  assert.equal(s.max, 3);
  assert.deepEqual(s.counts, { 1: 1, 2: 1, 3: 2 });
  assert.equal(s.rangeLabel, 'Easy to Hard');
  assert.equal(diff.summarizeLevels([2, 2], 'adult').rangeLabel, 'Medium');
  assert.match(diff.summarizeLevels([1, 3], 'kids').rangeLabel, /Beginner to Growing Reader \(Ages 4–10\)/);
});

test('badgeText: adult stars, kids tier + age', () => {
  assert.equal(diff.badgeText(2, 'adult'), '★★☆☆ Medium');
  assert.equal(diff.badgeText(4, 'adult'), '★★★★ Expert');
  assert.equal(diff.badgeText(3, 'kids'), 'Growing Reader · 8–10');
});

test('assembled book carries a difficulty summary and can label each page', () => {
  const { renderBookHtml } = require('../engine/export');
  const book = assembleBook({
    title: 'Mixed', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', answerKey: false,
    perPageDifficulty: true, puzzles: [{ type: 'sudoku', count: 1, difficulty: '1' }, { type: 'sudoku', count: 1, difficulty: '3' }], seed: 2,
  });
  assert.equal(book.meta.difficulty.min, 1);
  assert.equal(book.meta.difficulty.max, 3);
  assert.equal(book.meta.difficulty.rangeLabel, 'Easy to Hard');
  const html = renderBookHtml(book);
  assert.match(html, /pf-difficulty/); // per-page badge injected
  assert.ok((html.match(/★/g) || []).length >= 4);
});

test('checklist reports the difficulty range as an info row', () => {
  const book = assembleBook({
    title: 'B', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', answerKey: true,
    puzzles: [{ type: 'sudoku', count: 2, difficulty: '2' }],
  });
  const item = runChecklist(book).items.find((i) => i.id === 'difficulty-range');
  assert.ok(item && item.status === 'pass');
  assert.match(item.label, /Difficulty: Medium/);
});

test('cover renders optional difficulty text on the front', () => {
  const { renderCoverHtml } = require('../engine/cover');
  const cover = renderCoverHtml({ trimSize: '8.5x11', pageCount: 100, title: 'X', difficulty: 'Easy to Hard · Large Print' });
  assert.match(cover.html, /cover-diff/);
  assert.match(cover.html, /Easy to Hard · Large Print/);
});
