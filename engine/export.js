/**
 * Engine — PDF export pipeline.
 *
 * Renders a puzzle's HTML into a headless Chromium instance and emits a
 * print-ready PDF at the puzzle's trim size. Uses puppeteer-core driving an
 * existing Chromium binary so no browser download is required.
 *
 * Chromium resolution order:
 *   1. opts.executablePath
 *   2. PUPPETEER_EXECUTABLE_PATH / CHROMIUM_PATH env vars
 *   3. a pre-installed Playwright Chromium under /opt/pw-browsers
 *   4. common system chrome/chromium locations
 */
const fs = require('fs');
const path = require('path');
const { getModule, isActivityType } = require('../generators/registry');
const { getLayout } = require('../layouts');
const { frameSvg } = require('./decor');
const { composePage, splitHtml, composeParts } = require('./components');
const {
  renderTitlePage,
  renderCopyrightPage,
  renderBelongsToPage,
  renderIntroPage,
  renderAboutPage,
  renderMoreBooksPage,
  renderAnswerKey,
  answerKeyPages,
  answerKeyPageCount,
} = require('./matter');
const { renderCoverHtml, coverDimensions } = require('./cover');

function findChromium(explicit) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const localAppData = process.env.LOCALAPPDATA || (home && path.join(home, 'AppData', 'Local'));
  const candidates = [
    explicit,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  // Newest Playwright-installed Chromium, if present.
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dirs = fs
      .readdirSync(pwRoot)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const d of dirs) {
      candidates.push(path.join(pwRoot, d, 'chrome-linux', 'chrome'));
    }
  } catch (_) {
    /* pwRoot not present — fine */
  }

  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

/**
 * Render a puzzle to print-ready HTML for a given trim size.
 * @param {object} puzzle standard puzzle object
 * @param {object} [opts]
 * @param {string} [opts.trimSize='8.5x11']
 * @param {'kids'|'adult'} [opts.audience]
 * @param {boolean} [opts.answerKey=false]
 * @returns {string} HTML document
 */
function renderPuzzleHtml(puzzle, opts = {}) {
  const trimSize = opts.trimSize || '8.5x11';
  const audience = opts.audience || (puzzle.difficulty <= 1 ? 'kids' : 'adult');
  const layout = getLayout(trimSize, { audience, textScale: opts.textScale, fontFamily: opts.fontFamily });
  const mod = getModule(puzzle.type);
  let doc = mod.render(puzzle, layout, { answerKey: Boolean(opts.answerKey) });
  // Decorative border, but never on blank/activity pages (bleed guards stay
  // clean; drawing/coloring pages have their own framing).
  if (opts.border && opts.border !== 'none' && !isActivityType(puzzle.type)) {
    doc = applyBorder(doc, layout, opts.border, opts.borderColor);
  }
  // Page Editor decoration layer (recipe v2): an SVG overlaid on top of the
  // puzzle, in the page's usable-area coordinate space (px).
  if (opts.overlay) {
    doc = applyOverlay(doc, layout, opts.overlay);
  }
  return doc;
}

// Inject the editor's decoration SVG as a top overlay covering the usable area.
function applyOverlay(doc, layout, svg) {
  const css =
    `\n  body { position: relative; min-height: ${layout.usableHeight}px; }` +
    `\n  .pf-overlay { position: absolute; top: 0; left: 0; width: ${layout.usableWidth}px; height: ${layout.usableHeight}px; z-index: 5; pointer-events: none; }` +
    `\n  .pf-overlay > svg { width: 100%; height: 100%; display: block; overflow: visible; }\n`;
  let out = doc.replace(/<\/style>/i, `${css}</style>`);
  out = out.replace(/<body([^>]*)>/i, `<body$1><div class="pf-overlay">${svg}</div>`);
  return out;
}

// Inject a vector border as an overlay behind the puzzle content. The frame is
// absolutely positioned over the usable area and painted behind content
// (z-index:-1), so it travels with the page body through combinePages too.
function applyBorder(doc, layout, style, color) {
  const svg = frameSvg(style, layout.usableWidth, layout.usableHeight, { color });
  if (!svg) return doc;
  const css =
    `\n  body { position: relative; min-height: ${layout.usableHeight}px; }` +
    `\n  .pf-frame { position: absolute; inset: 0; z-index: -1; pointer-events: none; }` +
    `\n  .pf-frame svg { width: 100%; height: 100%; display: block; }\n`;
  let out = doc.replace(/<\/style>/i, `${css}</style>`);
  out = out.replace(/<body([^>]*)>/i, `<body$1><div class="pf-frame">${svg}</div>`);
  return out;
}

