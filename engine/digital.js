/**
 * Digital layer — QR "scan for answers" pages for a printed book.
 *
 * Each real (non-activity) puzzle in a book gets a static landing page that
 * reveals its answer, and a QR code on the printed puzzle page that links to
 * that landing page. The landing pages are self-contained HTML (inline CSS +
 * the puzzle's own answer-key render), meant to be dropped onto any static
 * host; the QR encodes `<baseUrl>/<book-slug>/p<n>.html`.
 *
 * Split across two responsibilities so `export.js` can draw the printed QR
 * without pulling in the (heavier) landing-page renderer:
 *   - planDigital / qrSvg  — pure, no dependency on the PDF pipeline
 *   - renderLandingPages   — lazily requires export.js for the answer render
 */
const { encode } = require('./qr');
const { isActivityType } = require('../generators/registry');

function slugify(s) {
  return String(s || 'book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'book';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plan the digital layer for a book: assign each real puzzle a stable page
 * number, filename, and full URL.
 * @param {object} book  assembled book (needs `.puzzles`, `.title`)
 * @param {object} [opts] { baseUrl, mode }
 * @returns {{ baseUrl, slug, mode, caption, entries, byPuzzle }}
 */
function planDigital(book, opts = {}) {
  const slug = slugify(book && book.title);
  const baseUrl = String(opts.baseUrl || '').trim().replace(/\/+$/, '');
  const mode = opts.mode === 'hint' || opts.mode === 'both' ? opts.mode : 'answer';
  const reals = (book && Array.isArray(book.puzzles) ? book.puzzles : []).filter((p) => p && !isActivityType(p.type));
  const entries = reals.map((puzzle, i) => {
    const n = i + 1;
    const filename = `p${n}.html`;
    const url = `${baseUrl}/${slug}/${filename}`;
    return { puzzle, n, filename, url, title: puzzle.title || `Puzzle ${n}` };
  });
  const byPuzzle = new Map(entries.map((e) => [e.puzzle, e]));
  return { baseUrl, slug, mode, caption: opts.caption || 'Scan for the answer', entries, byPuzzle };
}

/**
 * A crisp, self-contained QR as an inline SVG string (renders in the PDF and
 * on screen identically — Chromium draws inline SVG in both).
 */
function qrSvg(text, opts = {}) {
  const { modules, count } = encode(text, { ecl: opts.ecl || 'M' });
  const quiet = opts.margin != null ? opts.margin : 4;
  const dim = count + quiet * 2;
  const size = opts.size || 120;
  const fg = /^#[0-9a-fA-F]{3,8}$/.test(opts.fg || '') ? opts.fg : '#000000';
  let rects = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (modules[r][c]) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`
    + `<rect width="${dim}" height="${dim}" fill="#ffffff"/><g fill="${fg}">${rects}</g></svg>`;
}

// Pull the <style> blocks and <body> contents out of a rendered puzzle doc.
function extractParts(doc) {
  const styles = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(doc)) !== null) styles.push(m[1]);
  const body = (doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [null, doc])[1];
  // Drop the print @page rule — these pages are viewed on a phone, not printed.
  const style = styles.join('\n').replace(/@page[^{]*\{[^}]*\}/gi, '');
  return { style, body };
}

const SHELL_CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f6f8; color: #1a1a1a; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 20px 16px 60px; }
  .card { background: #fff; border-radius: 14px; box-shadow: 0 2px 14px rgba(0,0,0,.08); padding: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 14px; margin: 0 0 18px; }
  button.reveal { appearance: none; border: 0; background: #3b5bdb; color: #fff; font-size: 16px; font-weight: 600; padding: 12px 20px; border-radius: 10px; cursor: pointer; width: 100%; }
  button.reveal:hover { background: #364fc7; }
  .answer { margin-top: 18px; }
  .answer[hidden] { display: none; }
  .answer-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e6e6e6; border-radius: 10px; padding: 10px; background: #fff; }
  .foot { text-align: center; color: #999; font-size: 12px; margin-top: 26px; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181d; color: #e8e8e8; }
    .card { background: #22252c; box-shadow: none; }
    .sub { color: #a9adb5; }
    .answer-scroll { background: #fff; }
  }
`;

function landingHtml(book, entry, ansStyle, ansBody, opts = {}) {
  const bookTitle = esc(book.title || 'Puzzle Book');
  const pTitle = esc(entry.title);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pTitle} — Answer</title>
<style>${SHELL_CSS}</style>
<style>${ansStyle}</style>
</head><body>
<div class="wrap"><div class="card">
  <h1>${bookTitle}</h1>
  <p class="sub">Puzzle ${entry.n}: ${pTitle}</p>
  <button class="reveal" id="revealBtn" onclick="var a=document.getElementById('ans');a.hidden=false;this.style.display='none';">Show the answer</button>
  <div class="answer" id="ans" hidden><div class="answer-scroll">${ansBody}</div></div>
</div>
<p class="foot">Powered by PuzzleForge · <a href="index.html">All puzzles</a></p>
</div>
</body></html>`;
}

function indexHtml(book, plan) {
  const items = plan.entries.map((e) => `<li><a href="${esc(e.filename)}">Puzzle ${e.n}: ${esc(e.title)}</a></li>`).join('\n');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(book.title || 'Puzzle Book')} — Answers</title>
<style>${SHELL_CSS} ul{list-style:none;padding:0;margin:0} li{margin:0 0 2px} li a{display:block;padding:12px 14px;background:#fff;border-radius:10px;text-decoration:none;color:#1a1a1a;border:1px solid #eee} @media(prefers-color-scheme:dark){li a{background:#22252c;color:#e8e8e8;border-color:#2c2f37}}</style>
</head><body>
<div class="wrap">
  <h1>${esc(book.title || 'Puzzle Book')}</h1>
  <p class="sub">Scan a puzzle's QR code, or tap a puzzle below to see its answer.</p>
  <ul>${items}</ul>
  <p class="foot">Powered by PuzzleForge</p>
</div>
</body></html>`;
}

/**
 * Render the landing-page files for a book's digital plan.
 * @returns {Array<{ filename, html }>}  files to write under the book slug folder
 */
function renderLandingPages(book, plan) {
  // Lazy require: export.js requires this module for qrSvg, so importing it at
  // top would create a cycle. By call time export.js is fully loaded.
  const { renderPuzzleHtml } = require('./export');
  const files = plan.entries.map((e) => {
    const ak = renderPuzzleHtml(e.puzzle, { trimSize: book.trimSize, audience: book.audience, answerKey: true });
    const { style, body } = extractParts(ak);
    return { filename: e.filename, html: landingHtml(book, e, style, body, { mode: plan.mode }) };
  });
  files.push({ filename: 'index.html', html: indexHtml(book, plan) });
  return files;
}

module.exports = { planDigital, qrSvg, renderLandingPages, slugify };
