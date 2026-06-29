/**
 * Image tools (publisher-only) — turn an uploaded photo into a printable
 * coloring page.
 *
 * Pure-Sharp + JS pipeline: auto-orient, downscale to a working resolution,
 * grayscale, then a Sobel edge detector in JS (full control, predictable)
 * thresholded to clean black outlines on white, with optional line thickening.
 * No external ML — true semantic background removal is out of scope; the
 * "detail" control trades line count for cleanliness.
 */
const sharp = require('sharp');

const MAX_WORK_WIDTH = 2000; // cap processing resolution for speed

// Decode a data URL or raw base64 / buffer into a Buffer.
function toBuffer(image) {
  if (Buffer.isBuffer(image)) return image;
  const s = String(image || '');
  const comma = s.indexOf(',');
  const b64 = s.startsWith('data:') && comma >= 0 ? s.slice(comma + 1) : s;
  return Buffer.from(b64, 'base64');
}

/**
 * Convert an image to coloring-page line art.
 * @param {Buffer|string} image  buffer or (data) URL
 * @param {object} [opts]
 * @param {number} [opts.detail=6]     1 (few bold lines) … 10 (fine detail)
 * @param {number} [opts.thickness=2]  line weight in pixels (1–4)
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, dataUrl: string }>}
 */
