/**
 * Drawing page — render(). A big framed blank area with the prompt above it and
 * a caption line below. The frame fills the usable area so kids have room to
 * draw. Answer-key mode renders the same page (there is no solution).
 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function render(puzzle, layout) {
  const { prompt, caption } = puzzle.data;
  const titleSize = Math.round(layout.fontSize * 1.8);
  // Reserve room for the heading and caption, then the frame takes the rest.
  // A fixed height (not flex) so the frame stays a proper box in the Page
  // Editor's flow composition too. Reserve enough for a heading that wraps to
  // two lines (long prompts + large print) plus the caption, so the frame never
  // runs off the bottom of the page.
  const frameH = Math.max(120, layout.usableHeight - Math.round(layout.fontSize * 8));

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
  h1 { font-size: ${titleSize}px; margin: 0 0 14px 0; text-align: center; }
  .frame {
    width: 100%; height: ${frameH}px;
    border: 3px solid #000; border-radius: 14px;
  }
  .caption { margin-top: 14px; font-size: ${Math.round(layout.fontSize * 1.1)}px; }
  .caption .line { display: inline-block; border-bottom: 2px solid #000; width: 60%; height: 1.2em; vertical-align: bottom; }
</style>
</head>
<body>
  <h1>${esc(prompt)}</h1>
  <div class="frame"></div>
  <div class="caption">${esc(caption)} <span class="line"></span></div>
</body>
</html>`;
}

module.exports = { render };
