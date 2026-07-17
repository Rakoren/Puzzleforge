'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');
const { getModule } = require('../generators/registry');
const { acrossEntries, downEntries } = require('../generators/kakuro/core');

test('kakuro: every level yields a unique, rule-valid cross-sum board', () => {
  for (const audience of ['kids', 'adult']) {
    for (const difficulty of [1, 2, 3, 4]) {
      const p = pf.generate({ type: 'kakuro', difficulty, audience });
      assert.strictEqual(p.type, 'kakuro');
      const v = getModule('kakuro').validate(p);
      assert.ok(v.valid, `L${difficulty} ${audience} invalid: ${v.errors.slice(0, 2).join('; ')}`);
      const s = getModule('kakuro').solve(p);
      assert.ok(s.unique, `L${difficulty} ${audience} not unique`);
      assert.ok(s.solvable);
    }
  }
});

test('kakuro: every entry sums to its clue with no repeated digit', () => {
  const p = pf.generate({ type: 'kakuro', difficulty: 3 });
  const { rows, cols, grid } = p.data;
  const sol = p.solution.grid;
  const check = (entries, key) => {
    for (const e of entries) {
      const [cr, cc] = e.clue;
      const target = grid[cr][cc][key];
      assert.strictEqual(typeof target, 'number', `clue ${key} present at ${cr},${cc}`);
      const vals = e.cells.map(([r, c]) => sol[r][c]);
      assert.strictEqual(vals.reduce((a, b) => a + b, 0), target, `run sum at ${cr},${cc}`);
      assert.strictEqual(new Set(vals).size, vals.length, `run distinct at ${cr},${cc}`);
      for (const v of vals) assert.ok(v >= 1 && v <= 9, 'digit in 1..9');
    }
  };
  check(acrossEntries(grid, rows, cols), 'right');
  check(downEntries(grid, rows, cols), 'down');
});

test('kakuro: every white cell belongs to an across AND a down run (valid layout)', () => {
  const p = pf.generate({ type: 'kakuro', difficulty: 4 });
  const { rows, cols, grid } = p.data;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].t !== 'fill') continue;
      const hL = c > 0 && grid[r][c - 1].t === 'fill';
      const hR = c < cols - 1 && grid[r][c + 1].t === 'fill';
      const vU = r > 0 && grid[r - 1][c].t === 'fill';
      const vD = r < rows - 1 && grid[r + 1][c].t === 'fill';
      assert.ok(hL || hR, `cell ${r},${c} has a horizontal run neighbour`);
      assert.ok(vU || vD, `cell ${r},${c} has a vertical run neighbour`);
    }
  }
});

test('kakuro: a tampered clue makes the board non-unique or unsolvable', () => {
  const p = pf.generate({ type: 'kakuro', difficulty: 2 });
  const { rows, cols, grid } = p.data;
  // Bump the first across clue by 1 — the stored solution no longer fits.
  const e = acrossEntries(grid, rows, cols)[0];
  const [cr, cc] = e.clue;
  grid[cr][cc].right += 1;
  const v = getModule('kakuro').validate(p);
  assert.strictEqual(v.valid, false);
});

test('kakuro: renders a puzzle and an answer key with the diagonal clue cells', () => {
  const p = pf.generate({ type: 'kakuro', difficulty: 1 });
  const doc = pf.renderHtml(p, { trimSize: '8.5x11' });
  assert.match(doc, /td\.clue/);          // the diagonal clue-cell style
  assert.match(doc, /class="clue"/);      // at least one clue cell
  assert.match(pf.renderHtml(p, { trimSize: '8.5x11', answerKey: true }), /Answer Key/);
});
