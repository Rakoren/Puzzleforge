'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { assembleBook } = require('../engine/book');
const { renderBookHtml, renderPuzzlesHtml } = require('../engine/export');
const { generate } = require('../engine/generate');
const recipe = require('../engine/recipe');

const CONFIG = {
  title: 'Test Activity Book',
  subtitle: 'A Mixed Puzzle Sampler',
  author: 'PuzzleForge',
  // Adult sampler: sudoku isn't offered to the youngest kids tiers, so this
  // mixed wordsearch+sudoku baseline is an adult book. Kids-ladder behavior has
  // its own dedicated tests (see difficulty-ladder.test.js).
  audience: 'adult',
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

test('difficulty curve distributes levels by position', () => {
  const cfg = { ...CONFIG, puzzles: [{ type: 'wordsearch', count: 6, difficulty: 1 }] };
  const ramp = assembleBook({ ...cfg, difficultyCurve: 'easy-to-hard' }).puzzles
    .filter((p) => p.type === 'wordsearch')
    .map((p) => p.difficulty);
  assert.deepEqual(ramp, [1, 1, 2, 2, 3, 3]);
  const flat = assembleBook({ ...cfg, difficultyCurve: 'flat' }).puzzles
    .filter((p) => p.type === 'wordsearch')
    .every((p) => p.difficulty === 2);
  assert.ok(flat);
});

test('a seed makes the whole book reproducible (structure + grid content)', () => {
  const content = (b) => b.puzzles.map((p) => `${p.type}:${p.difficulty}:${JSON.stringify(p.data)}`).join('|');
  const cfg = { ...CONFIG, shuffle: true, puzzles: [{ type: 'wordsearch', count: 3, difficulty: '1-3' }, { type: 'maze', count: 2, difficulty: 1 }] };
  const a = assembleBook({ ...cfg, seed: 42 });
  const b = assembleBook({ ...cfg, seed: 42 });
  const c = assembleBook({ ...cfg, seed: 43 });
  assert.equal(a.seed, 42);
  assert.equal(content(a), content(b)); // same seed → identical grids
  assert.notEqual(content(a), content(c)); // different seed → different grids
});

test('generate() reproduces a single puzzle from a seed', () => {
  const cfg = { type: 'wordsearch', words: ['CAT', 'DOG', 'FISH', 'BIRD', 'FROG'], difficulty: 1 };
  const same = (x, y) => JSON.stringify(x.data) === JSON.stringify(y.data) && JSON.stringify(x.solution) === JSON.stringify(y.solution);
  assert.ok(same(generate(cfg, { seed: 9 }), generate(cfg, { seed: 9 })));
  assert.ok(!same(generate(cfg, { seed: 9 }), generate(cfg, { seed: 10 })));
});

test('recipe v2 round-trips and migrates v1', () => {
  const book = assembleBook({ ...CONFIG, seed: 7 });
  const rec = recipe.fromBook(CONFIG, book);
  assert.equal(rec.recipeVersion, 2);
  assert.equal(rec.seed, 7);
  // Round-trip reproduces the same page structure.
  const seq = (b) => b.puzzles.map((p) => `${p.type}:${p.difficulty}`).join(',');
  assert.equal(seq(assembleBook(recipe.toBookConfig(rec))), seq(book));
  // v1 (bare config) migrates to v2.
  const mig = recipe.migrate({ puzzleforgeBook: 1, ...CONFIG });
  assert.equal(mig.recipeVersion, 2);
  assert.equal(mig.book.title, CONFIG.title);
});

test('table elements render as an HTML table with header styling and escaped cells', () => {
  const { elementHtml } = require('../engine/element-html');
  const html = elementHtml({
    kind: 'table', rows: 2, cols: 2, header: true,
    cells: [['Name', 'Score'], ['A & B', '<10>']], colW: [80, 60],
    borderColor: '#334455', headerFill: '#eeeeee',
  });
  assert.match(html, /<table[^>]*table-layout:fixed/);
  assert.match(html, /width:140px/);            // 80 + 60
  assert.match(html, /font-weight:700;background:#eeeeee/); // header row
  assert.match(html, /A &amp; B/);              // escaped
  assert.match(html, /&lt;10&gt;/);             // escaped
  assert.ok(!html.includes('<10>'));            // no raw HTML injection
});

test('checklist flags a broken-apart word list that dropped a grid word', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ title: 'WL', trimSize: '6x9', audience: 'adult', theme: 'animals',
    puzzles: [{ type: 'wordsearch', count: 1, difficulty: 1 }] });
  const pg = book.pages.find((p) => p.puzzle.type === 'wordsearch');
  const words = pg.puzzle.data.words.slice();
  const dropped = words[0];
  // Simulate "Break apart": wordlist piece hidden, list re-typed as free text
  // but MISSING the first word.
  pg.state = { layout: { comp: { wordlist: { hidden: true } },
    elements: [{ kind: 'text', text: words.slice(1).join('\n') }] } };
  const { items } = runChecklist(book);
  const wl = items.find((i) => i.id === 'wordlist-match');
  assert.equal(wl.status, 'fail', 'mismatch should be flagged');
  assert.match(wl.message, new RegExp(dropped));

  // Control: list all words → passes.
  pg.state.layout.elements[0].text = words.join('\n');
  const ok = runChecklist(book).items.find((i) => i.id === 'wordlist-match');
  assert.equal(ok.status, 'pass');
});

