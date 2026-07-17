/**
 * Word Wheel — render().
 *
 * A circular wheel: the centre letter in a shaded hub, eight letters around it.
 * The puzzle page shows the wheel, the scoring targets, and ruled space to write
 * answers. The answer key lists every findable word grouped by length, with the
 * 9-letter word highlighted.
 */
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wheelSvg(center, ring, dim) {
  const cx = dim / 2, cy = dim / 2;
  const R = dim * 0.36; // ring radius
  const outerR = dim * 0.135;
  const hubR = dim * 0.16;
  const fs = Math.round(dim * 0.14);
  let cells = '';
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    cells += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${outerR.toFixed(1)}" fill="#fff" stroke="#333" stroke-width="2"/>`
      + `<text x="${x.toFixed(1)}" y="${(y + fs * 0.35).toFixed(1)}" font-size="${fs}" font-weight="700" text-anchor="middle">${esc((ring[i] || '').toUpperCase())}</text>`;
  }
  const hub = `<circle cx="${cx}" cy="${cy}" r="${hubR.toFixed(1)}" fill="#ffe08a" stroke="#333" stroke-width="2.5"/>`
    + `<text x="${cx}" y="${(cy + fs * 0.36).toFixed(1)}" font-size="${Math.round(fs * 1.05)}" font-weight="800" text-anchor="middle">${esc(center.toUpperCase())}</text>`;
  return `<svg width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" style="display:block">${cells}${hub}</svg>`;
}

function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const { center, ring, minLen, count, targets } = puzzle.data;
  const pangram = puzzle.solution.pangram;
  const dim = Math.min(Math.round(layout.usableWidth * 0.52), 340);
  const heading = answerKey ? `${esc(puzzle.title)} — Solution` : esc(puzzle.title);

  let bodyMain;
  if (answerKey) {
    const byLen = {};
    for (const w of puzzle.solution.words) (byLen[w.length] = byLen[w.length] || []).push(w);
    const groups = Object.keys(byLen).map(Number).sort((a, b) => a - b).map((len) => {
      const list = byLen[len].map((w) => (w === pangram ? `<b class="pan">${esc(w.toUpperCase())}</b>` : esc(w.toUpperCase()))).join(', ');
      return `<div class="grp"><span class="len">${len} letters (${byLen[len].length})</span> ${list}</div>`;
    }).join('');
    bodyMain = `<div class="nine">9-letter word: <b>${esc(pangram.toUpperCase())}</b></div>`
      + `<div class="total">${count} words to find</div>${groups}`;
  } else {
    // Ruled space for writing answers.
    let lines = '';
    for (let i = 0; i < 30; i++) lines += '<div class="wline"></div>';
    bodyMain = `<div class="targets">Good: ${targets.good} &nbsp;·&nbsp; Great: ${targets.great} &nbsp;·&nbsp; Expert: ${targets.expert} words</div>`
      + `<div class="nine">9-letter word: <span class="blank"></span></div>`
      + `<div class="answers">${lines}</div>`;
  }

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
  .instructions { text-align: center; margin: 0 0 16px 0; }
  .wheel { display: flex; justify-content: center; margin: 6px 0 14px; }
  .targets { text-align: center; font-weight: 600; margin: 0 0 14px; }
  .nine { font-weight: 600; margin: 4px 0 12px; }
  .nine .blank { display: inline-block; width: 260px; border-bottom: 1.5px solid #000; }
  .answers { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 26px; }
  .wline { border-bottom: 1px solid #999; height: ${Math.round(layout.fontSize * 1.7)}px; }
  .total { text-align: center; color: #555; margin: 0 0 14px; }
  .grp { margin: 0 0 9px; line-height: 1.5; }
  .grp .len { font-weight: 700; }
  .pan { background: #ffe08a; padding: 0 2px; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <div class="wheel">${wheelSvg(center, ring, dim)}</div>
  ${bodyMain}
</body>
</html>`;
}

module.exports = { render, wheelSvg };
