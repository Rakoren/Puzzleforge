/**
 * Word Search — render().
 *
 * Produces a self-contained, print-ready HTML document sized to the trim from
 * the layout. All dimensions come from the layout object — nothing is
 * hardcoded. The exporter feeds this HTML to Puppeteer to emit the PDF.
 *
 * @param {object} puzzle  standard puzzle object (data + solution)
 * @param {object} layout  resolved layout from layouts/getLayout()
 * @param {object} [opts]
 * @param {boolean} [opts.answerKey=false] highlight the solution cells
 * @returns {string} a full HTML document
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { size, grid, words } = puzzle.data;

  // Reserve vertical space for the title, instructions and word list so the
  // grid is sized to fit the remaining usable height.
  const reserveVertical = Math.round(layout.usableHeight * 0.35);
  const cell = layout.cellSizeFor(size, reserveVertical);
  const gridFont = Math.round(cell * 0.5);

  // Build the set of solution cells for answer-key highlighting.
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

  // Word list laid out in balanced columns.
  const cols = words.length > 18 ? 4 : words.length > 9 ? 3 : 2;
  const wordItems = words.map((w) => `<li>${esc(w)}</li>`).join('');

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
  body {
    font-family: ${layout.fontFamily};
    font-size: ${layout.fontSize}px;
    color: #000;
    width: ${layout.usableWidth}px;
  }
  h1 {
    font-size: ${Math.round(layout.fontSize * 1.6)}px;
    margin: 0 0 6px 0;
    text-align: center;
  }
  .instructions {
    text-align: center;
    margin: 0 0 14px 0;
    font-size: ${layout.fontSize}px;
  }
  table.grid {
    border-collapse: collapse;
    margin: 0 auto 16px auto;
  }
  table.grid td {
    width: ${cell}px;
    height: ${cell}px;
    text-align: center;
    vertical-align: middle;
    font-size: ${gridFont}px;
    font-weight: 600;
    letter-spacing: 0;
    border: 1px solid #ddd;
    font-family: ${layout.fontFamily};
  }
  table.grid td.hl {
    background: #d9d9d9;
    border-radius: 50%;
  }
  .wordlist {
    margin: 0 auto;
    max-width: ${layout.usableWidth}px;
  }
  .wordlist h2 {
    font-size: ${Math.round(layout.fontSize * 1.1)}px;
    margin: 0 0 6px 0;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  ul.words {
    columns: ${cols};
    -webkit-columns: ${cols};
    list-style: none;
    padding: 0;
    margin: 0;
    text-align: center;
  }
  ul.words li {
    font-size: ${layout.fontSize}px;
    padding: 2px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
    break-inside: avoid;
  }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <table class="grid">${rows.join('')}</table>
  <div class="wordlist">
    <h2>Words to Find</h2>
    <ul class="words">${wordItems}</ul>
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
