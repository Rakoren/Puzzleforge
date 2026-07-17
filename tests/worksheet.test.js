'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');

function wordsFor(d, n = 14) {
  return pf.selectWords(pf.resolveTheme('animals'), { difficulty: d, count: n });
}
function wsPuzzle(d = 1) {
  return pf.generate({ type: 'wordsearch', words: wordsFor(d), difficulty: d, theme: 'animals' });
}

test('renderHtml injects a Name/Date worksheet header and optional footer', () => {
  const doc = pf.renderHtml(wsPuzzle(), {
    trimSize: '8.5x11',
    worksheet: { classField: true, footer: 'Mrs. Lee · Grade 3' },
  });
  assert.match(doc, /pf-ws-head/);
  assert.match(doc, />Name</);
  assert.match(doc, />Date</);
  assert.match(doc, /Class \/ Period/);
  assert.match(doc, /Mrs\. Lee/);
});

test('a worksheet answer copy shows ANSWER KEY instead of blank fields', () => {
  const doc = pf.renderHtml(wsPuzzle(), { worksheet: { classField: false }, answerKey: true });
  assert.match(doc, /ANSWER KEY/);
  assert.doesNotMatch(doc, /class="pf-ws-f"/); // no Name/Date fill-in fields on the teacher copy
});

test('no worksheet option leaves the puzzle page unchanged (no header)', () => {
  const doc = pf.renderHtml(wsPuzzle(), { trimSize: '8.5x11' });
  assert.doesNotMatch(doc, /pf-ws-head/);
});

test('reserveTopIn shrinks the usable height so content fits below the header', () => {
  const base = pf.getLayout('8.5x11', { audience: 'adult' });
  const reserved = pf.getLayout('8.5x11', { audience: 'adult', reserveTopIn: 0.8 });
  assert.ok(reserved.usableHeight < base.usableHeight);
  assert.strictEqual(reserved.reserveTop, Math.round(0.8 * base.pxPerIn));
  assert.strictEqual(reserved.usableWidth, base.usableWidth); // width unaffected
});

test('assemblePacketHtml combines cover + worksheets + answer key into one doc', () => {
  const pages = [{ puzzle: wsPuzzle(1) }, { puzzle: wsPuzzle(2) }];
  const html = pf.assemblePacketHtml({
    trimSize: '8.5x11',
    audience: 'kids',
    cover: { title: 'Animals Unit', teacher: 'Mrs. Lee', objective: 'Build vocabulary.', contents: ['Word Search — Easy', 'Word Search — Medium'] },
    worksheet: { footer: 'Animals Unit' },
    pages,
    answers: 'end',
  });
  assert.match(html, /Animals Unit/);        // cover title
  assert.match(html, /Build vocabulary/);     // objective
  // cover + 2 worksheets + 2 answer copies = 5 combined pages
  assert.strictEqual((html.match(/pf-page pf-page-/g) || []).length, 5);
  assert.match(html, /ANSWER KEY/);
});

test('a packet with answers "none" omits the answer-key section', () => {
  const pages = [{ puzzle: wsPuzzle(1) }, { puzzle: wsPuzzle(2) }];
  const html = pf.assemblePacketHtml({ cover: null, pages, answers: 'none' });
  assert.strictEqual((html.match(/pf-page pf-page-/g) || []).length, 2); // just the two worksheets
  assert.doesNotMatch(html, /ANSWER KEY/);
});
