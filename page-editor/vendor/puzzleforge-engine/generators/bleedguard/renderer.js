/**
 * Bleed-through guard page — render(). A blank page with an optional faint,
 * centered footer note. Answer-key mode is identical (no solution).
 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function render(puzzle, layout) {
  const label = (puzzle.data && puzzle.data.label) || '';
  const note = label
    ? `<div class="note">${esc(label)}</div>`
    : '';
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
  body { font-family: ${layout.fontFamily}; color: #000; width: ${layout.usableWidth}px; height: ${layout.usableHeight}px; position: relative; }
  .note {
    position: absolute; bottom: 0; left: 0; width: 100%;
    text-align: center; color: #bbb; font-size: ${Math.round(layout.fontSize * 0.8)}px;
  }
</style>
</head>
<body>${note}</body>
</html>`;
}

module.exports = { render };
