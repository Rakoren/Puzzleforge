/**
 * Breather page — generate().
 *
 * A non-puzzle page placed between puzzle sets in adult books. Four kinds:
 *   quote   — a short quotation with an attribution
 *   fact    — a "Did you know?" fun fact
 *   divider — a decorative section break
 *   blank   — an empty page
 *
 * Content is chosen by the book pipeline and passed in; this module only shapes
 * and renders it. There is no answer.
 *
 * Config: { kind, text, source }
 */
const KINDS = new Set(['quote', 'fact', 'divider', 'blank']);

function generate(config = {}) {
  const kind = KINDS.has(config.kind) ? config.kind : 'divider';
  return {
    type: 'breather',
    difficulty: config.difficulty || 1,
    theme: config.theme || null,
    title: '',
    instructions: '',
    data: {
      kind,
      text: config.text != null ? String(config.text) : '',
      source: config.source ? String(config.source) : null,
    },
    solution: {},
  };
}

module.exports = { generate };
