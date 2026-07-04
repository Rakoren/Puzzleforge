/**
 * Pre-flight publish checklist (logic only — no AI).
 *
 * Runs structural / print-readiness checks over an assembled book so common KDP
 * rejections (odd or too-few pages, missing or incomplete answer key, blank
 * puzzle pages, misplaced bleed guards) are caught before export rather than at
 * upload. Content-quality checks (grammar, blurb, etc.) are a separate Claude
 * pass and are not part of this module.
 *
 * Severity: 'blocker' (🔴 must fix) | 'warning' (🟡 should fix). A passing
 * check reports status 'pass' (🟢).
 */
const { isActivityType } = require('../generators/registry');
const { getLayout } = require('../layouts');
const { gutterMinInches, KDP_PAGE_MAX } = require('./kdp');

// All user-authored text on the pages (template / matter text objects), lowercased.
// Lets matter checks work whether copyright came from a Book Builder field or an
// inserted editor template.
function pageText(book) {
  const parts = [];
  for (const pg of book.pages || []) {
    const els = pg.state && pg.state.layout && pg.state.layout.elements;
    if (Array.isArray(els)) for (const e of els) if (e && e.kind === 'text' && e.text) parts.push(String(e.text));
  }
  return parts.join('\n').toLowerCase();
}

const KDP_MIN_PAGES = 24;
const DRAWABLE = new Set(['coloring', 'drawing']);

// The items a grid-search puzzle asks the solver to find (its printed bank).
function listedItems(p) {
  const d = (p && p.data) || {};
  if (p.type === 'wordsearch') return Array.isArray(d.words) ? d.words.map(String) : [];
  if (p.type === 'numbersearch') return Array.isArray(d.numbers) ? d.numbers.map(String) : [];
  return [];
}
// Whole-word tokens of the free text a publisher put on the page (e.g. a
// broken-apart word list, whether a text box OR an editable table). Upper-cased
// for case-insensitive matching.
function pageFreeTokens(pg) {
  const els = pg.state && pg.state.layout && pg.state.layout.elements;
  if (!Array.isArray(els)) return new Set();
  const parts = [];
  for (const e of els) {
    if (!e) continue;
    if (e.kind === 'text' && e.text) parts.push(String(e.text));
    else if (e.kind === 'table' && Array.isArray(e.cells)) {
      for (const row of e.cells) if (Array.isArray(row)) for (const cell of row) if (cell) parts.push(String(cell));
    }
  }
  return new Set(parts.join('\n').toUpperCase().match(/[A-Z0-9]+/g) || []);
}
// The baked word-list piece was hidden (e.g. "Break apart puzzle" replaced it
// with editable text) — so the printed list now lives only in the free text.
function wordlistHidden(pg) {
  const comp = pg.state && pg.state.layout && pg.state.layout.comp;
  return !!comp && Object.keys(comp).some((k) => /wordlist|clue/i.test(k) && comp[k] && comp[k].hidden);
}
// Pages whose grid words are no longer all printed on the page. Only fires once
// a publisher has started editing the list as free text (break-apart / hide) —
// an untouched baked list always matches, so this never false-positives.
function wordlistMismatches(book) {
  const out = [];
  (book.pages || []).forEach((pg, i) => {
    const items = listedItems(pg.puzzle || {});
    if (!items.length) return;
    const tokens = pageFreeTokens(pg);
    const anyListed = items.some((w) => tokens.has(w.toUpperCase()));
    if (!wordlistHidden(pg) && !anyListed) return;         // baked list intact → skip
    const missing = items.filter((w) => !tokens.has(w.toUpperCase()));
    if (missing.length) out.push({ page: pg.pageNumber || i + 1, missing });
  });
  return out;
}

// A non-activity puzzle should carry real puzzle data and a solution.
function hasPuzzleContent(p) {
  const d = p.data || {};
  return Boolean(d.grid || d.words || d.cells || d.items || d.clues || d.questions || d.message);
}
function hasSolution(p) {
  const s = p.solution;
  return Boolean(s && typeof s === 'object' && Object.keys(s).length > 0);
}

