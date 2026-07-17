/**
 * Math Puzzles — generate().
 *
 * A worksheet of self-checking arithmetic puzzles: "missing number" equations
 * (fill the blank so the equation is true) and number sequences (find the next
 * terms). Difficulty controls the operations, the number range, and how many
 * sequence puzzles appear. Everything is generated and verified in-engine, so
 * the answer key is always correct.
 *
 * Config:
 *   count       number   optional number of problems
 *   difficulty  1|2|3|4
 *   title       string
 */
const { presetFor } = require('../../config/defaults');

const rint = (lo, hi, rand) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

// A "missing number" equation: one of a, b, or the result is blanked out.
function equationProblem(rand, opts) {
  const op = pick(opts.ops, rand);
  const m = opts.maxA;
  let a, b, result;
  if (op === '+') { a = rint(1, m, rand); b = rint(1, m, rand); result = a + b; }
  else if (op === '−') { a = rint(2, m, rand); b = rint(1, a, rand); result = a - b; } // minus, non-negative
  else if (op === '×') { a = rint(2, opts.maxFactor, rand); b = rint(2, opts.maxFactor, rand); result = a * b; } // times
  else { b = rint(2, opts.maxFactor, rand); result = rint(2, opts.maxFactor, rand); a = b * result; } // divide, exact
  const spots = opts.blankFirst ? ['a', 'b', 'result'] : ['b', 'result'];
  const blank = pick(spots, rand);
  const val = { a, b, result };
  const shown = {
    a: blank === 'a' ? '__' : a,
    b: blank === 'b' ? '__' : b,
    result: blank === 'result' ? '__' : result,
  };
  const opChar = op === '−' ? '−' : op === '×' ? '×' : op === '÷' ? '÷' : op;
  return {
    kind: 'equation',
    prompt: `${shown.a} ${opChar} ${shown.b} = ${shown.result}`,
    answer: String(val[blank]),
    a, op, b, result, blank,
  };
}

// A number sequence with the last `blanks` terms hidden.
function sequenceProblem(rand, opts) {
  const start = rint(1, 12, rand);
  const step = rint(2, opts.maxStep, rand);
  const len = 5;
  const blanks = opts.blanks || 1;
  const terms = Array.from({ length: len }, (_, i) => start + i * step);
  const shown = terms.map((t, i) => (i >= len - blanks ? '__' : t));
  const answers = terms.slice(len - blanks);
  return {
    kind: 'sequence',
    prompt: `${shown.join(', ')}, …`,
    answer: answers.join(', '),
    terms, blanks, step,
  };
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('mathpuzzles', difficulty, config.audience) || {
    count: 12, maxA: 10, maxFactor: 6, ops: ['+', '−'], blankFirst: false, seq: 0, maxStep: 5, seqBlanks: 1,
  };
  const count = config.count || preset.count;

  const problems = [];
  const seen = new Set();
  let guard = 0;
  const nSeq = Math.min(preset.seq || 0, Math.floor(count / 3));
  while (problems.length < count && guard++ < count * 40) {
    const useSeq = problems.length >= count - nSeq;
    const p = useSeq
      ? sequenceProblem(rand, { maxStep: preset.maxStep, blanks: preset.seqBlanks })
      : equationProblem(rand, preset);
    if (seen.has(p.prompt)) continue; // avoid duplicate prompts on a page
    seen.add(p.prompt);
    problems.push(p);
  }

  return {
    type: 'mathpuzzles',
    difficulty,
    theme: null,
    title: config.title || 'Math Puzzles',
    instructions: config.instructions || 'Fill in the missing number in each puzzle. Check your work with the answer key.',
    data: {
      problems: problems.map((p) => ({ prompt: p.prompt, kind: p.kind })),
      count: problems.length,
    },
    solution: {
      answers: problems.map((p) => p.answer),
      problems,
    },
  };
}

module.exports = { generate };