async function toColoringPage(image, opts = {}) {
  const detail = Math.max(1, Math.min(10, Math.round(Number(opts.detail) || 6)));
  const thickness = Math.max(1, Math.min(4, Math.round(Number(opts.thickness) || 2)));
  const threshold = 232 - detail * 16; // detail 1→216 (sparse) … 10→72 (dense)

  let pipeline = sharp(toBuffer(image)).rotate(); // honor EXIF orientation
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > MAX_WORK_WIDTH) pipeline = pipeline.resize({ width: MAX_WORK_WIDTH });

  const { data, info } = await pipeline.grayscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const g = (x, y) => data[(y * w + x) * ch];

  let edge = new Uint8Array(w * h).fill(255);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -g(x - 1, y - 1) - 2 * g(x - 1, y) - g(x - 1, y + 1) +
        g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1);
      const gy =
        -g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1) +
        g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1);
      if (Math.hypot(gx, gy) > threshold) edge[y * w + x] = 0;
    }
  }

  // Thicken lines (dilate black) for cleaner, more colorable outlines.
  for (let t = 1; t < thickness; t++) {
    const next = Uint8Array.from(edge);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (edge[y * w + x] === 0) {
          next[(y - 1) * w + x] = 0;
          next[(y + 1) * w + x] = 0;
          next[y * w + x - 1] = 0;
          next[y * w + x + 1] = 0;
        }
      }
    }
    edge = next;
  }

  const buffer = await sharp(Buffer.from(edge), { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  return { buffer, width: w, height: h, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
}

/**
 * Build a print-ready HTML page that fits a line-art image inside the trim's
 * usable area, exported to PDF via the engine.
 */
function coloringPageHtml(dataUrl, layout, title) {
  const titleSize = Math.round(layout.fontSize * 1.6);
  const headerReserve = title ? Math.round(layout.fontSize * 3) : 0;
  const artH = layout.usableHeight - headerReserve;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${layout.widthIn}in ${layout.heightIn}in; margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; color: #000; width: ${layout.usableWidth}px; }
  h1 { font-size: ${titleSize}px; text-align: center; margin: 0 0 12px 0; }
  .art { width: 100%; height: ${artH}px; display: flex; align-items: center; justify-content: center; }
  .art img { max-width: 100%; max-height: 100%; }
</style></head>
<body>
  ${title ? `<h1>${String(title).replace(/[<&>]/g, '')}</h1>` : ''}
  <div class="art"><img src="${dataUrl}"></div>
</body></html>`;
}

// --- Color by Number ---------------------------------------------------------

const clampInt = (v, lo, hi, def) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
};

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// k-means over flat RGB pixel data. Deterministic init (evenly spaced samples)
// so the same photo + settings give the same page.
function kmeans(px, n, k, iters) {
  const cent = new Float64Array(k * 3);
  // Low-discrepancy (golden-ratio) sampling spreads the seed pixels across the
  // whole image, avoiding row/column alignment that can miss a color. Still
  // deterministic, so the same photo + settings give the same page.
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(((i * 0.6180339887498949) % 1) * n);
    cent[i * 3] = px[idx * 3];
    cent[i * 3 + 1] = px[idx * 3 + 1];
    cent[i * 3 + 2] = px[idx * 3 + 2];
  }
  const labels = new Uint8Array(n);
  for (let it = 0; it < iters; it++) {
    for (let p = 0; p < n; p++) {
      const r = px[p * 3];
      const g = px[p * 3 + 1];
      const b = px[p * 3 + 2];
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = r - cent[c * 3];
        const dg = g - cent[c * 3 + 1];
        const db = b - cent[c * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = c; }
      }
      labels[p] = best;
    }
    const sum = new Float64Array(k * 3);
    const cnt = new Uint32Array(k);
    for (let p = 0; p < n; p++) {
      const c = labels[p];
      sum[c * 3] += px[p * 3];
      sum[c * 3 + 1] += px[p * 3 + 1];
      sum[c * 3 + 2] += px[p * 3 + 2];
      cnt[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (cnt[c]) {
        cent[c * 3] = sum[c * 3] / cnt[c];
        cent[c * 3 + 1] = sum[c * 3 + 1] / cnt[c];
        cent[c * 3 + 2] = sum[c * 3 + 2] / cnt[c];
      }
    }
  }
  return { labels, cent };
}

// Majority filter: replace each pixel's label with the most common among its
// 4-neighbours + itself. Removes speckle so regions are colorable.
function smoothLabels(labels, w, h, passes) {
  for (let pass = 0; pass < passes; pass++) {
    const next = Uint8Array.from(labels);
    const counts = {};
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        counts[labels[i]] = 1;
        for (const j of [i - 1, i + 1, i - w, i + w]) counts[labels[j]] = (counts[labels[j]] || 0) + 1;
        let bestL = labels[i];
        let bestC = -1;
        for (const l in counts) { if (counts[l] > bestC) { bestC = counts[l]; bestL = Number(l); } counts[l] = 0; }
        next[i] = bestL;
      }
    }
    labels = next;
  }
  return labels;
}

// Dissolve speckle: any connected region smaller than minArea is repainted with
// the palette color of the neighbor it shares the longest border with. Repeated
// until stable, this is what turns a noisy posterization into clean, colorable
// regions (the difference between a photo trace and a tidy color-by-number).
function mergeSmallRegions(pal, w, h, minArea, maxPasses) {
  const n = w * h;
  const comp = new Int32Array(n);
  const stack = new Int32Array(n);
  for (let pass = 0; pass < maxPasses; pass++) {
    comp.fill(-1);
    let changed = false;
    let cid = 0;
    for (let s = 0; s < n; s++) {
      if (comp[s] !== -1) continue;
      const target = pal[s];
      let sp = 0;
      stack[sp++] = s;
      comp[s] = cid;
      const cells = [];
      while (sp > 0) {
        const p = stack[--sp];
        cells.push(p);
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0 && comp[p - 1] === -1 && pal[p - 1] === target) { comp[p - 1] = cid; stack[sp++] = p - 1; }
        if (x < w - 1 && comp[p + 1] === -1 && pal[p + 1] === target) { comp[p + 1] = cid; stack[sp++] = p + 1; }
        if (y > 0 && comp[p - w] === -1 && pal[p - w] === target) { comp[p - w] = cid; stack[sp++] = p - w; }
        if (y < h - 1 && comp[p + w] === -1 && pal[p + w] === target) { comp[p + w] = cid; stack[sp++] = p + w; }
      }
      if (cells.length < minArea) {
        const counts = {};
        for (const p of cells) {
          const x = p % w;
          const y = (p - x) / w;
          if (x > 0 && comp[p - 1] !== cid) counts[pal[p - 1]] = (counts[pal[p - 1]] || 0) + 1;
          if (x < w - 1 && comp[p + 1] !== cid) counts[pal[p + 1]] = (counts[pal[p + 1]] || 0) + 1;
          if (y > 0 && comp[p - w] !== cid) counts[pal[p - w]] = (counts[pal[p - w]] || 0) + 1;
          if (y < h - 1 && comp[p + w] !== cid) counts[pal[p + w]] = (counts[pal[p + w]] || 0) + 1;
        }
        let bestV = -1;
        let bestC = 0;
        for (const v in counts) { if (counts[v] > bestC) { bestC = counts[v]; bestV = Number(v); } }
        if (bestV >= 0 && bestV !== target) { for (const p of cells) pal[p] = bestV; changed = true; }
      }
      cid++;
    }
    if (!changed) break;
  }
}

/**
 * Convert a photo into a color-by-number page: flat color regions, a number in
 * each sizable region, and a numbered color key.
 *
 * @param {Buffer|string} image
 * @param {object} [opts]
 * @param {number} [opts.colors=12]   palette size (4–24)
 * @param {number} [opts.smoothing=3] cleanup strength 0–5 (despeckle + merge); accepts opts.cleanup too
 * @returns {Promise<{ outlineDataUrl, referenceDataUrl, width, height, palette, regions }>}
 *   regions: [{ x, y, n }] with x/y as 0–1 fractions of the image; n = palette number.
 */
async function toColorByNumber(image, opts = {}) {
  const colors = clampInt(opts.colors, 4, 24, 12);
  // "Cleanup" drives despeckling, smoothing, and small-region merging — the
  // higher it is, the larger and tidier the regions (fewer stray numbers).
  const cleanup = clampInt(opts.smoothing != null ? opts.smoothing : opts.cleanup, 0, 5, 3);

  // Work at a modest resolution so clustering + components stay fast.
  let pipeline = sharp(toBuffer(image)).rotate();
  const meta = await pipeline.metadata();
  const workW = Math.min(meta.width || 600, 600);
  pipeline = pipeline.resize({ width: workW });
  // Edge-preserving despeckle BEFORE clustering, so photo texture collapses into
  // flat areas instead of becoming thousands of tiny color specks.
  if (cleanup > 0) pipeline = pipeline.median(1 + cleanup * 2);
  const { data, info } = await pipeline.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const n = w * h;

  // Pack RGB into a flat array for k-means.
  const px = new Float64Array(n * 3);
  for (let p = 0; p < n; p++) {
    px[p * 3] = data[p * ch];
    px[p * 3 + 1] = data[p * ch + 1];
    px[p * 3 + 2] = data[p * ch + 2];
  }

  const { labels: raw, cent } = kmeans(px, n, colors, 12);
  const labels = smoothLabels(raw, w, h, Math.max(1, cleanup));

  // Order clusters dark → light, then merge perceptually similar ones so asking
  // for "more colors" never yields near-duplicate shades (a major noise source).
  // "Colors" becomes a soft maximum; cleanup widens the merge tolerance.
  const used = [...new Set(labels)];
  used.sort((a, b) => luminance(cent[a * 3], cent[a * 3 + 1], cent[a * 3 + 2]) - luminance(cent[b * 3], cent[b * 3 + 1], cent[b * 3 + 2]));
  const colorThresh = 16 + cleanup * 8;
  const reps = []; // representative cluster ids that survive merging
  const repOf = new Int16Array(colors).fill(-1);
  for (const c of used) {
    const r = cent[c * 3];
    const g = cent[c * 3 + 1];
    const b = cent[c * 3 + 2];
    let found = -1;
    for (const rc of reps) {
      const dr = r - cent[rc * 3];
      const dg = g - cent[rc * 3 + 1];
      const db = b - cent[rc * 3 + 2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) < colorThresh) { found = rc; break; }
    }
    if (found >= 0) { repOf[c] = found; } else { reps.push(c); repOf[c] = c; }
  }
  const remap = new Int16Array(colors).fill(-1);
  let palette = reps.map((c, i) => {
    remap[c] = i;
    const r = cent[c * 3];
    const g = cent[c * 3 + 1];
    const b = cent[c * 3 + 2];
    return { n: i + 1, hex: toHex(r, g, b), rgb: [Math.round(r), Math.round(g), Math.round(b)] };
  });
  const pal = new Uint8Array(n); // 0-based palette index per pixel
  for (let p = 0; p < n; p++) pal[p] = remap[repOf[labels[p]]];

  // Dissolve tiny regions into their neighbours — the main noise-killer.
  const mergeArea = Math.round(n * (0.0008 + cleanup * 0.0007));
  mergeSmallRegions(pal, w, h, Math.max(24, mergeArea), 8);

  // Drop palette colors that no longer appear, and renumber 1..k contiguously.
  const present = [...new Set(pal)].sort((a, b) => a - b);
  const reindex = new Int16Array(palette.length).fill(-1);
  palette = present.map((oldIdx, i) => {
    reindex[oldIdx] = i;
    return { n: i + 1, hex: palette[oldIdx].hex, rgb: palette[oldIdx].rgb };
  });
  for (let p = 0; p < n; p++) pal[p] = reindex[pal[p]];

  // Connected components (4-connectivity) → one number per sizable region.
  const minArea = Math.max(80, Math.round(n * 0.0016));
  const comp = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const regions = [];
  let maxNumbers = 500;
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    const target = pal[s];
    let sp = 0;
    stack[sp++] = s;
    comp[s] = 1;
    let area = 0;
    let sx = 0;
    let sy = 0;
    const cells = [];
    while (sp > 0) {
      const p = stack[--sp];
      area++;
      const x = p % w;
      const y = (p - x) / w;
      sx += x;
      sy += y;
      cells.push(p);
      if (x > 0 && comp[p - 1] === -1 && pal[p - 1] === target) { comp[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && comp[p + 1] === -1 && pal[p + 1] === target) { comp[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && comp[p - w] === -1 && pal[p - w] === target) { comp[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && comp[p + w] === -1 && pal[p + w] === target) { comp[p + w] = 1; stack[sp++] = p + w; }
    }
    if (area < minArea || maxNumbers <= 0) continue;
    // Snap the label anchor to the region pixel nearest the centroid (so the
    // number always lands inside concave shapes).
    const cx = sx / area;
    const cy = sy / area;
    let bestP = cells[0];
    let bd = Infinity;
    for (const p of cells) {
      const x = p % w;
      const y = (p - x) / w;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d < bd) { bd = d; bestP = p; }
    }
    regions.push({ x: (bestP % w) / w, y: Math.floor(bestP / w) / h, n: target + 1 });
    maxNumbers--;
  }

  // Outline raster at higher resolution for crisp borders (drawn where adjacent
  // pixels belong to different palette colors).
  const S = Math.max(1, Math.round(1500 / w));
  const ow = w * S;
  const oh = h * S;
  const out = new Uint8Array(ow * oh).fill(255);
  for (let oy = 0; oy < oh; oy++) {
    const y = (oy / S) | 0;
    for (let ox = 0; ox < ow; ox++) {
      const x = (ox / S) | 0;
      const l = pal[y * w + x];
      const rightDiff = x < w - 1 && pal[y * w + x + 1] !== l;
      const downDiff = y < h - 1 && pal[(y + 1) * w + x] !== l;
      if (rightDiff || downDiff) out[oy * ow + ox] = 0;
    }
  }
  const outlineBuf = await sharp(Buffer.from(out), { raw: { width: ow, height: oh, channels: 1 } }).png().toBuffer();

  // Reference: the posterized color image (what the finished page looks like).
  const ref = Buffer.alloc(n * 3);
  for (let p = 0; p < n; p++) {
    const c = palette[pal[p]].rgb;
    ref[p * 3] = c[0];
    ref[p * 3 + 1] = c[1];
    ref[p * 3 + 2] = c[2];
  }
  const refBuf = await sharp(ref, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();

  return {
    outlineDataUrl: `data:image/png;base64,${outlineBuf.toString('base64')}`,
    referenceDataUrl: `data:image/png;base64,${refBuf.toString('base64')}`,
    width: ow,
    height: oh,
    palette,
    regions,
  };
}

/** Print-ready HTML for a color-by-number page: art + overlaid numbers + key. */
function colorByNumberHtml(result, layout, title, opts = {}) {
  const showReference = Boolean(opts.showReference);
  const titleSize = Math.round(layout.fontSize * 1.6);
  const headerReserve = title ? Math.round(layout.fontSize * 3) : 0;
  const keyRows = Math.ceil(result.palette.length / 6);
  const keyReserve = Math.round(layout.fontSize * (2.4 * keyRows + 1.4));
  const refReserve = showReference ? Math.round(layout.usableHeight * 0.22) : 0;
  const artH = layout.usableHeight - headerReserve - keyReserve - refReserve;

  // Fit the art box to the image aspect ratio so overlaid numbers align exactly.
  const scale = Math.min(layout.usableWidth / result.width, artH / result.height);
  const boxW = Math.round(result.width * scale);
  const boxH = Math.round(result.height * scale);
  const numFont = Math.max(7, Math.round(boxW / 60));

  const numbers = result.regions
    .map((r) => `<span class="n" style="left:${(r.x * 100).toFixed(2)}%;top:${(r.y * 100).toFixed(2)}%">${r.n}</span>`)
    .join('');
  const keys = result.palette
    .map((p) => `<div class="key"><span class="sw" style="background:${p.hex}"></span><span class="kn">${p.n}</span></div>`)
    .join('');
  const safeTitle = title ? String(title).replace(/[<&>]/g, '') : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${layout.widthIn}in ${layout.heightIn}in; margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; color: #000; width: ${layout.usableWidth}px; }
  h1 { font-size: ${titleSize}px; text-align: center; margin: 0 0 10px 0; }
  .art { width: 100%; height: ${artH}px; display: flex; align-items: center; justify-content: center; }
  .artwrap { position: relative; width: ${boxW}px; height: ${boxH}px; }
  .artwrap img { width: 100%; height: 100%; display: block; }
  .n { position: absolute; transform: translate(-50%, -50%); font-size: ${numFont}px; color: #444; line-height: 1; }
  .keyrow { display: flex; flex-wrap: wrap; gap: 6px 14px; justify-content: center; margin-top: 12px; }
  .key { display: flex; align-items: center; gap: 5px; font-size: ${Math.round(layout.fontSize * 0.85)}px; }
  .sw { width: ${Math.round(layout.fontSize * 1.1)}px; height: ${Math.round(layout.fontSize * 1.1)}px; border: 1px solid #000; display: inline-block; }
  .kn { font-weight: 700; }
  .ref { text-align: center; margin-top: 10px; }
  .ref img { max-height: ${refReserve - 20}px; max-width: 60%; border: 1px solid #ccc; }
  .ref-cap { font-size: ${Math.round(layout.fontSize * 0.8)}px; color: #666; }
</style></head>
<body>
  ${safeTitle ? `<h1>${safeTitle}</h1>` : ''}
  <div class="art"><div class="artwrap"><img src="${result.outlineDataUrl}">${numbers}</div></div>
  <div class="keyrow">${keys}</div>
  ${showReference ? `<div class="ref"><img src="${result.referenceDataUrl}"><div class="ref-cap">Color guide</div></div>` : ''}
</body></html>`;
}

// --- Dot to Dot --------------------------------------------------------------

// Otsu's method: the grayscale threshold that best separates fore/background.
function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) { maxVar = v; thr = t; }
  }
  return thr;
}

