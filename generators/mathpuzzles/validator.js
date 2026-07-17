/**
 * Math Puzzles — validate().
 *
 * Golden Standard: every puzzle must be arithmetically correct. For an
 * equation, substituting the answer into the blank makes both sides equal; for
 * a sequence, the terms form a constant arithmetic step and the answer is the
 * hidden tail. A minimum count and no duplicate prompts round it out.
 */
const MIN_PROBLEMS = 5;

function applyOp(a, op, b) {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return a / b;
  return NaN;
}

function equationOk(p) {
  const val = { a: p.a, b: p.b, result: p.result };
  val[p.blank] = Number(p.answer); // trust the answer, then check the identity
  return applyOp(val.a, p.op, val.b) === val.result;
}

function sequenceOk(p) {
  const t = p.terms;
  if (!Array.isArray(t) || t.length < 3) return false;
  const step = t[1] - t[0];
  for (let i = 2; i < t.length; i++) if (t[i] - t[i - 1] !== step) return false;
  const tail = t.slice(t.length - p.blanks).join(', ');
  return tail === String(p.answer);
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  const problems = puzzle.solution.problems || [];

  if (problems.length < MIN_PROBLEMS) {
    errors.push(`Only ${problems.length} problems; need at least ${MIN_PROBLEMS}.`);
  }
  if (problems.length !== puzzle.data.problems.length) {
    errors.push('Problem and answer counts do not match.');
  }

  const seen = new Set();
  problems.forEach((p, i) => {
    const ok = p.kind === 'sequence' ? sequenceOk(p) : equationOk(p);
    if (!ok) errors.push(`Problem ${i + 1} ("${p.prompt}") is not arithmetically correct.`);
    if (seen.has(p.prompt)) errors.push(`Duplicate problem: "${p.prompt}".`);
    seen.add(p.prompt);
  });

  return { valid: errors.length === 0, errors, warnings, score: errors.length === 0 ? 1 : 0 };
}

module.exports = { validate };
