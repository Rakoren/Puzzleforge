/**
 * Even-Odd Sudoku — render(). A 9×9 grid with shaded (even) cells filled and a
 * legend; givens bold, answer-key digits lighter.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { givens, size, shaded } = puzzle.data;
  const solution = puzzle.solution.grid;

  const reserveVertical = Math.round(layout.usableHeight * 0.2);
  const cell = layout.cellSizeFor(size, reserveVertical);
  const digitFont = Math.round(cell * 0.55);
  const thin = '1px solid #999';
  const thick = '2.5px solid #000';

  const rows = [];
  for (let r = 0; r < size; r++) {
    const tds = [];
    for (let c = 0; c < size; c++) {
      const given = givens[r][c] !== 0;
      let value = '', cls = [];
      if (given) { value = givens[r][c]; cls.push('given'); }
      else if (answerKey) { value = solution[r][c]; cls.push('solved'); }
      if (shaded[r][c]) cls.push('even');
      const styles = [
        `border-top:${r % 3 === 0 ? thick : thin}`,
        `border-left:${c % 3 === 0 ? thick : thin}`,
        `border-right:${c === size - 1 ? thick : thin}`,
        `border-bottom:${r === size - 1 ? thick : thin}`,
      ].join(';');
      tds.push(`<td class="${cls.join(' ')}" style="${styles}">${value}</td>`);
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
  .instructions { text-align: center; margin: 0 0 8px 0; }
  .legend { text-align: center; margin: 0 0 16px 0; font-size: ${Math.round(layout.fontSize * 0.85)}px; color: #333; }
  .legend .sw { display: inline-block; width: 14px; height: 14px; background: #dfe6f3; border: 1px solid #99a; vertical-align: -2px; margin: 0 4px; }
  table.sudoku { border-collapse: collapse; margin: 0 auto; }
  table.sudoku td { width: ${cell}px; height: ${cell}px; text-align: center; vertical-align: middle; font-size: ${digitFont}px; font-family: ${layout.fontFamily}; }
  table.sudoku td.even { background: #dfe6f3; }
  table.sudoku td.given { font-weight: 700; color: #000; }
  table.sudoku td.solved { font-weight: 400; color: #777; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <div class="legend"><span class="sw"></span> = even (2,4,6,8) &nbsp;·&nbsp; plain = odd (1,3,5,7,9)</div>
  <table class="sudoku">${rows.join('')}</table>
</body>
</html>`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { render };
