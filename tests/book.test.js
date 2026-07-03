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

test('table elements render as an HTML table with header styling and escaped cells', () => {
  const { elementHtml } = require('../engine/element-html');
  const html = elementHtml({
    kind: 'table', rows: 2, cols: 2, header: true,
    cells: [['Name', 'Score'], ['A & B', '<10>']], colW: [80, 60],
    borderColor: '#334455', headerFill: '#eeeeee',
  });
  assert.match(html, /<table[^>]*table-layout:fixed/);
  assert.match(html, /width:140px/);            // 80 + 60
  assert.match(html, /font-weight:700;background:#eeeeee/); // header row
  assert.match(html, /A &amp; B/);              // escaped
  assert.match(html, /&lt;10&gt;/);             // escaped
  assert.ok(!html.includes('<10>'));            // no raw HTML injection
});

test('checklist flags a broken-apart word list that dropped a grid word', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ title: 'WL', trimSize: '6x9', audience: 'adult', theme: 'animals',
    puzzles: [{ type: 'wordsearch', count: 1, difficulty: 1 }] });
  const pg = book.pages.find((p) => p.puzzle.type === 'wordsearch');
  const words = pg.puzzle.data.words.slice();
  const dropped = words[0];
  // Simulate "Break apart": wordlist piece hidden, list re-typed as free text
  // but MISSING the first word.
  pg.state = { layout: { comp: { wordlist: { hidden: true } },
    elements: [{ kind: 'text', text: words.slice(1).join('\n') }] } };
  const { items } = runChecklist(book);
  const wl = items.find((i) => i.id === 'wordlist-match');
  assert.equal(wl.status, 'fail', 'mismatch should be flagged');
  assert.match(wl.message, new RegExp(dropped));

  // Control: list all words → passes.
  pg.state.layout.elements[0].text = words.join('\n');
  const ok = runChecklist(book).items.find((i) => i.id === 'wordlist-match');
  assert.equal(ok.status, 'pass');
});

test('checklist does not false-positive on an untouched (baked) word list', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ title: 'WL2', trimSize: '6x9', audience: 'adult', theme: 'animals',
    puzzles: [{ type: 'wordsearch', count: 1, difficulty: 1 }] });
  // No editor state at all — the baked list is intact.
  const wl = runChecklist(book).items.find((i) => i.id === 'wordlist-match');
  assert.equal(wl.status, 'pass');
});

test('objects flagged behind render under the puzzle pieces (export stacking)', () => {
  const { composeParts } = require('../engine/components');
  const { getLayout } = require('../layouts');
  const layout = getLayout('6x9', { audience: 'adult' });
  const components = [{ kind: 'grid', key: 'grid', html: '<div>PUZZLEGRID</div>' }];
  const pageLayout = { comp: {}, elements: [
    { kind: 'text', text: 'BEHINDMARK', x: 10, y: 10, behind: true, z: 1 },
    { kind: 'text', text: 'FRONTMARK', x: 10, y: 40, z: 2 },
  ] };
  const html = composeParts('', components, layout, pageLayout);
  const iBehind = html.indexOf('BEHINDMARK'), iGrid = html.indexOf('PUZZLEGRID'), iFront = html.indexOf('FRONTMARK');
  assert.ok(iBehind >= 0 && iGrid >= 0 && iFront >= 0, 'all three present');
  assert.ok(iBehind < iGrid, 'behind object renders before (under) the puzzle');
  assert.ok(iGrid < iFront, 'front object renders after (over) the puzzle');
});

test('master pages inject page-number overlays with correct per-page numbers', () => {
  const book = assembleBook({
    ...CONFIG,
    master: {
      enabled: true, applyTo: 'all', skipFirst: 1, startAt: 1,
      elements: [{ kind: 'text', field: 'pageNumber', text: '#', x: 20, y: 700, fontSize: 12, color: '#000000' }],
    },
  });
  const html = renderBookHtml(book);
  // skipFirst:1 means the first physical page has NO number; the second page is "1".
  assert.match(html, />1<\/div>|>1<\/|1<\/div>/); // page number 1 rendered somewhere
  // The literal placeholder must not survive into the output.
  assert.ok(!/>#<\/div>/.test(html), 'placeholder # should be replaced by a real number');
});

test('master pages can be scoped to odd pages only', () => {
  const { renderBookHtml: rbh } = require('../engine/export');
  const book = assembleBook({
    ...CONFIG,
    master: { enabled: true, applyTo: 'odd', skipFirst: 0, startAt: 1,
      elements: [{ kind: 'text', field: 'pageNumber', text: '#', x: 20, y: 700 }] },
  });
  const html = rbh(book);
  assert.match(html, /class="pf-el"/); // at least one overlay element rendered
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

test('titlePage:false omits the auto title page but keeps title/author for cover & metadata', () => {
  const on = assembleBook({ ...CONFIG });
  assert.equal(on.titlePage, true);
  const off = assembleBook({ ...CONFIG, titlePage: false });
  assert.equal(off.titlePage, false);
  assert.equal(off.title, CONFIG.title); // title field preserved
  // Default render: title page present when on, absent when off.
  const { defaultLeaves } = require('../engine/export');
  assert.equal(defaultLeaves(on).filter((l) => l.role === 'title').length, 1);
  assert.equal(defaultLeaves(off).filter((l) => l.role === 'title').length, 0);
  // Content page numbering shifts down by one when there's no title page.
  assert.equal(off.pages[0].pageNumber, on.pages[0].pageNumber - 1);
});
