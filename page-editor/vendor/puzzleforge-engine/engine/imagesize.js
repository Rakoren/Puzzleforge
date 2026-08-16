/**
 * Read an image's pixel dimensions from a data: URI, with no dependencies.
 *
 * Used by the pre-flight check to compute an image's effective print DPI. Parses
 * just the header of PNG / JPEG / GIF (the formats the editor produces or
 * accepts); returns null for anything it can't read, so callers skip it rather
 * than fail.
 */
function fromDataUri(src) {
  if (typeof src !== 'string') return null;
  const m = /^data:image\/[a-z.+-]+;base64,([A-Za-z0-9+/=]+)$/i.exec(src.trim());
  if (!m) return null;
  let buf;
  try { buf = Buffer.from(m[1], 'base64'); } catch (_) { return null; }
  return fromBuffer(buf);
}

function fromBuffer(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG: 8-byte signature, then IHDR (width/height big-endian at 16/20).
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF: dimensions little-endian at offset 6/8.
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // JPEG: walk the markers to the Start-Of-Frame segment.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      // SOF0–SOF15 hold the frame size (skip DHT/DAC/RST markers c4/c8/cc).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      const len = buf.readUInt16BE(off + 2);
      if (len < 2) return null;
      off += 2 + len;
    }
  }
  return null;
}

module.exports = { fromDataUri, fromBuffer };