/**
 * Trace a photo's main subject into an ordered ring of numbered dots to connect.
 *
 * Foreground is auto-detected (the class that touches the image border least is
 * the subject), the largest blob is kept, and its outer boundary is sampled at
 * evenly spaced angles around the centroid — giving dots already in draw order.
 *
 * @param {Buffer|string} image
 * @param {object} [opts]
 * @param {number} [opts.dots=40]  number of dots (12–120)
 * @returns {Promise<{ width, height, dots:[{x,y,n}], referenceDataUrl }>}
 *   dots x/y are 0–1 fractions of the page.
 */
async function toDotToDot(image, opts = {}) {
  const target = clampInt(opts.dots, 12, 120, 40);

  let pipeline = sharp(toBuffer(image)).rotate();
  const meta = await pipeline.metadata();
  const workW = Math.min(meta.width || 500, 500);
  const { data, info } = await pipeline.resize({ width: workW }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const n = w * h;

  const hist = new Uint32Array(256);
  for (let p = 0; p < n; p++) hist[data[p * ch]]++;
  const thr = otsu(hist, n);

  // Decide which class is the subject: background usually hugs the border.
  let darkBorder = 0;
  let lightBorder = 0;
  const onBorder = (x, y) => x === 0 || y === 0 || x === w - 1 || y === h - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!onBorder(x, y)) continue;
      if (data[(y * w + x) * ch] <= thr) darkBorder++; else lightBorder++;
    }
  }
  const fgIsDark = darkBorder <= lightBorder; // subject = the class less present on the border
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const dark = data[p * ch] <= thr;
    mask[p] = (dark === fgIsDark) ? 1 : 0;
  }

  // Largest connected blob of foreground (4-connectivity).
  const comp = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let best = null;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || comp[s] !== -1) continue;
    let sp = 0;
    stack[sp++] = s;
    comp[s] = 1;
    const cells = [];
    while (sp > 0) {
      const p = stack[--sp];
      cells.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && comp[p - 1] === -1) { comp[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && comp[p + 1] === -1) { comp[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && comp[p - w] === -1) { comp[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && comp[p + w] === -1) { comp[p + w] = 1; stack[sp++] = p + w; }
    }
    if (!best || cells.length > best.length) best = cells;
  }
  if (!best || best.length < 16) {
    const e = new Error('Could not find a clear subject. Try a photo with a bold shape on a plain background.');
    e.status = 422;
    throw e;
  }

  // A mask of just the largest blob, plus its centroid.
  const blob = new Uint8Array(n);
  let cx = 0;
  let cy = 0;
  for (const p of best) {
    blob[p] = 1;
    cx += p % w;
    cy += Math.floor(p / w);
  }
  cx /= best.length;
  cy /= best.length;

  // Sample the outer boundary at evenly spaced angles: cast a ray from the
  // centroid and keep the farthest foreground pixel in that direction.
  const maxR = Math.hypot(w, h);
  const raw = [];
  for (let i = 0; i < target; i++) {
    const a = (i / target) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let hitX = -1;
    let hitY = -1;
    for (let r = 1; r < maxR; r++) {
      const x = Math.round(cx + dx * r);
      const y = Math.round(cy + dy * r);
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      if (blob[y * w + x]) { hitX = x; hitY = y; }
    }
    if (hitX >= 0) raw.push([hitX, hitY]);
  }

  // Drop near-duplicate consecutive points, then number in order.
  const minGap = Math.max(2, Math.hypot(w, h) * 0.012);
  const pts = [];
  for (const p of raw) {
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < minGap) continue;
    pts.push(p);
  }
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < minGap) pts.pop();
  }
  if (pts.length < 3) {
    const e = new Error('Subject is too small or thin for dot-to-dot. Try a bolder, rounder shape.');
    e.status = 422;
    throw e;
  }
  const dots = pts.map((p, i) => ({ x: p[0] / w, y: p[1] / h, n: i + 1 }));

  // Faint silhouette reference (optional guide).
  const ref = Buffer.alloc(n);
  for (let p = 0; p < n; p++) ref[p] = blob[p] ? 210 : 255;
  const refBuf = await sharp(ref, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();

  return { width: w, height: h, dots, referenceDataUrl: `data:image/png;base64,${refBuf.toString('base64')}` };
}

