/**
 * Word Ladder — render().
 *
 * A vertical ladder: the start word on top, the end word on the bottom, and a
 * boxed row of letter cells for each rung between them. Revealed hint letters
 * are pre-printed; blanks are for the solver. Answer-key mode fills every rung.
 */
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { start, end, steps, rungs, length } = puzzle.data;
  const ladder = puzzle.solution.ladder;

  const cell = Math.max(28, Math.round(layout.fontSize * 2.4));
  const letterFs = Math.round(cell * 0.5);

  const rowOf = (word, cls, pattern) => {
    const cells = [];
    for (let j = 0; j < length; j++) {
      let ch = '';
      if (cls === 'fixed') ch = word[j];
      else if (answerKey) ch = word[j];
      else ch = pattern && pattern[j] != null ? pattern[j] : '';
      const hintCls = cls === 'rung' && !answerKey && pattern && pattern[j] != null ? ' hint' : '';
      cells.push(`<span class="cell${hintCls}">${esc((ch || '').toUpperCase()) || '&nbsp;'}</span>`);
    }
    return `<div class="rung ${cls}">${cells.join('')}</div>`;
  };

  const rows = [rowOf(start, 'fixed')];
  for (let i = 1; i < steps - 1; i++) rows.push(rowOf(ladder[i], 'rung', rungs[i - 1]));
  rows.push(rowOf(end, 'fixed'));
  const ladderHtml = rows.join('<div class="arrow">↓</div>');

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
  .instructions { text-align: center; margin: 0 0 26px 0; }
  .ladder { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .rung { display: flex; gap: 6px; }
  .cell { width: ${cell}px; height: ${cell}px; border: 2px solid #000; border-radius: 5px;
    display: inline-flex; align-items: center; justify-content: center; font-size: ${letterFs}px; font-weight: 700; }
  .rung.fixed .cell { background: #eee; }
  .cell.hint { color: #888; }
  .rung.rung .cell { }
  .arrow { font-size: ${Math.round(layout.fontSize * 1.1)}px; line-height: 1; color: #666; }
  .word-count { text-align: center; margin-top: 22px; color: #555; font-size: ${Math.round(layout.fontSize * 0.9)}px; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <div class="ladder">${ladderHtml}</div>
  ${answerKey ? '' : `<div class="word-count">${steps - 2} word${steps - 2 === 1 ? '' : 's'} to find</div>`}
</body>
</html>`;
}

module.exports = { render };
