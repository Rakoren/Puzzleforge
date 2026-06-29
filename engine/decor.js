/**
 * Page decoration — procedural SVG borders (frames) for puzzle pages.
 *
 * Borders are drawn as a vector SVG sized to the page's usable area, so they
 * print razor-sharp at any trim size with no image assets. The renderer places
 * the frame as an absolutely-positioned overlay behind the puzzle content.
 *
 * AI-generated borders/clip art (from the ComfyUI tools) are a separate path:
 * those come in as images and are placed via custom-image options; these
 * built-ins are the reliable, always-available default.
 */

const BORDER_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'single', label: 'Single line' },
  { id: 'double', label: 'Double line' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dots', label: 'Dots' },
  { id: 'scallop', label: 'Scallop' },
  { id: 'stars', label: 'Stars' },
];
const BORDER_IDS = new Set(BORDER_STYLES.map((s) => s.id));

function clampNum(v, lo, hi, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

// Only allow a hex color or a plain CSS color name (defends the SVG against
// injection, since this string is interpolated into markup).
function sanitizeColor(c) {
  const s = String(c || '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^[a-zA-Z]{1,20}$/.test(s)) return s;
  return '#333333';
}

function starPath(cx, cy, r, color) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
}

function dotsBorder(x0, y0, x1, y1, color, weight) {
  const r = weight * 1.3;
  const gap = r * 4;
  let s = '';
  const run = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.round(len / gap));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      s += `<circle cx="${(ax + (bx - ax) * t).toFixed(1)}" cy="${(ay + (by - ay) * t).toFixed(1)}" r="${r.toFixed(1)}" fill="${color}"/>`;
    }
  };
  run(x0, y0, x1, y0);
  run(x1, y0, x1, y1);
  run(x1, y1, x0, y1);
  run(x0, y1, x0, y0);
  return s;
}

function scallopBorder(x0, y0, x1, y1, color, weight) {
  const seg = 26;
  let d = '';
  const edge = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.round(len / seg));
    const ux = (bx - ax) / n;
    const uy = (by - ay) / n;
    const r = Math.hypot(ux, uy) / 2;
    d += `M ${ax.toFixed(1)} ${ay.toFixed(1)} `;
    for (let i = 0; i < n; i++) {
      const nx = ax + ux * (i + 1);
      const ny = ay + uy * (i + 1);
      d += `A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${nx.toFixed(1)} ${ny.toFixed(1)} `;
    }
  };
  edge(x0, y0, x1, y0);
  edge(x1, y0, x1, y1);
  edge(x1, y1, x0, y1);
  edge(x0, y1, x0, y0);
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linejoin="round"/>`;
}

/**
 * Build the inner SVG markup for a page border.
 * @param {string} style one of BORDER_STYLES ids
 * @param {number} w usable width (px)
 * @param {number} h usable height (px)
 * @param {object} [opts] { color, weight }
 * @returns {string} SVG markup ('' when style is none/unknown)
 */
function frameSvg(style, w, h, opts = {}) {
  if (!style || style === 'none' || !BORDER_IDS.has(style)) return '';
  const color = sanitizeColor(opts.color);
  const weight = clampNum(opts.weight, 1, 10, 3);
  const pad = 4 + weight;
  const x0 = pad;
  const y0 = pad;
  const x1 = w - pad;
  const y1 = h - pad;
  const iw = x1 - x0;
  const ih = y1 - y0;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`;
  const rect = (inset, extra = '') =>
    `<rect x="${(x0 + inset).toFixed(1)}" y="${(y0 + inset).toFixed(1)}" width="${(iw - 2 * inset).toFixed(1)}" height="${(ih - 2 * inset).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${weight}" ${extra}/>`;
  let inner;
  switch (style) {
    case 'single':
      inner = rect(0);
      break;
    case 'double':
      inner = rect(0) + rect(weight * 2.4);
      break;
    case 'rounded':
      inner = rect(0, `rx="${Math.min(40, iw * 0.04).toFixed(1)}"`);
      break;
    case 'dashed':
      inner = rect(0, `stroke-dasharray="${weight * 4} ${weight * 3}" stroke-linecap="round"`);
      break;
    case 'dots':
      inner = dotsBorder(x0, y0, x1, y1, color, weight);
      break;
    case 'scallop':
      inner = scallopBorder(x0, y0, x1, y1, color, weight);
      break;
    case 'stars': {
      const r = 11 + weight;
      inner =
        rect(r * 0.9) +
        [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([cx, cy]) => starPath(cx, cy, r, color)).join('');
      break;
    }
    default:
      return '';
  }
  return open + inner + '</svg>';
}

module.exports = { frameSvg, BORDER_STYLES, BORDER_IDS };
