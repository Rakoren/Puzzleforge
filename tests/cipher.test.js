'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const ciphers = require('../generators/cipher/ciphers');
const { generate } = require('../engine/generate');
const cipherSolver = require('../generators/cipher/solver');
const cipherValidator = require('../generators/cipher/validator');
const cipherRenderer = require('../generators/cipher/renderer');

const LGLAYOUT = {
  widthIn: 8.5, heightIn: 11, margins: { top: 0.75, outside: 0.5, bottom: 0.75, gutter: 0.75 },
  fontFamily: 'Georgia, serif', fontSize: 14, usableWidth: 672, usableHeight: 864,
};

test('every cipher mode round-trips (encode → decode)', () => {
  const msg = 'STAY CURIOUS AND KIND';
  for (const mode of ciphers.MODES) {
    const enc = ciphers.encode(mode, msg, { shift: 5 });
    assert.equal(ciphers.decode(enc), enc.plaintext);
  }
  // caesar with a known shift
  assert.equal(ciphers.caesar('ABC', 1), 'BCD');
  assert.equal(ciphers.caesar('BCD', -1), 'ABC');
  // atbash is its own inverse
  assert.equal(ciphers.atbash(ciphers.atbash('HELLO WORLD')), 'HELLO WORLD');
});

test('cipher: every difficulty generates valid, solvable puzzles', () => {
  for (let d = 1; d <= 4; d++) {
    for (let s = 1; s <= 8; s++) {
      const p = generate({ type: 'cipher', difficulty: d, seed: s });
      assert.ok(cipherValidator.validate(p).valid, `d${d} s${s} valid`);
      assert.deepEqual(cipherSolver.solve(p).missing, [], `d${d} s${s} solves`);
    }
  }
});

test('cipher: a tampered ciphertext is rejected', () => {
  const p = generate({ type: 'cipher', difficulty: 1, seed: 1, mode: 'caesar', message: 'KEEP GOING' });
  p.data.cipher = ciphers.caesar('WRONG MESSAGE', p.data.shift); // decodes to something else
  assert.ok(!cipherValidator.validate(p).valid);
});

test('cipher: reproducible from a seed', () => {
  const c = (p) => JSON.stringify({ data: p.data, solution: p.solution });
  assert.equal(
    c(generate({ type: 'cipher', difficulty: 3, seed: 12 })),
    c(generate({ type: 'cipher', difficulty: 3, seed: 12 })),
  );
});

test('cipher: renders coded message + key (puzzle) and plaintext (answer key)', () => {
  const p = generate({ type: 'cipher', difficulty: 2, seed: 3, mode: 'morse', message: 'DREAM BIG' });
  const puzzleHtml = cipherRenderer.render(p, LGLAYOUT, {});
  const keyHtml = cipherRenderer.render(p, LGLAYOUT, { answerKey: true });
  assert.match(puzzleHtml, /Morse key/);
  assert.match(keyHtml, /DREAM BIG/);
});

test('cipher: works inside an assembled book with a back-of-book key', () => {
  const { assembleBook } = require('../engine/book');
  const { renderBookHtml } = require('../engine/export');
  const book = assembleBook({
    title: 'Codes', puzzleforgeBook: 1, trimSize: '8.5x11', answerKey: true,
    puzzles: [{ type: 'cipher', count: 2, difficulty: '2' }], seed: 3,
  });
  const html = renderBookHtml(book);
  assert.match(html, /Cipher/);
  assert.match(html, /cipher-ans/);
});
