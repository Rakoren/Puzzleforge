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
const { getModule } = require('../generators/registry');
const { getLayout } = require('../layouts');
const {
  renderTitlePage,
  renderCopyrightPage,
  renderBelongsToPage,
  renderIntroPage,
  renderAnswerKey,
} = require('./matter');

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
  const layout = getLayout(trimSize, { audience });
  const mod = getModule(puzzle.type);
  return mod.render(puzzle, layout, { answerKey: Boolean(opts.answerKey) });
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
function combinePages(htmlDocs) {
  const parts = htmlDocs.map(extractParts);
  const pageRule = parts.map((p) => extractPageRule(p.style)).find(Boolean) || '';
  const breakStyle = 'break-before: page; page-break-before: always;';

  const scopedStyles = parts
    .map((p, i) => scopeCss(p.style, `.pf-page-${i}`))
    .join('\n');
  const bodyBlock = parts
    .map(
      (p, i) =>
        `<div class="pf-page pf-page-${i}"${i > 0 ? ` style="${breakStyle}"` : ''}>${p.body}</div>`
    )
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  ${pageRule}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .pf-page { break-inside: avoid-page; page-break-inside: avoid; }
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
function renderBookHtml(book) {
  const layout = getLayout(book.trimSize, { audience: book.audience });
  const docs = [renderTitlePage(book, layout)];
  for (const fm of book.frontMatter || []) {
    if (fm.kind === 'copyright') docs.push(renderCopyrightPage(book, layout, fm));
    else if (fm.kind === 'belongsTo') docs.push(renderBelongsToPage(book, layout));
    else if (fm.kind === 'intro') docs.push(renderIntroPage(book, layout, fm));
  }
  for (const { puzzle } of book.pages) {
    docs.push(renderPuzzleHtml(puzzle, { trimSize: book.trimSize, audience: book.audience }));
  }
  // Only append an answer key when at least one page actually has an answer
  // (activity-only books — all coloring/drawing — get none).
  if (book.answerKey && book.meta.puzzleCount > 0) docs.push(renderAnswerKey(book, layout));
  return combinePages(docs);
}

/**
 * Export a full book to a print-ready PDF.
 * @param {object} book book object from engine/book.js
 * @param {object} opts { outPath (required), executablePath? }
 * @returns {Promise<{ outPath, pages, trimSize }>}
 */
async function exportBookPdf(book, opts = {}) {
  if (!opts.outPath) throw new Error('export: opts.outPath is required');
  const html = renderBookHtml(book);
  await htmlToPdf(html, opts.outPath, opts.executablePath);
  // pages = title + puzzles + (answer key may span multiple, counted as >=1)
  const pages = 1 + book.pages.length + (book.answerKey ? 1 : 0);
  return { outPath: opts.outPath, pages, trimSize: book.trimSize };
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

module.exports = {
  exportPuzzlePdf,
  exportBookPdf,
  exportPuzzlesPdf,
  renderPuzzleHtml,
  renderPuzzlesHtml,
  renderBookHtml,
  combinePages,
  findChromium,
};