/**
 * Export a single puzzle to a print-ready PDF.
 * @param {object} puzzle standard puzzle object
 * @param {object} opts
 * @param {string} opts.outPath          destination .pdf path (required)
 * @param {string} [opts.trimSize='8.5x11']
 * @param {'kids'|'adult'} [opts.audience]
 * @param {boolean} [opts.answerKey=false] append an answer-key page
 * @param {string} [opts.executablePath]   override Chromium binary
 * @returns {Promise<{ outPath: string, trimSize: string }>}
 */
// Render a single combined HTML string to a PDF via headless Chromium.
async function htmlToPdf(html, outPath, executablePathOpt) {
  let puppeteer;
  try {
    // eslint-disable-next-line global-require
    puppeteer = require('puppeteer-core');
  } catch (_) {
    throw new Error(
      'export: puppeteer-core is not installed. Run `npm install` before exporting PDFs.'
    );
  }
  const executablePath = findChromium(executablePathOpt);
  if (!executablePath) {
    throw new Error(
      'export: could not locate a Chromium binary. Set PUPPETEER_EXECUTABLE_PATH ' +
        'or pass opts.executablePath.'
    );
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outPath,
      printBackground: true,
      preferCSSPageSize: true, // honor the @page size set by the renderer
    });
  } finally {
    await browser.close();
  }
}

// Pull the <style> blocks and <body> contents out of a full HTML document.
function extractParts(doc) {
  const styles = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(doc)) !== null) styles.push(m[1]);
  const bodyMatch = doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : doc;
  return { style: styles.join('\n'), body };
}

// Extract the first @page rule (book pages all share one trim size).
function extractPageRule(css) {
  const m = css.match(/@page[^{]*\{[^}]*\}/i);
  return m ? m[0] : '';
}

// Scope a page's CSS to a wrapper class so rules from one page cannot affect
// another. @page blocks are stripped (handled globally); html/body selectors
// map to the wrapper itself; everything else is prefixed.
function scopeCss(css, scope) {
  const withoutPage = css.replace(/@page[^{]*\{[^}]*\}/gi, '');
  let out = '';
  const ruleRe = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(withoutPage)) !== null) {
    const decls = m[2].trim();
    if (!decls) continue;
    const selectors = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sel) => {
        if (sel === '*') return `${scope} *`;
        if (sel === 'html' || sel === 'body') return scope;
        if (/^(html|body)\b/.test(sel)) return sel.replace(/^(html|body)\b/, scope);
        return `${scope} ${sel}`;
      });
    out += `${selectors.join(', ')} { ${decls} }\n`;
  }
  return out;
}

/**
 * Combine several full HTML page documents into one document. Each page's CSS
 * is scoped to its own wrapper so styles cannot leak between pages, and a page
 * break is forced before each page after the first. The first page's @page
 * rule governs the sheet size (a book is one trim).
 */
