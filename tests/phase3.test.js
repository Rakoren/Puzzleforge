'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { generate } = require('../engine/generate');
const { renderPuzzleHtml } = require('../engine/export');
const themes = require('../themes');
const { listTypes } = require('../generators/registry');

const SPACE = themes.loadTheme('space');
const WORDS = themes.selectWords(SPACE);
const CLUES = themes.clueMap(SPACE);

test('all seven puzzle types are registered', () => {
  const types = listTypes();
  for (const t of ['wordsearch', 'sudoku', 'maze', 'cryptogram', 'wordscramble', 'crossword', 'krisskross']) {
    assert.ok(types.includes(t), `${t} is registered`);
  }
});

// --- Maze ---
test('maze is a perfect maze: fully connected, unique solution', () => {
  const { countOpenEdges } = require('../generators/maze/validator');
  const { solve } = require('../generators/maze/solver');
  const p = generate({ type: 'maze', difficulty: 2 });
  const r = solve(p);
  assert.equal(r.reachedCount, r.totalCells, 'every cell reachable');
  assert.equal(
    countOpenEdges(p.data.cells, p.data.width, p.data.height),
    p.data.width * p.data.height - 1,
    'spanning tree => unique path'
  );
  assert.ok(r.path.length > 0);
});

// --- Cryptogram ---
test('cryptogram has no fixed points and round-trips', () => {
  const { solve } = require('../generators/cryptogram/solver');
  const p = generate({ type: 'cryptogram', quote: 'THE QUICK BROWN FOX JUMPS' });
  for (const [cipher, plain] of Object.entries(p.solution.key)) {
    assert.notEqual(cipher, plain, 'no letter maps to itself');
  }
  assert.equal(solve(p).plaintext, p.solution.plaintext, 'decodes to plaintext');
});

// --- Word Scramble ---
test('word scramble produces real anagrams that differ from the answer', () => {
  const { isAnagram } = require('../generators/wordscramble/solver');
  const p = generate({ type: 'wordscramble', words: WORDS, difficulty: 2, theme: 'space' });
  p.data.entries.forEach((e, i) => {
    const answer = p.solution.words[i];
    assert.ok(isAnagram(e.scrambled, answer), `${answer} scramble is an anagram`);
    if (new Set(answer.split('')).size > 1) {
      assert.notEqual(e.scrambled, answer, `${answer} was actually rearranged`);
    }
  });
});

// --- Crossword ---
test('crossword is a single connected component with clues for every answer', () => {
  const { countComponents } = require('../generators/shared/interlock');
  const p = generate({ type: 'crossword', words: WORDS, clues: CLUES, theme: 'space' });
  assert.equal(countComponents(p.solution.grid), 1);
  for (const list of [p.data.across, p.data.down]) {
    for (const c of list) assert.ok(c.clue && c.clue.trim(), `clue present for ${c.number}`);
  }
  // answers read back off the solution grid
  const { solve } = require('../generators/crossword/solver');
  assert.deepEqual(solve(p).mismatches, []);
});

// --- Kriss-Kross ---
test('kriss-kross interlocks the word bank into one component', () => {
  const { countComponents } = require('../generators/shared/interlock');
  const p = generate({ type: 'krisskross', words: WORDS, theme: 'space' });
  assert.equal(countComponents(p.solution.grid), 1);
  const banked = p.data.wordBank.reduce((n, g) => n + g.words.length, 0);
  assert.equal(banked, p.solution.words.length, 'every placed word is in the bank');
});

test('interlock rejects words that conflict and keeps separation', () => {
  const { interlock } = require('../generators/shared/interlock');
  const { grid } = interlock(['PLANET', 'EARTH', 'MARS', 'STAR'], () => 0.5);
  // No filled cell should be orphaned.
  const h = grid.length;
  const w = grid[0].length;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (grid[r][c] == null) continue;
      const nb =
        (r > 0 && grid[r - 1][c] != null) ||
        (r + 1 < h && grid[r + 1][c] != null) ||
        (c > 0 && grid[r][c - 1] != null) ||
        (c + 1 < w && grid[r][c + 1] != null);
      assert.ok(nb, 'no isolated letters');
    }
  }
});

test('easy crossword/kriss-kross have no corner-touches; words never run alongside', () => {
  const { touchViolations } = require('../generators/shared/interlock');
  for (const type of ['crossword', 'krisskross']) {
    const cfg =
      type === 'crossword'
        ? { type, words: WORDS, clues: CLUES, theme: 'space', difficulty: 1 }
        : { type, words: WORDS, theme: 'space', difficulty: 1 };
    const p = generate(cfg);
    const ortho = touchViolations(p.solution.grid, p.solution.placements, false);
    const corner = touchViolations(p.solution.grid, p.solution.placements, true) - ortho;
    assert.equal(ortho, 0, `${type} easy: no parallel-adjacent words`);
    assert.equal(corner, 0, `${type} easy: no corner-touches`);
  }
});

test('interlock produces varied layouts across runs', () => {
  const { interlock } = require('../generators/shared/interlock');
  const opts = { separation: 'strict', preferCrossings: 'min' };
  const grids = new Set();
  for (let i = 0; i < 4; i++) {
    grids.add(JSON.stringify(interlock(WORDS.map((w) => w.toUpperCase()), Math.random, opts).grid));
  }
  assert.ok(grids.size > 1, 'repeated generations differ');
});

test('each new type renders print HTML sized to the trim', () => {
  for (const cfg of [
    { type: 'maze', difficulty: 1 },
    { type: 'cryptogram', difficulty: 2 },
    { type: 'wordscramble', words: WORDS, theme: 'space' },
    { type: 'crossword', words: WORDS, clues: CLUES, theme: 'space' },
    { type: 'krisskross', words: WORDS, theme: 'space' },
  ]) {
    const p = generate(cfg);
    const html = renderPuzzleHtml(p, { trimSize: '8.5x11' });
    assert.match(html, /size: 8\.5in 11in/, `${cfg.type} sized to trim`);
  }
});
