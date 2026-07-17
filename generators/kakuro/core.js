/**
 * Kakuro core — layout analysis and a constraint-propagating cross-sum solver
 * shared by generate / solve / validate.
 *
 * Grid model (`data.grid`, rows × cols): every cell is one of
 *   { t: 'fill' }                              — a white cell to be filled 1–9
 *   { t: 'clue', right: n|null, down: n|null } — a black cell; `right` is the
 *       sum of the across run starting immediately to its right, `down` the sum
 *       of the down run starting immediately below it (either may be null).
 * The top row and left column are always clue cells (the border).
 *
 * An "entry" (run) is a maximal straight line of ≥2 fill cells. Every fill cell
 * belongs to exactly one across entry and one down entry; each entry's digits
 * are distinct and sum to the clue on the black cell that precedes it.
 */

// Maximal horizontal fill segments of length ≥ 2, with the clue cell to their left.
function acrossEntries(grid, rows, cols) {
  const entries = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (grid[r][c].t === 'fill') {
        const start = c;
        while (c < cols && grid[r][c].t === 'fill') c++;
        if (c - start >= 2) {
          const cells = [];
          for (let cc = start; cc < c; cc++) cells.push([r, cc]);
          entries.push({ clue: [r, start - 1], cells });
        }
      } else c++;
    }
  }
  return entries;
}

// Maximal vertical fill segments of length ≥ 2, with the clue cell above them.
function downEntries(grid, rows, cols) {
  const entries = [];
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (grid[r][c].t === 'fill') {
        const start = r;
        while (r < rows && grid[r][c].t === 'fill') r++;
        if (r - start >= 2) {
          const cells = [];
          for (let rr = start; rr < r; rr++) cells.push([rr, c]);
          entries.push({ clue: [start - 1, c], cells });
        }
      } else r++;
    }
  }
  return entries;
}

// Build the solver's constraint model from a grid whose clue sums are set.
// Returns fill-cell ids, the entry list (target + member ids), and per-cell the
// entries it participates in.
function buildModel(grid, rows, cols) {
  const id = (r, c) => r * cols + c;
  const fillIds = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (grid[r][c].t === 'fill') fillIds.push(id(r, c));
  }
  const entries = [];
  const cellEntries = new Map();
  fillIds.forEach((fid) => cellEntries.set(fid, []));

  const add = (rawEntries, sumKey) => {
    for (const e of rawEntries) {
      const [cr, cc] = e.clue;
      const target = grid[cr][cc][sumKey];
      const ids = e.cells.map(([r, c]) => id(r, c));
      const idx = entries.length;
      entries.push({ target, ids });
      ids.forEach((fid) => cellEntries.get(fid).push(idx));
    }
  };
  add(acrossEntries(grid, rows, cols), 'right');
  add(downEntries(grid, rows, cols), 'down');

  return { fillIds, entries, cellEntries };
}

// Smallest / largest sum of `k` distinct digits drawn from 1..9 excluding `used`.
function extremeSums(k, used) {
  let min = 0;
  let max = 0;
  let taken = 0;
  for (let v = 1; v <= 9 && taken < k; v++) if (!used.has(v)) { min += v; taken++; }
  taken = 0;
  for (let v = 9; v >= 1 && taken < k; v--) if (!used.has(v)) { max += v; taken++; }
  return { min, max };
}

/**
 * Count solutions of the fully-clued grid, up to `cap`. `budget` bounds the
 * search so a pathological layout can't hang generation (returns Infinity when
 * the budget is exhausted, i.e. "treat as non-unique / reject").
 */
