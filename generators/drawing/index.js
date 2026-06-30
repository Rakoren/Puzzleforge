/**
 * Drawing page — generate().
 *
 * A non-puzzle activity page for kids' books: a large framed blank area with a
 * prompt and a caption line. It has no answer. If a theme (or word list) is
 * supplied, the prompt names something on-theme for variety.
 *
 * Config:
 *   prompt   string   optional — overrides the generated prompt
 *   words    string[] optional — pick a subject from these (book passes a few)
 *   theme    string   optional — used for labelling
 *   title    string   optional
 */
const { singularizeForPrompt, indefiniteArticle } = require('../shared/text');

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function generate(config = {}, rand = Math.random) {
  const words = (config.words || []).filter((w) => typeof w === 'string' && w.length);
  let prompt = config.prompt;
  let subject = null; // the raw word the prompt is built from (for re-rolling)
  if (!prompt) {
    if (words.length) {
      subject = pick(words, rand);
      const noun = singularizeForPrompt(subject).toLowerCase();
      prompt = `Draw ${indefiniteArticle(noun)} ${noun}!`;
    } else {
      prompt = pick(
        ['Draw your own picture!', 'What can you imagine?', 'Draw something you love!'],
        rand
      );
    }
  }

  return {
    type: 'drawing',
    difficulty: config.difficulty || 1,
    theme: config.theme || null,
    title: config.title || 'My Drawing',
    instructions: prompt,
    data: { prompt, caption: 'My drawing of…', subject },
    solution: {},
  };
}

module.exports = { generate };
