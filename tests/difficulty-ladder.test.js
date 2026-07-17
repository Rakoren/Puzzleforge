'use strict';
// The kids difficulty ladder is a SEPARATE, gentler ramp — not the adult ladder
// with different labels. These tests lock in that the mechanics actually diverge.
const { test } = require('node:test');
const assert = require('node:assert');
const { generate } = require('../engine/generate');
const { assembleBook } = require('../engine/book');
const { presetFor, kidsWordMaxLen } = require('../config/defaults');

const ws = (lv, audience) => generate({ type: 'wordsearch', difficulty: lv, audience, words: ['CAT', 'DOG', 'FOX', 'OWL', 'BEE', 'ANT', 'HEN'], seed: 5 });
const mz = (lv, audience) => generate({ type: 'maze', difficulty: lv, audience, seed: 5 });

test('presetFor returns a gentler kids preset than the adult one', () => {
  for (const lv of [2, 3, 4]) {
    const a = presetFor('wordsearch', lv, 'adult');
    const k = presetFor('wordsearch', lv, 'kids');
    assert.ok(k.minSize < a.minSize, `WS L${lv}: kids minSize ${k.minSize} < adult ${a.minSize}`);
    const am = presetFor('maze', lv, 'adult');
    const km = presetFor('maze', lv, 'kids');
    assert.ok(km.width * km.height < am.width * am.height, `maze L${lv}: kids grid < adult`);
  }
});

test("kids top tier stays below the adult top tier's mechanics", () => {
  // Kids Independent (L4) maze is smaller than an adult HARD (L3) maze.
  const kids4 = presetFor('maze', 4, 'kids');
  const adult3 = presetFor('maze', 3, 'adult');
  assert.ok(kids4.width * kids4.height < adult3.width * adult3.height,
    `kids L4 (${kids4.width}x${kids4.height}) should be gentler than adult L3 (${adult3.width}x${adult3.height})`);
  // Kids word search never reaches the adult "dense" (crossing) separation.
  for (const lv of [1, 2, 3, 4]) {
    assert.notEqual(presetFor('wordsearch', lv, 'kids').separation, 'dense', `kids WS L${lv} not dense`);
  }
});

test('kids grids render smaller than adult grids at the same level', () => {
  for (const lv of [2, 3, 4]) {
    assert.ok(mz(lv, 'kids').data.width < mz(lv, 'adult').data.width, `maze L${lv} kids narrower`);
  }
  // A dense adult L4 word search is far larger than the kids L4.
  assert.ok(ws(4, 'kids').data.grid.length < ws(4, 'adult').data.grid.length);
});

test('sudoku is not offered to the youngest kids tiers, but is for older ones', () => {
  for (const lv of [1, 2]) {
    assert.throws(() => generate({ type: 'sudoku', difficulty: lv, audience: 'kids', seed: 1 }), /isn.t offered/i,
      `kids sudoku L${lv} should be rejected`);
  }
  const count = (p) => p.data.givens.flat().filter(Boolean).length;
  for (const lv of [3, 4]) {
    const k = generate({ type: 'sudoku', difficulty: lv, audience: 'kids', seed: 5 });
    const a = generate({ type: 'sudoku', difficulty: lv, audience: 'adult', seed: 5 });
    assert.ok(count(k) > count(a), `kids sudoku L${lv} has more givens (easier) than adult`);
  }
});

test('cipher never uses Morse for kids', () => {
  for (const lv of [1, 2, 3, 4]) {
    assert.ok(!presetFor('cipher', lv, 'kids').modes.includes('morse'), `kids cipher L${lv} has no Morse`);
  }
  assert.ok(presetFor('cipher', 3, 'adult').modes.includes('morse'), 'adults still get Morse');
});

test('kids auto-selected theme words respect the per-tier length cap', () => {
  assert.equal(kidsWordMaxLen(1, 'kids'), 5);
  assert.equal(kidsWordMaxLen(4, 'kids'), 8);
  assert.equal(kidsWordMaxLen(1, 'adult'), null);
  // A Beginner kids word search built from a theme hides only short words.
  const book = assembleBook({
    title: 'K', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'kids', theme: 'animals',
    answerKey: false, puzzles: [{ type: 'wordsearch', count: 1, difficulty: '1' }], seed: 3,
  });
  const words = book.puzzles[0].data.words;
  assert.ok(words.length > 0, 'puzzle still has words');
  assert.ok(words.every((w) => w.length <= 5), `all Beginner words ≤5 chars: ${words.join(',')}`);
});

test('custom words are never dropped by the kids length cap', () => {
  // A publisher who types a long word (PRINCESS) keeps it, even in a kids book.
  const book = assembleBook({
    title: 'K2', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'kids',
    answerKey: false, seed: 3,
    puzzles: [{ type: 'wordsearch', count: 1, difficulty: '1', theme: 'Castle', words: ['PRINCESS', 'KING', 'CROWN'] }],
  });
  assert.ok(book.puzzles[0].data.words.includes('PRINCESS'), 'hand-typed long word survives');
});