// Returns a warning message when the audience and the difficulty labeling are
// incoherent, or null when they line up.
function difficultyAudienceIssue(book) {
  const audience = String(book.audience || '').toLowerCase();
  if (audience !== 'kids' && audience !== 'adult') {
    return 'No audience set — difficulty defaults to the Adult labels (Easy…Expert). Set Kids or Adult so buyers see the right labels (Kids show an age range).';
  }
  const ra = String((book.metadata && book.metadata.readingAge) || '').toLowerCase().trim();
  if (!ra) return null;
  const saysAdult = /adult|grown|18\s*\+/.test(ra);
  const saysKid = /kid|child|pre-?k|grade|age/.test(ra) || /\b([2-9]|1[0-2])\b/.test(ra);
  if (audience === 'kids' && saysAdult) {
    return `Audience is Kids but the listing reading age says "${book.metadata.readingAge}". Kids books show age/grade difficulty labels — align the reading age or switch the audience.`;
  }
  if (audience === 'adult' && saysKid && !saysAdult) {
    return `Audience is Adult but the reading age "${book.metadata.readingAge}" reads like a kids range. Adult books use Easy…Expert labels — switch to Kids or clear the reading age.`;
  }
  return null;
}

/**
 * @param {object} book assembled book (engine/book.js)
 * @param {object} [opts]
 * @param {number} [opts.pageCount] physical page count from the rendered PDF
 *   (the answer key paginates, so pass the real count when available)
 * @param {Array}  [opts.specs] original config.puzzles, to verify the count
 * @returns {{ items: Array, summary: { blockers, warnings, passes } }}
 */
