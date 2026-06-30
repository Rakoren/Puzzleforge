/**
 * Coloring page — generate().
 *
 * A non-puzzle activity page: procedurally generated black-outline line art for
 * kids to color. Three styles:
 *   mandala — concentric rings of petals/scallops (default; always available)
 *   bubble  — a big outlined theme word to color in
 *   pattern — a grid of simple repeated motifs (hearts, stars, flowers, fish)
 *
 * Art is drawn at render time from { style, word, seed } so the data stays
 * tiny and the same page always reproduces.
 *
 * Config:
 *   style  'mandala'|'bubble'|'pattern'  optional
 *   words  string[]  optional — source for the bubble word (book passes a few)
 *   word   string    optional — explicit bubble word
 *   seed   number    optional
 *   theme  string    optional
 *   title  string    optional
 */
const { singularizeForPrompt } = require('../shared/text');

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function generate(config = {}, rand = Math.random) {
  const words = (config.words || [])
    .map((w) => String(w).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length >= 3 && w.length <= 9);

  let style = config.style;
  if (!style) {
    const choices = ['mandala', 'pattern'];
    if (words.length || config.word) choices.push('bubble');
    style = pick(choices, rand);
  }

  let word = null;
  let subject = null; // raw word behind the bubble (for re-rolling)
  if (style === 'bubble') {
    subject = config.word || (words.length ? pick(words, rand) : 'COLOR');
    word = singularizeForPrompt(subject).toUpperCase();
  }

  const seed = config.seed != null ? config.seed : Math.floor(rand() * 1e9);

  return {
    type: 'coloring',
    difficulty: config.difficulty || 1,
    theme: config.theme || null,
    title: config.title || 'Color the Picture',
    instructions: 'Color the picture however you like!',
    data: { style, word, seed, subject },
    solution: {},
  };
}

module.exports = { generate };