test('checklist counts words held in a broken-apart table, not just text boxes', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ title: 'WL3', trimSize: '6x9', audience: 'adult', theme: 'animals',
    puzzles: [{ type: 'wordsearch', count: 1, difficulty: 1 }] });
  const pg = book.pages.find((p) => p.puzzle.type === 'wordsearch');
  const words = pg.puzzle.data.words.slice();
  // Word list broken apart into a TABLE (2 columns), all words present.
  const cells = [];
  for (let i = 0; i < words.length; i += 2) cells.push([words[i] || '', words[i + 1] || '']);
  pg.state = { layout: { comp: { wordlist: { hidden: true } },
    elements: [{ kind: 'table', rows: cells.length, cols: 2, cells }] } };
  const ok = runChecklist(book).items.find((i) => i.id === 'wordlist-match');
  assert.equal(ok.status, 'pass', 'words in a table should count as present');

  // Drop one from the table → flagged.
  cells[0][0] = '';
  const bad = runChecklist(book).items.find((i) => i.id === 'wordlist-match');
  assert.equal(bad.status, 'fail');
});

test('checklist does not false-positive on an untouched (baked) word list', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ title: 'WL2', trimSize: '6x9', audience: 'adult', theme: 'animals',
    puzzles: [{ type: 'wordsearch', count: 1, difficulty: 1 }] });
  // No editor state at all — the baked list is intact.
  const wl = runChecklist(book).items.find((i) => i.id === 'wordlist-match');
  assert.equal(wl.status, 'pass');
});

