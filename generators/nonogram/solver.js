/**
 * Nonogram — solve().
 *
 * Solves a nonogram from its row/column clues and counts solutions (capped at
 * 2) to prove uniqueness. Uses a depth-first search over rows: every legal
 * arrangement of a row's clue is tried, pruned against a partial-column check
 * so dead branches are abandoned early. Practical for the grid sizes used here
 * (≤ 15).
 */

// Run-length clue of a boolean line (empty line -> [] is normalized to [0] by
// callers that need a printable clue; here [] means "no filled cells").
function clueOf(line) {
  const runs = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      runs.push(run);
      run = 0;
    }
  }
  if (run) runs.push(run);
  return runs.length ? runs : [0];
}

// All boolean arrangements of `width` cells satisfying `clue` (a list of block
// lengths). `[0]` or `[]` means an empty line.
function rowArrangements(clue, width) {
  const blocks = clue.filter((n) => n > 0);
  const results = [];
  if (blocks.length === 0) {
    results.push(new Array(width).fill(false));
    return results;
  }
  const total = blocks.reduce((s, b) => s + b, 0);
  const slack = width - total - (blocks.length - 1);
  if (slack < 0) return results;

  const k = blocks.length;
  // Distribute `slack` extra spaces across k+1 gap slots (before each block and
  // after the last), with a mandatory single separator between consecutive
  // blocks.
  const gapSlots = k + 1;
  function distribute(slotIdx, left, chosen) {
    if (slotIdx === gapSlots - 1) {
      chosen.push(left);
      // assemble
      const row = [];
      for (let i = 0; i < k; i++) {
        const lead = chosen[i] + (i > 0 ? 1 : 0); // separator before block i>0
        for (let g = 0; g < lead; g++) row.push(false);
        for (let b = 0; b < blocks[i]; b++) row.push(true);
      }
      for (let g = 0; g < chosen[gapSlots - 1]; g++) row.push(false);
      while (row.length < width) row.push(false);
      results.push(row.slice(0, width));
      chosen.pop();
      return;
    }
    for (let v = 0; v <= left; v++) {
      chosen.push(v);
      distribute(slotIdx + 1, left - v, chosen);
      chosen.pop();
    }
  }
  distribute(0, slack, []);
  return results;
}

// Is the partial column (cells filled for the rows placed so far) a valid
// prefix of `clue`? The last run may still be growing if the last cell is on.
function partialColumnOk(cells, clue) {
  const target = clue.filter((n) => n > 0);
  const runs = [];
  let run = 0;
  for (const v of cells) {
    if (v) run++;
    else if (run) {
      runs.push(run);
      run = 0;
    }
  }
  const lastOpen = run > 0;
  // closed runs must match the clue prefix exactly
  const closed = runs;
  for (let i = 0; i < closed.length; i++) {
    if (closed[i] !== target[i]) return false;
  }
  if (closed.length > target.length) return false;
  if (lastOpen) {
    const idx = closed.length;
    if (idx >= target.length) return false;
    if (run > target[idx]) return false;
  }
  return true;
}

/**
 * Count solutions up to `cap`.
 * @returns {number}
 */
function countSolutions(rowClues, colClues, width, height, cap = 2) {
  const rowOptions = rowClues.map((clue) => rowArrangements(clue, width));
  // If any row has no legal arrangement, there are no solutions.
  if (rowOptions.some((opts) => opts.length === 0)) return 0;

  const grid = [];
  let count = 0;

  function columnsOk(uptoRow, finalCheck) {
    for (let c = 0; c < width; c++) {
      const cells = [];
      for (let r = 0; r <= uptoRow; r++) cells.push(grid[r][c]);
      if (finalCheck) {
        const got = clueOf(cells);
        const want = colClues[c].filter((n) => n > 0);
        const g = got[0] === 0 ? [] : got;
        if (g.length !== want.length || g.some((v, i) => v !== want[i])) return false;
      } else if (!partialColumnOk(cells, colClues[c])) {
        return false;
      }
    }
    return true;
  }

  function recurse(r) {
    if (count >= cap) return;
    if (r === height) {
      if (columnsOk(height - 1, true)) count++;
      return;
    }
    for (const opt of rowOptions[r]) {
      grid[r] = opt;
      if (columnsOk(r, false)) recurse(r + 1);
      if (count >= cap) return;
    }
    grid[r] = undefined;
  }

  recurse(0);
  return count;
}

/**
 * Solve a puzzle to its (assumed unique) grid.
 * @returns {{ grid: boolean[][]|null, solutionCount: number, unique: boolean }}
 */
function solve(puzzle) {
  const { rowClues, colClues, width, height } = puzzle.data;
  // Reuse the counter but capture the first full solution.
  const rowOptions = rowClues.map((clue) => rowArrangements(clue, width));
  const grid = [];
  let found = null;

  function colsOk(upto, final) {
    for (let c = 0; c < width; c++) {
      const cells = [];
      for (let r = 0; r <= upto; r++) cells.push(grid[r][c]);
      if (final) {
        const got = clueOf(cells);
        const want = colClues[c].filter((n) => n > 0);
        const g = got[0] === 0 ? [] : got;
        if (g.length !== want.length || g.some((v, i) => v !== want[i])) return false;
      } else if (!partialColumnOk(cells, colClues[c])) return false;
    }
    return true;
  }
  function rec(r) {
    if (found) return;
    if (r === height) {
      if (colsOk(height - 1, true)) found = grid.map((row) => row.slice());
      return;
    }
    for (const opt of rowOptions[r]) {
      grid[r] = opt;
      if (colsOk(r, false)) rec(r + 1);
      if (found) return;
    }
  }
  rec(0);

  const solutionCount = countSolutions(rowClues, colClues, width, height, 2);
  return { grid: found, solutionCount, unique: solutionCount === 1 };
}

module.exports = { solve, countSolutions, clueOf, rowArrangements, partialColumnOk };
