/**
 * Classroom worksheets + lesson packets.
 *
 * A *worksheet* is a single puzzle printed on a page with a student Name / Date
 * header (and an optional Class / Period line + footer). It reuses the ordinary
 * puzzle renderer via `renderPuzzleHtml(puzzle, { worksheet })`, which reserves a
 * top band for the header — so a worksheet prints exactly like a puzzle page,
 * just with the teacher chrome on top.
 *
 * A *lesson packet* is a title/cover page + several worksheets + an optional
 * answer-key section, combined into one PDF. Everything is assembled from the
 * same primitives the book pipeline uses (`combinePages`), so the output is
 * print-consistent with the rest of PuzzleForge.
 */
const { getLayout } = require('../layouts');
const { renderPuzzleHtml, combinePages } = require('./export');

const esc = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A packet cover / title page at the packet's trim. Carries the packet title,
 * a Name/Date block, optional teacher / class / date meta, a learning objective,
 * standards, and a "what's inside" contents list.
 * @returns {string} a full HTML document
 */
function renderPacketCoverHtml(opts = {}, layout) {
  const L = layout || getLayout(opts.trimSize || '8.5x11', { audience: opts.audience || 'adult' });
  const fs = L.fontSize;
  const meta = [];
  if (opts.teacher) meta.push(`Teacher: ${esc(opts.teacher)}`);
  if (opts.className) meta.push(esc(opts.className));
  if (opts.dateline) meta.push(esc(opts.dateline));
  const contents = (opts.contents || [])
    .map((c, i) => `<li><span class="n">${i + 1}</span>${esc(c)}</li>`)
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  @page { size: ${L.widthIn}in ${L.heightIn}in; margin: ${L.margins.top}in ${L.margins.outside}in ${L.margins.bottom}in ${L.margins.gutter}in; }
  * { box-sizing: border-box; } html, body { margin: 0; padding: 0; }
  body { font-family: ${L.fontFamily}; color: #111; width: ${L.usableWidth}px; min-height: ${L.usableHeight}px; display: flex; flex-direction: column; }
  .top { border-bottom: 3px solid #111; padding-bottom: 14px; }
  .kicker { font-size: ${Math.round(fs * 0.78)}px; letter-spacing: .18em; text-transform: uppercase; color: #555; }
  h1 { font-size: ${Math.round(fs * 2.4)}px; margin: 6px 0 4px; line-height: 1.05; }
  .sub { font-size: ${Math.round(fs * 1.1)}px; color: #333; }
  .meta { margin-top: 14px; font-size: ${Math.round(fs * 0.92)}px; color: #333; display: flex; flex-wrap: wrap; gap: 6px 22px; }
  .fields { margin-top: 22px; display: flex; gap: 26px; }
  .fld { flex: 1; font-size: ${Math.round(fs * 0.95)}px; } .fld .l { font-weight: 600; margin-bottom: 2px; } .fld .r { border-bottom: 1px solid #111; height: ${Math.round(fs * 1.1)}px; }
  .block { margin-top: 22px; } .block h2 { font-size: ${Math.round(fs)}px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: .05em; color: #333; }
  .block p { margin: 0; font-size: ${Math.round(fs * 0.98)}px; color: #222; line-height: 1.45; }
  ol.contents { margin: 0; padding: 0; list-style: none; font-size: ${Math.round(fs * 0.98)}px; }
  ol.contents li { padding: 6px 0; border-bottom: 1px dashed #cfcfcf; display: flex; align-items: baseline; gap: 10px; }
  ol.contents .n { display: inline-grid; place-items: center; width: ${Math.round(fs * 1.4)}px; height: ${Math.round(fs * 1.4)}px; border-radius: 50%; background: #111; color: #fff; font-size: ${Math.round(fs * 0.7)}px; font-weight: 700; flex: none; }
  .spacer { flex: 1; min-height: 18px; }
  .foot { border-top: 1px solid #ccc; padding-top: 8px; font-size: ${Math.round(fs * 0.78)}px; color: #666; text-align: center; }
  </style></head><body>
    <div class="top">
      <div class="kicker">${esc(opts.kicker || 'Lesson Packet')}</div>
      <h1>${esc(opts.title || 'Lesson Packet')}</h1>
      ${opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ''}
    </div>
    ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}
    <div class="fields"><div class="fld"><div class="l">Name</div><div class="r"></div></div><div class="fld"><div class="l">Date</div><div class="r"></div></div></div>
    ${opts.objective ? `<div class="block"><h2>Learning objective</h2><p>${esc(opts.objective)}</p></div>` : ''}
    ${opts.standards ? `<div class="block"><h2>Standards</h2><p>${esc(opts.standards)}</p></div>` : ''}
    ${contents ? `<div class="block"><h2>What&rsquo;s inside</h2><ol class="contents">${contents}</ol></div>` : ''}
    <div class="spacer"></div>
    <div class="foot">${esc(opts.footer || 'Made with PuzzleForge')}</div>
  </body></html>`;
}

/**
 * Assemble a lesson packet into one combined HTML document:
 *   [cover] → worksheet 1 → worksheet 2 → … → [answer-key section].
 * @param {object} cfg
 * @param {string}  [cfg.trimSize='8.5x11']
 * @param {'kids'|'adult'} [cfg.audience]
 * @param {object|null} [cfg.cover] cover options (see renderPacketCoverHtml); null to skip
 * @param {Array} cfg.pages         [{ puzzle, worksheet, border, borderColor }]
 * @param {'none'|'end'} [cfg.answers='end']  where the answer key goes
 * @returns {string} combined HTML document
 */
function assemblePacketHtml(cfg = {}) {
  const trimSize = cfg.trimSize || '8.5x11';
  const audience = cfg.audience || 'adult';
  const pages = Array.isArray(cfg.pages) ? cfg.pages : [];
  const docs = [];

  if (cfg.cover) {
    const layout = getLayout(trimSize, { audience });
    docs.push(renderPacketCoverHtml({ ...cfg.cover, trimSize, audience }, layout));
  }

  const common = (p) => ({
    trimSize, audience,
    worksheet: p.worksheet || cfg.worksheet || undefined,
    border: p.border, borderColor: p.borderColor,
  });

  for (const p of pages) {
    docs.push(renderPuzzleHtml(p.puzzle, { ...common(p), answerKey: false }));
  }
  if ((cfg.answers || 'end') === 'end') {
    for (const p of pages) {
      docs.push(renderPuzzleHtml(p.puzzle, { ...common(p), answerKey: true }));
    }
  }
  return combinePages(docs);
}

module.exports = { renderPacketCoverHtml, assemblePacketHtml };