function combinePages(htmlDocs, opts = {}) {
  const footers = opts.footers || [];
  const pageHeight = opts.pageHeight; // px; only set when footers are in play
  const parts = htmlDocs.map(extractParts);
  const pageRule = parts.map((p) => extractPageRule(p.style)).find(Boolean) || '';
  const breakStyle = 'break-before: page; page-break-before: always;';

  const scopedStyles = parts
    .map((p, i) => scopeCss(p.style, `.pf-page-${i}`))
    .join('\n');
  const bodyBlock = parts
    .map((p, i) => {
      const footer = footers[i] ? `<div class="pf-footer">${footers[i]}</div>` : '';
      return `<div class="pf-page pf-page-${i}"${i > 0 ? ` style="${breakStyle}"` : ''}>${p.body}${footer}</div>`;
    })
    .join('');

  // When footers are present, make each page at least a full page tall so an
  // absolutely-positioned footer lands at the bottom margin edge.
  const pageSizing = pageHeight ? `.pf-page { position: relative; min-height: ${pageHeight}px; }` : '';
  const footerCss =
    `.pf-footer { position: absolute; bottom: 0; left: 0; width: 100%; text-align: center;` +
    ` font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #666; }`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  ${pageRule}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .pf-page { break-inside: avoid-page; page-break-inside: avoid; }
  ${pageSizing}
  ${footerCss}
  ${scopedStyles}
  </style></head><body>${bodyBlock}</body></html>`;
}

/**
 * Export a single puzzle to a print-ready PDF.
 * @param {object} puzzle standard puzzle object
 * @param {object} opts
 * @param {string} opts.outPath          destination .pdf path (required)
 * @param {string} [opts.trimSize='8.5x11']
 * @param {'kids'|'adult'} [opts.audience]
 * @param {boolean} [opts.answerKey=false] append an answer-key page
 * @param {string} [opts.executablePath]   override Chromium binary
 * @returns {Promise<{ outPath: string, trimSize: string }>}
 */
async function exportPuzzlePdf(puzzle, opts = {}) {
  if (!opts.outPath) throw new Error('export: opts.outPath is required');
  const trimSize = opts.trimSize || '8.5x11';

  const pages = [renderPuzzleHtml(puzzle, { ...opts, answerKey: false })];
  if (opts.answerKey) pages.push(renderPuzzleHtml(puzzle, { ...opts, answerKey: true }));
  const html = pages.length === 1 ? pages[0] : combinePages(pages);

  await htmlToPdf(html, opts.outPath, opts.executablePath);
  return { outPath: opts.outPath, trimSize };
}

/**
 * Render a full book to a single combined HTML document:
 *   title page → puzzle pages → answer key (if enabled).
 * @param {object} book book object from engine/book.js
 * @returns {string} combined HTML
 */
/**
 * The full book as an ordered list of "leaves" (every physical page): title,
 * front matter, content pages, answer key, back matter. The Page Editor uses
 * this to show and rearrange ALL pages, and the exporter renders from it — so a
 * custom leaf order (reordered / inserted blanks / deleted) round-trips exactly.
 * @returns {Array<{role, matter?, matterKind?, puzzle?, state?, src?}>}
 */
function defaultLeaves(book) {
  const leaves = [{ role: 'title' }];
  for (const fm of book.frontMatter || []) {
    if (fm.kind === 'copyright' || fm.kind === 'belongsTo' || fm.kind === 'intro') {
      leaves.push({ role: 'frontmatter', matter: fm, matterKind: fm.kind });
    }
  }
  book.pages.forEach((pg, i) => leaves.push({ role: 'content', puzzle: pg.puzzle, state: pg.state, src: i }));
  if (book.answerKey && book.meta.puzzleCount > 0) {
    // The answer key can span several pages; give each its own leaf.
    const layout = getLayout(book.trimSize, { audience: book.audience, textScale: book.fontScale, fontFamily: book.fontFamily });
    const n = answerKeyPageCount(book, layout);
    for (let k = 0; k < n; k++) leaves.push({ role: 'answerkey', akIndex: k });
  }
  for (const bm of book.backMatter || []) {
    if (bm.kind === 'about' || bm.kind === 'morebooks') {
      leaves.push({ role: 'backmatter', matter: bm, matterKind: bm.kind });
    }
  }
  return leaves;
}

// Render a matter/title/answer-key leaf's base HTML document.
function renderMatterDoc(book, layout, leaf) {
  if (leaf.role === 'title') return renderTitlePage(book, layout);
  if (leaf.role === 'answerkey') { const pages = answerKeyPages(book, layout); return pages[leaf.akIndex || 0] || pages[pages.length - 1]; }
  const fm = leaf.matter || {};
  switch (fm.kind) {
    case 'copyright': return renderCopyrightPage(book, layout, fm);
    case 'belongsTo': return renderBelongsToPage(book, layout);
    case 'intro': return renderIntroPage(book, layout, fm);
    case 'about': return renderAboutPage(book, layout, fm);
    case 'morebooks': return renderMoreBooksPage(book, layout, fm);
    default: return renderTitlePage(book, layout);
  }
}

// Render one leaf (any page role) to a print-ready HTML document, honoring a
// per-page state (Page Editor layout overrides + border).
function renderLeafDoc(book, layout, styleOpts, leaf) {
  const st = leaf.state || {};
  const border = st.border !== undefined ? st.border : book.border;
  const borderColor = st.borderColor !== undefined ? st.borderColor : book.borderColor;
  const withBorder = (doc) => (border && border !== 'none') ? applyBorder(doc, layout, border, borderColor) : doc;

  if (leaf.role === 'content') {
    const puzzle = leaf.puzzle;
    if (st.layout) return withBorder(composePage(puzzle, layout, st.layout));
    const overlay = st.canvasState && st.canvasState.svg ? st.canvasState.svg : null;
    return renderPuzzleHtml(puzzle, { trimSize: book.trimSize, ...styleOpts, border, borderColor, overlay });
  }
  // Title / front matter / answer key / back matter.
  let doc = renderMatterDoc(book, layout, leaf);
  if (st.layout) { const { style, components } = splitHtml(doc); doc = composeParts(style, components, layout, st.layout); }
  return withBorder(doc);
}

// Whether a leaf carries a printed page number (content puzzles + answer key).
function leafNumbered(leaf) {
  return (leaf.role === 'content' && leaf.puzzle && leaf.puzzle.type !== 'bleedguard') || leaf.role === 'answerkey';
}

function renderBookHtml(book, leaves) {
  const styleOpts = { audience: book.audience, textScale: book.fontScale, fontFamily: book.fontFamily };
  const layout = getLayout(book.trimSize, styleOpts);
  const numbered = book.pageNumbers === true;
  const list = Array.isArray(leaves) ? leaves : defaultLeaves(book);
  const prefix = book.footerText ? `${escFooter(book.footerText)} · ` : '';

  const docs = [];
  const footers = [];
  let n = 0;
  for (const leaf of list) {
    docs.push(renderLeafDoc(book, layout, styleOpts, leaf));
    footers.push(numbered && leafNumbered(leaf) ? `${prefix}${++n}` : null);
  }

  return numbered
    ? combinePages(docs, { footers, pageHeight: layout.usableHeight })
    : combinePages(docs);
}

function escFooter(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Export a full book to a print-ready PDF.
 * @param {object} book book object from engine/book.js
 * @param {object} opts { outPath (required), executablePath?, leaves? }
 *   `leaves` overrides the default page order (Page Editor page plan).
 * @returns {Promise<{ outPath, pages, trimSize }>}
 */
async function exportBookPdf(book, opts = {}) {
  if (!opts.outPath) throw new Error('export: opts.outPath is required');
  const leaves = Array.isArray(opts.leaves) ? opts.leaves : defaultLeaves(book);
  const html = renderBookHtml(book, leaves);
  await htmlToPdf(html, opts.outPath, opts.executablePath);
  return { outPath: opts.outPath, pages: leaves.length, trimSize: book.trimSize };
}

/**
 * Render a heterogeneous list of puzzle pages into one combined HTML document.
 * Each entry is one page. Powers the teacher tools (differentiation sets,
 * class sets, worksheets) where the page sequence is built by the caller.
 * @param {Array<{puzzle:object, trimSize?:string, audience?:string, answerKey?:boolean}>} entries
 * @returns {string} combined HTML
 */
function renderPuzzlesHtml(entries) {
  const docs = entries.map((e) =>
    renderPuzzleHtml(e.puzzle, {
      trimSize: e.trimSize || '8.5x11',
      audience: e.audience,
      answerKey: Boolean(e.answerKey),
    })
  );
  return combinePages(docs);
}

/**
 * Export a list of puzzle pages to a single print-ready PDF.
 * @param {Array} entries see renderPuzzlesHtml
 * @param {object} opts { outPath (required), executablePath? }
 * @returns {Promise<{ outPath: string, pages: number }>}
 */
async function exportPuzzlesPdf(entries, opts = {}) {
  if (!opts.outPath) throw new Error('export: opts.outPath is required');
  if (!entries || !entries.length) throw new Error('export: no puzzles to export');
  const html = renderPuzzlesHtml(entries);
  await htmlToPdf(html, opts.outPath, opts.executablePath);
  return { outPath: opts.outPath, pages: entries.length };
}

/**
 * Export a full-wrap KDP cover to a print-ready PDF.
 * @param {object} config see cover.renderCoverHtml
 * @param {object} opts { outPath (required), executablePath? }
 * @returns {Promise<{ outPath: string, dims: object }>}
 */
async function exportCoverPdf(config, opts = {}) {
  if (!opts.outPath) throw new Error('export: opts.outPath is required');
  const { html, dims } = renderCoverHtml(config);
  await htmlToPdf(html, opts.outPath, opts.executablePath);
  return { outPath: opts.outPath, dims };
}

/**
 * Export an arbitrary standalone HTML document (with its own @page rule) to a
 * print-ready PDF. Used by image tools and other one-off pages.
 * @param {string} html
 * @param {object} opts { outPath (required), executablePath? }
 */
async function exportHtmlPdf(html, opts = {}) {
  if (!opts.outPath) throw new Error('export: opts.outPath is required');
  await htmlToPdf(html, opts.outPath, opts.executablePath);
  return { outPath: opts.outPath };
}

module.exports = {
  exportPuzzlePdf,
  exportBookPdf,
  exportPuzzlesPdf,
  exportCoverPdf,
  exportHtmlPdf,
  renderPuzzleHtml,
  renderPuzzlesHtml,
  renderBookHtml,
  renderCoverHtml,
  coverDimensions,
  combinePages,
  findChromium,
  defaultLeaves,
  renderMatterDoc,
};
