'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { assembleBook } = require('../engine/book');
const { renderBookHtml, renderPuzzlesHtml } = require('../engine/export');
const { generate } = require('../engine/generate');

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