function countSolutions(grid, rows, cols, cap = 2, budget = 200000) {
  const { fillIds, entries, cellEntries } = buildModel(grid, rows, cols);
  const val = new Map();
  fillIds.forEach((fid) => val.set(fid, 0));
  let count = 0;
  let steps = 0;
  let overBudget = false;

  // Candidate digits for an unassigned cell, given current assignment.
  function candidates(fid) {
    const out = [];
    for (let v = 1; v <= 9; v++) {
      let ok = true;
      for (const ei of cellEntries.get(fid)) {
        const e = entries[ei];
        let sum = 0;
        let remaining = 0;
        const used = new Set();
        let dup = false;
        for (const cid of e.ids) {
          if (cid === fid) continue;
          const cv = val.get(cid);
          if (cv === 0) remaining++;
          else { sum += cv; used.add(cv); if (cv === v) dup = true; }
        }
        if (dup) { ok = false; break; }
        const total = sum + v;
        if (remaining === 0) { if (total !== e.target) { ok = false; break; } }
        else {
          used.add(v);
          const { min, max } = extremeSums(remaining, used);
          if (total + min > e.target || total + max < e.target) { ok = false; break; }
        }
      }
      if (ok) out.push(v);
    }
    return out;
  }

  function selectCell() {
    let best = null;
    for (const fid of fillIds) {
      if (val.get(fid) !== 0) continue;
      const cands = candidates(fid);
      if (cands.length === 0) return { fid, cands };
      if (!best || cands.length < best.cands.length) {
        best = { fid, cands };
        if (cands.length === 1) return best;
      }
    }
    return best;
  }

  function recurse() {
    if (count >= cap || overBudget) return;
    if (++steps > budget) { overBudget = true; return; }
    const cell = selectCell();
    if (cell === null) { count++; return; }
    if (cell.cands.length === 0) return;
    for (const v of cell.cands) {
      val.set(cell.fid, v);
      recurse();
      val.set(cell.fid, 0);
      if (count >= cap || overBudget) return;
    }
  }

  recurse();
  if (overBudget) return Infinity;
  return count;
}

// Solve to the first full assignment; returns a rows×cols grid of digits (0 for
// clue cells) or null if unsolvable.
function solveGrid(grid, rows, cols, budget = 400000) {
  const { fillIds, entries, cellEntries } = buildModel(grid, rows, cols);
  const val = new Map();
  fillIds.forEach((fid) => val.set(fid, 0));
  let steps = 0;

  function candidates(fid) {
    const out = [];
    for (let v = 1; v <= 9; v++) {
      let ok = true;
      for (const ei of cellEntries.get(fid)) {
        const e = entries[ei];
        let sum = 0;
        let remaining = 0;
        const used = new Set();
        let dup = false;
        for (const cid of e.ids) {
          if (cid === fid) continue;
          const cv = val.get(cid);
          if (cv === 0) remaining++;
          else { sum += cv; used.add(cv); if (cv === v) dup = true; }
        }
        if (dup) { ok = false; break; }
        const total = sum + v;
        if (remaining === 0) { if (total !== e.target) { ok = false; break; } }
        else {
          used.add(v);
          const { min, max } = extremeSums(remaining, used);
          if (total + min > e.target || total + max < e.target) { ok = false; break; }
        }
      }
      if (ok) out.push(v);
    }
    return out;
  }

  function selectCell() {
    let best = null;
    for (const fid of fillIds) {
      if (val.get(fid) !== 0) continue;
      const cands = candidates(fid);
      if (cands.length === 0) return { fid, cands };
      if (!best || cands.length < best.cands.length) {
        best = { fid, cands };
        if (cands.length === 1) return best;
      }
    }
    return best;
  }

  function recurse() {
    if (++steps > budget) return false;
    const cell = selectCell();
    if (cell === null) return true;
    if (cell.cands.length === 0) return false;
    for (const v of cell.cands) {
      val.set(cell.fid, v);
      if (recurse()) return true;
      val.set(cell.fid, 0);
    }
    return false;
  }

  if (!recurse()) return null;
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const fid of fillIds) out[Math.floor(fid / cols)][fid % cols] = val.get(fid);
  return out;
}

module.exports = { acrossEntries, downEntries, buildModel, countSolutions, solveGrid };
