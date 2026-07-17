/**
 * Kakuro — render().
 *
 * Clue (black) cells are split by a diagonal: the DOWN sum sits in the
 * top-right triangle, the ACROSS sum in the bottom-left. White cells are blank
 * on the puzzle and carry the solved digit on the answer key. All dimensions
 * come from the layout.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { rows, cols, grid } = puzzle.data;
  const sol = puzzle.solution.grid;

  const reserveVertical = Math.round(layout.usableHeight * 0.18);
  const cell = Math.max(16, Math.min(
    Math.floor(layout.usableWidth / cols),
    Math.floor((layout.usableHeight - reserveVertical) / rows),
  ));
  const digitFont = Math.round(cell * 0.5);
  const clueFont = Math.max(9, Math.round(cell * 0.3));
  const line = '1px solid #333';

  const trs = [];
  for (let r = 0; r < rows; r++) {
    const tds = [];
    for (let c = 0; c < cols; c++) {
      const cellData = grid[r][c];
      if (cellData.t === 'fill') {
        const v = answerKey ? sol[r][c] : '';
        tds.push(`<td class="fill">${v}</td>`);
      } else {
        const right = cellData.right;
        const down = cellData.down;
        if (right == null && down == null) {
          tds.push('<td class="block"></td>');
        } else {
          const dv = down != null ? `<span class="d">${down}</span>` : '';
          const rv = right != null ? `<span class="a">${right}</span>` : '';
          tds.push(`<td class="clue">${dv}${rv}</td>`);
        }
      }
    }
    trs.push(`<tr>${tds.join('')}</tr>`);
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
  .instructions { text-align: center; margin: 0 0 16px 0; }
  table.kakuro { border-collapse: collapse; margin: 0 auto; }
  table.kakuro td {
    width: ${cell}px; height: ${cell}px; padding: 0; border: ${line};
    text-align: center; vertical-align: middle;
  }
  table.kakuro td.fill { background: #fff; font-size: ${digitFont}px; font-weight: 600; color: #444; }
  table.kakuro td.block { background: #2b2b2b; }
  table.kakuro td.clue {
    position: relative; background: #2b2b2b;
    background-image: linear-gradient(to bottom right,
      transparent 0 calc(50% - 0.8px),
      rgba(255,255,255,.85) calc(50% - 0.8px) calc(50% + 0.8px),
      transparent calc(50% + 0.8px) 100%);
  }
  table.kakuro td.clue .d { position: absolute; top: 1px; right: 3px; color: #fff; font-size: ${clueFont}px; line-height: 1; }
  table.kakuro td.clue .a { position: absolute; bottom: 1px; left: 3px; color: #fff; font-size: ${clueFont}px; line-height: 1; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <table class="kakuro">${trs.join('')}</table>
</body>
</html>`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { render };
