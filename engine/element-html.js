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
    rounded: 'Verdana, Geneva, sans-serif',
    trebuchet: "'Trebuchet MS', 'Segoe UI', sans-serif",
    tahoma: 'Tahoma, Geneva, sans-serif',
    palatino: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    garamond: "Garamond, 'Times New Roman', serif",
    century: "'Century Gothic', 'Gill Sans', sans-serif",
    impact: 'Impact, Haettenschweiler, sans-serif',
    brush: "'Brush Script MT', 'Segoe Script', cursive",
  };
  // Resolve a fontFamily value to a CSS font stack. Custom uploaded fonts use
  // `custom:<slug>` and render through an injected @font-face named
  // `pf-custom-<slug>` (present in both the editor and the PDF export doc).
  function fontStack(ff) {
    const v = String(ff || '');
    if (v.slice(0, 7) === 'custom:') {
      const slug = v.slice(7).replace(/[^a-z0-9_-]/gi, '');
      if (slug) return `'pf-custom-${slug}', Arial, sans-serif`;
    }
    return FONTS[v] || FONTS.sans;
  }

  // 5-point star fitted to a w×h box, inset so the stroke isn't clipped.
  function starPoints(w, h, inset) { return nStarPoints(w, h, 5, 0.42, inset); }

  // n-point star (points × 2 vertices, alternating outer/inner radius).
  function nStarPoints(w, h, points, innerRatio, inset) {
    const cx = w / 2, cy = h / 2, rx = w / 2 - inset, ry = h / 2 - inset, out = [];
    for (let k = 0; k < points * 2; k++) {
      const f = k % 2 === 0 ? 1 : innerRatio;
      const a = (Math.PI / points) * k - Math.PI / 2;
      out.push(`${(cx + Math.cos(a) * rx * f).toFixed(2)},${(cy + Math.sin(a) * ry * f).toFixed(2)}`);
    }
    return out.join(' ');
  }

  // Regular n-gon fitted to the box, rotated by rotDeg (0 = first vertex up).
  function regPoly(w, h, n, rotDeg, inset) {
    const cx = w / 2, cy = h / 2, rx = w / 2 - inset, ry = h / 2 - inset;
    const rot = (rotDeg || 0) * Math.PI / 180, out = [];
    for (let k = 0; k < n; k++) {
      const a = rot - Math.PI / 2 + (2 * Math.PI * k) / n;
      out.push(`${(cx + Math.cos(a) * rx).toFixed(2)},${(cy + Math.sin(a) * ry).toFixed(2)}`);
    }
    return out.join(' ');
  }

  // Block arrow pointing right, fitted to the box (mirror/rotate for the others).
  function arrowPoints(w, h, dir, inset) {
    const i = inset;
    // right-pointing arrow in a w×h box; swap axes / mirror for other dirs.
    const build = (W, H) => {
      const headW = W * 0.42, sT = H * 0.28, sB = H * 0.72;
      return [[i, sT], [W - headW, sT], [W - headW, i], [W - i, H / 2], [W - headW, H - i], [W - headW, sB], [i, sB]];
    };
    let p = dir === 'up' || dir === 'down' ? build(h, w).map(([x, y]) => [y, x]) : build(w, h);
    if (dir === 'left') p = p.map(([x, y]) => [w - x, y]);
    if (dir === 'up') p = p.map(([x, y]) => [x, h - y]);
    return p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  }

  // Plus / cross fitted to the box (arm thickness = fraction of the short side).
  function crossPoints(w, h, inset) {
    const i = inset, t = 0.34;
    const ax = w * (0.5 - t / 2), bx = w * (0.5 + t / 2), ay = h * (0.5 - t / 2), by = h * (0.5 + t / 2);
    return [[ax, i], [bx, i], [bx, ay], [w - i, ay], [w - i, by], [bx, by], [bx, h - i], [ax, h - i], [ax, by], [i, by], [i, ay], [ax, ay]]
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  }
  function heartPath(w, h, i) {
    const cx = w / 2;
    return `M ${cx},${h - i} C ${w * 0.02},${h * 0.6} ${w * 0.1},${h * 0.16} ${cx},${h * 0.3}`
      + ` C ${w - w * 0.1},${h * 0.16} ${w - w * 0.02},${h * 0.6} ${cx},${h - i} Z`;
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
    const cFill = (e.cellFill && e.cellFill !== 'none') ? color(e.cellFill, '#ffffff') : null;
    const fs = Math.max(6, num(e.fontSize, 15));
    const fam = fontStack(e.fontFamily);
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
        const cs = `border:${bW}px solid ${bC};padding:${pad}px;text-align:${align};vertical-align:top;` + (isH ? `font-weight:700;background:${hFill};` : (cFill ? `background:${cFill};` : ''));
        body += `<td style="${cs}">${esc((cells[r] && cells[r][c]) || '')}</td>`;
      }
      body += '</tr>';
    }
    return `<table style="border-collapse:collapse;table-layout:fixed;width:${totalW}px;font-family:${fam};font-size:${fs}px;color:${col};line-height:1.35;">${cg}<tbody>${body}</tbody></table>`;
  }

  // A rounded-rectangle speech bubble with a tail on the bottom-left, as one
  // fillable path (so fill + stroke follow the whole outline, tail included).
  function speechPath(w, h, inset) {
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    const tailH = Math.min((y1 - y0) * 0.26, 24);
    const bodyB = y1 - tailH;
    const r = Math.max(2, Math.min(16, (x1 - x0) / 2, (bodyB - y0) / 2));
    const baseL = x0 + Math.min((x1 - x0) * 0.24, 44);
    const baseR = baseL + Math.min((x1 - x0) * 0.15, 26);
    const tip = x0 + Math.min((x1 - x0) * 0.11, 18);
    return [
      `M ${x0 + r} ${y0}`, `H ${x1 - r}`, `A ${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
      `V ${bodyB - r}`, `A ${r} ${r} 0 0 1 ${x1 - r} ${bodyB}`,
      `H ${baseR}`, `L ${tip} ${y1}`, `L ${baseL} ${bodyB}`, `H ${x0 + r}`,
      `A ${r} ${r} 0 0 1 ${x0} ${bodyB - r}`, `V ${y0 + r}`, `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`, 'Z',
    ].join(' ');
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
      case 'star4':
        body = `<polygon points="${nStarPoints(w, h, 4, 0.45, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'star6':
        body = `<polygon points="${nStarPoints(w, h, 6, 0.55, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'righttriangle':
        body = `<polygon points="${i},${i} ${i},${h - i} ${w - i},${h - i}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'diamond':
        body = `<polygon points="${w / 2},${i} ${w - i},${h / 2} ${w / 2},${h - i} ${i},${h / 2}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'pentagon':
        body = `<polygon points="${regPoly(w, h, 5, 0, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'hexagon':
        body = `<polygon points="${regPoly(w, h, 6, 90, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'octagon':
        body = `<polygon points="${regPoly(w, h, 8, 22.5, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'trapezoid':
        body = `<polygon points="${w * 0.25},${i} ${w * 0.75},${i} ${w - i},${h - i} ${i},${h - i}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'parallelogram':
        body = `<polygon points="${w * 0.25},${i} ${w - i},${i} ${w * 0.75},${h - i} ${i},${h - i}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'cross':
        body = `<polygon points="${crossPoints(w, h, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'heart':
        body = `<path d="${heartPath(w, h, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'arrow-right':
      case 'arrow-left':
      case 'arrow-up':
      case 'arrow-down':
        body = `<polygon points="${arrowPoints(w, h, e.shape.slice(6), i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'roundrect':
        body = `<rect x="${i}" y="${i}" width="${w - sw}" height="${h - sw}" rx="${Math.max(6, Math.min(w, h) * 0.16)}" ${attrs}/>`;
        break;
      case 'line':
        body = `<line x1="${i}" y1="${h / 2}" x2="${w - i}" y2="${h / 2}" stroke="${stroke === 'none' ? '#222222' : stroke}" stroke-width="${Math.max(1, sw)}" stroke-linecap="round"/>`;
        break;
      case 'speech':
        body = `<path d="${speechPath(w, h, i)}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'thought': {
        const inW = w - sw, inH = h - sw;
        const bodyH = inH * 0.6;
        const rx = inW / 2, ry = bodyH / 2;
        const p1r = Math.max(3, Math.min((inH - bodyH) * 0.42, inW * 0.12));
        const p2r = Math.max(2, p1r * 0.6);
        const p1y = i + bodyH + p1r * 0.6;
        const p2y = Math.min(h - i - p2r, p1y + p1r * 0.85 + p2r);
        body = `<ellipse cx="${w / 2}" cy="${i + ry}" rx="${rx}" ry="${ry}" ${attrs}/>`
          + `<circle cx="${i + inW * 0.42}" cy="${p1y}" r="${p1r}" ${attrs}/>`
          + `<circle cx="${i + inW * 0.26}" cy="${p2y}" r="${p2r}" ${attrs}/>`;
        break;
      }
      default: // rect
        body = `<rect x="${i}" y="${i}" width="${w - sw}" height="${h - sw}" rx="${Math.max(0, num(e.rx, 0))}" ${attrs}/>`;
    }
    const fx = e.flipH || e.flipV ? `transform:scale(${e.flipH ? -1 : 1},${e.flipV ? -1 : 1});` : '';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;${fx}">${body}</svg>`;
  }

  // A QR code drawn from its stored module matrix (see engine/qr.js). Pure —
  // no encoder here — so the same matrix renders identically in the editor and
  // the PDF. `crispEdges` keeps the modules sharp at any print size.
  function qrSvg(e) {
    const mods = Array.isArray(e.modules) ? e.modules : [];
    const n = mods.length;
    const w = Math.max(24, num(e.w, 140));
    if (!n) {
      // No data yet — a placeholder box so the object is still visible/selectable.
      return `<svg width="${w}" height="${w}" viewBox="0 0 10 10" style="display:block"><rect width="10" height="10" fill="#f0f0f0" stroke="#bbb" stroke-width="0.2"/></svg>`;
    }
    const quiet = 4; // standard QR quiet zone
    const dim = n + quiet * 2;
    const fg = color(e.fg, '#000000');
    const bg = e.bg === 'none' ? 'none' : color(e.bg, '#ffffff');
    let rects = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (mods[r][c]) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
      }
    }
    return `<svg width="${w}" height="${w}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" style="display:block">`
      + (bg === 'none' ? '' : `<rect width="${dim}" height="${dim}" fill="${bg}"/>`)
      + `<g fill="${fg}">${rects}</g></svg>`;
  }

  /**
   * Render a free element's inner HTML (unpositioned — the caller wraps it and
   * applies the translate/rotate/scale transform).
   */
  function elementInner(e) {
    if (!e) return '';
    if (e.kind === 'qr') return qrSvg(e);
    if (e.kind === 'image') {
      if (typeof e.src === 'string' && e.src.startsWith('data:')) {
        const fx = e.flipH || e.flipV ? `transform:scale(${e.flipH ? -1 : 1},${e.flipV ? -1 : 1});` : '';
        return `<img src="${e.src}" style="width:${num(e.width, 160)}px;display:block;pointer-events:none;${fx}" alt="">`;
      }
      // No image yet: a picture placeholder frame (double-click in the editor to
      // fill it). Rendered with inline styles so it looks the same in the PDF.
      const w = num(e.width, 200), h = num(e.h, 140);
      const fs = Math.max(18, Math.min(w, h) * 0.3);
      return `<div style="width:${w}px;height:${h}px;box-sizing:border-box;border:2px dashed #b6bccb;`
        + `border-radius:6px;display:flex;align-items:center;justify-content:center;`
        + `background:#f7f8fb;color:#aeb4c4;font-size:${fs}px;">\u{1F5BC}</div>`;
    }
    if (e.kind === 'shape') return shapeSvg(e);
    if (e.kind === 'table') return tableHtml(e);
    // text
    const fill = (e.color === 'none' || e.color === 'transparent') ? 'transparent' : color(e.color, '#222');
    const cols = Math.max(1, Math.min(4, Math.round(num(e.columns, 1))));
    const pad = Math.max(0, Math.min(60, num(e.pad, 0)));
    // Typography (OpenType features Chromium renders on screen and in the PDF).
    const NUMSTYLE = { linprop: 'lining-nums proportional-nums', lintab: 'lining-nums tabular-nums', oldprop: 'oldstyle-nums proportional-nums', oldtab: 'oldstyle-nums tabular-nums' };
    const LIG = { disc: 'common-ligatures discretionary-ligatures', none: 'none' };
    const css =
      `font-size:${num(e.fontSize, 24)}px;color:${fill};` +
      `font-family:${fontStack(e.fontFamily)};` +
      `font-weight:${e.bold ? 700 : 400};font-style:${e.italic ? 'italic' : 'normal'};` +
      `text-decoration:${e.underline ? 'underline' : 'none'};` +
      `text-align:${['left', 'center', 'right', 'justify'].includes(e.align) ? e.align : 'left'};` +
      `width:${num(e.w, 240)}px;white-space:pre-wrap;line-height:${Math.max(0.8, Math.min(3, num(e.lineHeight, 1.25)))};` +
      (e.hyphens ? 'hyphens:auto;-webkit-hyphens:auto;' : '') +
      (cols > 1 ? `column-count:${cols};column-gap:16px;` : '') +
      // Text-box frame (Shape Format tab): background fill, border, radius, shadow.
      ((pad > 0 || (e.boxStroke && e.boxStroke !== 'none')) ? `padding:${pad}px;box-sizing:border-box;` : '') +
      (e.boxFill && e.boxFill !== 'none' ? `background:${color(e.boxFill, '#ffffff')};` : '') +
      (e.boxStroke && e.boxStroke !== 'none' ? `border:${Math.max(0, Math.min(20, num(e.boxStrokeW, 1)))}px solid ${color(e.boxStroke, '#333')};` : '') +
      (num(e.boxRadius, 0) ? `border-radius:${Math.max(0, Math.min(200, num(e.boxRadius, 0)))}px;` : '') +
      (e.boxShadow ? `box-shadow:3px 3px 7px ${color(e.boxShadow, '#00000033')};` : '') +
      (NUMSTYLE[e.numStyle] ? `font-variant-numeric:${NUMSTYLE[e.numStyle]};` : '') +
      (LIG[e.ligatures] ? `font-variant-ligatures:${LIG[e.ligatures]};` : '') +
      // WordArt: outline (text-stroke) + drop shadow. Chromium renders both on
      // screen and in the PDF, so styled titles print exactly as designed.
      (e.textStroke ? `-webkit-text-stroke:${Math.max(0, num(e.textStrokeW, 1))}px ${color(e.textStroke, '#222')};` : '') +
      (e.textShadow ? `text-shadow:2px 2px 0 ${color(e.textShadow, '#00000040')};` : '');
    // Drop cap: float the first character so it spans N lines (Publisher-style).
    let body = esc(e.text || '');
    const dc = Math.max(0, Math.min(5, Math.round(num(e.dropCap, 0))));
    if (dc >= 2 && e.text) { const t = String(e.text); body = `<span style="float:left;font-size:${dc}em;line-height:.8;padding:0 .06em 0 0;font-weight:700;">${esc(t[0])}</span>${esc(t.slice(1))}`; }
    return `<div class="pf-textbox" style="${css}">${body}</div>`;
  }

  // Wrap the inner HTML in a link / bookmark anchor when set, so Chromium emits
  // a clickable link (and a named target) in the exported PDF. Both are inert on
  // paper. Only http(s)/mailto and same-page #targets are allowed as hrefs.
  function elementHtml(e) {
    const inner = elementInner(e);
    if (!e || (!e.link && !e.bookmark)) return inner;
    const href = /^(https?:|mailto:|#)/i.test(String(e.link || '')) ? esc(e.link) : null;
    const name = e.bookmark ? esc(String(e.bookmark)) : null;
    if (!href && !name) return inner;
    const attrs = (href ? ` href="${href}"` : '') + (name ? ` id="${name}" name="${name}"` : '');
    return `<a${attrs} style="text-decoration:none;color:inherit;display:block;">${inner}</a>`;
  }

  // Build @font-face CSS for uploaded custom fonts. Each entry is
  // { family:'pf-custom-<slug>', dataUrl:'data:font/...;base64,...' }. Used by
  // the export doc (server) and the live editor so custom fonts match on both.
  // Only data: URLs are accepted, and the family is re-derived from the slug so
  // an untrusted `family` can't inject arbitrary CSS.
  function fontFaceCss(fonts) {
    if (!Array.isArray(fonts)) return '';
    return fonts.map((f) => {
      const fam = String((f && f.family) || '');
      const slug = fam.slice(0, 10) === 'pf-custom-' ? fam.slice(10).replace(/[^a-z0-9_-]/gi, '') : '';
      const url = String((f && f.dataUrl) || '');
      if (!slug || !/^data:[a-z0-9/+.-]+;base64,[a-z0-9+/=]+$/i.test(url)) return '';
      return `@font-face{font-family:'pf-custom-${slug}';src:url(${url});font-display:swap;}`;
    }).filter(Boolean).join('\n');
  }

  return { elementHtml, fontStack, fontFaceCss, FONTS };
});
