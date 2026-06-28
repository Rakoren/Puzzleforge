/**
 * Number Search — render().
 *
 * Same layout as a word search: a grid of digits with a "Numbers to Find"
 * list. Answer-key mode highlights the solution cells.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { size, grid, numbers } = puzzle.data;

  const reserveVertical = Math.round(layout.usableHeight * 0.32);
  const cell = layout.cellSizeFor(size, reserveVertical);
  const gridFont = Math.round(cell * 0.5);

  const solutionCells = new Set();
  if (answerKey && puzzle.solution && puzzle.solution.placements) {
    for (const p of puzzle.solution.placements) {
      for (const [r, c] of p.cells) solutionCells.add(`${r},${c}`);
    }
  }

  const rows = [];
  for (let r = 0; r < size; r++) {
    const cells = [];
    for (let c = 0; c < size; c++) {
      const hl = solutionCells.has(`${r},${c}`) ? ' class="hl"' : '';
      cells.push(`<td${hl}>${esc(grid[r][c])}</td>`);
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }

  const cols = numbers.length > 18 ? 5 : numbers.length > 9 ? 4 : 3;
  const items = numbers.map((n) => `<li>${esc(n)}</li>`).join('');
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
  table.grid { border-collapse: collapse; margin: 0 auto 16px auto; }
  table.grid td { width: ${cell}px; height: ${cell}px; text-align: center; vertical-align: middle; font-size: ${gridFont}px; font-weight: 600; border: 1px solid #ddd; }
  table.grid td.hl { background: #d9d9d9; border-radius: 50%; }
  .numlist { margin: 0 auto; max-width: ${layout.usableWidth}px; }
  .numlist h2 { font-size: ${Math.round(layout.fontSize * 1.1)}px; margin: 0 0 6px 0; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
  ul.nums { columns: ${cols}; -webkit-columns: ${cols}; list-style: none; padding: 0; margin: 0; text-align: center; }
  ul.nums li { font-size: ${layout.fontSize}px; padding: 2px 0; letter-spacing: 1px; break-inside: avoid; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <table class="grid">${rows.join('')}</table>
  <div class="numlist">
    <h2>Numbers to Find</h2>
    <ul class="nums">${items}</ul>
  </div>
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
