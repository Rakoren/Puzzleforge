'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');
const { getModule } = require('../generators/registry');

// ---------------- Math Puzzles ----------------
test('mathpuzzles: generates arithmetically-correct problems at every level', () => {
  for (const audience of ['kids', 'adult']) {
    for (const difficulty of [1, 2, 3, 4]) {
      const p = pf.generate({ type: 'mathpuzzles', difficulty, audience });
      assert.strictEqual(p.type, 'mathpuzzles');
      const v = getModule('mathpuzzles').validate(p);
      assert.ok(v.valid, `L${difficulty} ${audience} invalid: ${v.errors.slice(0, 2).join('; ')}`);
      assert.strictEqual(p.solution.answers.length, p.data.problems.length);
    }
  }
});

test('mathpuzzles: a wrong answer is rejected by the validator (self-checking)', () => {
  const p = pf.generate({ type: 'mathpuzzles', difficulty: 1, audience: 'kids' });
  // corrupt one equation answer
  const eq = p.solution.problems.findIndex((x) => x.kind === 'equation');
  p.solution.answers[eq] = String(Number(p.solution.answers[eq]) + 1);
  p.solution.problems[eq].answer = p.solution.answers[eq];
  assert.strictEqual(getModule('mathpuzzles').validate(p).valid, false);
});

test('mathpuzzles: sequence puzzles appear at the harder tiers and are a true progression', () => {
  const p = pf.generate({ type: 'mathpuzzles', difficulty: 4, audience: 'adult' });
  const seqs = p.solution.problems.filter((x) => x.kind === 'sequence');
  assert.ok(seqs.length > 0, 'has sequence puzzles at L4');
  for (const s of seqs) {
    const step = s.terms[1] - s.terms[0];
    for (let i = 2; i < s.terms.length; i++) assert.strictEqual(s.terms[i] - s.terms[i - 1], step);
  }
});

test('mathpuzzles: renders a worksheet and an answer key', () => {
  const p = pf.generate({ type: 'mathpuzzles', difficulty: 2 });
  assert.match(pf.renderHtml(p, { trimSize: '8.5x11' }), /<h1>/);
  assert.match(pf.renderHtml(p, { trimSize: '8.5x11', answerKey: true }), /Answer Key/);
});

// ---------------- X-Sudoku ----------------
test('xsudoku: every level yields a unique, rule-valid diagonal sudoku', () => {
  for (const difficulty of [1, 2, 3, 4]) {
    const p = pf.generate({ type: 'xsudoku', difficulty, audience: 'adult' });
    assert.strictEqual(p.type, 'xsudoku');
    const v = getModule('xsudoku').validate(p);
    assert.ok(v.valid, `L${difficulty} invalid: ${v.errors.slice(0, 2).join('; ')}`);
    const s = getModule('xsudoku').solve(p);
    assert.ok(s.unique, `L${difficulty} not unique`);
    assert.ok(s.solvable);
  }
});

test('xsudoku: both diagonals of the solution contain 1–9', () => {
  const p = pf.generate({ type: 'xsudoku', difficulty: 2, audience: 'adult' });
  const g = p.solution.grid;
  const main = new Set(), anti = new Set();
  for (let i = 0; i < 9; i++) { main.add(g[i][i]); anti.add(g[i][8 - i]); }
  assert.strictEqual(main.size, 9);
  assert.strictEqual(anti.size, 9);
});

test('xsudoku: harder levels expose fewer givens', () => {
  const easy = pf.generate({ type: 'xsudoku', difficulty: 1, audience: 'adult' });
  const hard = pf.generate({ type: 'xsudoku', difficulty: 4, audience: 'adult' });
  assert.ok(hard.data.givenCount <= easy.data.givenCount);
});

test('xsudoku: renders the grid with shaded diagonals', () => {
  const p = pf.generate({ type: 'xsudoku', difficulty: 1 });
  const doc = pf.renderHtml(p, { trimSize: '8.5x11' });
  assert.match(doc, /td\.diag/);       // the diagonal-shading style
  assert.match(doc, /class="[^"]*diag/); // at least one shaded cell
});
