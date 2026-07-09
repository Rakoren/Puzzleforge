'use strict';
// Themes carry four vocabulary tiers (matching the four difficulty levels) and
// an `audiences` field. Word selection is audience-aware: adults reach the
// hardest tier at Expert; kids stay in the easier tiers with a length cap.
const { test } = require('node:test');
const assert = require('node:assert');
const themes = require('../themes');
const { assembleBook } = require('../engine/book');

const BUILT_INS = ['animals', 'body', 'food', 'jobs', 'ocean', 'space', 'sports', 'transport', 'weather'];
const wordOf = (e) => (typeof e === 'string' ? e : e.word);

test('every built-in theme has four non-empty tiers and an audiences field', () => {
  for (const id of BUILT_INS) {
    const t = themes.loadTheme(id);
    assert.deepEqual(t.audiences, ['kids', 'adult'], `${id} suits both audiences`);
    for (const tier of ['1', '2', '3', '4']) {
      assert.ok(t.tiers[tier] && t.tiers[tier].length > 0, `${id} tier ${tier} is non-empty`);
    }
  }
});

test('the Expert tier (4) is harder vocabulary than Hard (3)', () => {
  const avgLen = (entries) => entries.reduce((s, e) => s + wordOf(e).length, 0) / entries.length;
  for (const id of BUILT_INS) {
    const t = themes.loadTheme(id);
    assert.ok(avgLen(t.tiers['4']) > avgLen(t.tiers['3']),
      `${id}: tier-4 words average longer than tier-3`);
  }
});

test('selectWords can pull the exact fourth tier', () => {
  const t = themes.loadTheme('animals');
  const tier4Words = new Set(t.tiers['4'].map(wordOf));
  const picked = themes.selectWords(t, { difficulty: 4, count: 10 });
  assert.ok(picked.length > 0);
  assert.ok(picked.every((w) => tier4Words.has(w)), 'difficulty:4 draws only tier-4 words');
});

test('maxLength drops words longer than the cap', () => {
  const t = themes.loadTheme('animals');
  const short = themes.selectWords(t, { maxDifficulty: 4, maxLength: 5, count: 40 });
  assert.ok(short.length > 0);
  assert.ok(short.every((w) => w.length <= 5), 'every word within the cap');
});

test('adult Expert draws the hardest tier; kids Independent never does', () => {
  const t = themes.loadTheme('animals');
  const tier4 = new Set(t.tiers['4'].map(wordOf));
  const bookWords = (audience, level) => assembleBook({
    title: 'T', audience, trimSize: '8.5x11', theme: 'animals', answerKey: false, seed: 5,
    puzzles: [{ type: 'wordsearch', difficulty: String(level), count: 1 }],
  }).puzzles[0].data.words;

  // Adult Expert reaches into tier 4.
  const adultExpert = bookWords('adult', 4);
  assert.ok(adultExpert.some((w) => tier4.has(w)), 'adult Expert includes tier-4 vocabulary');

  // Kids Independent never uses tier 4, and stays within the length cap (≤8).
  const kidsTop = bookWords('kids', 4);
  assert.ok(kidsTop.every((w) => !tier4.has(w)), 'kids never draw the Expert tier');
  assert.ok(kidsTop.every((w) => w.length <= 8), 'kids Independent words within the cap');
});

test('adult Hard (L3) and Expert (L4) pull different vocabulary', () => {
  const words = (level) => new Set(assembleBook({
    title: 'T', audience: 'adult', trimSize: '8.5x11', theme: 'animals', answerKey: false, seed: 9,
    puzzles: [{ type: 'wordsearch', difficulty: String(level), count: 1 }],
  }).puzzles[0].data.words);
  const hard = words(3);
  const expert = words(4);
  // The Expert set is not merely a subset/dup of Hard.
  const overlap = [...expert].filter((w) => hard.has(w)).length;
  assert.ok(overlap < expert.size, 'Expert introduces words Hard did not use');
});
