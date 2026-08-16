/**
 * Brain Teasers — generate().
 *
 * Picks a set of logic / math / word / lateral teasers from the bank (or a
 * teacher-supplied list) filtered by difficulty. Numbered prompts with an
 * answer key, each tagged with the kind of teaser.
 *
 * Config:
 *   teasers     [{q,a,kind}]  optional custom teasers (overrides the bank)
 *   count       number        optional number of teasers
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
  const preset = presetFor('brainteasers', difficulty, config.audience) || { count: 8, maxDifficulty: difficulty };
  const count = config.count || preset.count;
  const maxDifficulty = config.maxDifficulty || preset.maxDifficulty;

  let pool;
  if (Array.isArray(config.teasers) && config.teasers.length) {
    pool = config.teasers
      .map((item) => ({ q: String(item.q || '').trim(), a: String(item.a || '').trim(), kind: item.kind ? String(item.kind) : '' }))
      .filter((item) => item.q && item.a);
  } else {
    pool = BANK.filter((item) => item.difficulty <= maxDifficulty);
  }

  if (pool.length < 5) {
    throw new Error('brainteasers.generate: not enough teasers for these settings');
  }

  const chosen = shuffle(pool.slice(), rand).slice(0, Math.min(count, pool.length));
  const teasers = chosen.map((item) => ({ q: item.q, a: item.a, kind: item.kind || '' }));

  return {
    type: 'brainteasers',
    difficulty,
    theme: null,
    title: config.title || 'Brain Teasers',
    instructions: config.instructions || 'Think carefully and write your answer on the line. The answer key explains each one.',
    data: {
      questions: teasers.map((item) => ({ q: item.q, kind: item.kind })),
      count: teasers.length,
    },
    solution: {
      answers: teasers.map((item) => item.a),
      questions: teasers,
    },
  };
}

module.exports = { generate };
