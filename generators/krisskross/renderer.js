/**
 * Kriss-Kross — render().
 *
 * Empty grid of writable boxes (with an optional revealed starter letter) plus
 * the word bank grouped by length. Answer-key mode fills the grid.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { width, height, cells, wordBank, starter } = puzzle.data;
  const solution = puzzle.solution.grid;

  const reserveVertical = Math.round(layout.usableHeight * 0.32);
  const cell = layout.cellSizeFor(Math.max(width, height), reserveVertical);
  const letterFont = Math.round(cell * 0.55);

  const rows = [];
  for (let r = 0; r < height; r++) {
    const tds = [];
    for (let c = 0; c < width; c++) {
      if (!cells[r][c]) {
        tds.push('<td class="blank"></td>');
        continue;
      }
      let ch = '';
      let cls = 'cell';
      if (answerKey) {
        ch = solution[r][c];
      } else if (starter && starter.row === r && starter.col === c) {
        ch = starter.letter;
        cls = 'cell given';
      }
      tds.push(`<td class="${cls}">${esc(ch)}</td>`);
    }
    rows.push(`<tr>${tds.join('')}</tr>`);
  }

  const bank = wordBank
    .map(
      (group) =>
        `<div class="len-group"><h3>${group.len} letters</h3><ul>${group.words
          .map((w) => `<li>${esc(w)}</li>`)
          .join('')}</ul></div>`
    )
    .join('');

  const heading = answerKey ? `${esc(puzzle.title)} — Answer Key` : esc(puzzle.title);

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
  .instructions { text-align: center; margin: 0 0 14px 0; }
  table.kk { border-collapse: collapse; margin: 0 auto 18px auto; }
  table.kk td { width: ${cell}px; height: ${cell}px; padding: 0; text-align: center; vertical-align: middle; font-size: ${letterFont}px; }
  table.kk td.blank { border: none; }
  table.kk td.cell { border: 1.2px solid #000; font-weight: 600; color: ${answerKey ? '#444' : '#000'}; }
  table.kk td.given { font-weight: 700; color: #000; background: #eee; }
  .bank { display: flex; flex-wrap: wrap; gap: 10px 26px; justify-content: center; }
  .len-group h3 { font-size: ${Math.round(layout.fontSize * 0.95)}px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #999; }
  .len-group ul { list-style: none; padding: 0; margin: 0; }
  .len-group li { font-size: ${Math.round(layout.fontSize * 0.95)}px; letter-spacing: 1px; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <table class="kk">${rows.join('')}</table>
  <div class="bank">${bank}</div>
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
