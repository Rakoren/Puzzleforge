/**
 * Logic Grid — generate().
 *
 * Builds a random 1-to-1 matching between a set of people and several attribute
 * categories, then derives a set of natural-language clues that pin down exactly
 * one solution. Correctness is structural: every clue is read straight off the
 * true solution (so it is always true), and the constraint solver proves the
 * clue set has a unique answer before the puzzle is returned.
 *
 * Config:
 *   difficulty  1|2|3  grid size and clue style (see config/defaults)
 *   people      [str]  optional custom names for the primary category
 *   title       str
 */
const { PEOPLE, ATTRIBUTES, ORDINALS } = require('./pools');
const { enumerate } = require('./solver');
const { DIFFICULTY, presetFor } = require('../../config/defaults');

const PRESETS = (DIFFICULTY.logicgrid) || {
  1: { items: 4, cats: 3, ordinal: false, style: 'positive' },
  2: { items: 4, cats: 4, ordinal: true, style: 'mixed' },
  3: { items: 5, cats: 4, ordinal: true, style: 'hard' },
};

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Build the category set: primary people + a mix of attribute categories, with
// at most one ordinal category when the preset allows it.
function buildCategories(preset, config, rand) {
  const N = preset.items;
  const names = (Array.isArray(config.people) && config.people.length >= N
    ? config.people.map(String)
    : shuffle(PEOPLE.items.slice(), rand)).slice(0, N);
  const cats = [{ key: PEOPLE.key, label: PEOPLE.label, kind: 'name', subj: PEOPLE.subj, values: names }];

  const attrPool = shuffle(ATTRIBUTES.slice(), rand);
  let remaining = preset.cats - 1;
  if (preset.ordinal && remaining > 0) {
    const ord = pick(ORDINALS, rand);
    const values = [];
    for (let i = 0; i < N; i++) values.push(ord.start + i * ord.step);
    cats.push({ key: ord.key, label: ord.label, kind: 'ordinal', subj: ord.subj, more: ord.more, unit: ord.unit, values });
    remaining -= 1;
  }
  for (let i = 0; i < remaining; i++) {
    const a = attrPool[i];
    cats.push({ key: a.key, label: a.label, kind: 'noun', subj: a.subj, values: shuffle(a.items.slice(), rand).slice(0, N) });
  }
  return cats;
}

// The true solution: entity i (the i-th person) gets values[i] in every
// category, after each attribute category is shuffled independently.
function buildSolution(cats, rand) {
  const N = cats[0].values.length;
  const sol = cats.map((c, ci) => (ci === 0 ? c.values.slice() : shuffle(c.values.slice(), rand)));
  const rows = [];
  for (let i = 0; i < N; i++) {
    const row = {};
    cats.forEach((c, ci) => { row[c.key] = sol[ci][i]; });
    rows.push(row);
  }
  return { sol, rows };
}

const subjOf = (cats, c, v) => cats[c].subj(v);

