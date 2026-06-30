/**
 * Puzzle page composition for the Page Editor.
 *
 * The editor lets the publisher move/resize a puzzle's individual pieces (grid,
 * title, instructions, word list) and add text / clip art — a freeform layout.
 * To keep print quality, pieces stay as the original crisp HTML and are placed
 * with absolute position + a CSS transform (scale/rotate), never rasterized.
 *
 * `splitPuzzle` pulls a rendered puzzle apart into named pieces (parsing our own
 * markup); `composePage` lays a set of placed pieces + free elements back into a
 * print-ready page document. When a page has no custom layout, the normal
 * renderer is used instead, so nothing changes for un-edited pages.
 */
const { getModule } = require('../generators/registry');
const { getLayout } = require('../layouts');

// Pull one element (by tag + class) out of a body string; returns { html, rest }.
function pull(body, tag, cls) {
  const re = new RegExp(`<(${tag})\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>[\\s\\S]*?</\\1>`, 'i');
  const m = body.match(re);
  if (!m) return { html: null, rest: body };
  return { html: m[0], rest: body.replace(m[0], '') };
}
function pullTag(body, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'i');
  const m = body.match(re);
  if (!m) return { html: null, rest: body };
  return { html: m[0], rest: body.replace(m[0], '') };
}

/**
 * Render a puzzle and split it into named pieces.
 * @returns {{ style: string, components: Array<{kind,html}> }}
 *   kinds: 'grid' (the puzzle body), 'title', 'instructions', 'wordlist'.
 */
function splitPuzzle(puzzle, layout, opts = {}) {
  const mod = getModule(puzzle.type);
  const doc = mod.render(puzzle, layout, { answerKey: Boolean(opts.answerKey) });

  const styles = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRe.exec(doc)) !== null) styles.push(sm[1]);
  const bodyMatch = doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : doc;

  const title = pullTag(body, 'h1');
  body = title.rest;
  const instr = pull(body, '(?:div|p)', 'instructions');
  body = instr.rest;
  const wl = pull(body, 'div', 'wordlist');
  body = wl.rest;
  const clues = pull(body, 'div', 'clues');
  body = clues.rest;

  const components = [];
  // grid (the remaining body) goes first so it sits behind the labels by default.
  if (body.trim()) components.push({ kind: 'grid', html: `<div class="pf-grid">${body.trim()}</div>` });
  if (title.html) components.push({ kind: 'title', html: title.html });
  if (instr.html) components.push({ kind: 'instructions', html: instr.html });
  if (wl.html) components.push({ kind: 'wordlist', html: wl.html });
  if (clues.html) components.push({ kind: 'wordlist', html: clues.html });

  return { style: styles.join('\n'), components };
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);

// Default stacked placement when a piece has no saved position (fallback only;
// the editor measures and supplies real positions).
function defaultPlacement(kind, layout, i) {
  const w = layout.usableWidth;
  if (kind === 'title') return { x: 0, y: 0, w, scale: 1, rot: 0 };
  if (kind === 'instructions') return { x: 0, y: 44, w, scale: 1, rot: 0 };
  if (kind === 'grid') return { x: 0, y: 90, w, scale: 1, rot: 0 };
  return { x: 0, y: layout.usableHeight - 160, w, scale: 1, rot: 0 };
}

function placedDiv(html, p) {
  const tf = `transform: translate(${num(p.x, 0)}px, ${num(p.y, 0)}px) rotate(${num(p.rot, 0)}deg) scale(${num(p.scale, 1)});`;
  const width = p.w ? `width:${num(p.w, layoutWidthGuess)}px;` : '';
  return `<div class="pf-el" style="${tf}${width}">${html}</div>`;
}
let layoutWidthGuess = 600;

/**
 * Compose a print-ready page from placed puzzle pieces + free elements.
 * @param {object} puzzle
 * @param {object} layout  resolved layout (getLayout)
 * @param {object} pageLayout { comp: {kind:{x,y,scale,rot,w,hidden}}, elements:[...] }
 * @param {object} [opts] { answerKey }
 * @returns {string} full HTML doc
 */
function composePage(puzzle, layout, pageLayout, opts = {}) {
  const { style, components } = splitPuzzle(puzzle, layout, opts);
  layoutWidthGuess = layout.usableWidth;
  const comp = (pageLayout && pageLayout.comp) || {};
  const elements = (pageLayout && Array.isArray(pageLayout.elements)) ? pageLayout.elements : [];

  // Track repeated kinds (e.g. two wordlist columns) by index.
  const kindSeen = {};
  const pieces = components
    .map((c) => {
      const n = kindSeen[c.kind] = (kindSeen[c.kind] || 0) + 1;
      const key = n > 1 ? `${c.kind}${n}` : c.kind;
      const p = comp[key] || comp[c.kind] || defaultPlacement(c.kind, layout);
      if (p.hidden) return '';
      return placedDiv(c.html, p);
    })
    .join('\n');

  const freebies = elements
    .sort((a, b) => num(a.z, 0) - num(b.z, 0))
    .map((e) => {
      const p = { x: e.x, y: e.y, scale: e.scale, rot: e.rot };
      if (e.kind === 'text') {
        const css =
          `font-size:${num(e.fontSize, 24)}px;color:${/^#[0-9a-fA-F]{3,8}$/.test(e.color || '') ? e.color : '#222'};` +
          `font-family:${e.fontFamily === 'serif' ? 'Georgia, serif' : 'Arial, Helvetica, sans-serif'};` +
          `text-align:${['left', 'center', 'right'].includes(e.align) ? e.align : 'left'};` +
          `width:${num(e.w, 240)}px;white-space:pre-wrap;line-height:1.25;`;
        return `<div class="pf-el pf-text" style="transform: translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)});${css}">${esc(e.text)}</div>`;
      }
      if (e.kind === 'image' && typeof e.src === 'string' && e.src.startsWith('data:')) {
        const w = num(e.width, 160);
        return `<div class="pf-el" style="transform: translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)});"><img src="${e.src}" style="width:${w}px;display:block;"></div>`;
      }
      return '';
    })
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${layout.widthIn}in ${layout.heightIn}in; margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; color: #000; position: relative; width: ${layout.usableWidth}px; min-height: ${layout.usableHeight}px; }
  .pf-el { position: absolute; top: 0; left: 0; transform-origin: top left; }
  .pf-grid table, .pf-grid svg { margin: 0 !important; }
  ${style}
</style></head>
<body>
${pieces}
${freebies}
</body></html>`;
}

module.exports = { splitPuzzle, composePage };
