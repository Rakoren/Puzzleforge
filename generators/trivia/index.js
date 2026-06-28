/**
 * Trivia / Quiz — generate().
 *
 * Selects a set of questions from the bank (or a teacher-supplied list) filtered
 * by category and difficulty. A different format from the grid puzzles: numbered
 * questions with an answer key.
 *
 * Config:
 *   questions   [{q,a}]   optional custom questions (overrides the bank)
 *   category    string    optional filter (e.g. "science")
 *   count       number    optional number of questions
 *   difficulty  1|2|3
 *   title       string
 */
const BANK = require('./bank');
const { DIFFICULTY } = require('../../config/defaults');

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = DIFFICULTY.trivia[difficulty] || DIFFICULTY.trivia[1];
  const count = config.count || preset.count;
  const maxDifficulty = config.maxDifficulty || preset.maxDifficulty;

  let pool;
  if (Array.isArray(config.questions) && config.questions.length) {
    pool = config.questions
      .map((item) => ({ q: String(item.q || '').trim(), a: String(item.a || '').trim() }))
      .filter((item) => item.q && item.a);
  } else {
    pool = BANK.filter((item) => item.difficulty <= maxDifficulty).filter(
      (item) => !config.category || item.category === config.category
    );
  }

  if (pool.length < 5) {
    throw new Error('trivia.generate: not enough questions for these settings');
  }

  const chosen = shuffle(pool.slice(), rand).slice(0, Math.min(count, pool.length));
  const questions = chosen.map((item) => ({ q: item.q, a: item.a }));

  const titleCat = config.category
    ? config.category.charAt(0).toUpperCase() + config.category.slice(1)
    : null;

  return {
    type: 'trivia',
    difficulty,
    theme: config.category || null,
    title: config.title || (titleCat ? `${titleCat} Quiz` : 'Trivia Quiz'),
    instructions: config.instructions || 'Answer each question. Check your answers with the key.',
    data: {
      questions: questions.map((item) => ({ q: item.q })),
      count: questions.length,
    },
    solution: {
      answers: questions.map((item) => item.a),
      questions,
    },
  };
}

module.exports = { generate };