function runChecklist(book, opts = {}) {
  const items = [];
  const add = (id, label, severity, ok, message) =>
    items.push({ id, label, severity, status: ok ? 'pass' : 'fail', message: ok ? '' : message });

  const realPuzzles = book.puzzles.filter((p) => !isActivityType(p.type));
  const pages = opts.pageCount || estimatePageCount(book);

  // --- Structural ---
  add('min-pages', 'Minimum page count', 'warning', pages >= KDP_MIN_PAGES,
    `KDP requires at least ${KDP_MIN_PAGES} pages — this book has ${pages}. Add more puzzles or activity pages.`);

  add('even-pages', 'Even page count', 'warning', pages % 2 === 0,
    `Page count is ${pages} (odd). KDP pads to even — add one blank page so you control where it lands.`);

  if (Array.isArray(opts.specs)) {
    const wantReal = opts.specs
      .filter((s) => !isActivityType(s.type))
      .reduce((sum, s) => sum + (s.count || 1), 0);
    add('puzzle-count', 'Puzzle count matches config', 'blocker', realPuzzles.length === wantReal,
      `Config asked for ${wantReal} puzzles but the book has ${realPuzzles.length} — a generator may have failed.`);
  }

  add('no-empty', 'No blank puzzle pages', 'blocker', realPuzzles.every(hasPuzzleContent),
    'A puzzle page has no content — regenerate the book or that puzzle.');

  // Word list must still match the grid. After "Break apart puzzle" the list is
  // editable free text; a stray edit could drop a word that's hidden in the grid.
  const wlMiss = wordlistMismatches(book);
  const wlTotal = wlMiss.reduce((n, m) => n + m.missing.length, 0);
  add('wordlist-match', 'Word list matches the grid', 'warning', wlMiss.length === 0,
    wlMiss.length
      ? `${wlTotal} grid word(s) are hidden in the puzzle but no longer printed on the page — e.g. page ${wlMiss[0].page}: ${wlMiss[0].missing.slice(0, 6).join(', ')}. Solvers won't be told to find them. Re-add the missing words or undo the break-apart.`
      : '');

  // Difficulty labels are derived from the audience (Kids → age/grade, Adult →
  // Easy…Expert). Flag when the audience is unset or the listing's reading age
  // contradicts it, so the printed/listed labels stay coherent.
  const da = difficultyAudienceIssue(book);
  add('difficulty-audience', 'Difficulty labels match audience', 'warning', !da, da || '');

  if (book.answerKey) {
    add('key-present', 'Answer key present', 'blocker', realPuzzles.length > 0,
      'Answer key is on but there are no puzzles to key. Add puzzles or turn the key off.');
    add('key-complete', 'Answer key complete', 'blocker', realPuzzles.every(hasSolution),
      'A puzzle is missing its solution, so the answer key would be incomplete.');
  } else {
    add('key-present', 'Answer key present', 'warning', realPuzzles.length === 0,
      'No answer key — most puzzle books need one. Turn it on unless this is intentional.');
  }

  // Bleed guard should follow every coloring/drawing page (unless one already does).
  const ordered = book.puzzles;
  let guardsOk = true;
  for (let i = 0; i < ordered.length; i++) {
    if (DRAWABLE.has(ordered[i].type)) {
      const next = ordered[i + 1];
      if (!next || next.type !== 'bleedguard') { guardsOk = false; break; }
    }
  }
  add('bleed-guards', 'Bleed guards placed', 'warning', guardsOk,
    'A coloring/drawing page has no blank page behind it — marker ink can bleed through. Turn on bleed guard.');

  // --- Front / back matter (matter may be a Book Builder field OR an editor template) ---
  const txt = pageText(book);
  const hasCopyright = (book.frontMatter || []).some((m) => m.kind === 'copyright') || /copyright ©|all rights reserved/.test(txt);
  add('copyright', 'Copyright page', 'warning', hasCopyright,
    'No copyright page. Most published books include one — add the Copyright template in the editor.');

  const hasBack = (book.backMatter || []).length > 0 || /about the author|more books/.test(txt);
  add('back-matter', 'Back matter present', 'warning', hasBack,
    'No back matter. An "about the author" or "more books" page adds polish and cross-promotion.');

  // --- Print readiness ---
  add('trim-consistent', 'Single trim size', 'blocker', Boolean(book.trimSize),
    'Book has no trim size set.');

  add('kdp-page-max', 'Within KDP page limit', 'blocker', pages <= KDP_PAGE_MAX,
    `KDP paperback allows at most ${KDP_PAGE_MAX} pages — this book has ${pages}. Split it into volumes.`);

  // Inside (gutter) margin must grow with page count; thicker books lose more to
  // the binding. Our trim specs use a generous 0.75", so this only trips on very
  // thick books (700+ pages).
  if (book.trimSize) {
    try {
      const layout = getLayout(book.trimSize, { audience: book.audience });
      const gutter = layout.margins.gutter;
      const need = gutterMinInches(pages);
      add('gutter-margin', 'Inside (gutter) margin for page count', 'blocker', gutter >= need - 1e-9,
        `Inside margin is ${gutter}" but a ${pages}-page book needs at least ${need}". Reduce pages or widen the gutter.`);
    } catch (_) { /* unknown trim already flagged by trim-consistent */ }
  }

  const summary = items.reduce(
    (acc, it) => {
      if (it.status === 'pass') acc.passes++;
      else if (it.severity === 'blocker') acc.blockers++;
      else acc.warnings++;
      return acc;
    },
    { blockers: 0, warnings: 0, passes: 0 }
  );
  return { items, summary };
}

// Rough page count when a rendered count isn't supplied: title + front matter +
// content pages + a single answer-key page + back matter. (The real key may span
// several pages — pass opts.pageCount from the rendered PDF for accuracy.)
function estimatePageCount(book) {
  const m = book.meta || {};
  return (
    1 +
    (m.frontMatterCount || 0) +
    book.pages.length +
    (book.answerKey && (m.puzzleCount || 0) > 0 ? 1 : 0) +
    (m.backMatterCount || 0)
  );
}

module.exports = { runChecklist };
