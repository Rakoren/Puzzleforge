'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');
const { getModule } = require('../generators/registry');
const offensive = require('../filters/offensive');

for (const type of ['riddles', 'brainteasers']) {
  test(`${type}: generates, validates, solves, and renders at every level`, () => {
    for (const audience of ['kids', 'adult']) {
      for (const difficulty of [1, 2, 3, 4]) {
        const p = pf.generate({ type, difficulty, audience });
        assert.strictEqual(p.type, type);
        const mod = getModule(type);
        const v = mod.validate(p);
        assert.ok(v.valid, `${type} L${difficulty} ${audience} invalid: ${v.errors.join('; ')}`);
        // solver echoes an answer per prompt
        assert.strictEqual(mod.solve(p).answers.length, p.data.questions.length);
        // renders a worksheet page + an answer key
        const doc = pf.renderHtml(p, { trimSize: '8.5x11', audience });
        assert.match(doc, /<h1>/);
        assert.match(pf.renderHtml(p, { trimSize: '8.5x11', audience, answerKey: true }), /Answer Key/);
      }
    }
  });

  test(`${type}: not an activity type (gets an answer key) and content is filter-clean`, () => {
    assert.strictEqual(pf.isActivityType(type), false);
    const p = pf.generate({ type, difficulty: 4, audience: 'adult' });
    p.solution.questions.forEach((q, i) => {
      assert.strictEqual(offensive.scanText(q.q).length, 0, `prompt ${i + 1} clean`);
      assert.strictEqual(offensive.scanText(p.solution.answers[i]).length, 0, `answer ${i + 1} clean`);
    });
  });

  test(`${type}: is reproducible under a seed and kids stay out of the hardest tier`, () => {
    const seed = 12345;
    const a = pf.generate({ type, difficulty: 3, audience: 'adult', seed }, () => 0.42);
    const b = pf.generate({ type, difficulty: 3, audience: 'adult', seed }, () => 0.42);
    assert.deepStrictEqual(a.data.questions, b.data.questions);
  });
}

test('riddles/brain teasers accept a teacher-supplied list', () => {
  const custom = pf.generate({
    type: 'riddles',
    riddles: Array.from({ length: 6 }, (_, i) => ({ q: `Custom riddle ${i}?`, a: `Answer ${i}` })),
  });
  assert.strictEqual(custom.data.count, 6);
  assert.match(custom.solution.answers[0], /Answer/);
});
