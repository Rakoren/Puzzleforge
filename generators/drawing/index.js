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
function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function generate(config = {}, rand = Math.random) {
  const words = (config.words || []).filter((w) => typeof w === 'string' && w.length);
  let prompt = config.prompt;
  if (!prompt) {
    if (words.length) {
      const subject = pick(words, rand);
      prompt = `Draw a ${subject.toLowerCase()}!`;
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
    data: { prompt, caption: 'My drawing of…' },
    solution: {},
  };
}

module.exports = { generate };