// Every clue below is true under `sol`; each carries the text and the machine
// predicate (kind + category indices + values) the solver checks.
function buildCluePool(cats, sol, preset, rand) {
  const N = cats[0].values.length;
  const ordIdx = cats.findIndex((c) => c.kind === 'ordinal');
  const positives = []; const negatives = []; const ordinals = [];

  for (let a = 0; a < cats.length; a++) {
    for (let b = a + 1; b < cats.length; b++) {
      for (let i = 0; i < N; i++) {
        positives.push({
          kind: 'same', ca: a, va: sol[a][i], cb: b, vb: sol[b][i], req: [a, b],
          text: `${cap(subjOf(cats, a, sol[a][i]))} is ${subjOf(cats, b, sol[b][i])}.`,
        });
      }
      // a handful of true negatives per category pair
      for (let t = 0; t < N; t++) {
        const i = Math.floor(rand() * N); let j = Math.floor(rand() * N);
        if (i === j) j = (j + 1) % N;
        negatives.push({
          kind: 'diff', ca: a, va: sol[a][i], cb: b, vb: sol[b][j], req: [a, b],
          text: `${cap(subjOf(cats, a, sol[a][i]))} is not ${subjOf(cats, b, sol[b][j])}.`,
        });
      }
    }
  }

  if (ordIdx >= 0) {
    const nonOrd = cats.map((_, ci) => ci).filter((ci) => ci !== ordIdx);
    for (let t = 0; t < N * 3; t++) {
      let i = Math.floor(rand() * N); let j = Math.floor(rand() * N);
      if (sol[ordIdx][i] === sol[ordIdx][j]) continue;
      const hi = sol[ordIdx][i] > sol[ordIdx][j] ? i : j;
      const lo = hi === i ? j : i;
      const da = pick(nonOrd, rand); const db = pick(nonOrd, rand);
      if (sol[da][hi] === sol[db][lo] && da === db) continue;
      const more = cats[ordIdx].more; const unit = cats[ordIdx].unit;
      const n = sol[ordIdx][hi] - sol[ordIdx][lo];
      if (rand() < 0.5 && n >= 1 && n <= 4) {
        const unitN = n === 1 ? unit.replace(/s$/, '') : unit; // "1 year", "2 years"
        ordinals.push({
          kind: 'delta', ca: da, va: sol[da][hi], cb: db, vb: sol[db][lo], n, req: [da, db, ordIdx],
          text: `${cap(subjOf(cats, da, sol[da][hi]))} is ${n} ${unitN} ${more} than ${subjOf(cats, db, sol[db][lo])}.`,
        });
      } else {
        ordinals.push({
          kind: 'gt', ca: da, va: sol[da][hi], cb: db, vb: sol[db][lo], req: [da, db, ordIdx],
          text: `${cap(subjOf(cats, da, sol[da][hi]))} is ${more} than ${subjOf(cats, db, sol[db][lo])}.`,
        });
      }
    }
  }

  // Order the pool by difficulty style. Positives are the easiest (direct
  // links); negatives and ordinal comparisons force real deduction. The full
  // positive set is always appended last as a uniqueness-guaranteeing fallback.
  shuffle(positives, rand); shuffle(negatives, rand); shuffle(ordinals, rand);
  let ordered;
  if (preset.style === 'positive') ordered = [...positives, ...negatives];
  else if (preset.style === 'mixed') ordered = [...ordinals, ...negatives.slice(0, N * 2), ...positives];
  else ordered = [...negatives, ...ordinals, ...positives];
  // Guarantee termination: appending every positive fully determines the grid.
  return { ordered: [...ordered, ...positives], positives };
}

// Greedily add clues until the solution is unique, then drop any clue that
// isn't needed — yielding a compact, non-redundant set.
function selectClues(cats, ordered, rand) {
  const isUnique = (clues) => {
    const r = enumerate(cats, clues, { limit: 2 });
    return r.count === 1 && !r.overBudget;
  };
  const selected = [];
  for (const clue of ordered) {
    selected.push(clue);
    if (isUnique(selected)) break;
  }
  const order = shuffle(selected.slice(), rand);
  let kept = selected;
  for (const clue of order) {
    const trial = kept.filter((c) => c !== clue);
    if (isUnique(trial)) kept = trial;
  }
  return kept;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('logicgrid', difficulty, config.audience);

  const cats = buildCategories(preset, config, rand);
  const { sol, rows } = buildSolution(cats, rand);
  const { ordered } = buildCluePool(cats, sol, preset, rand);
  const clues = selectClues(cats, ordered, rand);

  // Public category descriptors: display values only (no subj functions). The
  // primary keeps its solution order (it fixes entity identity); attribute
  // values are sorted so the printed legend doesn't hint at the answer.
  const publicCats = cats.map((c, ci) => ({
    key: c.key,
    label: c.label,
    kind: c.kind,
    values: ci === 0 ? c.values.slice()
      : c.kind === 'ordinal' ? c.values.slice().sort((a, b) => a - b)
        : c.values.slice().sort(),
  }));
  // `index` numbers the printed clue; `n` (delta amount) and `req` are the
  // machine fields the solver reads back during verification.
  const publicClues = clues.map((c, i) => {
    const out = { index: i + 1, text: c.text, kind: c.kind, ca: c.ca, va: c.va, cb: c.cb, vb: c.vb, req: c.req };
    if (c.n != null) out.n = c.n;
    return out;
  });

  return {
    type: 'logicgrid',
    difficulty,
    theme: config.theme || null,
    title: config.title || 'Logic Puzzle',
    instructions: config.instructions
      || 'Use the clues to match each person with their attributes. Cross out what can’t be true until only one answer per person remains, then fill in the table.',
    data: {
      categories: publicCats,
      clues: publicClues,
    },
    solution: { rows },
  };
}

module.exports = { generate, buildCategories, buildSolution, buildCluePool, selectClues };
