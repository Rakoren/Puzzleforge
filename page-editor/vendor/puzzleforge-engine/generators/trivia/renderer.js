/**
 * Trivia — render().
 *
 * Numbered questions with an answer line under each. Answer-key mode lists the
 * answers in a compact two-column layout.
 */
function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const questions = puzzle.data.questions;
  const answers = puzzle.solution.answers;

  let body;
  if (answerKey) {
    const items = answers.map((a, i) => `<li><span class="n">${i + 1}.</span> ${esc(a)}</li>`).join('');
    body = `<ol class="answers">${items}</ol>`;
  } else {
    const items = questions
      .map(
        (item, i) =>
          `<li><span class="q">${esc(item.q)}</span><span class="line"></span></li>`
      )
      .join('');
    body = `<ol class="questions">${items}</ol>`;
  }

  const heading = answerKey ? `${esc(puzzle.title)} — Answer Key` : esc(puzzle.title);
  const cols = answerKey ? 2 : 1;

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
  .instructions { text-align: center; margin: 0 0 20px 0; }
  ol.questions { padding-left: 26px; margin: 0; }
  ol.questions li { margin-bottom: ${Math.round(layout.fontSize * 1.4)}px; font-size: ${Math.round(layout.fontSize * 1.05)}px; }
  ol.questions .q { display: block; margin-bottom: 8px; }
  ol.questions .line { display: block; border-bottom: 1px solid #444; height: ${Math.round(layout.fontSize * 1.2)}px; }
  ol.answers { columns: ${cols}; -webkit-columns: ${cols}; list-style: none; padding: 0; margin: 0; }
  ol.answers li { margin-bottom: 6px; break-inside: avoid; }
  ol.answers .n { font-weight: 700; }
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
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { render };
