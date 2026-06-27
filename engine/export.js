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
const { renderTitlePage, renderAnswerKey } = require('./matter');

function findChromium(explicit) {
  const candidates = [
    explicit,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
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

/**
 * Combine several full HTML page documents into one document, preserving every
 * page's styles and forcing a page break before each page after the first.
 * The first page's @page rule governs the sheet size (a book is one trim).
 */
function combinePages(htmlDocs) {
  const parts = htmlDocs.map(extractParts);
  const styleBlock = parts.map((p) => p.style).join('\n');
  const bodyBlock = parts
    .map((p, i) =>
      `<div class="pf-page"${i > 0 ? ' style="break-before: page;"' : ''}>${p.body}</div>`
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  .pf-page { break-inside: avoid-page; }
  ${styleBlock}
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
  for (const { puzzle } of book.pages) {
    docs.push(renderPuzzleHtml(puzzle, { trimSize: book.trimSize, audience: book.audience }));
  }
  if (book.answerKey) docs.push(renderAnswerKey(book, layout));
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

module.exports = {
  exportPuzzlePdf,
  exportBookPdf,
  renderPuzzleHtml,
  renderBookHtml,
  combinePages,
  findChromium,
};
