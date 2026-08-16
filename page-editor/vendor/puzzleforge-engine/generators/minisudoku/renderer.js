/**
 * Mini Sudoku (6×6) — render(). A 6×6 grid with bold 2×3 box borders; givens
 * bold, answer-key digits lighter.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { givens, size, boxR, boxC } = puzzle.data;
  const solution = puzzle.solution.grid;

  const reserveVertical = Math.round(layout.usableHeight * 0.2);
  // A 6×6 grid can afford larger cells than a 9×9; cap so it doesn't fill the page.
  const cell = Math.min(layout.cellSizeFor(size, reserveVertical), Math.round(layout.usableWidth / 7));
  const digitFont = Math.round(cell * 0.5);
  const thin = '1px solid #999';
  const thick = '2.5px solid #000';

  const rows = [];
  for (let r = 0; r < size; r++) {
    const tds = [];
    for (let c = 0; c < size; c++) {
      const given = givens[r][c] !== 0;
      let value = '', cls = '';
      if (given) { value = givens[r][c]; cls = 'given'; }
      else if (answerKey) { value = solution[r][c]; cls = 'solved'; }
      const styles = [
        `border-top:${r % boxR === 0 ? thick : thin}`,
        `border-left:${c % boxC === 0 ? thick : thin}`,
        `border-right:${c === size - 1 ? thick : thin}`,
        `border-bottom:${r === size - 1 ? thick : thin}`,
      ].join(';');
      tds.push(`<td class="${cls}" style="${styles}">${value}</td>`);
    }
    rows.push(`<tr>${tds.join('')}</tr>`);
  }

  const heading = answerKey ? `${esc(puzzle.title)} — Answer Key` : esc(puzzle.title);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page { size: ${layout.widthIn}in ${layout.heightIn}in; margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; font-size: ${layout.fontSize}px; color: #000; width: ${layout.usableWidth}px; }
  h1 { font-size: ${Math.round(layout.fontSize * 1.6)}px; margin: 0 0 6px 0; text-align: center; }
  .instructions { text-align: center; margin: 0 0 18px 0; }
  table.sudoku { border-collapse: collapse; margin: 0 auto; }
  table.sudoku td { width: ${cell}px; height: ${cell}px; text-align: center; vertical-align: middle; font-size: ${digitFont}px; font-family: ${layout.fontFamily}; }
  table.sudoku td.given { font-weight: 700; color: #000; }
  table.sudoku td.solved { font-weight: 400; color: #777; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <table class="sudoku">${rows.join('')}</table>
</body>
</html>`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { render };
