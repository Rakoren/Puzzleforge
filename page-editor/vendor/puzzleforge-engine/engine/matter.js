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

const { isActivityType } = require('../generators/registry');

// Activity pages (coloring/drawing/bleed-through) have no answer to print.
function hasAnswer(type) {
  return !isActivityType(type);
}

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

/** Copyright page (publishing front matter). */
function renderCopyrightPage(book, layout, fm) {
  const holder = esc(fm.publisher || book.author || book.title);
  const style = `
  .cp { position: absolute; bottom: 0; left: 0; width: 100%; font-size: ${Math.round(layout.fontSize * 0.95)}px; color: #222; line-height: 1.6; }
  .cp p { margin: 0 0 8px 0; }
  .cp .small { font-size: ${Math.round(layout.fontSize * 0.85)}px; color: #555; }
  .cp-wrap { position: relative; height: ${layout.usableHeight}px; }`;
  const body = `<div class="cp-wrap"><div class="cp">
    <p>Copyright © ${fm.year} ${holder}</p>
    <p>All rights reserved.</p>
    <p class="small">No part of this publication may be reproduced, distributed, or transmitted in
      any form or by any means without the prior written permission of the publisher, except for
      brief quotations in reviews.</p>
    ${fm.rights ? `<p class="small">${esc(fm.rights)}</p>` : ''}
  </div></div>`;
  return pageShell(layout, style, body);
}

/** "This book belongs to" page (kids). */
function renderBelongsToPage(book, layout) {
  const style = `
  .belongs { height: ${layout.usableHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .belongs h2 { font-size: ${Math.round(layout.fontSize * 2.2)}px; margin: 0 0 40px 0; }
  .belongs .line { border-bottom: 3px solid #000; width: 70%; height: 1.6em; }
  .belongs .star { font-size: ${Math.round(layout.fontSize * 2)}px; margin-top: 30px; letter-spacing: 10px; }`;
  const body = `<div class="belongs">
    <h2>This Book Belongs To</h2>
    <div class="line"></div>
    <div class="star">★ ★ ★</div>
  </div>`;
  return pageShell(layout, style, body);
}

