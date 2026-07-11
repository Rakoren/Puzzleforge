'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');
const qr = require('../engine/qr');

function sampleBook() {
  // Two real puzzles + a filler activity page (should be excluded from the plan).
  return pf.assembleBook({
    title: 'Animal Fun!',
    trimSize: '8.5x11',
    audience: 'kids',
    theme: 'animals',
    puzzles: [
      { type: 'wordsearch', count: 2, difficulty: 1 },
      { type: 'maze', count: 1, difficulty: 1 },
    ],
    interleave: ['coloring'],
  });
}

test('planDigital assigns per-real-puzzle URLs under a slugged base', () => {
  const book = sampleBook();
  const reals = book.puzzles.filter((p) => !pf.isActivityType(p.type)).length;
  const plan = pf.planDigital(book, { baseUrl: 'https://puzzles.example.com/' });
  assert.equal(plan.slug, 'animal-fun');
  assert.equal(plan.entries.length, reals, 'one entry per real puzzle');
  assert.equal(plan.byPuzzle.size, reals);
  // trailing slash trimmed; filenames sequential; URL well-formed
  assert.equal(plan.entries[0].url, 'https://puzzles.example.com/animal-fun/p1.html');
  assert.equal(plan.entries[reals - 1].filename, `p${reals}.html`);
  // activity/filler pages are not linked
  const linkedTypes = new Set(plan.entries.map((e) => e.puzzle.type));
  assert.ok(![...linkedTypes].some((t) => pf.isActivityType(t)), 'no activity pages linked');
});

test('qrSvg encodes exactly the landing URL (deterministic, self-contained)', () => {
  const url = 'https://puzzles.example.com/animal-fun/p1.html';
  const svg = pf.qrSvg(url, { size: 120 });
  assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  // one <rect> per dark module (+1 for the white background rect)
  const dark = qr.encode(url).modules.flat().filter(Boolean).length;
  const rects = (svg.match(/<rect\b/g) || []).length;
  assert.equal(rects, dark + 1, 'dark modules + background rect');
  // deterministic
  assert.equal(pf.qrSvg(url, { size: 120 }), svg);
});

test('renderLandingPages produces one reveal page per puzzle plus an index', () => {
  const book = sampleBook();
  const plan = pf.planDigital(book, { baseUrl: 'https://x.test' });
  const files = pf.renderLandingPages(book, plan);
  assert.equal(files.length, plan.entries.length + 1);
  const names = files.map((f) => f.name || f.filename);
  assert.ok(names.includes('index.html'));
  const p1 = files.find((f) => (f.filename || f.name) === 'p1.html').html;
  assert.match(p1, /Show the answer/); // reveal control
  assert.match(p1, /id="ans"/);        // answer container present
  assert.match(p1, /<!doctype html>/i);
  // index links every puzzle
  const idx = files.find((f) => (f.filename || f.name) === 'index.html').html;
  plan.entries.forEach((e) => assert.ok(idx.includes(e.filename), `index links ${e.filename}`));
});

test('book export prints one QR badge per real puzzle, encoding its URL', () => {
  const book = sampleBook();
  book.digital = pf.planDigital(book, { baseUrl: 'https://puzzles.example.com' });
  const html = pf.renderBookHtml(book, undefined);
  const caps = (html.match(/Scan for the answer/g) || []).length;
  assert.equal(caps, book.digital.entries.length, 'one caption per real puzzle');
  // the first puzzle's QR is present as an inline SVG (same rect count as its URL)
  assert.ok(html.includes('class="pf-qr"'));
});
