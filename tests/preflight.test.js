'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const imagesize = require('../engine/imagesize');
const { gutterMinInches } = require('../engine/kdp');
const { assembleBook } = require('../engine/book');
const { runChecklist } = require('../engine/checklist');

// A minimal valid PNG header (the parser only reads the IHDR width/height).
function pngUri(w, h) {
  const b = Buffer.alloc(24);
  b[0] = 0x89; b[1] = 0x50; b[2] = 0x4e; b[3] = 0x47;
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return 'data:image/png;base64,' + b.toString('base64');
}
const bookWith = (elements) => assembleBook({
  title: 'PF', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult',
  puzzles: [{ type: 'sudoku', count: 1, difficulty: '2' }],
  pageState: [{ layout: { comp: {}, elements } }],
});
const item = (book, id) => runChecklist(book).items.find((i) => i.id === id);

test('imagesize reads PNG/GIF/JPEG dimensions from a header', () => {
  assert.deepEqual(imagesize.fromDataUri(pngUri(640, 480)), { width: 640, height: 480 });
  assert.equal(imagesize.fromDataUri('not-an-image'), null);
});

test("KDP gutter table matches Amazon's published minimums", () => {
  assert.equal(gutterMinInches(24), 0.375);
  assert.equal(gutterMinInches(150), 0.375);
  assert.equal(gutterMinInches(151), 0.5);
  assert.equal(gutterMinInches(300), 0.5);
  assert.equal(gutterMinInches(500), 0.625);
  assert.equal(gutterMinInches(700), 0.75);
  assert.equal(gutterMinInches(828), 0.875);
});

test('image-dpi flags an image printing below 300 DPI, passes a crisp one', () => {
  // 60px image shown at 300px wide → ~19 DPI (fail)
  const low = bookWith([{ group: 'el', kind: 'image', src: pngUri(60, 60), width: 300, scale: 1, x: 50, y: 50 }]);
  assert.equal(item(low, 'image-dpi').status, 'fail');
  // 900px image shown at 200px wide → ~432 DPI (pass)
  const ok = bookWith([{ group: 'el', kind: 'image', src: pngUri(900, 900), width: 200, scale: 1, x: 50, y: 50 }]);
  assert.equal(item(ok, 'image-dpi').status, 'pass');
});

test('safe-area flags content off the page, passes content inside', () => {
  const off = bookWith([{ group: 'el', kind: 'shape', shape: 'rect', w: 200, h: 100, scale: 1, x: -40, y: 50 }]);
  assert.equal(item(off, 'safe-area').status, 'fail');
  const inside = bookWith([{ group: 'el', kind: 'shape', shape: 'rect', w: 100, h: 80, scale: 1, x: 30, y: 30 }]);
  assert.equal(item(inside, 'safe-area').status, 'pass');
});

test('a clean book has zero blockers (the gate would pass it)', () => {
  const book = assembleBook({
    title: 'Clean', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', answerKey: true,
    puzzles: [{ type: 'sudoku', count: 30, difficulty: '2' }],
  });
  const blockers = runChecklist(book).items.filter((i) => i.status !== 'pass' && i.severity === 'blocker');
  assert.equal(blockers.length, 0, `unexpected blockers: ${blockers.map((b) => b.id).join(', ')}`);
});

test('metadata checks warn when empty and pass when filled (never block)', () => {
  const base = { title: 'M', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', answerKey: true, puzzles: [{ type: 'sudoku', count: 30, difficulty: '2' }] };
  const bare = runChecklist(assembleBook(base));
  assert.equal(bare.items.filter((i) => i.status !== 'pass' && i.severity === 'blocker').length, 0);
  assert.equal(bare.items.find((i) => i.id === 'meta-description').status, 'fail');
  const full = runChecklist(assembleBook({ ...base, metadata: { description: 'A fun book', keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], categories: ['x', 'y', 'z'], readingAge: 'Adult' } }));
  for (const id of ['meta-description', 'meta-keywords', 'meta-categories']) {
    assert.equal(full.items.find((i) => i.id === id).status, 'pass', `${id} passes when filled`);
  }
});