/** Optional introduction / welcome page. */
function renderIntroPage(book, layout, fm) {
  const paras = String(fm.text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join('');
  const style = `
  .intro { padding-top: ${Math.round(layout.usableHeight * 0.12)}px; }
  .intro h2 { font-size: ${Math.round(layout.fontSize * 2)}px; text-align: center; margin: 0 0 24px 0; }
  .intro p { font-size: ${Math.round(layout.fontSize * 1.1)}px; line-height: 1.7; margin: 0 0 14px 0; }`;
  const body = `<div class="intro">
    <h2>${esc(fm.heading || 'Welcome!')}</h2>
    ${paras}
  </div>`;
  return pageShell(layout, style, body);
}

/** Back-matter "About the author" page (heading + paragraphs). */
function renderAboutPage(book, layout, bm) {
  const paras = String(bm.text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join('');
  const style = `
  .about-pg { padding-top: ${Math.round(layout.usableHeight * 0.1)}px; }
  .about-pg h2 { font-size: ${Math.round(layout.fontSize * 2)}px; text-align: center; margin: 0 0 24px 0; }
  .about-pg p { font-size: ${Math.round(layout.fontSize * 1.1)}px; line-height: 1.7; margin: 0 0 14px 0; }`;
  return pageShell(layout, style, `<div class="about-pg"><h2>${esc(bm.heading)}</h2>${paras}</div>`);
}

/** Back-matter "More books" page (heading + a centered list of titles). */
function renderMoreBooksPage(book, layout, bm) {
  const items = String(bm.text || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<li>${esc(s)}</li>`)
    .join('');
  const style = `
  .more-pg { padding-top: ${Math.round(layout.usableHeight * 0.12)}px; text-align: center; }
  .more-pg h2 { font-size: ${Math.round(layout.fontSize * 2)}px; margin: 0 0 24px 0; }
  .more-pg ul { list-style: none; padding: 0; margin: 0; }
  .more-pg li { font-size: ${Math.round(layout.fontSize * 1.3)}px; line-height: 2; }`;
  return pageShell(layout, style, `<div class="more-pg"><h2>${esc(bm.heading)}</h2><ul>${items}</ul></div>`);
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

function miniMaze(puzzle, blockWidth) {
  const { width, height, cells, start, end } = puzzle.data;
  const cell = Math.max(5, Math.floor(blockWidth / width));
  const N = 1;
  const E = 2;
  const S = 4;
  const W = 8;
  const w = width * cell;
  const h = height * cell;
  const lines = [];
  const line = (x1, y1, x2, y2) => lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x * cell;
      const py = y * cell;
      const m = cells[y][x];
      if ((m & N) === 0) line(px, py, px + cell, py);
      if ((m & W) === 0) line(px, py, px, py + cell);
      if ((m & S) === 0) line(px, py + cell, px + cell, py + cell);
      if ((m & E) === 0) line(px + cell, py, px + cell, py + cell);
    }
  }
  const pts = (puzzle.solution.path || [])
    .map((p) => `${p.x * cell + cell / 2},${p.y * cell + cell / 2}`)
    .join(' ');
  return `<svg width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}">
    <polyline points="${pts}" fill="none" stroke="#c0392b" stroke-width="${Math.max(1.5, cell * 0.25)}"/>
    <g stroke="#000" stroke-width="1">${lines.join('')}</g>
  </svg>`;
}

function miniNonogram(puzzle, blockWidth) {
  const { width, height } = puzzle.data;
  const grid = puzzle.solution.grid;
  const cell = Math.max(4, Math.floor(blockWidth / width));
  let html = '<table style="border-collapse:collapse">';
  for (let r = 0; r < height; r++) {
    html += '<tr>';
    for (let c = 0; c < width; c++) {
      const on = grid[r][c];
      html += `<td style="width:${cell}px;height:${cell}px;border:0.5px solid #ccc;background:${on ? '#222' : '#fff'}"></td>`;
    }
    html += '</tr>';
  }
  return html + '</table>';
}

function miniAnswer(puzzle, blockWidth) {
  switch (puzzle.type) {
    case 'wordsearch':
    case 'numbersearch':
      return miniWordsearch(puzzle, Math.floor(blockWidth / puzzle.data.size));
    case 'sudoku':
      return miniSudoku(puzzle, Math.floor(blockWidth / puzzle.data.size));
    case 'maze':
      return miniMaze(puzzle, blockWidth);
    case 'cryptogram':
      return `<div class="crypt-ans" style="font-size:${Math.max(9, Math.round(blockWidth / 22))}px">${esc(puzzle.solution.plaintext)}</div>`;
    case 'cipher':
      return `<div class="cipher-ans" style="font-size:${Math.max(9, Math.round(blockWidth / 24))}px">${esc(puzzle.solution.plaintext)}</div>`;
    case 'wordscramble':
    case 'krisskross':
      return `<div class="word-ans">${(puzzle.solution.words || []).map(esc).join(', ')}</div>`;
    case 'crossword':
      return miniCrossword(puzzle, blockWidth);
    case 'nonogram':
      return miniNonogram(puzzle, blockWidth);
    case 'trivia': {
      // Numbers rendered inline (not as <ol> markers) so two-digit numbers like
      // "10." can't overflow the list padding and get clipped.
      const fs = Math.max(9, Math.round(blockWidth / 26));
      const lis = (puzzle.solution.answers || [])
        .map((a, i) => `<li style="margin:0 0 3px 0"><b>${i + 1}.</b> ${esc(a)}</li>`)
        .join('');
      return `<ol class="trivia-ans" style="margin:0;padding:0;list-style:none;font-size:${fs}px">${lis}</ol>`;
    }
    case 'logicgrid': {
      const cats = puzzle.data.categories;
      const rows = puzzle.solution.rows;
      const fs = Math.max(7, Math.min(12, Math.round(blockWidth / (cats.length * 6.5))));
      const cell = `border:0.5px solid #999;padding:1px 3px;text-align:center;font-size:${fs}px`;
      const th = cats.map((c) => `<th style="${cell};font-weight:700;background:#eee">${esc(c.label)}</th>`).join('');
      const body = rows
        .map((r) => `<tr>${cats.map((c) => `<td style="${cell}">${esc(r[c.key])}</td>`).join('')}</tr>`)
        .join('');
      return `<table class="logic-ans" style="border-collapse:collapse;width:100%;table-layout:fixed"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
    }
    case 'wordladder': {
      const fs = Math.max(9, Math.round(blockWidth / 16));
      const chain = (puzzle.solution.ladder || []).map((w) => esc(w.toUpperCase())).join(' &rarr; ');
      return `<div class="ladder-ans" style="font-size:${fs}px;line-height:1.5;font-weight:600">${chain}</div>`;
    }
    case 'wordwheel': {
      const fs = Math.max(8, Math.round(blockWidth / 42));
      const pan = puzzle.solution.pangram;
      const words = (puzzle.solution.words || [])
        .map((w) => (w === pan ? `<b>${esc(w.toUpperCase())}</b>` : esc(w.toUpperCase()))).join(', ');
      return `<div class="wheel-ans" style="font-size:${fs}px;line-height:1.4">`
        + `<b>9-letter word: ${esc(pan.toUpperCase())}</b> (${puzzle.data.count} words)<br>${words}</div>`;
    }
    default:
      return `<div class="generic">(no compact answer view for ${esc(puzzle.type)})</div>`;
  }
}

function miniCrossword(puzzle, blockWidth) {
  const { width, height } = puzzle.data;
  const grid = puzzle.solution.grid;
  const cell = Math.max(8, Math.floor(blockWidth / width));
  const font = Math.max(6, Math.round(cell * 0.6));
  let html = '<table style="border-collapse:collapse">';
  for (let r = 0; r < height; r++) {
    html += '<tr>';
    for (let c = 0; c < width; c++) {
      const ch = grid[r][c];
      if (ch == null) {
        html += `<td style="width:${cell}px;height:${cell}px;background:#000"></td>`;
      } else {
        html += `<td style="width:${cell}px;height:${cell}px;border:0.5px solid #999;text-align:center;font-size:${font}px;font-weight:600">${esc(ch)}</td>`;
      }
    }
    html += '</tr>';
  }
  return html + '</table>';
}

// How many answer blocks fit per row, by type, balancing legibility.
function blocksPerRow(type) {
  if (type === 'sudoku') return 3;
  if (type === 'cryptogram' || type === 'wordscramble' || type === 'krisskross' || type === 'trivia' || type === 'logicgrid' || type === 'cipher') {
    return 1;
  }
  return 2; // wordsearch, numbersearch, maze, crossword, nonogram
}

// Estimate an answer block's rendered height (grid/text + its label), so the
// key can be split into real pages without a browser to measure with.
function estBlockHeight(puzzle, blockWidth, layout) {
  const d = puzzle.data || {};
  const labelH = Math.round(layout.fontSize * 0.9) + 10;
  let grid = 60;
  switch (puzzle.type) {
    case 'wordsearch':
    case 'numbersearch': { const size = d.size || 15; grid = size * Math.floor(blockWidth / size); break; }
    case 'sudoku': { const size = d.size || 9; grid = size * Math.floor(blockWidth / size); break; }
    case 'maze': { const w = d.width || 10, h = d.height || 10; grid = h * Math.max(5, Math.floor(blockWidth / w)); break; }
    case 'crossword': { const w = d.width || 10, h = d.height || 10; grid = h * Math.max(8, Math.floor(blockWidth / w)); break; }
    case 'nonogram': { const w = d.width || 10, h = d.height || 10; grid = h * Math.max(4, Math.floor(blockWidth / w)); break; }
    case 'cryptogram': { const fs = Math.max(9, Math.round(blockWidth / 22)); const len = (puzzle.solution.plaintext || '').length; const perLine = Math.max(1, Math.floor(blockWidth / (fs * 0.62))); grid = Math.ceil(len / perLine) * Math.round(fs * 1.5); break; }
    case 'cipher': { const fs = Math.max(9, Math.round(blockWidth / 24)); const len = (puzzle.solution.plaintext || '').length; const perLine = Math.max(1, Math.floor(blockWidth / (fs * 0.62))); grid = Math.ceil(len / perLine) * Math.round(fs * 1.5); break; }
    case 'wordscramble':
    case 'krisskross': { const fs = layout.fontSize; const txt = (puzzle.solution.words || []).join(', '); const perLine = Math.max(1, Math.floor(blockWidth / (fs * 0.56))); grid = Math.ceil((txt.length || 1) / perLine) * Math.round(fs * 1.5); break; }
    case 'trivia': { const fs = Math.max(9, Math.round(blockWidth / 26)); grid = (puzzle.solution.answers || []).length * Math.round(fs * 1.6); break; }
    case 'logicgrid': { const n = (puzzle.solution.rows || []).length; grid = (n + 1) * Math.round(layout.fontSize * 1.7); break; }
    case 'wordladder': { const fs = Math.max(9, Math.round(blockWidth / 16)); const len = (puzzle.solution.ladder || []).join(' → ').length; const perLine = Math.max(1, Math.floor(blockWidth / (fs * 0.62))); grid = Math.ceil(len / perLine) * Math.round(fs * 1.5); break; }
    case 'wordwheel': { const fs = Math.max(8, Math.round(blockWidth / 42)); const len = (puzzle.solution.words || []).join(', ').length + 40; const perLine = Math.max(1, Math.floor(blockWidth / (fs * 0.6))); grid = (Math.ceil(len / perLine) + 1) * Math.round(fs * 1.4); break; }
    default: grid = 80;
  }
  return Math.ceil(grid) + labelH + 8;
}

const KEY_GAP = 16;
const KEY_ROW_GAP = 16;

// Pack the book's answer blocks into pages. Blocks flow into rows of up to
// blocksPerRow(type) (grouped by matching row width); rows fill a page until the
// usable height is reached, then a new page starts. Returns an array of pages,
// each an array of rows ({ items:[{html,h}], h }).
function packAnswerKey(book, layout) {
  const blocks = book.pages
    .filter(({ puzzle }) => hasAnswer(puzzle.type))
    .map(({ puzzle, pageNumber }, i) => {
      const perRow = blocksPerRow(puzzle.type);
      const blockWidth = Math.floor((layout.usableWidth - KEY_GAP * (perRow - 1)) / perRow);
      const label = `${i + 1}. ${esc(puzzle.title)} (p.${pageNumber})`;
      const html = `<div class="key-block" style="width:${blockWidth}px"><p class="label">${label}</p>${miniAnswer(puzzle, blockWidth)}</div>`;
      return { html, h: estBlockHeight(puzzle, blockWidth, layout), perRow };
    });

  const rows = [];
  let cur = null;
  for (const b of blocks) {
    if (!cur || cur.perRow !== b.perRow || cur.items.length >= b.perRow) { cur = { perRow: b.perRow, items: [], h: 0 }; rows.push(cur); }
    cur.items.push(b); cur.h = Math.max(cur.h, b.h);
  }

  const titleH = Math.round(layout.fontSize * 1.8) + 26;
  const budget = layout.usableHeight - titleH;
  const pages = [];
  let curRows = [], curH = 0;
  for (const r of rows) {
    const add = r.h + (curRows.length ? KEY_ROW_GAP : 0);
    if (curRows.length && curH + add > budget) { pages.push(curRows); curRows = []; curH = 0; }
    curRows.push(r); curH += r.h + (curRows.length > 1 ? KEY_ROW_GAP : 0);
  }
  if (curRows.length) pages.push(curRows);
  return pages;
}

function keyPageStyle(layout) {
  return `
  h1.key-title { font-size: ${Math.round(layout.fontSize * 1.8)}px; text-align: center; margin: 0 0 18px 0; }
  .key-row { display: flex; gap: ${KEY_GAP}px; align-items: flex-start; margin-bottom: ${KEY_ROW_GAP}px; }
  .key-block { break-inside: avoid; }
  .key-block .label { font-size: ${Math.round(layout.fontSize * 0.9)}px; margin: 0 0 4px 0; font-weight: 700; }`;
}

/**
 * Back-of-book answer key, paginated into as many pages as needed so nothing
 * overflows the trim. Returns an array of standalone page documents.
 */
function answerKeyPages(book, layout) {
  const pages = packAnswerKey(book, layout);
  if (!pages.length) return [pageShell(layout, keyPageStyle(layout), `<h1 class="key-title">Answer Key</h1>`)];
  return pages.map((rows, i) => {
    const suffix = pages.length > 1 ? ` (${i + 1} of ${pages.length})` : '';
    const body = `<h1 class="key-title">Answer Key${suffix}</h1>` +
      rows.map((r) => `<div class="key-row">${r.items.map((it) => it.html).join('')}</div>`).join('');
    return pageShell(layout, keyPageStyle(layout), body);
  });
}

/** Number of physical pages the answer key spans. */
function answerKeyPageCount(book, layout) {
  const n = packAnswerKey(book, layout).length;
  return n || 1;
}

/** Back-of-book answer key — first page (kept for API compatibility). */
function renderAnswerKey(book, layout) {
  return answerKeyPages(book, layout)[0];
}

module.exports = {
  renderTitlePage,
  renderCopyrightPage,
  renderBelongsToPage,
  renderIntroPage,
  renderAboutPage,
  renderMoreBooksPage,
  renderAnswerKey,
  answerKeyPages,
  answerKeyPageCount,
  pageShell,
};
