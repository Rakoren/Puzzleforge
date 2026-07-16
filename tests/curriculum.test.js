'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const pf = require('..');

test('listGrades covers K–6 + adult with aligned CCSS vocabulary standards', () => {
  const grades = pf.listGrades();
  const ids = grades.map((g) => g.id);
  assert.deepStrictEqual(ids, ['K', '1', '2', '3', '4', '5', '6', 'adult']);
  const g3 = grades.find((g) => g.id === '3');
  assert.strictEqual(g3.audience, 'kids');
  assert.strictEqual(g3.level, 3);
  assert.ok(g3.standards.some((s) => /L\.3\.4/.test(s.code))); // vocabulary acquisition
  assert.ok(g3.mix.includes('wordsearch'));
  const adult = grades.find((g) => g.id === 'adult');
  assert.strictEqual(adult.audience, 'adult');
  assert.strictEqual(adult.standards.length, 0); // no K-12 ELA standards for adults
});

test('planLessonPacket builds a grade-appropriate packet from a topic', () => {
  const plan = pf.planLessonPacket({ grade: '3', topic: 'Animals', count: 4 });
  assert.strictEqual(plan.audience, 'kids');
  assert.strictEqual(plan.pages.length, 4);
  // every page at the grade's difficulty, drawn from the grade's mix
  assert.ok(plan.pages.every((p) => p.difficulty === 3));
  const mix = pf.gradeInfo('3').mix;
  assert.ok(plan.pages.every((p) => mix.includes(p.type)));
  // cover carries topic, standards, objective
  assert.match(plan.cover.title, /Animals/);
  assert.match(plan.cover.title, /Grade 3/);
  assert.match(plan.cover.standards, /CCSS\.ELA-LITERACY\.L\.3\.4/);
  assert.match(plan.cover.objective, /Animals/);
});

test('planLessonPacket cycles the mix and clamps the count', () => {
  const plan = pf.planLessonPacket({ grade: '5', topic: 'Space', count: 99 });
  assert.strictEqual(plan.pages.length, 20); // clamped to the max
  const mix = pf.gradeInfo('5').mix;
  // first pages follow the mix order
  assert.strictEqual(plan.pages[0].type, mix[0]);
  assert.strictEqual(plan.pages[mix.length].type, mix[0]); // wraps around
});

test('an auto-planned packet actually assembles into a PDF-ready document', () => {
  const plan = pf.planLessonPacket({ grade: '2', topic: 'Ocean', count: 3 });
  const pages = plan.pages.map((p) => {
    const words = pf.selectWords(pf.resolveTheme('ocean'), { difficulty: p.difficulty, count: 14 });
    return { puzzle: pf.generate({ type: p.type, words, difficulty: p.difficulty, theme: 'ocean' }) };
  });
  const html = pf.assemblePacketHtml({ audience: plan.audience, cover: plan.cover, pages, answers: plan.answers });
  assert.match(html, /Ocean/);
  // cover + 3 worksheets + 3 answer copies
  assert.strictEqual((html.match(/pf-page pf-page-/g) || []).length, 7);
});
