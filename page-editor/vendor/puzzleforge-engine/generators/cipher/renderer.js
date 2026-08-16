/**
 * Cipher — render().
 *
 * Shows the coded message with a blank under each token to write the decoded
 * letter, plus a decoder key appropriate to the cipher (shift note, Atbash
 * pairs, A1Z26 legend, or a Morse chart). Answer-key mode reveals the message.
 */
const { MORSE, LETTERS } = require('./ciphers');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const isLetter = (ch) => ch >= 'A' && ch <= 'Z';

// A token shown above a write-in blank.
function cell(code, blank) {
  return `<span class="cell"><span class="code">${esc(code)}</span><span class="${blank ? 'blank' : 'nb'}">&nbsp;</span></span>`;
}

function codedHtml(data) {
  if (data.mode === 'caesar' || data.mode === 'atbash') {
    return data.cipher.split(' ').map((word) => {
      const cells = word.split('').map((ch) => (isLetter(ch) ? cell(ch, true) : cell(ch, false))).join('');
      return `<span class="word">${cells}</span>`;
    }).join('<span class="space"></span>');
  }
  // a1z26 / morse: words of tokens
  return data.words.map((word) => {
    const cells = word.map((tok) => cell(tok, true)).join('');
    return `<span class="word">${cells}</span>`;
  }).join('<span class="space"></span>');
}

function keyHtml(data) {
  if (data.mode === 'caesar') {
    return data.showKey
      ? `<div class="ckey"><b>Key:</b> shift each letter back ${data.shift} place${data.shift === 1 ? '' : 's'} (so A becomes ${LETTERS[(26 - data.shift) % 26]}).</div>`
      : `<div class="ckey"><b>Key:</b> hidden — every letter moved the same number of places. Tip: guess a short word, or try each shift.</div>`;
  }
  if (data.mode === 'atbash') {
    const pairs = [];
    for (let i = 0; i < 13; i++) pairs.push(`${LETTERS[i]}↔${LETTERS[25 - i]}`);
    return `<div class="ckey"><b>Key (Atbash):</b> ${pairs.join(' · ')}</div>`;
  }
  if (data.mode === 'a1z26') {
    const legend = LETTERS.split('').map((l, i) => `${l}=${i + 1}`).join(' · ');
    return `<div class="ckey ckey-grid"><b>Key:</b> ${legend}</div>`;
  }
  // morse
  const legend = LETTERS.split('').map((l) => `${l} ${MORSE[l]}`).join(' &nbsp; ');
  return `<div class="ckey ckey-mono"><b>Morse key:</b> ${legend}</div>`;
}

function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const heading = answerKey ? `${esc(puzzle.title)} — Solution` : esc(puzzle.title);
  const codeFs = Math.round(layout.fontSize * 1.05);
  const cellW = puzzle.data.mode === 'morse' ? Math.round(layout.fontSize * 2.8)
    : puzzle.data.mode === 'a1z26' ? Math.round(layout.fontSize * 1.9)
      : Math.round(layout.fontSize * 1.5);

  const body = answerKey
    ? `<div class="solution">${esc(puzzle.solution.plaintext)}</div>`
    : `<div class="coded">${codedHtml(puzzle.data)}</div>${keyHtml(puzzle.data)}`;

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
  .coded { line-height: 3; }
  .word { display: inline-flex; margin: 0 ${Math.round(cellW * 0.5)}px ${Math.round(layout.fontSize)}px 0; vertical-align: top; }
  .space { display: inline-block; width: ${Math.round(cellW * 0.5)}px; }
  .cell { display: inline-flex; flex-direction: column; align-items: center; width: ${cellW}px; }
  .cell .code { font-size: ${codeFs}px; font-weight: 600; letter-spacing: .5px; }
  .cell .blank { height: ${Math.round(cellW * 0.9)}px; width: ${cellW - 4}px; border-bottom: 1.5px solid #000; }
  .cell .nb { height: ${Math.round(cellW * 0.9)}px; }
  .ckey { margin-top: 34px; padding-top: 12px; border-top: 1px solid #ccc; font-size: ${Math.round(layout.fontSize * 0.9)}px; line-height: 1.7; }
  .ckey-mono { font-family: 'Courier New', monospace; }
  .solution { margin-top: 30px; font-size: ${Math.round(layout.fontSize * 1.3)}px; text-align: center; font-weight: 700; line-height: 1.5; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  ${body}
</body>
</html>`;
}

module.exports = { render };
