/**
 * Coloring page — render(). Produces black-outline line art (white fill) sized
 * to the usable area. Art is drawn deterministically from data.seed so a page
 * always reproduces. Answer-key mode is identical (there is no solution).
 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Small seeded PRNG (mulberry32) so a seed reproduces the same picture.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (deg) => (deg * Math.PI) / 180;

// --- mandala ---------------------------------------------------------------

function ringOf(motif, count, c) {
  let s = '';
  for (let i = 0; i < count; i++) {
    s += `<g transform="rotate(${(360 * i) / count} ${c} ${c})">${motif}</g>`;
  }
  return s;
}

// One instance of a band motif at "12 o'clock", to be repeated by ringOf.
// Each spans the radius band [r0, r1]; `w` is its half-width in px.
function bandMotif(kind, c, r0, r1, w) {
  const mid = (r0 + r1) / 2;
  const f = (n) => n.toFixed(1);
  switch (kind) {
    case 'petal':
      return `<path d="M ${c} ${f(c - r0)} C ${f(c - w)} ${f(c - mid)}, ${f(c - w)} ${f(c - mid)}, ${c} ${f(c - r1)} C ${f(c + w)} ${f(c - mid)}, ${f(c + w)} ${f(c - mid)}, ${c} ${f(c - r0)} Z"/>`;
    case 'teardrop':
      return `<path d="M ${c} ${f(c - r1)} Q ${f(c + w)} ${f(c - mid)}, ${c} ${f(c - r0)} Q ${f(c - w)} ${f(c - mid)}, ${c} ${f(c - r1)} Z"/>`;
    case 'diamond':
      return `<polygon points="${c},${f(c - r1)} ${f(c + w)},${f(c - mid)} ${c},${f(c - r0)} ${f(c - w)},${f(c - mid)}"/>`;
    case 'triangle':
      return `<polygon points="${c},${f(c - r1)} ${f(c + w)},${f(c - r0)} ${f(c - w)},${f(c - r0)}"/>`;
    case 'circle':
      return `<circle cx="${c}" cy="${f(c - mid)}" r="${f(Math.min(w, (r1 - r0) / 2))}"/>`;
    case 'twin': {
      const rr = Math.min(w * 0.55, (r1 - r0) / 4);
      return `<circle cx="${c}" cy="${f(c - r0 - (r1 - r0) * 0.32)}" r="${f(rr)}"/><circle cx="${c}" cy="${f(c - r0 - (r1 - r0) * 0.72)}" r="${f(rr * 0.8)}"/>`;
    }
    default:
      return `<circle cx="${c}" cy="${f(c - mid)}" r="${f(w * 0.6)}"/>`;
  }
}

// Seed-driven mandala: random ring count, fold symmetry, per-ring motifs,
// center and border treatments — so every page is visibly different.
function mandala(S, rng) {
  const c = S / 2;
  const R = S * 0.46;
  const ring = (r) => `<circle cx="${c}" cy="${c}" r="${r.toFixed(1)}"/>`;
  const choose = (arr) => arr[Math.floor(rng() * arr.length)];
  const parts = [];

  const N = choose([8, 10, 12, 16]); // base fold symmetry (kept consistent)
  const ringCount = choose([3, 4, 5]);
  const rInner = R * choose([0.14, 0.18, 0.22]);

  const edges = [];
  for (let i = 0; i <= ringCount; i++) edges.push(rInner + ((R - rInner) * i) / ringCount);

  // Outer boundary (sometimes doubled) and the inner circle.
  parts.push(ring(R));
  if (rng() < 0.6) parts.push(ring(R * 0.965));
  parts.push(ring(rInner));

  const motifs = ['petal', 'teardrop', 'diamond', 'triangle', 'circle', 'twin'];
  for (let i = 0; i < ringCount; i++) {
    const r0 = edges[i];
    const r1 = edges[i + 1];
    if (rng() < 0.5 && i > 0) parts.push(ring(r0)); // optional separating circle
    const count = rng() < 0.5 ? N : 2 * N;
    const arc = (2 * Math.PI * ((r0 + r1) / 2)) / count;
    const w = Math.min(arc * 0.45, (r1 - r0) * 0.5);
    const pad = (r1 - r0) * 0.08;
    parts.push(ringOf(bandMotif(choose(motifs), c, r0 + pad, r1 - pad, w), count, c));
  }

  // Center motif.
  switch (choose(['flower', 'burst', 'rings', 'dot'])) {
    case 'flower':
      parts.push(ring(rInner * 0.38));
      parts.push(ringOf(bandMotif('petal', c, rInner * 0.38, rInner * 0.95, rInner * 0.5), choose([6, 8]), c));
      break;
    case 'burst':
      parts.push(ring(rInner * 0.28));
      parts.push(ringOf(bandMotif('triangle', c, rInner * 0.28, rInner * 0.95, rInner * 0.4), choose([8, 12]), c));
      break;
    case 'rings':
      parts.push(ring(rInner * 0.66));
      parts.push(ring(rInner * 0.38));
      parts.push(ring(rInner * 0.16));
      break;
    default:
      parts.push(ring(rInner * 0.45));
  }

  // Optional outer scallop-dot border.
  if (rng() < 0.65) {
    const dotCount = choose([2 * N, 2.5 * N, 3 * N]) | 0;
    parts.push(ringOf(`<circle cx="${c}" cy="${(c - R * 0.93).toFixed(1)}" r="${(S * 0.013).toFixed(1)}"/>`, dotCount, c));
  }

  return parts.join('');
}

// --- pattern ---------------------------------------------------------------

function motif(kind, x, y, s) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.36;
  switch (kind) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"/>`;
    case 'diamond':
      return `<polygon points="${cx},${(cy - r).toFixed(1)} ${(cx + r).toFixed(1)},${cy} ${cx},${(cy + r).toFixed(1)} ${(cx - r).toFixed(1)},${cy}"/>`;
    case 'star': {
      let pts = '';
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = rad(-90 + i * 36);
        pts += `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `;
      }
      return `<polygon points="${pts.trim()}"/>`;
    }
    case 'heart':
      return `<path d="M ${cx} ${(cy + r * 0.9).toFixed(1)} C ${(cx - r * 1.5).toFixed(1)} ${(cy - r * 0.2).toFixed(1)}, ${(cx - r * 0.4).toFixed(1)} ${(cy - r * 1.1).toFixed(1)}, ${cx} ${(cy - r * 0.35).toFixed(1)} C ${(cx + r * 0.4).toFixed(1)} ${(cy - r * 1.1).toFixed(1)}, ${(cx + r * 1.5).toFixed(1)} ${(cy - r * 0.2).toFixed(1)}, ${cx} ${(cy + r * 0.9).toFixed(1)} Z"/>`;
    case 'flower': {
      let s2 = `<circle cx="${cx}" cy="${cy}" r="${(r * 0.32).toFixed(1)}"/>`;
      for (let i = 0; i < 6; i++) {
        const a = rad(i * 60);
        const px = cx + r * 0.62 * Math.cos(a);
        const py = cy + r * 0.62 * Math.sin(a);
        s2 += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r * 0.34).toFixed(1)}"/>`;
      }
      return s2;
    }
    case 'fish':
    default: {
      const e = `<ellipse cx="${cx}" cy="${cy}" rx="${r.toFixed(1)}" ry="${(r * 0.62).toFixed(1)}"/>`;
      const tail = `<polygon points="${(cx + r).toFixed(1)},${cy} ${(cx + r * 1.5).toFixed(1)},${(cy - r * 0.5).toFixed(1)} ${(cx + r * 1.5).toFixed(1)},${(cy + r * 0.5).toFixed(1)}"/>`;
      const eye = `<circle cx="${(cx - r * 0.45).toFixed(1)}" cy="${(cy - r * 0.12).toFixed(1)}" r="${(r * 0.1).toFixed(1)}"/>`;
      return e + tail + eye;
    }
  }
}

function pattern(S, rng) {
  const g = [3, 4, 5][Math.floor(rng() * 3)];
  const cell = S / g;
  const kinds = ['circle', 'diamond', 'star', 'heart', 'flower', 'fish'];
  const start = Math.floor(rng() * kinds.length);
  const parts = [];
  // Outer border.
  parts.push(`<rect x="1" y="1" width="${(S - 2).toFixed(1)}" height="${(S - 2).toFixed(1)}" rx="${(S * 0.03).toFixed(1)}"/>`);
  let k = start;
  for (let r = 0; r < g; r++) {
    for (let col = 0; col < g; col++) {
      parts.push(motif(kinds[k % kinds.length], col * cell, r * cell, cell));
      k++;
    }
    k++; // shift each row so motifs alternate
  }
  return parts.join('');
}

// --- bubble word -----------------------------------------------------------

function bubble(S, word) {
  const c = S / 2;
  const stroke = Math.max(3, S * 0.012);
  const fontSize = Math.min(S * 0.42, (S * 1.4) / Math.max(3, word.length));
  return (
    `<rect x="${(S * 0.04).toFixed(1)}" y="${(S * 0.04).toFixed(1)}" width="${(S * 0.92).toFixed(1)}" height="${(S * 0.92).toFixed(1)}" rx="${(S * 0.05).toFixed(1)}"/>` +
    `<text x="${c}" y="${c}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${fontSize.toFixed(0)}" ` +
    `text-anchor="middle" dominant-baseline="central" textLength="${(S * 0.86).toFixed(0)}" lengthAdjust="spacingAndGlyphs" ` +
    `fill="#fff" stroke="#000" stroke-width="${stroke.toFixed(1)}" stroke-linejoin="round" paint-order="stroke">${esc(word)}</text>`
  );
}

function artFor(data, S) {
  const rng = mulberry32((data.seed || 1) >>> 0);
  if (data.style === 'bubble' && data.word) return bubble(S, data.word);
  if (data.style === 'pattern') return pattern(S, rng);
  return mandala(S, rng);
}

function render(puzzle, layout) {
  const titleSize = Math.round(layout.fontSize * 1.8);
  const headerReserve = Math.round(layout.fontSize * 5);
  const S = Math.max(160, Math.min(layout.usableWidth, layout.usableHeight - headerReserve));
  const art = artFor(puzzle.data, S);

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
  h1 { font-size: ${titleSize}px; margin: 0 0 4px 0; text-align: center; }
  .instructions { text-align: center; margin: 0 0 12px 0; }
  .art { text-align: center; }
  svg.color-art { display: block; margin: 0 auto; }
  svg.color-art * { fill: none; stroke: #000; stroke-width: ${Math.max(2, S * 0.006).toFixed(1)}px; }
  svg.color-art text { stroke-width: ${Math.max(3, S * 0.012).toFixed(1)}px; }
  svg.color-art text { fill: #fff; }
</style>
</head>
<body>
  <h1>${esc(puzzle.title)}</h1>
  <div class="instructions">${esc(puzzle.instructions)}</div>
  <div class="art">
    <svg class="color-art" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${art}</svg>
  </div>
</body>
</html>`;
}

module.exports = { render };
