/**
 * Collect the reader-facing text of an assembled book for the content-quality
 * pre-flight (Claude proofread). Unlike the editor's inline proofread (which
 * only sees typed prose), this gathers everything a buyer reads: the book
 * title/subtitle, the listing blurb, front/back matter, and each puzzle's title,
 * instructions, crossword clues, and trivia Q&A.
 *
 * Identical strings are de-duplicated (many puzzles share a title/instruction),
 * and the list is capped, so one review call stays small and cheap.
 */
const { isActivityType } = require('../generators/registry');

const MAX_SNIPPETS = 240;

function collectBookText(book) {
  const out = [];
  const seen = new Set();
  const add = (kind, text) => {
    const t = String(text == null ? '' : text).trim();
    if (t.length < 2 || seen.has(t) || out.length >= MAX_SNIPPETS) return;
    seen.add(t);
    out.push({ id: out.length + 1, kind, text: t });
  };

  if (book.title) add('book-title', book.title);
  if (book.subtitle) add('subtitle', book.subtitle);
  const md = book.metadata || {};
  if (md.description) add('blurb', md.description);

  const matter = [...(book.frontMatter || []), ...(book.backMatter || [])];
  for (const m of matter) {
    for (const k of ['heading', 'title', 'body', 'text', 'intro', 'about', 'blurb']) {
      if (m && m[k] && typeof m[k] === 'string') add('matter', m[k]);
    }
  }

  for (const pg of book.pages || []) {
    const p = pg && pg.puzzle;
    if (!p || isActivityType(p.type)) continue;
    if (p.title) add('puzzle-title', p.title);
    if (p.instructions) add('instruction', p.instructions);
    const d = p.data || {};
    for (const c of [...(d.across || []), ...(d.down || [])]) {
      if (c && c.clue) add('clue', c.clue);
    }
    const qs = (p.solution && p.solution.questions) || [];
    for (const q of qs) { if (q && q.q) add('question', q.q); if (q && q.a) add('answer', q.a); }
  }
  return out;
}

module.exports = { collectBookText, MAX_SNIPPETS };
