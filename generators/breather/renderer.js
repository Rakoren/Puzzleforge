/**
 * Breather page — render(). Centered, calm content between puzzle sets.
 * Answer-key mode is identical (there is no solution).
 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function render(puzzle, layout) {
  const { kind, text, source } = puzzle.data;
  const fs = layout.fontSize;

  let inner;
  if (kind === 'quote') {
    inner = `<blockquote class="quote">“${esc(text)}”</blockquote>` +
      (source ? `<div class="source">— ${esc(source)}</div>` : '');
  } else if (kind === 'fact') {
    inner = `<div class="fact-head">Did you know?</div><div class="fact">${esc(text)}</div>`;
  } else if (kind === 'blank') {
    inner = '';
  } else {
    inner = `<div class="ornament">❖ ❖ ❖</div>`;
  }

  const style = `
  .breather { height: ${layout.usableHeight}px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; padding: 0 8%; }
  .quote { font-family: Georgia, 'Times New Roman', serif; font-style: italic;
    font-size: ${Math.round(fs * 1.8)}px; line-height: 1.5; margin: 0; color: #1c2330; }
  .source { margin-top: 18px; font-size: ${Math.round(fs * 1.1)}px; color: #555; }
  .fact-head { font-size: ${Math.round(fs * 1.5)}px; font-weight: 700; letter-spacing: .5px;
    color: #2f49b0; margin-bottom: 16px; }
  .fact { font-size: ${Math.round(fs * 1.5)}px; line-height: 1.5; color: #1c2330; }
  .ornament { font-size: ${Math.round(fs * 2)}px; color: #888; letter-spacing: 10px; }`;

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
  body { font-family: ${layout.fontFamily}; font-size: ${fs}px; color: #000; width: ${layout.usableWidth}px; }
  ${style}
</style>
</head>
<body>
  <div class="breather">${inner}</div>
</body>
</html>`;
}

module.exports = { render };
