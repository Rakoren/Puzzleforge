/**
 * Shared free-element renderer (text / image / shape).
 *
 * Loaded by BOTH the engine's page composer (print export) and the Page
 * Editor (browser, via a <script> tag) so an object looks pixel-identical on
 * screen and in the exported PDF. UMD-style: `module.exports` on Node,
 * `window.PFElements` in the browser.
 *
 * All inputs are treated as untrusted recipe data: colors are validated
 * against a hex pattern, shape names against a whitelist, image sources must
 * be data: URIs, and text is HTML-escaped.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PFElements = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const color = (c, d) => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : d);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Font stacks use single quotes: they land inside double-quoted style="…"
  // attributes, so double quotes would truncate the attribute.
  const FONTS = {
    sans: 'Arial, Helvetica, sans-serif',
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', Courier, monospace",
    hand: "'Comic Sans MS', 'Comic Sans', cursive",
  };

  // 5-point star fitted to a w×h box, inset so the stroke isn't clipped.
  function starPoints(w, h, inset) {
    const cx = w / 2, cy = h / 2;
    const rx = w / 2 - inset, ry = h / 2 - inset;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const f = i % 2 === 0 ? 1 : 0.42;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${(cx + Math.cos(a) * rx * f).toFixed(2)},${(cy + Math.sin(a) * ry * f).toFixed(2)}`);
    }
    return pts.join(' ');
  }

  // A simple data table. Rendered as an HTML <table> with inline styles so it
  // looks identical on screen (editor) and in the PDF composer. Column widths
  // are fixed via <colgroup> so text wraps predictably at print size.
  function tableHtml(e) {
    const rows = Math.max(1, Math.min(60, num(e.rows, 2)));
    const cols = Math.max(1, Math.min(20, num(e.cols, 2)));
    const cells = Array.isArray(e.cells) ? e.cells : [];
    const colW = Array.isArray(e.colW) ? e.colW : [];
    const defW = 90;
    const bC = color(e.borderColor, '#333333');
    const bW = Math.max(0, Math.min(8, num(e.borderW, 1)));
    const pad = Math.max(0, Math.min(40, num(e.cellPad, 6)));
    const header = !!e.header;
    const hFill = color(e.headerFill, '#f0f0f0');
    const fs = Math.max(6, num(e.fontSize, 15));
    const fam = FONTS[e.fontFamily] || FONTS.sans;
    const col = color(e.color, '#222222');
    const align = ['left', 'center', 'right'].includes(e.align) ? e.align : 'left';
    let totalW = 0, cg = '<colgroup>';
    for (let c = 0; c < cols; c++) { const w = Math.max(16, num(colW[c], defW)); totalW += w; cg += `<col style="width:${w}px">`; }
    cg += '</colgroup>';
    let body = '';
    for (let r = 0; r < rows; r++) {
      body += '<tr>';
      for (let c = 0; c < cols; c++) {
        const isH = header && r === 0;
        const cs = `border:${bW}px solid ${bC};padding:${pad}px;text-align:${align};vertical-align:top;` + (isH ? `font-weight:700;background:${hFill};` : '');
        body += `<td style="${cs}">${esc((cells[r] && cells[r][c]) || '')}</td>`;
      }
      body += '</tr>';
    }
    return `<table style="border-collapse:collapse;table-layout:fixed;width:${totalW}px;font-family:${fam};font-size:${fs}px;color:${col};line-height:1.35;">${cg}<tbody>${body}</tbody></table>`;
  }

  function shapeSvg(e) {
    const w = Math.max(8, num(e.w, 160));
    const h = Math.max(4, num(e.h, 120));
    const sw = Math.max(0, num(e.strokeW, 2));
    const fill = e.fill === 'none' ? 'none' : color(e.fill, '#ffd43b');
    const stroke = e.stroke === 'none' ? 'none' : color(e.stroke, '#222222');
    const i = sw / 2;
    const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
    let body;
    switch (e.shape) {
      case 'ellipse':
        body = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - i}" ry="${h / 2 - i}" ${attrs}/>`;
        break;
      case 'triangle':
        body = `<polygon points="${w / 2},${i} ${w - i},${h - i} ${i},${h - i}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'star':
        body = `<polygon points="${starPoints(w, h, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'line':
        body = `<line x1="${i}" y1="${h / 2}" x2="${w - i}" y2="${h / 2}" stroke="${stroke === 'none' ? '#222222' : stroke}" stroke-width="${Math.max(1, sw)}" stroke-linecap="round"/>`;
        break;
      default: // rect
        body = `<rect x="${i}" y="${i}" width="${w - sw}" height="${h - sw}" rx="${Math.max(0, num(e.rx, 0))}" ${attrs}/>`;
    }
    const fx = e.flipH || e.flipV ? `transform:scale(${e.flipH ? -1 : 1},${e.flipV ? -1 : 1});` : '';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;${fx}">${body}</svg>`;
  }

  /**
   * Render a free element's inner HTML (unpositioned — the caller wraps it and
   * applies the translate/rotate/scale transform).
   */
  function elementHtml(e) {
    if (!e) return '';
    if (e.kind === 'image') {
      if (typeof e.src !== 'string' || !e.src.startsWith('data:')) return '';
      const fx = e.flipH || e.flipV ? `transform:scale(${e.flipH ? -1 : 1},${e.flipV ? -1 : 1});` : '';
      return `<img src="${e.src}" style="width:${num(e.width, 160)}px;display:block;pointer-events:none;${fx}" alt="">`;
    }
    if (e.kind === 'shape') return shapeSvg(e);
    if (e.kind === 'table') return tableHtml(e);
    // text
    const css =
      `font-size:${num(e.fontSize, 24)}px;color:${color(e.color, '#222')};` +
      `font-family:${FONTS[e.fontFamily] || FONTS.sans};` +
      `font-weight:${e.bold ? 700 : 400};font-style:${e.italic ? 'italic' : 'normal'};` +
      `text-decoration:${e.underline ? 'underline' : 'none'};` +
      `text-align:${['left', 'center', 'right'].includes(e.align) ? e.align : 'left'};` +
      `width:${num(e.w, 240)}px;white-space:pre-wrap;line-height:${Math.max(0.8, Math.min(3, num(e.lineHeight, 1.25)))};` +
      // WordArt: outline (text-stroke) + drop shadow. Chromium renders both on
      // screen and in the PDF, so styled titles print exactly as designed.
      (e.textStroke ? `-webkit-text-stroke:${Math.max(0, num(e.textStrokeW, 1))}px ${color(e.textStroke, '#222')};` : '') +
      (e.textShadow ? `text-shadow:2px 2px 0 ${color(e.textShadow, '#00000040')};` : '');
    return `<div class="pf-textbox" style="${css}">${esc(e.text || '')}</div>`;
  }

  return { elementHtml };
});
