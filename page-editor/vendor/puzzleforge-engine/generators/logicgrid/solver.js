/**
 * Logic Grid — solve() + the constraint engine.
 *
 * A candidate solution assigns, to every category, a permutation mapping the
 * N entities (fixed by the primary category's order) to that category's values.
 * `enumerate` searches those permutations with clue-based pruning and can count
 * solutions (stopping early once it finds more than one). This is the single
 * source of truth for both:
 *   - generation: prove a clue set yields exactly one solution
 *   - verification: independently re-derive the answer key
 *
 * A clue is { kind, ca, va, cb, vb, n?, req } where ca/cb are category indices,
 * va/vb are values, and req is the set of category indices the clue needs
 * assigned before it can be checked. Kinds:
 *   same  — the (ca=va) entity is the (cb=vb) entity
 *   diff  — they are different entities
 *   gt    — the (ca=va) entity's ordinal value is greater than the (cb=vb)'s
 *   delta — the (ca=va) entity's ordinal value is exactly n more than (cb=vb)'s
 */

// All permutations of a small array (N ≤ 6 here, so this stays cheap).
function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

function ordinalIndex(categories) {
  return categories.findIndex((c) => c.kind === 'ordinal');
}

function evalClue(assign, clue, ordIdx) {
  const iA = assign[clue.ca].indexOf(clue.va);
  const iB = assign[clue.cb].indexOf(clue.vb);
  if (iA < 0 || iB < 0) return true; // not enough info yet — don't prune
  switch (clue.kind) {
    case 'same': return iA === iB;
    case 'diff': return iA !== iB;
    case 'gt': return assign[ordIdx][iA] > assign[ordIdx][iB];
    case 'delta': return assign[ordIdx][iA] - assign[ordIdx][iB] === clue.n;
    default: return true;
  }
}

/**
 * Search for solutions consistent with the clues.
 *   opts.limit  stop after this many solutions (default 2 — enough to test
 *               uniqueness cheaply)
 *   opts.budget node cap; if exceeded, `overBudget` is set true
 * Returns { count, first, overBudget } where `first` is the first full
 * assignment found (array of value-permutations per category) or null.
 */
function enumerate(categories, clues, opts = {}) {
  const limit = opts.limit != null ? opts.limit : 2;
  const budget = opts.budget != null ? opts.budget : 4000000;
  const ordIdx = ordinalIndex(categories);

  const assign = new Array(categories.length);
  assign[0] = categories[0].values.slice(); // primary is fixed (identity)

  // Assign the ordinal category first (its comparison clues prune hardest),
  // then the remaining attribute categories.
  const order = [];
  if (ordIdx > 0) order.push(ordIdx);
  for (let c = 1; c < categories.length; c++) if (c !== ordIdx) order.push(c);

  const perms = categories.map((c) => permutations(c.values));
  const assigned = new Set([0]);

  let count = 0;
  let first = null;
  let nodes = 0;
  let overBudget = false;

  function dfs(k) {
    if (overBudget || count >= limit) return;
    if (k === order.length) {
      count += 1;
      if (!first) first = assign.map((a) => a.slice());
      return;
    }
    const c = order[k];
    for (const perm of perms[c]) {
      if (overBudget || count >= limit) return;
      if (++nodes > budget) { overBudget = true; return; }
      assign[c] = perm;
      assigned.add(c);
      let ok = true;
      for (const clue of clues) {
        if (clue.ca !== c && clue.cb !== c && !(clue.kind === 'gt' || clue.kind === 'delta')) continue;
        let ready = true;
        for (const r of clue.req) if (!assigned.has(r)) { ready = false; break; }
        if (!ready) continue;
        if (!evalClue(assign, clue, ordIdx)) { ok = false; break; }
      }
      if (ok) dfs(k + 1);
      assigned.delete(c);
    }
    assign[c] = undefined;
  }
  dfs(0);
  return { count, first, overBudget };
}

// Turn a full assignment into solution rows keyed by category, one per entity.
function assignToRows(categories, assign) {
  const N = categories[0].values.length;
  const rows = [];
  for (let i = 0; i < N; i++) {
    const row = {};
    for (let c = 0; c < categories.length; c++) row[categories[c].key] = assign[c][i];
    rows.push(row);
  }
  return rows;
}

/**
 * Engine verification entry point. Rebuilds the constraint model from the
 * puzzle's public data (categories + clues) and independently re-derives the
 * solution. Returns { rows, missing } — `missing` non-empty means the engine
 * should reject the puzzle (no unique solution, or a mismatch with the stored
 * key).
 */
function solve(puzzle) {
  const categories = puzzle.data.categories.map((c) => ({ key: c.key, kind: c.kind, values: c.values.slice() }));
  const clues = puzzle.data.clues.map((cl) => ({ kind: cl.kind, ca: cl.ca, va: cl.va, cb: cl.cb, vb: cl.vb, n: cl.n, req: cl.req }));
  const { count, first, overBudget } = enumerate(categories, clues, { limit: 2 });
  if (overBudget) return { missing: ['solver exceeded its search budget'] };
  if (count === 0) return { missing: ['no solution satisfies the clues'] };
  if (count > 1) return { missing: ['clues allow more than one solution'] };
  const rows = assignToRows(categories, first);
  // Confirm the independently found answer matches the stored key.
  const key = puzzle.solution.rows;
  for (let i = 0; i < rows.length; i++) {
    for (const c of categories) {
      if (String(rows[i][c.key]) !== String(key[i][c.key])) {
        return { missing: [`deduced answer differs from stored key at row ${i + 1}`] };
      }
    }
  }
  return { rows, missing: [] };
}

module.exports = { solve, enumerate, permutations, assignToRows, ordinalIndex };
