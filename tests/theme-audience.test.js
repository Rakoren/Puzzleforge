'use strict';
// Themes carry four vocabulary tiers (matching the four difficulty levels) and
// an `audiences` field. Word selection is audience-aware: adults reach the
// hardest tier at Expert; kids stay in the easier tiers with a length cap.
const { test } = require('node:test');
const assert = require('node:assert');
const themes = require('../themes');
const { assembleBook } = require('../engine/book');

const BUILT_INS = ['animals', 'body', 'food', 'jobs', 'ocean', 'space', 'sports', 'transport', 'weather'];

test('splitTheme makes Kids + Adult variants from a Both theme and keeps the original', () => {
  const fs = require('fs');
  const path = require('path');
  const themegen = require('../puzzleforge-web/themegen');
  const dir = themes.THEME_DIR;
  const srcFile = path.join(dir, '__probe_split_test.json');
  const w = (e) => (typeof e === 'string' ? e : e.word);
  const clean = (ids) => ids.forEach((id) => { const f = path.join(dir, `${id}.json`); if (fs.existsSync(f)) fs.unlinkSync(f); });

  fs.writeFileSync(srcFile, JSON.stringify({
    id: '__probe_split_test', label: 'Probe Split', category: 'Other', audiences: ['kids', 'adult'],
    tiers: {
      1: ['CAT', 'DOG', 'COW'], 2: ['TIGER', 'ZEBRA', 'EAGLE'],
      3: ['GIRAFFE', 'DOLPHIN', 'PENGUIN', 'CHEETAH', 'LEOPARD', 'GAZELLE'],
      4: [{ word: 'RHINOCEROS', clue: 'horn' }, 'HIPPOPOTAMUS', 'ORANGUTAN'],
    },
  }));
  let r;
  try {
    r = themegen.splitTheme('__probe_split_test');
    const kids = themes.loadTheme(r.kids);
    const adult = themes.loadTheme(r.adult);

    assert.deepEqual(kids.audiences, ['kids']);
    assert.deepEqual(adult.audiences, ['adult']);
    // Kids drops the Expert (adult-hard) words; Adult keeps them.
    const kidsWords = new Set(['1', '2', '3', '4'].flatMap((t) => kids.tiers[t].map(w)));
    assert.ok(!kidsWords.has('HIPPOPOTAMUS'), 'kids variant excludes the adult Expert words');
    assert.ok(adult.tiers['4'].map(w).includes('HIPPOPOTAMUS'), 'adult variant keeps the Expert tier');
    // The original is untouched and still Both.
    assert.deepEqual(themes.loadTheme('__probe_split_test').audiences, ['kids', 'adult']);
  } finally {
    clean(['__probe_split_test', r && r.kids, r && r.adult].filter(Boolean));
  }
});

test('splitTheme refuses a theme that is not Both', () => {
  const fs = require('fs');
  const path = require('path');
  const themegen = require('../puzzleforge-web/themegen');
  const file = path.join(themes.THEME_DIR, '__probe_kidsonly.json');
  fs.writeFileSync(file, JSON.stringify({
    id: '__probe_kidsonly', label: 'Kids Only', category: 'Other', audiences: ['kids'],
    tiers: { 1: ['CAT'], 2: ['TIGER'], 3: ['GIRAFFE'], 4: [] },
  }));
  try {
    assert.throws(() => themegen.splitTheme('__probe_kidsonly'), /only a "both" theme/i);
  } finally {
    fs.unlinkSync(file);
  }
});
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

test('upgradeToFourTiers splits an old 3-tier theme, leaving 4-tier ones alone', () => {
  const three = { 1: ['CAT'], 2: ['TIGER', 'ZEBRA'], 3: ['GIRAFFE', 'ELEPHANT', 'RHINOCEROS', 'HIPPOPOTAMUS', 'DOLPHIN', 'PENGUIN'], 4: [] };
  const up = themes.upgradeToFourTiers(three);
  assert.ok(up[4].length > 0, 'tier 4 populated from the hardest tier-3 words');
  assert.deepEqual(up[1], ['CAT'], 'tiers 1–2 untouched');
  assert.deepEqual(up[2], ['TIGER', 'ZEBRA']);
  assert.equal(up[3].length + up[4].length, three[3].length, 'no tier-3 word lost');
  assert.ok(up[4].includes('HIPPOPOTAMUS'), 'longest word promoted to Expert');
  // Already-4-tier themes are returned unchanged.
  const four = { 1: ['A'], 2: ['BB'], 3: ['CCC'], 4: ['DDDD'] };
  assert.deepEqual(themes.upgradeToFourTiers(four)[4], ['DDDD']);
  // Too few tier-3 words to split → left as a 3-tier theme.
  assert.equal(themes.upgradeToFourTiers({ 1: ['A'], 2: ['B'], 3: ['CCC', 'DDD'], 4: [] })[4].length, 0);
});

test('a loaded 3-tier theme auto-upgrades in memory and defaults audiences to both', () => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(themes.THEME_DIR, '__probe_legacy.json');
  fs.writeFileSync(file, JSON.stringify({
    id: '__probe_legacy', label: 'Probe', category: 'Other',
    tiers: { 1: ['CAT', 'DOG'], 2: ['TIGER', 'ZEBRA'], 3: ['GIRAFFE', 'ELEPHANT', 'RHINOCEROS', 'HIPPOPOTAMUS', 'CROCODILE', 'DOLPHIN'] },
  }));
  try {
    const t = themes.loadTheme('__probe_legacy');
    assert.deepEqual(t.audiences, ['kids', 'adult'], 'missing audiences → both');
    assert.ok(t.tiers['4'].length > 0, 'Expert tier synthesized on load');
  } finally {
    fs.unlinkSync(file);
  }
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
