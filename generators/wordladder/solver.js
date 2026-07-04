/**
 * Word Ladder — solve() + the path-search engine.
 *
 * A ladder is a sequence of real words start → … → end, each one letter
 * different from the last, no word repeated. The puzzle reveals some letters on
 * the intermediate rungs; the search finds every ladder consistent with the
 * endpoints, the revealed letters, and the one-letter-change rule. This is the
 * source of truth for both:
 *   - generation: add just enough revealed letters to make the answer unique
 *   - verification: independently re-derive the ladder for the answer key
 */
const WORDS = require('./words');

function dictFor(length) {
  return new Set(WORDS[length] || []);
}

// Words one letter different from `word` that exist in `dict`.
function neighbors(word, dict) {
  const out = [];
  for (let i = 0; i < word.length; i++) {
    for (let c = 97; c < 123; c++) {
      const ch = String.fromCharCode(c);
      if (ch === word[i]) continue;
      const cand = word.slice(0, i) + ch + word.slice(i + 1);
      if (dict.has(cand)) out.push(cand);
    }
  }
  return out;
}

const isNeighbor = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d === 1;
};

const matches = (word, pattern) => pattern.every((ch, i) => ch == null || ch === word[i]);

/**
 * Count ladders of exactly `steps` words (indices 0..steps-1) from start to end
 * that satisfy `patterns` (patterns[i] is an array of letter|null for rung i).
 *   opts.limit  stop after this many (default 2 — enough to test uniqueness)
 * Returns { count, first, overBudget } where `first` is the first full ladder.
 */
function countLadders(start, end, steps, patterns, opts = {}) {
  const limit = opts.limit != null ? opts.limit : 2;
  const budget = opts.budget != null ? opts.budget : 2000000;
  const dict = dictFor(start.length);
  const path = new Array(steps);
  path[0] = start;
  const used = new Set([start]);
  let count = 0, first = null, nodes = 0, overBudget = false;

  function dfs(pos, prev) {
    if (overBudget || count >= limit) return;
    if (++nodes > budget) { overBudget = true; return; }
    if (pos === steps - 1) {
      if (isNeighbor(prev, end) && matches(end, patterns[pos])) {
        count += 1;
        if (!first) { path[pos] = end; first = path.slice(); }
      }
      return;
    }
    for (const w of neighbors(prev, dict)) {
      if (used.has(w) || w === end) continue;
      if (!matches(w, patterns[pos])) continue;
      used.add(w); path[pos] = w;
      dfs(pos + 1, w);
      used.delete(w);
      if (overBudget || count >= limit) return;
    }
  }
  dfs(1, start);
  return { count, first, overBudget };
}

function patternsFrom(puzzle) {
  const { start, end, steps } = puzzle.data;
  const rungs = puzzle.data.rungs; // intermediate reveals, length steps-2
  const patterns = new Array(steps);
  patterns[0] = start.split('');
  patterns[steps - 1] = end.split('');
  for (let i = 1; i < steps - 1; i++) patterns[i] = (rungs[i - 1] || []).slice();
  return patterns;
}

// Engine verification: re-derive the ladder from the public puzzle data.
function solve(puzzle) {
  const { start, end, steps } = puzzle.data;
  const patterns = patternsFrom(puzzle);
  const { count, first, overBudget } = countLadders(start, end, steps, patterns, { limit: 2 });
  if (overBudget) return { missing: ['solver exceeded its search budget'] };
  if (count === 0) return { missing: ['no ladder satisfies the revealed letters'] };
  if (count > 1) return { missing: ['revealed letters allow more than one ladder'] };
  const want = puzzle.solution.ladder;
  for (let i = 0; i < steps; i++) {
    if (first[i] !== want[i]) return { missing: [`deduced ladder differs from stored key at rung ${i + 1}`] };
  }
  return { ladder: first, missing: [] };
}

module.exports = { solve, countLadders, neighbors, isNeighbor, matches, dictFor, patternsFrom, WORDS };
