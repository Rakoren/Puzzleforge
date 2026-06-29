/**
 * KDP printing-cost + royalty model and metadata helpers.
 *
 * Printing costs are based on Amazon KDP's published US paperback rates. They
 * change over time — treat the output as an estimate and confirm current rates
 * on KDP before pricing. Puzzle-book interiors are almost always black & white,
 * which is modeled precisely; color rates are rougher and flagged as such.
 *
 * Royalty (paperback) is a flat 60% of list price minus printing cost.
 */

// Last reviewed against KDP US rates: June 2025. Update here when KDP changes.
const RATES_UPDATED = '2025-06';
const ROYALTY_RATE = 0.6;

// US paperback printing cost. Black & white: a flat fee under 108 pages, then a
// per-page rate. Color rates are approximate.
function printingCostUSD(pageCount, paper) {
  const pages = Math.max(1, Math.round(pageCount));
  if (paper === 'premium-color') {
    // ~ fixed + per-page; approximate.
    return round2(0.37 + pages * 0.07);
  }
  if (paper === 'standard-color') {
    return pages <= 40 ? 3.6 : round2(pages * 0.0585);
  }
  // black & white (white or cream)
  return pages <= 108 ? 2.3 : round2(pages * 0.012);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function ceil2(n) {
  return Math.ceil(n * 100) / 100;
}
function priceTo99(n) {
  // Smallest X.99 price point at or above n (common puzzle-book pricing).
  const base = Math.floor(n) + 0.99;
  return base >= n - 1e-9 ? base : Math.floor(n) + 1.99;
}

/**
 * Estimate paperback economics for a book.
 * @param {object} args
 * @param {number} args.pageCount
 * @param {'bw'|'standard-color'|'premium-color'} [args.paper='bw']
 * @param {number} [args.listPrice]  USD; royalty computed when given
 * @returns {object} estimate (all USD)
 */
function royaltyEstimate(args = {}) {
  const paper = args.paper || 'bw';
  const pageCount = Math.max(1, Math.round(Number(args.pageCount) || 1));
  const printCost = printingCostUSD(pageCount, paper);
  const breakeven = ceil2(printCost / ROYALTY_RATE); // min list price for any royalty
  const listPrice = args.listPrice != null && args.listPrice !== '' ? Number(args.listPrice) : null;

  const out = {
    marketplace: 'US',
    currency: 'USD',
    paper,
    pageCount,
    printCost,
    royaltyRate: ROYALTY_RATE,
    breakeven,
    suggestedLow: priceTo99(Math.max(breakeven * 1.8, 5.99)),
    suggestedHigh: priceTo99(Math.max(breakeven * 2.6, 8.99)),
    ratesUpdated: RATES_UPDATED,
  };
  if (listPrice != null && Number.isFinite(listPrice)) {
    out.listPrice = round2(listPrice);
    out.royalty = round2(listPrice * ROYALTY_RATE - printCost);
    out.belowMinimum = listPrice < breakeven;
  }
  return out;
}

// Normalize the publish metadata a user enters in the Book Builder, splitting
// the keyword / category text areas into capped slot lists.
function normalizeMetadata(meta = {}) {
  const lines = (s, cap) =>
    String(s || '')
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, cap);
  return {
    seriesName: (meta.seriesName || '').trim(),
    seriesNumber: (meta.seriesNumber || '').toString().replace(/[^0-9]/g, ''),
    description: (meta.description || '').trim(),
    keywords: lines(meta.keywords, 7),
    categories: lines(meta.categories, 3),
    readingAge: (meta.readingAge || '').trim(),
    paper: meta.paper === 'cream' ? 'cream' : meta.paper || 'white',
    listPrice: meta.listPrice != null && meta.listPrice !== '' ? Number(meta.listPrice) : null,
    aiText: Boolean(meta.aiText),
    aiImages: Boolean(meta.aiImages),
  };
}

// KDP AI-disclosure answers, pre-filled from which AI tools the book used.
// Puzzle grids/keys are algorithmic and never disclosed.
function aiDisclosure(meta = {}) {
  const types = [];
  if (meta.aiText) types.push('Text (AI-generated theme words / clues)');
  if (meta.aiImages) types.push('Images (AI-generated art via ComfyUI / Stable Diffusion)');
  const tools = [];
  if (meta.aiText) tools.push('Claude (Anthropic)');
  if (meta.aiImages) tools.push('Stable Diffusion (ComfyUI)');
  return {
    usedAI: types.length > 0,
    contentTypes: types,
    tools,
  };
}

module.exports = { royaltyEstimate, printingCostUSD, normalizeMetadata, aiDisclosure, ROYALTY_RATE, RATES_UPDATED };
