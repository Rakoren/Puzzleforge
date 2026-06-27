/**
 * Layout system.
 *
 * A layout is a computed set of rendering constraints passed to every
 * generator's render() call. Renderers MUST use these values and must not
 * hardcode dimensions.
 *
 * Raw trim specs live in the per-size files (8x10.js, etc.); this module
 * resolves a raw spec + audience into the concrete layout object that
 * renderers consume, including usable pixel dimensions and helpers for
 * computing grid cell size.
 */
const { AUDIENCE } = require('../config/defaults');

// CSS pixels per inch used for on-screen layout math. The PDF itself is
// emitted at the physical trim size (in inches) and rendered as vectors, so
// text and grid lines stay sharp regardless of this constant — it only sets
// the coordinate space the renderers lay out in.
const PX_PER_IN = 96;

const SPECS = {
  '8x10': require('./8x10'),
  '8.5x11': require('./8.5x11'),
  '8.5x8.5': require('./8.5x8.5'),
  '6x9': require('./6x9'),
};

function listTrimSizes() {
  return Object.keys(SPECS);
}

/**
 * Resolve a layout for a given trim size + audience.
 * @param {string} trimSize  one of listTrimSizes()
 * @param {object} [opts]
 * @param {'kids'|'adult'} [opts.audience='adult']
 * @returns {object} resolved layout
 */
function getLayout(trimSize, opts = {}) {
  const spec = SPECS[trimSize];
  if (!spec) {
    throw new Error(
      `Unknown trim size "${trimSize}". Known sizes: ${listTrimSizes().join(', ')}`
    );
  }
  const audienceKey = opts.audience || 'adult';
  const audience = AUDIENCE[audienceKey];
  if (!audience) {
    throw new Error(
      `Unknown audience "${audienceKey}". Known: ${Object.keys(AUDIENCE).join(', ')}`
    );
  }

  const { margins } = spec;
  const usableWidthIn = spec.widthIn - margins.gutter - margins.outside;
  const usableHeightIn = spec.heightIn - margins.top - margins.bottom;

  const usableWidth = Math.round(usableWidthIn * PX_PER_IN);
  const usableHeight = Math.round(usableHeightIn * PX_PER_IN);

  const fontSize = Math.round(spec.baseFontPt * audience.fontScale);

  const layout = {
    trimSize: spec.trimSize,
    audience: audience.label,

    // physical dimensions (inches) — consumed by the PDF exporter
    widthIn: spec.widthIn,
    heightIn: spec.heightIn,
    margins: { ...margins },

    // on-screen layout space (px) — consumed by renderers
    pxPerIn: PX_PER_IN,
    usableWidth,
    usableHeight,
    fontSize,
    fontFamily: 'Arial, Helvetica, "Open Sans", Roboto, sans-serif',

    /**
     * Largest square grid cell size (px) that fits `gridSize` cells across
     * the usable width while leaving room for a labels/instructions band.
     * @param {number} gridSize number of cells per side
     * @param {number} [reserveVertical=0] px to reserve below the grid
     */
    cellSizeFor(gridSize, reserveVertical = 0) {
      const maxByWidth = Math.floor(usableWidth / gridSize);
      const maxByHeight = Math.floor((usableHeight - reserveVertical) / gridSize);
      return Math.max(12, Math.min(maxByWidth, maxByHeight));
    },
  };

  return layout;
}

module.exports = { getLayout, listTrimSizes, PX_PER_IN };
