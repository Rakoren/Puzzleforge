/**
 * Crossword — render().
 *
 * Renders the numbered grid (writable cells as bordered boxes, empty space
 * around words left blank for the floating criss-cross look) and the Across /
 * Down clue lists. Answer-key mode fills the solution letters.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { width, height, numbers, cells, across, down } = puzzle.data;
  const solution = puzzle.solution.grid;

  const reserveVertical = Math.round(layout.usableHeight * 0.5);
  const cell = layout.cellSizeFor(Math.max(width, height), reserveVertical);
  const numFont = Math.max(6, Math.round(cell * 0.32));
  const letterFont = Math.round(cell * 0.55);

  const rows = [];
  for (let r = 0; r < height; r++) {
    const tds = [];
    for (let c = 0; c < width; c++) {
      if (!cells[r][c]) {
        tds.push('<td class="blank"></td>');
        continue;
      }
      const n = numbers[r][c];
      const numSpan = n ? `<span class="n">${n}</span>` : '';
      const letter = answerKey && solution[r][c] != null ? `<span class="l">${esc(solution[r][c])}</span>` : '';
      tds.push(`<td class="cell">${numSpan}${letter}</td>`);
    }
    rows.push(`<tr>${tds.join('')}</tr>`);
  }

  const clueList = (title, list) =>
    `<div class="clue-col"><h2>${title}</h2><ol>${list
      .map((c) => `<li><span class="cn">${c.number}.</span> ${esc(c.clue)}</li>`)
      .join('')}</ol></div>`;

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
  table.cw { border-collapse: collapse; margin: 0 auto 18px auto; }
  table.cw td { width: ${cell}px; height: ${cell}px; padding: 0; }
  table.cw td.blank { border: none; }
  table.cw td.cell { border: 1.2px solid #000; position: relative; text-align: center; vertical-align: middle; }
  table.cw td.cell .n { position: absolute; top: 1px; left: 2px; font-size: ${numFont}px; line-height: 1; }
  table.cw td.cell .l { font-size: ${letterFont}px; font-weight: 600; color: ${answerKey ? '#444' : '#000'}; }
  .clues { display: flex; gap: 28px; align-items: flex-start; }
  .clue-col { flex: 1; }
  .clue-col h2 { font-size: ${Math.round(layout.fontSize * 1.1)}px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; border-bottom: 1.5px solid #000; }
  .clue-col ol { list-style: none; padding: 0; margin: 0; }
  .clue-col li { font-size: ${Math.round(layout.fontSize * 0.95)}px; margin-bottom: 4px; break-inside: avoid; }
  .clue-col .cn { font-weight: 700; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <table class="cw">${rows.join('')}</table>
  <div class="clues">
    ${clueList('Across', across)}
    ${clueList('Down', down)}
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
