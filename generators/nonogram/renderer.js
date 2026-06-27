/**
 * Nonogram — render().
 *
 * Lays out the puzzle as a table: column clues stacked above each column, row
 * clues to the left of each row, and the empty solving grid in the lower-right.
 * Group lines are drawn every five cells. Answer-key mode fills the solution.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { width, height, rowClues, colClues } = puzzle.data;
  const grid = puzzle.solution.grid;

  const RG = Math.max(1, ...rowClues.map((c) => c.length)); // left gutter width
  const CG = Math.max(1, ...colClues.map((c) => c.length)); // top gutter height
  const tableCols = RG + width;
  const tableRows = CG + height;

  const reserveVertical = Math.round(layout.usableHeight * 0.14);
  const cell = layout.cellSizeFor(Math.max(tableCols, tableRows), reserveVertical);
  const clueFont = Math.max(8, Math.round(cell * 0.46));

  const heavy = '2px solid #000';
  const light = '1px solid #bbb';

  const rows = [];
  for (let tr = 0; tr < tableRows; tr++) {
    const tds = [];
    for (let tc = 0; tc < tableCols; tc++) {
      const inTopGutter = tr < CG;
      const inLeftGutter = tc < RG;

      if (inTopGutter && inLeftGutter) {
        tds.push('<td class="corner"></td>');
        continue;
      }
      if (inTopGutter) {
        const col = tc - RG;
        const clue = colClues[col];
        const idx = tr - (CG - clue.length);
        const val = idx >= 0 ? clue[idx] : '';
        const rb = (col + 1) % 5 === 0 || col === width - 1 ? heavy : light;
        tds.push(`<td class="clue" style="border-right:${rb}">${val === '' ? '' : val}</td>`);
        continue;
      }
      if (inLeftGutter) {
        const row = tr - CG;
        const clue = rowClues[row];
        const idx = tc - (RG - clue.length);
        const val = idx >= 0 ? clue[idx] : '';
        const bb = (row + 1) % 5 === 0 || row === height - 1 ? heavy : light;
        tds.push(`<td class="clue" style="border-bottom:${bb}">${val === '' ? '' : val}</td>`);
        continue;
      }
      // body cell
      const row = tr - CG;
      const col = tc - RG;
      const filledCell = answerKey && grid[row][col];
      const rb = (col + 1) % 5 === 0 || col === width - 1 ? heavy : light;
      const bb = (row + 1) % 5 === 0 || row === height - 1 ? heavy : light;
      const lb = col === 0 ? heavy : light;
      const tb = row === 0 ? heavy : light;
      tds.push(
        `<td class="box${filledCell ? ' on' : ''}" style="border:${light};border-top:${tb};border-left:${lb};border-right:${rb};border-bottom:${bb}"></td>`
      );
    }
    rows.push(`<tr>${tds.join('')}</tr>`);
  }

  const heading = answerKey ? `${esc(puzzle.title)} — Solution` : esc(puzzle.title);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page {
    size: ${layout.widthIn}in ${layout.heightIn}in;
    margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; font-size: ${layout.fontSize}px; color: #000; width: ${layout.usableWidth}px; }
  h1 { font-size: ${Math.round(layout.fontSize * 1.6)}px; margin: 0 0 6px 0; text-align: center; }
  .instructions { text-align: center; margin: 0 0 16px 0; }
  table.nono { border-collapse: collapse; margin: 0 auto; }
  table.nono td { width: ${cell}px; height: ${cell}px; padding: 0; text-align: center; vertical-align: middle; }
  table.nono td.clue { font-size: ${clueFont}px; color: #000; font-weight: 600; }
  table.nono td.corner { border: none; }
  table.nono td.box { background: #fff; }
  table.nono td.box.on { background: #222; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <table class="nono">${rows.join('')}</table>
</body>
</html>`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { render };
