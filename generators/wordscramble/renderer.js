/**
 * Word Scramble — render().
 *
 * Each scrambled word is listed with letter boxes to write the answer, an
 * optional clue, and an optional first-letter hint. Answer-key mode fills the
 * boxes with the solution.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { entries } = puzzle.data;
  const words = puzzle.solution.words;

  const boxW = Math.max(16, Math.round(layout.fontSize * 1.5));
  const scrambleFont = Math.round(layout.fontSize * 1.25);

  const rows = entries
    .map((e, i) => {
      const answer = words[i];
      const boxes = [];
      for (let k = 0; k < e.length; k++) {
        let ch = '';
        if (answerKey) ch = answer[k];
        else if (e.hint && k === 0) ch = e.hint;
        boxes.push(`<span class="box">${esc(ch) || '&nbsp;'}</span>`);
      }
      const clue = e.clue ? `<span class="clue">${esc(e.clue)}</span>` : '';
      return `<li>
        <span class="num">${i + 1}.</span>
        <span class="scramble">${esc(spaced(e.scrambled))}</span>
        <span class="arrow">&rarr;</span>
        <span class="boxes">${boxes.join('')}</span>
        ${clue}
      </li>`;
    })
    .join('');

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
  .instructions { text-align: center; margin: 0 0 22px 0; }
  ul.scrambles { list-style: none; padding: 0; margin: 0; }
  ul.scrambles li { display: flex; align-items: center; gap: 10px; margin-bottom: ${Math.round(layout.fontSize * 1.2)}px; break-inside: avoid; }
  .num { width: 28px; text-align: right; font-weight: 600; }
  .scramble { font-size: ${scrambleFont}px; font-weight: 700; letter-spacing: 2px; min-width: ${Math.round(layout.usableWidth * 0.28)}px; }
  .arrow { color: #888; }
  .boxes { display: inline-flex; gap: 3px; }
  .box { display: inline-block; width: ${boxW}px; height: ${Math.round(boxW * 1.1)}px; border: 1.5px solid #333; text-align: center; line-height: ${Math.round(boxW * 1.1)}px; font-weight: 700; font-size: ${scrambleFont}px; ${answerKey ? 'color:#777;' : ''} }
  .clue { color: #555; font-style: italic; font-size: ${Math.round(layout.fontSize * 0.95)}px; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <ul class="scrambles">${rows}</ul>
</body>
</html>`;
}

function spaced(s) {
  return s.split('').join(' ');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { render };
