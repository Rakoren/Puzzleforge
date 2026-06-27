/**
 * Engine — front/back matter templates.
 *
 * Renders the title page and the back-of-book answer-key section. Each
 * function returns a full standalone HTML document; the exporter extracts the
 * <style> and <body> of every page and concatenates them into a single PDF,
 * so per-page styles are preserved.
 *
 * Answer-key entries are rendered compactly (several per page) by small,
 * self-contained per-type renderers. New puzzle types add a case to
 * miniAnswer(); everything else is generic.
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pageShell(layout, style, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${layout.widthIn}in ${layout.heightIn}in; margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; font-size: ${layout.fontSize}px; color: #000; width: ${layout.usableWidth}px; }
  ${style}
  </style></head><body>${body}</body></html>`;
}

/** Title / front-matter page. */
function renderTitlePage(book, layout) {
  const style = `
  .title-wrap { height: ${layout.usableHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .title-wrap h1 { font-size: ${Math.round(layout.fontSize * 3)}px; margin: 0 0 12px 0; letter-spacing: 1px; }
  .title-wrap .subtitle { font-size: ${Math.round(layout.fontSize * 1.4)}px; color: #333; margin-bottom: 28px; }
  .title-wrap .author { font-size: ${Math.round(layout.fontSize * 1.2)}px; color: #000; margin-top: 36px; }
  .title-wrap .count { font-size: ${layout.fontSize}px; color: #555; margin-top: 8px; }`;
  const body = `<div class="title-wrap">
    <h1>${esc(book.title)}</h1>
    ${book.subtitle ? `<div class="subtitle">${esc(book.subtitle)}</div>` : ''}
    <div class="count">${book.meta.puzzleCount} puzzles</div>
    ${book.author ? `<div class="author">${esc(book.author)}</div>` : ''}
  </div>`;
  return pageShell(layout, style, body);
}

// --- compact per-type answer renderers -------------------------------------

function miniWordsearch(puzzle, cellPx) {
  const { size, grid } = puzzle.data;
  const cells = new Set();
  for (const p of puzzle.solution.placements || []) {
    for (const [r, c] of p.cells) cells.add(`${r},${c}`);
  }
  const font = Math.max(5, Math.round(cellPx * 0.6));
  let html = `<table class="mini-ws" style="border-collapse:collapse">`;
  for (let r = 0; r < size; r++) {
    html += '<tr>';
    for (let c = 0; c < size; c++) {
      const hl = cells.has(`${r},${c}`);
      html += `<td style="width:${cellPx}px;height:${cellPx}px;font-size:${font}px;text-align:center;` +
        `border:0.5px solid #eee;${hl ? 'background:#cfcfcf;font-weight:700;' : 'color:#aaa;'}">${esc(grid[r][c])}</td>`;
    }
    html += '</tr>';
  }
  return html + '</table>';
}

function miniSudoku(puzzle, cellPx) {
  const { size, givens } = puzzle.data;
  const sol = puzzle.solution.grid;
  const font = Math.max(5, Math.round(cellPx * 0.62));
  let html = `<table class="mini-su" style="border-collapse:collapse">`;
  for (let r = 0; r < size; r++) {
    html += '<tr>';
    for (let c = 0; c < size; c++) {
      const given = givens[r][c] !== 0;
      const bt = r % 3 === 0 ? '1.5px solid #000' : '0.5px solid #999';
      const bl = c % 3 === 0 ? '1.5px solid #000' : '0.5px solid #999';
      const br = c === size - 1 ? '1.5px solid #000' : '0.5px solid #999';
      const bb = r === size - 1 ? '1.5px solid #000' : '0.5px solid #999';
      html += `<td style="width:${cellPx}px;height:${cellPx}px;font-size:${font}px;text-align:center;` +
        `border-top:${bt};border-left:${bl};border-right:${br};border-bottom:${bb};` +
        `${given ? 'font-weight:700;color:#000;' : 'color:#777;'}">${sol[r][c]}</td>`;
    }
    html += '</tr>';
  }
  return html + '</table>';
}

function miniAnswer(puzzle, blockWidth) {
  switch (puzzle.type) {
    case 'wordsearch':
      return miniWordsearch(puzzle, Math.floor(blockWidth / puzzle.data.size));
    case 'sudoku':
      return miniSudoku(puzzle, Math.floor(blockWidth / puzzle.data.size));
    default:
      return `<div class="generic">(no compact answer view for ${esc(puzzle.type)})</div>`;
  }
}

// How many answer blocks fit per row, by type, balancing legibility.
function blocksPerRow(type) {
  if (type === 'sudoku') return 3;
  return 2; // wordsearch and default
}

/** Back-of-book answer-key section. Overflow paginates naturally in print. */
function renderAnswerKey(book, layout) {
  const gap = 16;
  const style = `
  h1.key-title { font-size: ${Math.round(layout.fontSize * 1.8)}px; text-align: center; margin: 0 0 18px 0; }
  .key-grid { display: flex; flex-wrap: wrap; gap: ${gap}px; align-items: flex-start; }
  .key-block { break-inside: avoid; }
  .key-block .label { font-size: ${Math.round(layout.fontSize * 0.9)}px; margin: 0 0 4px 0; font-weight: 700; }`;

  const blocks = book.pages
    .map(({ puzzle, pageNumber }, i) => {
      const perRow = blocksPerRow(puzzle.type);
      const blockWidth = Math.floor((layout.usableWidth - gap * (perRow - 1)) / perRow);
      const label = `${i + 1}. ${esc(puzzle.title)} (p.${pageNumber})`;
      return `<div class="key-block" style="width:${blockWidth}px">
        <p class="label">${label}</p>
        ${miniAnswer(puzzle, blockWidth)}
      </div>`;
    })
    .join('');

  const body = `<h1 class="key-title">Answer Key</h1><div class="key-grid">${blocks}</div>`;
  return pageShell(layout, style, body);
}

module.exports = { renderTitlePage, renderAnswerKey, pageShell };
