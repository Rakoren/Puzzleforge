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
const { elementHtml } = require('./element-html');

// Find the index just past the close tag matching the open tag at `from`,
// accounting for nested same-name tags.
function findClose(s, tag, from) {
  const open = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');
  const close = new RegExp('</' + tag + '>', 'gi');
  let depth = 1, idx = from;
  while (depth > 0) {
    close.lastIndex = idx; open.lastIndex = idx;
    const c = close.exec(s); if (!c) return s.length;
    open.lastIndex = idx; const o = open.exec(s);
    if (o && o.index < c.index) { depth++; idx = o.index + o[0].length; }
    else { depth--; idx = c.index + c[0].length; }
  }
  return idx;
}

function classify(tag, html) {
  if (tag === 'h1' || tag === 'h2') return 'title';
  if (/class="[^"]*\binstructions\b/.test(html)) return 'instructions';
  if (/class="[^"]*\b(clues|wordlist)\b/.test(html)) return 'wordlist';
  return 'grid';
}

/**
 * Split any rendered page document into named pieces **in original DOM order**,
 * so recomposing them unchanged reproduces the original layout exactly. Works
 * for puzzle pages and for front/back matter pages alike.
 * @returns {{ style: string, components: Array<{kind,html}> }}
 */
function splitHtml(doc) {
  const styles = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRe.exec(doc)) !== null) styles.push(sm[1]);
  const bodyMatch = doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : doc;

  // Walk the body's top-level elements in order.
  const components = [];
  const openRe = /<([a-zA-Z0-9]+)(\s[^>]*)?>/g;
  let i = 0;
  while (i < body.length) {
    openRe.lastIndex = i;
    const m = openRe.exec(body);
    if (!m) break;
    const tag = m[1].toLowerCase();
    const end = findClose(body, tag, openRe.lastIndex);
    const html = body.slice(m.index, end).trim();
    if (html) components.push({ kind: classify(tag, html), html });
    i = end;
  }

  return { style: styles.join('\n'), components };
}

/**
 * Render a puzzle and split it into named pieces (see splitHtml).
 * @returns {{ style: string, components: Array<{kind,html}> }}
 */
function splitPuzzle(puzzle, layout, opts = {}) {
  const mod = getModule(puzzle.type);
  return splitHtml(mod.render(puzzle, layout, { answerKey: Boolean(opts.answerKey) }));
}

const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);

// Per-piece transform from its saved delta (dx, dy, scale, rot). Empty when the
// piece is unmoved, so the page renders identically to the original layout.
function pieceTransform(p) {
  if (!p) return '';
  const dx = num(p.dx, 0), dy = num(p.dy, 0), s = num(p.scale, 1), r = num(p.rot, 0);
  if (!dx && !dy && s === 1 && !r) return '';
  return `transform:translate(${dx}px,${dy}px) rotate(${r}deg) scale(${s});transform-origin:top left;`;
}

/**
 * Compose a print-ready page from the puzzle's pieces (in their original flow,
 * each movable via a transform delta) plus free text / image elements.
 *
 * With no edits, the pieces render in normal flow exactly like the original
 * puzzle — same centering, same single-page fit — because we only add a wrapper
 * and apply a transform when a piece has actually been moved.
 *
 * @param {object} pageLayout { comp: { key: { dx,dy,scale,rot,hidden } }, elements:[...] }
 */
function composePage(puzzle, layout, pageLayout, opts = {}) {
  const { style, components } = splitPuzzle(puzzle, layout, opts);
  return composeParts(style, components, layout, pageLayout);
}

/**
 * Compose a print-ready page from an already-split page (style + ordered
 * components) plus free text / image elements. Used for both puzzle pages
 * (via composePage) and front/back matter pages the publisher has edited.
 * @param {object} pageLayout { comp: { key: { dx,dy,scale,rot,hidden } }, elements:[...] }
 */
function composeParts(style, components, layout, pageLayout) {
  const comp = (pageLayout && pageLayout.comp) || {};
  const elements = (pageLayout && Array.isArray(pageLayout.elements)) ? pageLayout.elements : [];

  const kindSeen = {};
  const pieces = components
    .map((c) => {
      const n = (kindSeen[c.kind] = (kindSeen[c.kind] || 0) + 1);
      const key = n > 1 ? `${c.kind}${n}` : c.kind;
      const p = comp[key] || comp[c.kind] || {};
      if (p.hidden) return '';
      const tf = pieceTransform(p);
      // Matter pages (title, copyright, …) position their content via the page
      // context (absolute/flex), which a flow wrapper would break. When the
      // editor supplies a measured anchor (ax, ay), pin the piece absolutely
      // there so it reproduces the original placement and moves crisply.
      if (Number.isFinite(Number(p.ax)) && Number.isFinite(Number(p.ay))) {
        const w = num(p.aw, 0);
        const abs = `position:absolute;left:${num(p.ax, 0)}px;top:${num(p.ay, 0)}px;${w ? `width:${w}px;` : ''}transform-origin:top left;${tf}`;
        return `<div class="pf-piece pf-abs" data-pf="${key}" style="${abs}">${c.html}</div>`;
      }
      return `<div class="pf-piece" data-pf="${key}"${tf ? ` style="${tf}"` : ''}>${c.html}</div>`;
    })
    .join('\n');

  // Inner markup comes from the SAME renderer the editor uses on screen
  // (engine/element-html.js), so text/image/shape objects print exactly as
  // they were drawn. Objects flagged `behind` render UNDER the puzzle pieces
  // (backgrounds/watermarks/frames); the rest render on top — matching the
  // editor's stacking exactly.
  const renderEl = (e) => {
    const inner = elementHtml(e);
    if (!inner) return '';
    return `<div class="pf-el" style="transform: translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)});">${inner}</div>`;
  };
  const ordered = elements.slice().sort((a, b) => num(a.z, 0) - num(b.z, 0));
  const behindHtml = ordered.filter((e) => e.behind).map(renderEl).join('\n');
  const frontHtml = ordered.filter((e) => !e.behind).map(renderEl).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${layout.widthIn}in ${layout.heightIn}in; margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; color: #000; position: relative; width: ${layout.usableWidth}px; min-height: ${layout.usableHeight}px; }
  .pf-piece { position: relative; }
  .pf-el { position: absolute; top: 0; left: 0; transform-origin: top left; }
  ${style}
</style></head>
<body>
${behindHtml}
${pieces}
${frontHtml}
</body></html>`;
}

module.exports = { splitPuzzle, splitHtml, composePage, composeParts };