/** Print-ready HTML for a dot-to-dot page. */
function dotToDotHtml(result, layout, title, opts = {}) {
  const showReference = Boolean(opts.showReference);
  const titleSize = Math.round(layout.fontSize * 1.6);
  const headerReserve = title ? Math.round(layout.fontSize * 3) : 0;
  const instr = 'Connect the dots from 1 to ' + result.dots.length + '!';
  const instrReserve = Math.round(layout.fontSize * 2.2);
  const artH = layout.usableHeight - headerReserve - instrReserve;

  const scale = Math.min(layout.usableWidth / result.width, artH / result.height);
  const boxW = Math.round(result.width * scale);
  const boxH = Math.round(result.height * scale);
  const numFont = Math.max(8, Math.round(boxW / 48));
  const dotSize = Math.max(3, Math.round(boxW / 180));

  const markers = result.dots
    .map(
      (d) =>
        `<span class="dot" style="left:${(d.x * 100).toFixed(2)}%;top:${(d.y * 100).toFixed(2)}%"></span>` +
        `<span class="dn" style="left:${(d.x * 100).toFixed(2)}%;top:${(d.y * 100).toFixed(2)}%">${d.n}</span>`
    )
    .join('');
  const safeTitle = title ? String(title).replace(/[<&>]/g, '') : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${layout.widthIn}in ${layout.heightIn}in; margin: ${layout.margins.top}in ${layout.margins.outside}in ${layout.margins.bottom}in ${layout.margins.gutter}in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${layout.fontFamily}; color: #000; width: ${layout.usableWidth}px; }
  h1 { font-size: ${titleSize}px; text-align: center; margin: 0 0 6px 0; }
  .instr { text-align: center; font-size: ${Math.round(layout.fontSize)}px; margin: 0 0 8px; }
  .art { width: 100%; height: ${artH}px; display: flex; align-items: center; justify-content: center; }
  .artwrap { position: relative; width: ${boxW}px; height: ${boxH}px; }
  .artwrap img { width: 100%; height: 100%; display: block; opacity: .5; }
  .dot { position: absolute; width: ${dotSize}px; height: ${dotSize}px; background: #000; border-radius: 50%; transform: translate(-50%, -50%); }
  .dn { position: absolute; font-size: ${numFont}px; color: #000; transform: translate(${Math.round(dotSize)}px, -120%); line-height: 1; }
</style></head>
<body>
  ${safeTitle ? `<h1>${safeTitle}</h1>` : ''}
  <div class="instr">${instr}</div>
  <div class="art"><div class="artwrap">${showReference ? `<img src="${result.referenceDataUrl}">` : ''}${markers}</div></div>
</body></html>`;
}

module.exports = {
  toColoringPage,
  coloringPageHtml,
  toColorByNumber,
  colorByNumberHtml,
  toDotToDot,
  dotToDotHtml,
};
