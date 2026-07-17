'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const qr = require('../engine/qr');
const { elementHtml } = require('../engine/element-html');

test('qr.encode returns a square, deterministic module matrix', () => {
  const a = qr.encode('https://example.com/puzzle/3');
  assert.ok(a.count >= 21, 'QR is at least version 1 (21×21)');
  assert.equal(a.modules.length, a.count);
  assert.equal(a.modules[0].length, a.count);
  // finder pattern: top-left 7×7 corner is dark on its border
  assert.equal(a.modules[0][0], 1);
  assert.equal(a.modules[0][6], 1);
  // deterministic
  const b = qr.encode('https://example.com/puzzle/3');
  assert.deepEqual(a.modules, b.modules);
  // different data → different matrix
  const c = qr.encode('https://example.com/puzzle/4');
  assert.notDeepEqual(a.modules, c.modules);
});

test('qr element renders a crisp SVG with one rect per dark module', () => {
  const { modules, count } = qr.encode('hello world');
  const html = elementHtml({ kind: 'qr', modules, w: 140, fg: '#000000', bg: '#ffffff' });
  assert.match(html, /<svg/);
  assert.match(html, /shape-rendering="crispEdges"/);
  const darks = modules.reduce((n, row) => n + row.reduce((m, v) => m + v, 0), 0);
  const rects = (html.match(/<rect /g) || []).length;
  // one rect per dark module, plus the background rect
  assert.equal(rects, darks + 1);
  // quiet zone: viewBox is module count + 8
  assert.match(html, new RegExp(`viewBox="0 0 ${count + 8} ${count + 8}"`));
});

test('qr element with no data renders a placeholder (still selectable)', () => {
  const html = elementHtml({ kind: 'qr', modules: [], w: 100 });
  assert.match(html, /<svg/);
  assert.match(html, /width="100"/);
});
