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
async function exportPuzzlePdf(puzzle, opts = {}) {
  if (!opts.outPath) throw new Error('export: opts.outPath is required');
  const trimSize = opts.trimSize || '8.5x11';

  let puppeteer;
  try {
    // eslint-disable-next-line global-require
    puppeteer = require('puppeteer-core');
  } catch (_) {
    throw new Error(
      'export: puppeteer-core is not installed. Run `npm install` before exporting PDFs.'
    );
  }

  const executablePath = findChromium(opts.executablePath);
  if (!executablePath) {
    throw new Error(
      'export: could not locate a Chromium binary. Set PUPPETEER_EXECUTABLE_PATH ' +
        'or pass opts.executablePath.'
    );
  }

  // The puzzle page, plus an optional answer-key page joined with a page break.
  const pages = [renderPuzzleHtml(puzzle, { ...opts, answerKey: false })];
  if (opts.answerKey) {
    pages.push(renderPuzzleHtml(puzzle, { ...opts, answerKey: true }));
  }
  const html = joinPages(pages);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: opts.outPath,
      printBackground: true,
      preferCSSPageSize: true, // honor the @page size set by the renderer
    });
  } finally {
    await browser.close();
  }

  return { outPath: opts.outPath, trimSize };
}

// Concatenate multiple full HTML docs into one, separating each with a forced
// page break. We splice the bodies together so a single @page rule applies.
function joinPages(htmlDocs) {
  if (htmlDocs.length === 1) return htmlDocs[0];
  const headMatch = htmlDocs[0].match(/<head>[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : '<head></head>';
  const bodies = htmlDocs.map((doc) => {
    const m = doc.match(/<body>([\s\S]*?)<\/body>/i);
    return m ? m[1] : doc;
  });
  const joined = bodies
    .map((b, i) =>
      i === 0
        ? `<div class="pf-page">${b}</div>`
        : `<div class="pf-page" style="break-before: page;">${b}</div>`
    )
    .join('');
  return `<!doctype html><html lang="en">${head}<body>${joined}</body></html>`;
}

module.exports = { exportPuzzlePdf, renderPuzzleHtml, findChromium };