test('padToEven appends a blank leaf only when the page count is odd', () => {
  const { defaultLeaves } = require('../engine/export');
  const base = { title: 'Pad', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', titlePage: false, seed: 3 };
  // 1 puzzle + no answer key + no title = 1 leaf (odd).
  const odd = assembleBook({ ...base, answerKey: false, puzzles: [{ type: 'sudoku', count: 1, difficulty: '2' }] });
  assert.equal(defaultLeaves({ ...odd, padToEven: false }).length % 2, 1, 'odd without padding');
  const padded = defaultLeaves({ ...odd, padToEven: true });
  assert.equal(padded.length % 2, 0, 'even after padding');
  assert.equal(padded[padded.length - 1].role, 'blank', 'trailing leaf is blank');
  // An already-even book is left untouched.
  const even = assembleBook({ ...base, answerKey: false, puzzles: [{ type: 'sudoku', count: 2, difficulty: '2' }] });
  const evenLeaves = defaultLeaves({ ...even, padToEven: true });
  assert.ok(!evenLeaves.some((l) => l.role === 'blank'), 'no blank added to an even book');
});

test('assembleBook carries padToEven through from config', () => {
  const on = assembleBook({ title: 'X', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', padToEven: true, puzzles: [{ type: 'sudoku', count: 1, difficulty: '2' }] });
  assert.equal(on.padToEven, true);
  const off = assembleBook({ title: 'X', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', puzzles: [{ type: 'sudoku', count: 1, difficulty: '2' }] });
  assert.equal(off.padToEven, false);
});

test('price-breakeven warns below break-even, passes above, absent without a price', () => {
  const base = { title: 'P', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', answerKey: true, puzzles: [{ type: 'sudoku', count: 30, difficulty: '2' }] };
  // No listPrice → the check doesn't run at all.
  assert.equal(item(assembleBook(base), 'price-breakeven'), undefined);
  // A $0.99 price can't clear break-even on any real book → warning (never blocks).
  const low = runChecklist(assembleBook({ ...base, metadata: { listPrice: 0.99 } }));
  const lowItem = low.items.find((i) => i.id === 'price-breakeven');
  assert.equal(lowItem.status, 'fail');
  assert.equal(lowItem.severity, 'warning');
  // A healthy price clears it.
  assert.equal(runChecklist(assembleBook({ ...base, metadata: { listPrice: 9.99 } })).items.find((i) => i.id === 'price-breakeven').status, 'pass');
});

test('frontImageDpi flags a low-res cover image and passes a crisp one', () => {
  const { frontImageDpi } = require('../engine/cover');
  assert.equal(frontImageDpi({ trimSize: '8.5x11', pageCount: 100 }), null, 'no image → null');
  // 300px wide on an ~8.75"-wide front panel → ~34 DPI (fail).
  const low = frontImageDpi({ trimSize: '8.5x11', pageCount: 100, front: { image: pngUri(300, 400) } });
  assert.equal(low.ok, false);
  assert.ok(low.dpi < 300);
  // 3000×3600 easily clears 300 DPI on the same panel.
  const ok = frontImageDpi({ trimSize: '8.5x11', pageCount: 100, front: { image: pngUri(3000, 3600) } });
  assert.equal(ok.ok, true);
  assert.ok(ok.dpi >= 300);
});

test('collectBookText gathers all reader-facing text and de-dupes', () => {
  const { collectBookText } = require('../engine/booktext');
  const book = assembleBook({
    title: 'My Puzzle Book', subtitle: '50 Fun Puzzles', puzzleforgeBook: 1, trimSize: '8.5x11', audience: 'adult', theme: 'animals',
    metadata: { description: 'A great book of puzzles.' },
    puzzles: [{ type: 'crossword', count: 1, difficulty: '2' }, { type: 'trivia', count: 1, difficulty: '2' }, { type: 'sudoku', count: 3, difficulty: '2' }],
    seed: 1,
  });
  const t = collectBookText(book);
  const kinds = new Set(t.map((s) => s.kind));
  for (const k of ['book-title', 'blurb', 'puzzle-title', 'instruction', 'clue', 'question', 'answer']) {
    assert.ok(kinds.has(k), `collected a ${k}`);
  }
  // Ids are unique and the 3 identical sudoku instructions collapse to one.
  assert.equal(new Set(t.map((s) => s.id)).size, t.length);
  assert.equal(t.filter((s) => s.kind === 'instruction' && /every row, column/.test(s.text)).length, 1);
});
