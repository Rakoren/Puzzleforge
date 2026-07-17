'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');

const BANKS = ['dolch-nouns', 'dolch-sight-words', 'number-words'];

test('curriculum word banks load, carry a standard, and fill all four tiers', () => {
  for (const id of BANKS) {
    const t = pf.loadTheme(id);
    assert.ok(t.standard && /^CCSS\./.test(t.standard), `${id} declares a CCSS standard`);
    assert.strictEqual(t.category, 'Curriculum & Sight Words');
    for (const d of [1, 2, 3, 4]) {
      assert.ok(pf.selectWords(t, { difficulty: d }).length > 0, `${id} tier ${d} has words`);
    }
  }
});

test('listThemesDetailed surfaces the standard for the pickers', () => {
  const all = pf.listThemesDetailed();
  const nouns = all.find((x) => x.id === 'dolch-nouns');
  assert.ok(nouns, 'dolch-nouns is listed');
  assert.strictEqual(nouns.standard, 'CCSS.ELA-LITERACY.RF.K.3');
  // topical themes have no standard
  const animals = all.find((x) => x.id === 'animals');
  assert.strictEqual(animals.standard, null);
});

test('a sight-word bank generates a valid word search + scramble', () => {
  const t = pf.loadTheme('dolch-nouns');
  const words = pf.selectWords(t, { difficulty: 2, count: 12 });
  assert.ok(words.length >= 8);
  const ws = pf.generate({ type: 'wordsearch', words, difficulty: 2, theme: t.label });
  assert.ok(ws.data.words.length >= 8);
  const sc = pf.generate({ type: 'wordscramble', words, difficulty: 2, theme: t.label });
  assert.ok((sc.data.entries || []).length >= 1);
});

test('every bank word is filter-clean (letters only, >= 3 chars, not offensive)', () => {
  for (const id of BANKS) {
    const t = pf.loadTheme(id);
    for (const d of [1, 2, 3, 4]) {
      for (const w of pf.selectWords(t, { difficulty: d })) {
        assert.match(w, /^[A-Z]{3,}$/, `${id}: "${w}" is letters-only and >= 3 chars`);
        assert.strictEqual(pf.isOffensiveWord(w), false, `${id}: "${w}" passes the filter`);
      }
    }
  }
});
