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

module.exports = { toColoringPage, coloringPageHtml };
