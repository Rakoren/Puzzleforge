'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { assembleBook } = require('../engine/book');
const { renderBookHtml, renderPuzzlesHtml } = require('../engine/export');
const { generate } = require('../engine/generate');
const recipe = require('../engine/recipe');

const CONFIG = {
  title: 'Test Activity Book',
  subtitle: 'A Mixed Puzzle Sampler',
  author: 'PuzzleForge',
  audience: 'kids',
  trimSize: '8x10',
  theme: 'animals',
  puzzles: [
    { type: 'wordsearch', count: 2, difficulty: 1 },
    { type: 'sudoku', count: 2, difficulty: '1-2' },
  ],
};

test('assembleBook generates all puzzles and assigns pages', () => {
  const book = assembleBook(CONFIG);
  assert.equal(book.meta.puzzleCount, 4);
  assert.equal(book.meta.byType.wordsearch, 2);
  assert.equal(book.meta.byType.sudoku, 2);
  // Page numbers start at 2 (page 1 is the title page) and increase.
  assert.equal(book.pages[0].pageNumber, 2);
  assert.equal(book.pages[3].pageNumber, 5);
});

test('book difficulty range is honored', () => {
  const book = assembleBook(CONFIG);
  for (const p of book.puzzles.filter((x) => x.type === 'sudoku')) {
    assert.ok(p.difficulty >= 1 && p.difficulty <= 2);
  }
});

test('renderBookHtml includes title, both puzzle types, and the answer key', () => {
  const book = assembleBook(CONFIG);
  const html = renderBookHtml(book);
  assert.match(html, /Test Activity Book/);
  assert.match(html, /table class="grid"/); // wordsearch
  assert.match(html, /table class="sudoku"/); // sudoku
  assert.match(html, /Answer Key/);
  // One combined document sized to the book trim.
  assert.match(html, /size: 8in 10in/);
});

test('assembleBook requires a title and puzzles', () => {
  assert.throws(() => assembleBook({ puzzles: [] }), /title is required/);
  assert.throws(() => assembleBook({ title: 'x', puzzles: [] }), /non-empty/);
});

test('difficulty curve distributes levels by position', () => {
  const cfg = { ...CONFIG, puzzles: [{ type: 'wordsearch', count: 6, difficulty: 1 }] };
  const ramp = assembleBook({ ...cfg, difficultyCurve: 'easy-to-hard' }).puzzles
    .filter((p) => p.type === 'wordsearch')
    .map((p) => p.difficulty);
  assert.deepEqual(ramp, [1, 1, 2, 2, 3, 3]);
  const flat = assembleBook({ ...cfg, difficultyCurve: 'flat' }).puzzles
    .filter((p) => p.type === 'wordsearch')
    .every((p) => p.difficulty === 2);
  assert.ok(flat);
});

test('a seed makes the whole book reproducible (structure + grid content)', () => {
  const content = (b) => b.puzzles.map((p) => `${p.type}:${p.difficulty}:${JSON.stringify(p.data)}`).join('|');
  const cfg = { ...CONFIG, shuffle: true, puzzles: [{ type: 'wordsearch', count: 3, difficulty: '1-3' }, { type: 'maze', count: 2, difficulty: 1 }] };
  const a = assembleBook({ ...cfg, seed: 42 });
  const b = assembleBook({ ...cfg, seed: 42 });
  const c = assembleBook({ ...cfg, seed: 43 });
  assert.equal(a.seed, 42);
  assert.equal(content(a), content(b)); // same seed → identical grids
  assert.notEqual(content(a), content(c)); // different seed → different grids
});

test('generate() reproduces a single puzzle from a seed', () => {
  const cfg = { type: 'wordsearch', words: ['CAT', 'DOG', 'FISH', 'BIRD', 'FROG'], difficulty: 1 };
  const same = (x, y) => JSON.stringify(x.data) === JSON.stringify(y.data) && JSON.stringify(x.solution) === JSON.stringify(y.solution);
  assert.ok(same(generate(cfg, { seed: 9 }), generate(cfg, { seed: 9 })));
  assert.ok(!same(generate(cfg, { seed: 9 }), generate(cfg, { seed: 10 })));
});

test('recipe v2 round-trips and migrates v1', () => {
  const book = assembleBook({ ...CONFIG, seed: 7 });
  const rec = recipe.fromBook(CONFIG, book);
  assert.equal(rec.recipeVersion, 2);
  assert.equal(rec.seed, 7);
  // Round-trip reproduces the same page structure.
  const seq = (b) => b.puzzles.map((p) => `${p.type}:${p.difficulty}`).join(',');
  assert.equal(seq(assembleBook(recipe.toBookConfig(rec))), seq(book));
  // v1 (bare config) migrates to v2.
  const mig = recipe.migrate({ puzzleforgeBook: 1, ...CONFIG });
  assert.equal(mig.recipeVersion, 2);
  assert.equal(mig.book.title, CONFIG.title);
});

test('per-page state overrides the book border', () => {
  const book = assembleBook({ ...CONFIG, border: 'single', pageState: [{ border: 'stars' }] });
  assert.equal(book.pages[0].state.border, 'stars');
  assert.match(renderBookHtml(book), /<svg/); // a frame is rendered
});

test('renderPuzzlesHtml combines a teacher set (differentiation) into one document', () => {
  const entries = [1, 2, 3].map((d) => ({
    puzzle: generate({ type: 'sudoku', difficulty: d }),
    trimSize: '8.5x11',
    answerKey: false,
  }));
  const html = renderPuzzlesHtml(entries);
  // three page wrappers, sized to one trim, each its own scoped styles
  const pages = (html.match(/class="pf-page pf-page-\d+"/g) || []).length;
  assert.equal(pages, 3);
  assert.match(html, /size: 8\.5in 11in/);
});

test('checklist adds KDP print-spec checks (gutter margin scales with page count)', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ ...CONFIG, answerKey: true });
  const ok = runChecklist(book, { pageCount: 40 });
  const okGutter = ok.items.find((i) => i.id === 'gutter-margin');
  assert.equal(okGutter.status, 'pass'); // 0.75" gutter is ample at 40 pages
  assert.ok(ok.items.find((i) => i.id === 'kdp-page-max'));
  // A 800-page book needs 0.875"; our 0.75" gutter should fail.
  const thick = runChecklist(book, { pageCount: 800 });
  assert.equal(thick.items.find((i) => i.id === 'gutter-margin').status, 'fail');
});

test('checklist detects a copyright page from editor template text', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ ...CONFIG, copyright: false });
  // simulate a template copyright page: a blank content page carrying text elements
  book.pages.push({ puzzle: { type: 'bleedguard', data: {}, solution: {} }, pageNumber: 99,
    state: { layout: { comp: {}, elements: [{ kind: 'text', text: 'Copyright © 2026 R. Koren' }] } } });
  const r = runChecklist(book, { pageCount: 40 });
  assert.equal(r.items.find((i) => i.id === 'copyright').status, 'pass');
});