test('speech and thought bubble shapes render with fill + stroke', () => {
  const { elementHtml } = require('../engine/element-html');
  const speech = elementHtml({ kind: 'shape', shape: 'speech', w: 200, h: 130, fill: '#ffd43b', stroke: '#222222', strokeW: 2 });
  assert.match(speech, /<path d="M/);            // single tailed-bubble path
  assert.match(speech, /fill="#ffd43b"/);
  assert.match(speech, /stroke="#222222"/);
  const thought = elementHtml({ kind: 'shape', shape: 'thought', w: 200, h: 130, fill: '#ffffff', stroke: '#333333', strokeW: 2 });
  assert.match(thought, /<ellipse/);             // body
  assert.equal((thought.match(/<circle/g) || []).length, 2); // two trailing puffs
});

test('objects flagged behind render under the puzzle pieces (export stacking)', () => {
  const { composeParts } = require('../engine/components');
  const { getLayout } = require('../layouts');
  const layout = getLayout('6x9', { audience: 'adult' });
  const components = [{ kind: 'grid', key: 'grid', html: '<div>PUZZLEGRID</div>' }];
  const pageLayout = { comp: {}, elements: [
    { kind: 'text', text: 'BEHINDMARK', x: 10, y: 10, behind: true, z: 1 },
    { kind: 'text', text: 'FRONTMARK', x: 10, y: 40, z: 2 },
  ] };
  const html = composeParts('', components, layout, pageLayout);
  const iBehind = html.indexOf('BEHINDMARK'), iGrid = html.indexOf('PUZZLEGRID'), iFront = html.indexOf('FRONTMARK');
  assert.ok(iBehind >= 0 && iGrid >= 0 && iFront >= 0, 'all three present');
  assert.ok(iBehind < iGrid, 'behind object renders before (under) the puzzle');
  assert.ok(iGrid < iFront, 'front object renders after (over) the puzzle');
});

test('master pages inject page-number overlays with correct per-page numbers', () => {
  const book = assembleBook({
    ...CONFIG,
    master: {
      enabled: true, applyTo: 'all', skipFirst: 1, startAt: 1,
      elements: [{ kind: 'text', field: 'pageNumber', text: '#', x: 20, y: 700, fontSize: 12, color: '#000000' }],
    },
  });
  const html = renderBookHtml(book);
  // skipFirst:1 means the first physical page has NO number; the second page is "1".
  assert.match(html, />1<\/div>|>1<\/|1<\/div>/); // page number 1 rendered somewhere
  // The literal placeholder must not survive into the output.
  assert.ok(!/>#<\/div>/.test(html), 'placeholder # should be replaced by a real number');
});

test('master pages can be scoped to odd pages only', () => {
  const { renderBookHtml: rbh } = require('../engine/export');
  const book = assembleBook({
    ...CONFIG,
    master: { enabled: true, applyTo: 'odd', skipFirst: 0, startAt: 1,
      elements: [{ kind: 'text', field: 'pageNumber', text: '#', x: 20, y: 700 }] },
  });
  const html = rbh(book);
  assert.match(html, /class="pf-el"/); // at least one overlay element rendered
});

test('per-page state overrides the book border', () => {
  const book = assembleBook({ ...CONFIG, border: 'single', pageState: [{ border: 'stars' }] });
  assert.equal(book.pages[0].state.border, 'stars');
  assert.match(renderBookHtml(book), /<svg/); // a frame is rendered
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

test('checklist adds KDP print-spec checks (gutter margin scales with page count)', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ ...CONFIG, answerKey: true });
  const ok = runChecklist(book, { pageCount: 40 });
  const okGutter = ok.items.find((i) => i.id === 'gutter-margin');
  assert.equal(okGutter.status, 'pass'); // 0.75" gutter is ample at 40 pages
  assert.ok(ok.items.find((i) => i.id === 'kdp-page-max'));
  // A 800-page book needs 0.875"; our 0.75" gutter should fail.
  const thick = runChecklist(book, { pageCount: 800 });
  assert.equal(thick.items.find((i) => i.id === 'gutter-margin').status, 'fail');
});

test('checklist detects a copyright page from editor template text', () => {
  const { runChecklist } = require('../engine/checklist');
  const book = assembleBook({ ...CONFIG, copyright: false });
  // simulate a template copyright page: a blank content page carrying text elements
  book.pages.push({ puzzle: { type: 'bleedguard', data: {}, solution: {} }, pageNumber: 99,
    state: { layout: { comp: {}, elements: [{ kind: 'text', text: 'Copyright © 2026 R. Koren' }] } } });
  const r = runChecklist(book, { pageCount: 40 });
  assert.equal(r.items.find((i) => i.id === 'copyright').status, 'pass');
});

test('titlePage:false omits the auto title page but keeps title/author for cover & metadata', () => {
  const on = assembleBook({ ...CONFIG });
  assert.equal(on.titlePage, true);
  const off = assembleBook({ ...CONFIG, titlePage: false });
  assert.equal(off.titlePage, false);
  assert.equal(off.title, CONFIG.title); // title field preserved
  // Default render: title page present when on, absent when off.
  const { defaultLeaves } = require('../engine/export');
  assert.equal(defaultLeaves(on).filter((l) => l.role === 'title').length, 1);
  assert.equal(defaultLeaves(off).filter((l) => l.role === 'title').length, 0);
  // Content page numbering shifts down by one when there's no title page.
  assert.equal(off.pages[0].pageNumber, on.pages[0].pageNumber - 1);
});

const bookTemplates = require('../puzzleforge-web/public/templates.js');

test('every starter template assembles into a real, renderable book', () => {
  assert.ok(Array.isArray(bookTemplates) && bookTemplates.length >= 1);
  const ids = new Set();
  for (const tpl of bookTemplates) {
    assert.ok(tpl.id && tpl.name && tpl.config, `template ${tpl.id} shape`);
    assert.ok(!ids.has(tpl.id), `duplicate template id ${tpl.id}`);
    ids.add(tpl.id);
    // Deep-copy: applyConfig/useTemplate must never mutate the shared template.
    const cfg = JSON.parse(JSON.stringify(tpl.config));
    const book = assembleBook(cfg);
    assert.ok(book.pages.length > 0, `${tpl.id} produced pages`);
    const html = renderBookHtml(book);
    assert.ok(html.includes(tpl.config.title), `${tpl.id} renders its title`);
    // Row counts stay within the builder's 1–40 per-row cap.
    for (const p of tpl.config.puzzles) {
      assert.ok(p.count >= 1 && p.count <= 40, `${tpl.id} ${p.type} count ${p.count} within 1–40`);
    }
  }
});

// --- Logic Grid ---------------------------------------------------------
const { generate: engineGenerate } = require('../engine/generate');
const logic = require('../generators/logicgrid');
const logicSolver = require('../generators/logicgrid/solver');
const logicValidator = require('../generators/logicgrid/validator');
const logicRenderer = require('../generators/logicgrid/renderer');

const LGLAYOUT = {
  widthIn: 8.5, heightIn: 11, margins: { top: 0.75, outside: 0.5, bottom: 0.75, gutter: 0.75 },
  fontFamily: 'Georgia, serif', fontSize: 14, usableWidth: 672, usableHeight: 864,
};

test('logic grid: every difficulty generates a uniquely-solvable puzzle', () => {
  for (let d = 1; d <= 3; d++) {
    for (let s = 1; s <= 6; s++) {
      const p = engineGenerate({ type: 'logicgrid', difficulty: d, seed: s });
      // validator passes (uniqueness + clue consistency + shape)
      const v = logicValidator.validate(p);
      assert.ok(v.valid, `d${d} s${s} valid: ${v.errors.join('; ')}`);
      // independent solver re-derives the exact answer
      const solved = logicSolver.solve(p);
      assert.deepEqual(solved.missing, [], `d${d} s${s} solver: ${solved.missing.join('; ')}`);
      // solution is a full N×categories grid
      const N = p.data.categories[0].values.length;
      assert.equal(p.solution.rows.length, N);
    }
  }
});

test('logic grid: a wrong clue is rejected by the validator', () => {
  const p = engineGenerate({ type: 'logicgrid', difficulty: 1, seed: 3 });
  // Flip a "same" clue into a false statement by swapping its second value.
  const clue = p.data.clues.find((c) => c.kind === 'same');
  const cat = p.data.categories[clue.cb];
  clue.vb = cat.values.find((v) => String(v) !== String(clue.vb));
  const v = logicValidator.validate(p);
  assert.ok(!v.valid, 'validator should reject an inconsistent clue');
});

test('logic grid: reproducible from a seed (content)', () => {
  const content = (p) => JSON.stringify({ data: p.data, solution: p.solution });
  const a = content(engineGenerate({ type: 'logicgrid', difficulty: 3, seed: 77 }));
  const b = content(engineGenerate({ type: 'logicgrid', difficulty: 3, seed: 77 }));
  assert.equal(a, b);
});

test('logic grid: renders clues + a blank table (puzzle) and a filled table (key)', () => {
  const p = engineGenerate({ type: 'logicgrid', difficulty: 2, seed: 11 });
  const puzzleHtml = logicRenderer.render(p, LGLAYOUT, {});
  const keyHtml = logicRenderer.render(p, LGLAYOUT, { answerKey: true });
  assert.match(puzzleHtml, /Clues/);
  assert.match(puzzleHtml, new RegExp(p.data.clues[0].text.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(keyHtml, /Solution/);
  // The answer key contains the primary value AND at least one deduced value.
  const row0 = p.solution.rows[0];
  const attrKey = p.data.categories[1].key;
  assert.match(keyHtml, new RegExp(String(row0[attrKey])));
});

test('logic grid: works inside an assembled book with a back-of-book key', () => {
  const book = assembleBook({
    title: 'Logic Sampler', puzzleforgeBook: 1, trimSize: '8.5x11', answerKey: true,
    puzzles: [{ type: 'logicgrid', count: 2, difficulty: '1-2' }], seed: 5,
  });
  const html = renderBookHtml(book);
  assert.match(html, /Clues/);
  assert.match(html, /logic-ans/); // compact answer table in the key
});

// --- Word Ladder --------------------------------------------------------
const ladder = require('../generators/wordladder');
const ladderSolver = require('../generators/wordladder/solver');
const ladderValidator = require('../generators/wordladder/validator');
const ladderRenderer = require('../generators/wordladder/renderer');

test('word ladder: every difficulty generates a uniquely-solvable ladder of real words', () => {
  for (let d = 1; d <= 3; d++) {
    for (let s = 1; s <= 8; s++) {
      const p = engineGenerate({ type: 'wordladder', difficulty: d, seed: s });
      const v = ladderValidator.validate(p);
      assert.ok(v.valid, `d${d} s${s} valid: ${v.errors.join('; ')}`);
      const solved = ladderSolver.solve(p);
      assert.deepEqual(solved.missing, [], `d${d} s${s} solver: ${solved.missing.join('; ')}`);
      // consecutive words differ by exactly one letter
      const L = p.solution.ladder;
      for (let i = 1; i < L.length; i++) {
        assert.ok(ladderSolver.isNeighbor(L[i - 1], L[i]), `${L[i - 1]}→${L[i]} one-letter step`);
      }
      assert.equal(L[0], p.data.start);
      assert.equal(L[L.length - 1], p.data.end);
    }
  }
});

test('word ladder: revealed hints match the answer, and a wrong hint is rejected', () => {
  const p = engineGenerate({ type: 'wordladder', difficulty: 2, seed: 4 });
  // find a revealed cell and corrupt it
  let found = false;
  for (let i = 0; i < p.data.rungs.length && !found; i++) {
    for (let j = 0; j < p.data.length; j++) {
      if (p.data.rungs[i][j] != null) {
        p.data.rungs[i][j] = p.data.rungs[i][j] === 'a' ? 'b' : 'a';
        found = true; break;
      }
    }
  }
  assert.ok(found, 'puzzle had at least one hint to corrupt');
  assert.ok(!ladderValidator.validate(p).valid, 'a wrong hint should fail validation');
});

test('word ladder: reproducible from a seed (content)', () => {
  const c = (p) => JSON.stringify({ data: p.data, solution: p.solution });
  const a = c(engineGenerate({ type: 'wordladder', difficulty: 3, seed: 88 }));
  const b = c(engineGenerate({ type: 'wordladder', difficulty: 3, seed: 88 }));
  assert.equal(a, b);
});

test('word ladder: renders boxed rungs (puzzle) and the full chain (answer key)', () => {
  const p = engineGenerate({ type: 'wordladder', difficulty: 2, seed: 6 });
  const puzzleHtml = ladderRenderer.render(p, LGLAYOUT, {});
  const keyHtml = ladderRenderer.render(p, LGLAYOUT, { answerKey: true });
  // Each letter renders in its own cell, so compare on the tag-stripped text
  // where a row's cells concatenate back into the word.
  const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, '');
  assert.ok(text(puzzleHtml).includes(p.data.start.toUpperCase()));
  assert.ok(text(puzzleHtml).includes(p.data.end.toUpperCase()));
  const keyText = text(keyHtml);
  for (const w of p.solution.ladder) assert.ok(keyText.includes(w.toUpperCase()), `key shows ${w}`);
});

test('word ladder: works inside an assembled book with a back-of-book key', () => {
  const book = assembleBook({
    title: 'Ladders', puzzleforgeBook: 1, trimSize: '8.5x11', answerKey: true,
    puzzles: [{ type: 'wordladder', count: 2, difficulty: '1-2' }], seed: 3,
  });
  const html = renderBookHtml(book);
  assert.match(html, /Word Ladder/);
  assert.match(html, /ladder-ans/);
});

// --- Word Wheel ---------------------------------------------------------
const wheel = require('../generators/wordwheel');
const wheelSolver = require('../generators/wordwheel/solver');
const wheelValidator = require('../generators/wordwheel/validator');
const wheelRenderer = require('../generators/wordwheel/renderer');

test('word wheel: every difficulty generates a valid, solvable wheel', () => {
  for (let d = 1; d <= 4; d++) {
    for (let s = 1; s <= 5; s++) {
      const p = engineGenerate({ type: 'wordwheel', difficulty: d, seed: s });
      const v = wheelValidator.validate(p);
      assert.ok(v.valid, `d${d} s${s} valid: ${v.errors.join('; ')}`);
      const solved = wheelSolver.solve(p);
      assert.deepEqual(solved.missing, [], `d${d} s${s} solver: ${solved.missing.join('; ')}`);
      // wheel letters equal the 9-letter word's letters; centre is on the wheel
      assert.equal(p.data.wheel.length, 9);
      assert.equal(p.data.wheel.split('').sort().join(''), p.solution.pangram.split('').sort().join(''));
      assert.ok(p.data.wheel.includes(p.data.center));
      // every listed word uses the centre and is ≥ minLen
      for (const w of p.solution.words) {
        assert.ok(w.includes(p.data.center) && w.length >= p.data.minLen, `${w} legal`);
      }
    }
  }
});

test('word wheel: an illegal answer is rejected', () => {
  const p = engineGenerate({ type: 'wordwheel', difficulty: 2, seed: 4 });
  p.solution.words.push('zzzz'); // not makeable from the wheel
  assert.ok(!wheelValidator.validate(p).valid);
});

test('word wheel: reproducible from a seed', () => {
  const c = (p) => JSON.stringify({ data: p.data, solution: p.solution });
  assert.equal(
    c(engineGenerate({ type: 'wordwheel', difficulty: 3, seed: 21 })),
    c(engineGenerate({ type: 'wordwheel', difficulty: 3, seed: 21 })),
  );
});

test('word wheel: renders the wheel (puzzle) and the full word list (answer key)', () => {
  const p = engineGenerate({ type: 'wordwheel', difficulty: 2, seed: 6 });
  const puzzleHtml = wheelRenderer.render(p, LGLAYOUT, {});
  const keyHtml = wheelRenderer.render(p, LGLAYOUT, { answerKey: true });
  assert.match(puzzleHtml, /<svg/);
  assert.match(puzzleHtml, new RegExp(p.data.center.toUpperCase()));
  assert.match(keyHtml, new RegExp(p.solution.pangram.toUpperCase()));
  assert.match(keyHtml, /words to find/);
});

test('word wheel: works inside an assembled book with a back-of-book key', () => {
  const book = assembleBook({
    title: 'Wheels', puzzleforgeBook: 1, trimSize: '8.5x11', answerKey: true,
    puzzles: [{ type: 'wordwheel', count: 1, difficulty: '2' }], seed: 3,
  });
  const html = renderBookHtml(book);
  assert.match(html, /Word Wheel/);
  assert.match(html, /wheel-ans/);
});
