/**
 * Cryptogram — render().
 *
 * Each cipher letter is shown with a blank slot beneath it for the solver to
 * write the decoded letter. Revealed hints are pre-filled. A decoder strip
 * (A–Z with blanks) is provided for tracking the substitution. Words never
 * break across lines. Answer-key mode shows the plaintext and the full key.
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { ciphertext, author, hints } = puzzle.data;
  const hintMap = {};
  for (const h of hints || []) hintMap[h.cipher] = h.plain;

  const cellW = Math.max(16, Math.round(layout.fontSize * 1.4));
  const cipherFont = Math.round(layout.fontSize * 1.1);

  const words = ciphertext.split(/(\s+)/); // keep separators
  const wordHtml = words
    .map((token) => {
      if (/^\s+$/.test(token)) return '<span class="space"></span>';
      const cells = token
        .split('')
        .map((ch) => {
          if (!/[A-Z]/.test(ch)) {
            return `<span class="cell punct"><span class="answer">&nbsp;</span><span class="cipher">${esc(ch)}</span></span>`;
          }
          const pre = answerKey ? puzzle.solution.key[ch] : hintMap[ch] || '';
          const cls = answerKey || hintMap[ch] ? 'answer filled' : 'answer';
          return `<span class="cell"><span class="${cls}">${esc(pre) || '&nbsp;'}</span><span class="cipher">${esc(ch)}</span></span>`;
        })
        .join('');
      return `<span class="word">${cells}</span>`;
    })
    .join('');

  const decoder = LETTERS.map(
    (l) => `<span class="dec"><span class="dec-l">${l}</span><span class="dec-b">&nbsp;</span></span>`
  ).join('');

  const heading = answerKey ? `${esc(puzzle.title)} — Solution` : esc(puzzle.title);
  const authorLine = author ? `<div class="author">— ${esc(author)}</div>` : '';
  const solutionBlock = answerKey
    ? `<div class="solution">${esc(puzzle.solution.plaintext)}${author ? ' — ' + esc(author) : ''}</div>`
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
  body { font-family: ${layout.fontFamily}; font-size: ${layout.fontSize}px; color: #000; width: ${layout.usableWidth}px; }
  h1 { font-size: ${Math.round(layout.fontSize * 1.6)}px; margin: 0 0 6px 0; text-align: center; }
  .instructions { text-align: center; margin: 0 0 22px 0; }
  .puzzle { line-height: 2.6; }
  .word { display: inline-flex; margin: 0 ${Math.round(cellW * 0.5)}px ${Math.round(layout.fontSize)}px 0; vertical-align: top; }
  .cell { display: inline-flex; flex-direction: column; align-items: center; width: ${cellW}px; }
  .cell .answer { height: ${Math.round(cellW * 0.9)}px; width: ${cellW - 4}px; border-bottom: 1.5px solid #000; text-align: center; font-weight: 700; font-size: ${cipherFont}px; line-height: ${Math.round(cellW * 0.9)}px; }
  .cell .answer.filled { color: ${answerKey ? '#777' : '#000'}; }
  .cell.punct .answer { border-bottom: none; }
  .cell .cipher { font-size: ${cipherFont}px; font-weight: 600; letter-spacing: 1px; margin-top: 2px; }
  .author { text-align: right; margin-top: 18px; font-style: italic; }
  .decoder { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 4px; border-top: 1px solid #ccc; padding-top: 12px; }
  .dec { display: inline-flex; flex-direction: column; align-items: center; width: ${cellW}px; }
  .dec-l { font-weight: 700; font-size: ${Math.round(layout.fontSize * 0.95)}px; }
  .dec-b { height: ${Math.round(cellW * 0.8)}px; width: ${cellW - 4}px; border: 1px solid #999; margin-top: 2px; }
  .solution { margin-top: 24px; font-size: ${Math.round(layout.fontSize * 1.2)}px; text-align: center; font-weight: 600; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <div class="puzzle">${wordHtml}</div>
  ${authorLine}
  ${solutionBlock}
  ${answerKey ? '' : `<div class="decoder">${decoder}</div>`}
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
