/**
 * Math Puzzles — render().
 * A numbered, two-column grid of problems with the blank shown as an underline;
 * the answer key fills each blank in.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const problems = puzzle.data.problems;
  const answers = puzzle.solution.answers;
  const solved = puzzle.solution.problems || [];

  let body, cols;
  if (answerKey) {
    cols = 2;
    const items = solved
      .map((p, i) => {
        const filled = p.kind === 'sequence'
          ? p.terms.join(', ')
          : p.prompt.replace('__', esc(String(answers[i])));
        return `<li><span class="n">${i + 1}.</span> <span class="eq">${esc(filled)}</span></li>`;
      })
      .join('');
    body = `<ol class="answers">${items}</ol>`;
  } else {
    cols = 2;
    const items = problems
      .map((p, i) => `<li><span class="n">${i + 1}.</span> <span class="eq">${esc(p.prompt)}</span></li>`)
      .join('');
    body = `<ol class="problems">${items}</ol>`;
  }

  const heading = answerKey ? `${esc(puzzle.title)} — Answer Key` : esc(puzzle.title);
  const eqFont = Math.round(layout.fontSize * 1.25);

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
  .instructions { text-align: center; margin: 0 0 22px 0; }
  ol.problems, ol.answers { columns: ${cols}; -webkit-columns: ${cols}; column-gap: 40px; list-style: none; padding: 0; margin: 0; }
  ol.problems li, ol.answers li { margin: 0 0 ${Math.round(layout.fontSize * 1.5)}px; break-inside: avoid; font-size: ${eqFont}px; }
  ol.answers li { margin-bottom: ${Math.round(layout.fontSize * 0.9)}px; }
  .n { display: inline-block; min-width: ${Math.round(eqFont * 1.6)}px; font-weight: 700; }
  .eq { font-family: ${layout.fontFamily}; letter-spacing: .5px; white-space: nowrap; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  ${body}
</body>
</html>`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { render };
