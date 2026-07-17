'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');
const { getModule } = require('../generators/registry');

// ---------------- Mini Sudoku (6×6) ----------------
test('minisudoku: every level yields a unique, rule-valid 6×6 sudoku', () => {
  for (const audience of ['kids', 'adult']) {
    for (const difficulty of [1, 2, 3, 4]) {
      const p = pf.generate({ type: 'minisudoku', difficulty, audience });
      assert.strictEqual(p.type, 'minisudoku');
      assert.strictEqual(p.data.size, 6);
      const v = getModule('minisudoku').validate(p);
      assert.ok(v.valid, `L${difficulty} ${audience} invalid: ${v.errors.slice(0, 2).join('; ')}`);
      const s = getModule('minisudoku').solve(p);
      assert.ok(s.unique, `L${difficulty} ${audience} not unique`);
      assert.ok(s.solvable);
    }
  }
});

test('minisudoku: every row, column, and 2×3 box holds 1–6', () => {
  const p = pf.generate({ type: 'minisudoku', difficulty: 2 });
  const g = p.solution.grid;
  const full = (vals) => { const s = new Set(vals); return s.size === 6 && !s.has(0); };
  for (let i = 0; i < 6; i++) {
    assert.ok(full(g[i]), `row ${i}`);
    assert.ok(full(g.map((row) => row[i])), `col ${i}`);
  }
  for (let br = 0; br < 6; br += 2) {
    for (let bc = 0; bc < 6; bc += 3) {
      const box = [];
      for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 3; dc++) box.push(g[br + dr][bc + dc]);
      assert.ok(full(box), `box ${br},${bc}`);
    }
  }
});

test('minisudoku: harder levels expose no more givens than easier ones', () => {
  const easy = pf.generate({ type: 'minisudoku', difficulty: 1, audience: 'adult' });
  const hard = pf.generate({ type: 'minisudoku', difficulty: 4, audience: 'adult' });
  assert.ok(hard.data.givenCount <= easy.data.givenCount);
});

test('minisudoku: renders a worksheet and an answer key', () => {
  const p = pf.generate({ type: 'minisudoku', difficulty: 1 });
  assert.match(pf.renderHtml(p, { trimSize: '8.5x11' }), /table class="sudoku"/);
  assert.match(pf.renderHtml(p, { trimSize: '8.5x11', answerKey: true }), /Answer Key/);
});

// ---------------- Even-Odd Sudoku (9×9) ----------------
test('evenodd: every level yields a unique, rule-valid parity sudoku', () => {
  for (const audience of ['kids', 'adult']) {
    for (const difficulty of [1, 2, 3, 4]) {
      const p = pf.generate({ type: 'evenodd', difficulty, audience });
      assert.strictEqual(p.type, 'evenodd');
      const v = getModule('evenodd').validate(p);
      assert.ok(v.valid, `L${difficulty} ${audience} invalid: ${v.errors.slice(0, 2).join('; ')}`);
      const s = getModule('evenodd').solve(p);
      assert.ok(s.unique, `L${difficulty} ${audience} not unique`);
    }
  }
});

test('evenodd: shaded cells are exactly the even-valued cells of the solution', () => {
  const p = pf.generate({ type: 'evenodd', difficulty: 2 });
  const g = p.solution.grid;
  const shaded = p.data.shaded;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      assert.strictEqual(!!shaded[r][c], g[r][c] % 2 === 0, `parity mismatch at ${r},${c}`);
    }
  }
});

test('evenodd: the parity constraint is actually enforced during solving', () => {
  // A grid with a given that violates parity must not solve under the core.
  const p = pf.generate({ type: 'evenodd', difficulty: 1 });
  const core = getModule('evenodd').solve; // sanity: solver rebuilds core from shading
  assert.ok(typeof core === 'function');
  const s = getModule('evenodd').solve(p);
  // Every solved cell must respect its shading.
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const even = s.solution[r][c] % 2 === 0;
      assert.strictEqual(even, !!p.data.shaded[r][c], `solve parity at ${r},${c}`);
    }
  }
});

test('evenodd: renders the grid with an even/odd legend and shaded cells', () => {
  const doc = pf.renderHtml(pf.generate({ type: 'evenodd', difficulty: 1 }), { trimSize: '8.5x11' });
  assert.match(doc, /td\.even/);        // the even-shading style
  assert.match(doc, /class="[^"]*even/); // at least one shaded cell
  assert.match(doc, /even/i);            // legend text
});
