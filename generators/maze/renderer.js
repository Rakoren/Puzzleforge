/**
 * Maze — render().
 *
 * Draws the maze as an inline SVG: walls are line segments on cell edges that
 * have no carved passage. The start opening is on the top-left edge and the
 * finish on the bottom-right. In answer-key mode the solution path is drawn as
 * a polyline through cell centres.
 *
 * All sizing is derived from the layout — the cell size is the largest that
 * fits the maze within the usable area.
 */
const { N, E, S, W } = require('./index');

function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { width, height, cells, start, end } = puzzle.data;

  const reserveVertical = Math.round(layout.usableHeight * 0.16);
  const availW = layout.usableWidth;
  const availH = layout.usableHeight - reserveVertical;
  const cell = Math.max(8, Math.floor(Math.min(availW / width, availH / height)));
  const pad = Math.max(2, Math.round(cell * 0.15));
  const w = width * cell;
  const h = height * cell;
  const stroke = Math.max(1.5, Math.round(cell * 0.08));

  const lines = [];
  const line = (x1, y1, x2, y2) =>
    lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x * cell;
      const py = y * cell;
      const mask = cells[y][x];
      // Draw a wall on each side without an open passage. The start/end cells
      // get an opening on the outer border.
      const isStart = x === start.x && y === start.y;
      const isEnd = x === end.x && y === end.y;
      if ((mask & N) === 0 && !(isStart && y === 0)) line(px, py, px + cell, py);
      if ((mask & W) === 0 && !(isStart && x === 0)) line(px, py, px, py + cell);
      if ((mask & S) === 0 && !(isEnd && y === height - 1)) line(px, py + cell, px + cell, py + cell);
      if ((mask & E) === 0 && !(isEnd && x === width - 1)) line(px + cell, py, px + cell, py + cell);
    }
  }

  let pathSvg = '';
  if (answerKey && puzzle.solution && puzzle.solution.path && puzzle.solution.path.length) {
    const pts = puzzle.solution.path
      .map((p) => `${p.x * cell + cell / 2},${p.y * cell + cell / 2}`)
      .join(' ');
    pathSvg = `<polyline points="${pts}" fill="none" stroke="#c0392b" stroke-width="${Math.max(
      2,
      Math.round(cell * 0.18)
    )}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const markFont = Math.max(8, Math.round(cell * 0.5));
  const startMark = `<text x="${start.x * cell + cell / 2}" y="${start.y * cell + cell / 2}" font-size="${markFont}" text-anchor="middle" dominant-baseline="central" fill="#2c7">S</text>`;
  const endMark = `<text x="${end.x * cell + cell / 2}" y="${end.y * cell + cell / 2}" font-size="${markFont}" text-anchor="middle" dominant-baseline="central" fill="#c0392b">F</text>`;

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
  .instructions { text-align: center; margin: 0 0 14px 0; }
  .maze-wrap { text-align: center; }
  svg.maze { display: block; margin: 0 auto; }
  svg.maze line { stroke: #000; stroke-width: ${stroke}px; stroke-linecap: square; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <div class="maze-wrap">
    <svg class="maze" width="${w + pad * 2}" height="${h + pad * 2}" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}">
      ${pathSvg}
      <g>${lines.join('')}</g>
      ${startMark}${endMark}
    </svg>
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
