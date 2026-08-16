/**
 * Riddles — generate().
 *
 * Picks a set of "what am I?" riddles from the bank (or a teacher-supplied list)
 * filtered by difficulty. Same numbered-with-answer-key format as trivia, but a
 * distinct puzzle type so it reads and prints as riddles.
 *
 * Config:
 *   riddles     [{q,a}]  optional custom riddles (overrides the bank)
 *   count       number   optional number of riddles
 *   difficulty  1|2|3|4
 *   title       string
 */
const BANK = require('./bank');
const { presetFor } = require('../../config/defaults');

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('riddles', difficulty, config.audience) || { count: 8, maxDifficulty: difficulty };
  const count = config.count || preset.count;
  const maxDifficulty = config.maxDifficulty || preset.maxDifficulty;

  let pool;
  if (Array.isArray(config.riddles) && config.riddles.length) {
    pool = config.riddles
      .map((item) => ({ q: String(item.q || '').trim(), a: String(item.a || '').trim() }))
      .filter((item) => item.q && item.a);
  } else {
    pool = BANK.filter((item) => item.difficulty <= maxDifficulty);
  }

  if (pool.length < 5) {
    throw new Error('riddles.generate: not enough riddles for these settings');
  }

  const chosen = shuffle(pool.slice(), rand).slice(0, Math.min(count, pool.length));
  const riddles = chosen.map((item) => ({ q: item.q, a: item.a }));

  return {
    type: 'riddles',
    difficulty,
    theme: null,
    title: config.title || 'Riddles',
    instructions: config.instructions || 'Read each riddle and write your answer on the line. Check the answer key when you are done.',
    data: {
      questions: riddles.map((item) => ({ q: item.q })),
      count: riddles.length,
    },
    solution: {
      answers: riddles.map((item) => item.a),
      questions: riddles,
    },
  };
}

module.exports = { generate };
