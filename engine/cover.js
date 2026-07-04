/**
 * Engine — KDP full-wrap cover.
 *
 * Produces a single print-ready cover spanning back + spine + front as one
 * sheet, which is what KDP paperback uploads require. Dimensions are computed
 * from the trim size, page count, and paper type:
 *
 *   full width  = 2 × trim width + spine + 2 × bleed
 *   full height = trim height + 2 × bleed
 *   spine       = page count × per-page thickness
 *
 * The renderer lays out three panels at exact inch widths; backgrounds and the
 * optional front image bleed to the physical edge, while text stays inside a
 * safe margin so trimming never clips it.
 */

// Per-page thickness (inches) by paper. KDP black-and-white:
//   white = 0.002252", cream = 0.0025".
const PAGE_THICKNESS = { white: 0.002252, cream: 0.0025 };
const BLEED_IN = 0.125;
const SAFE_IN = 0.25; // keep text this far inside the trim edge
const MIN_SPINE_TEXT_PAGES = 79; // KDP minimum page count for spine text

function parseTrim(trimSize) {
  const [w, h] = String(trimSize || '8.5x11').split('x').map(Number);
  return { w: w || 8.5, h: h || 11 };
}

/**
 * Compute full-wrap cover dimensions.
 * @returns {{trimWidthIn,trimHeightIn,bleedIn,spineIn,fullWidthIn,fullHeightIn,paper,pageCount,spineTextAllowed}}
 */
function coverDimensions(trimSize, pageCount, paper = 'white') {
  const { w, h } = parseTrim(trimSize);
  const per = PAGE_THICKNESS[paper] || PAGE_THICKNESS.white;
  const pages = Math.max(0, Math.floor(Number(pageCount) || 0));
  const spine = +(pages * per).toFixed(4);
  return {
    trimWidthIn: w,
    trimHeightIn: h,
    bleedIn: BLEED_IN,
    spineIn: spine,
    fullWidthIn: +(w * 2 + spine + BLEED_IN * 2).toFixed(4),
    fullHeightIn: +(h + BLEED_IN * 2).toFixed(4),
    paper: PAGE_THICKNESS[paper] ? paper : 'white',
    pageCount: pages,
    spineTextAllowed: pages >= MIN_SPINE_TEXT_PAGES && spine >= 0.18,
  };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Sanitize a CSS color so a config value can't break out of the style attr.
function color(c, fallback) {
  const v = String(c == null ? '' : c).trim();
  return /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgb\([\d ,.%]+\)$/.test(v) ? v : fallback;
}

/**
 * Render the full-wrap cover as a standalone HTML document sized in inches.
 * @param {object} config
 * @param {string} config.trimSize
 * @param {number} config.pageCount
 * @param {'white'|'cream'} [config.paper]
 * @param {string} [config.title] [config.subtitle] [config.author]
 * @param {object} [config.front] { bgColor, image (data URL), textColor, titlePosition }
 * @param {object} [config.back]  { bgColor, textColor, blurb }
 * @param {object} [config.spine] { bgColor, textColor, text }
 * @returns {{ html: string, dims: object }}
 */
function renderCoverHtml(config = {}) {
  const dims = coverDimensions(config.trimSize, config.pageCount, config.paper);
  const front = config.front || {};
  const back = config.back || {};
  const spine = config.spine || {};

  const backW = dims.bleedIn + dims.trimWidthIn; // left bleed lives on the back
  const frontW = dims.trimWidthIn + dims.bleedIn; // right bleed lives on the front
  const fullH = dims.fullHeightIn;
  const pad = BLEED_IN + SAFE_IN; // safe inset from the physical edge

  const frontBg = color(front.bgColor, '#1f3a93');
  const frontText = color(front.textColor, '#ffffff');
  const backBg = color(back.bgColor, frontBg);
  const backText = color(back.textColor, frontText);
  const spineBg = color(spine.bgColor, frontBg);
  const spineText = color(spine.textColor, frontText);

  const justify =
    front.titlePosition === 'top' ? 'flex-start' : front.titlePosition === 'bottom' ? 'flex-end' : 'center';
  const frontImage = front.image
    ? `background-image:url('${String(front.image).replace(/'/g, '')}');background-size:cover;background-position:center;`
    : '';
  const textShadow = front.image ? 'text-shadow:0 2px 6px rgba(0,0,0,.55);' : '';

  const spineLine = [config.title, config.author].filter(Boolean).map(esc).join('  ·  ');
  const spineHtml =
    dims.spineTextAllowed && spineLine
      ? `<div class="spine-text">${spineLine}</div>`
      : '';

  // KDP barcode keep-out: ~2" × 1.2" at the back bottom-right.
  const barcode = `<div class="barcode"></div>`;

  return {
    dims,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${dims.fullWidthIn}in ${fullH}in; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .wrap { display: flex; width: ${dims.fullWidthIn}in; height: ${fullH}in;
    font-family: Georgia, 'Times New Roman', serif; }
  .panel { height: ${fullH}in; overflow: hidden; position: relative; }
  .back { width: ${backW}in; background: ${backBg}; color: ${backText};
    padding: ${pad}in ${pad}in ${pad}in ${BLEED_IN + 0.2}in; }
  .spine { width: ${dims.spineIn}in; background: ${spineBg}; color: ${spineText};
    display: flex; align-items: center; justify-content: center; }
  .front { width: ${frontW}in; background: ${frontBg}; ${frontImage} color: ${frontText};
    padding: ${pad}in ${pad}in ${pad}in ${SAFE_IN}in;
    display: flex; flex-direction: column; align-items: center; justify-content: ${justify};
    text-align: center; ${textShadow} }
  .front h1 { font-size: 46pt; line-height: 1.1; margin: 0; }
  .front .sub { font-size: 20pt; margin: 14pt 0 0; opacity: .95; }
  .front .cover-diff { font-size: 15pt; font-weight: 600; margin: 12pt 0 0; letter-spacing: .3px; opacity: .95; }
  .front .author { font-size: 18pt; margin: 28pt 0 0; }
  .back .blurb { font-size: 12.5pt; line-height: 1.5; white-space: pre-wrap; max-width: 100%; }
  .back .back-author { position: absolute; bottom: ${pad}in; left: ${BLEED_IN + 0.2}in; font-size: 12pt; }
  .barcode { position: absolute; right: ${pad}in; bottom: ${pad}in; width: 2in; height: 1.2in;
    background: #fff; border: 1px dashed #bbb; }
  .spine-text { transform: rotate(90deg); white-space: nowrap; font-size: ${Math.min(0.8 * dims.spineIn * 72, 16)}pt; }
</style></head>
<body>
  <div class="wrap">
    <div class="panel back">
      ${back.blurb ? `<div class="blurb">${esc(back.blurb)}</div>` : ''}
      ${config.author ? `<div class="back-author">${esc(config.author)}</div>` : ''}
      ${barcode}
    </div>
    <div class="panel spine">${spineHtml}</div>
    <div class="panel front">
      ${config.title ? `<h1>${esc(config.title)}</h1>` : ''}
      ${config.subtitle ? `<div class="sub">${esc(config.subtitle)}</div>` : ''}
      ${config.difficulty ? `<div class="cover-diff">${esc(config.difficulty)}</div>` : ''}
      ${config.author ? `<div class="author">${esc(config.author)}</div>` : ''}
    </div>
  </div>
</body></html>`,
  };
}

module.exports = { coverDimensions, renderCoverHtml };
