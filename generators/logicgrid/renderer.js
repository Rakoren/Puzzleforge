/**
 * Logic Grid — render().
 *
 * Prints the numbered clues, a legend of the possible value for each category,
 * and a fill-in table: the Person column is filled and the solver writes each
 * matching attribute. Answer-key mode fills the whole table from the solution.
 */
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(puzzle, layout, opts = {}) {
  const answerKey = Boolean(opts.answerKey);
  const cats = puzzle.data.categories;
  const clues = puzzle.data.clues;
  const rows = puzzle.solution.rows;
  const primary = cats[0];

  // People in printed order (alphabetical), with a lookup to their answer row.
  const byName = {};
  rows.forEach((r) => { byName[r[primary.key]] = r; });
  const people = primary.values.slice().sort();

  const cluesHtml = clues
    .map((c) => `<li>${esc(c.text)}</li>`)
    .join('');

  const legendHtml = cats
    .map((c) => `<div class="leg"><span class="leg-cat">${esc(c.label)}:</span> ${c.values.map((v) => esc(v)).join(', ')}</div>`)
    .join('');

  const headCells = cats.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const bodyHtml = people
    .map((name) => {
      const row = byName[name];
      const cells = cats
        .map((c, ci) => {
          if (ci === 0) return `<td class="fixed">${esc(name)}</td>`;
          const val = answerKey ? esc(row[c.key]) : '&nbsp;';
          return `<td class="${answerKey ? 'ans' : ''}">${val}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const heading = answerKey ? `${esc(puzzle.title)} — Solution` : esc(puzzle.title);
  const cellH = Math.round(layout.fontSize * 2.1);

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
  .instructions { text-align: center; margin: 0 0 18px 0; }
  .clues { margin: 0 0 20px 0; }
  .clues h2, .table-wrap h2 { font-size: ${Math.round(layout.fontSize * 1.15)}px; margin: 0 0 8px 0; }
  .clues ol { margin: 0; padding-left: ${Math.round(layout.fontSize * 1.4)}px; line-height: 1.7; }
  .legend { margin: 0 0 20px 0; padding: 10px 12px; border: 1px solid #bbb; border-radius: 6px; font-size: ${Math.round(layout.fontSize * 0.92)}px; line-height: 1.6; background: #fafafa; }
  .leg-cat { font-weight: 700; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1.5px solid #000; text-align: center; height: ${cellH}px; padding: 2px 4px; font-size: ${Math.round(layout.fontSize * 0.98)}px; word-break: break-word; }
  th { background: #eee; font-weight: 700; }
  td.fixed { font-weight: 700; background: #f6f6f6; }
  td.ans { color: #555; font-weight: 600; }
</style>
</head>
<body>
  <h1>${heading}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <div class="clues">
    <h2>Clues</h2>
    <ol>${cluesHtml}</ol>
  </div>
  <div class="legend">${legendHtml}</div>
  <div class="table-wrap">
    <h2>${answerKey ? 'Answer' : 'Your answer'}</h2>
    <table>
      <thead><tr>${headCells}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </div>
</body>
</html>`;
}

module.exports = { render };
