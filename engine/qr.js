/**
 * QR code encoding for PuzzleForge.
 *
 * Turns a URL/text into a module matrix (the black/white grid) that the shared
 * element renderer draws as a crisp SVG — so a placed QR is vector-sharp on
 * screen and in the exported PDF. Encoding is deterministic (same text + error
 * level → same matrix), which keeps the editor and the PDF composer in sync.
 *
 * The browser editor uses the same `qrcode-generator` library (served as a
 * static script) so a QR created in the editor matches one made server-side.
 */
const qrcode = require('qrcode-generator');

const LEVELS = ['L', 'M', 'Q', 'H'];

/**
 * Encode text into a QR module matrix.
 * @param {string} text
 * @param {object} [opts]
 * @param {'L'|'M'|'Q'|'H'} [opts.ecl='M']  error-correction level
 * @param {number} [opts.typeNumber=0]      QR version (0 = auto-fit)
 * @returns {{ count:number, modules:number[][], ecl:string }}
 */
function encode(text, opts = {}) {
  const ecl = LEVELS.includes(opts.ecl) ? opts.ecl : 'M';
  const qr = qrcode(opts.typeNumber || 0, ecl);
  qr.addData(String(text == null ? '' : text));
  qr.make();
  const count = qr.getModuleCount();
  const modules = [];
  for (let r = 0; r < count; r++) {
    const row = [];
    for (let c = 0; c < count; c++) row.push(qr.isDark(r, c) ? 1 : 0);
    modules.push(row);
  }
  return { count, modules, ecl };
}

module.exports = { encode, LEVELS };
