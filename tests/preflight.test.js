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
