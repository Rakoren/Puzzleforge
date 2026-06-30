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

const KDP_MIN_PAGES = 24;
const DRAWABLE = new Set(['coloring', 'drawing']);

// A non-activity puzzle should carry real puzzle data and a solution.
function hasPuzzleContent(p) {
  const d = p.data || {};
  return Boolean(d.grid || d.words || d.cells || d.items || d.clues || d.questions || d.message);
}
function hasSolution(p) {
  const s = p.solution;
  return Boolean(s && typeof s === 'object' && Object.keys(s).length > 0);
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

  // --- Front / back matter ---
  const hasCopyright = (book.frontMatter || []).some((m) => m.kind === 'copyright');
  add('copyright', 'Copyright page', 'warning', hasCopyright,
    'No copyright page. Most published books include one (front matter).');

  add('back-matter', 'Back matter present', 'warning', (book.backMatter || []).length > 0,
    'No back matter. An "about the author" or "more books" page adds polish and cross-promotion.');

  // --- Print readiness ---
  add('trim-consistent', 'Single trim size', 'blocker', Boolean(book.trimSize),
    'Book has no trim size set.');

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
