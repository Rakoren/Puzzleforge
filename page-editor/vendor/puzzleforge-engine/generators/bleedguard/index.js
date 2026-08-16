/**
 * Bleed-through guard page — generate().
 *
 * A (near-)blank page meant to sit after a coloring page so marker or paint
 * doesn't bleed onto the next printed page. By default it carries a faint note
 * explaining why it's blank; pass an empty `label` for a completely blank page.
 *
 * Config:
 *   label  string  optional — faint footer note ('' = fully blank)
 *   title  string  optional
 */
function generate(config = {}) {
  const label =
    config.label != null ? config.label : 'This page is intentionally left blank to prevent bleed-through.';
  return {
    type: 'bleedguard',
    difficulty: config.difficulty || 1,
    theme: config.theme || null,
    title: config.title || 'Blank Page',
    instructions: '',
    data: { label },
    solution: {},
  };
}

module.exports = { generate };
