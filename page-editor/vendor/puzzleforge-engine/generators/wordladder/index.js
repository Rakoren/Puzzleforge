/**
 * Word Ladder — generate().
 *
 * Turns one word into another by changing a single letter at a time, every rung
 * a real word (Lewis Carroll's "Doublets"). Builds a random ladder through the
 * baked common-word graph, then reveals the minimum number of letters on the
 * intermediate rungs to make the answer unique (the solver is the judge). Higher
 * difficulty means longer ladders and fewer given letters.
 *
 * Config:
 *   difficulty  1|2|3  ladder length + how many letters are given
 *   length      3|4|5  optional override of word length
 *   title       str
 */
const { countLadders, neighbors, dictFor, WORDS } = require('./solver');
const { DIFFICULTY, presetFor } = require('../../config/defaults');

const PRESETS = (DIFFICULTY.wordladder) || {
  1: { length: 3, steps: 4, style: 'guided' },
  2: { length: 4, steps: 5, style: 'some' },
  3: { length: 4, steps: 6, style: 'minimal' },
};

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// A simple (no-repeat) random walk of `steps` words through the graph.
function buildLadder(length, steps, rand) {
  const words = WORDS[length] || [];
  const dict = dictFor(length);
  if (words.length < steps) return null;
  // Bias the start toward the most common words for friendlier puzzles.
  const startPool = words.slice(0, Math.max(steps, Math.floor(words.length * 0.5)));
  for (let tries = 0; tries < 3000; tries++) {
    const start = startPool[Math.floor(rand() * startPool.length)];
    const path = [start];
    const used = new Set([start]);
    let ok = true;
    while (path.length < steps) {
      const cur = path[path.length - 1];
      const opts = shuffle(neighbors(cur, dict).filter((w) => !used.has(w)), rand);
      if (!opts.length) { ok = false; break; }
      // Prefer a next word that still has onward options (fewer dead ends).
      const next = opts.find((w) => neighbors(w, dict).some((n) => !used.has(n) && n !== w)) || opts[0];
      path.push(next); used.add(next);
    }
    if (ok && path.length === steps && path[0] !== path[steps - 1] && variedEnough(path)) return path;
  }
  return null;
}

// Reject ladders that change the same letter position at every step (e.g.
// GONE→ZONE→DONE→LONE→NONE) — they read as "pick N words ending in -ONE" rather
// than a real transformation. Require at least two distinct changed positions.
function variedEnough(path) {
  if (path.length <= 2) return true;
  const positions = new Set();
  for (let i = 1; i < path.length; i++) {
    for (let j = 0; j < path[i].length; j++) if (path[i][j] !== path[i - 1][j]) positions.add(j);
  }
  return positions.size >= 2;
}

// Reveal letters on the intermediate rungs until the ladder is the only
// solution, then add difficulty-appropriate guiding hints.
function makeHints(ladder, preset, rand) {
  const steps = ladder.length;
  const L = ladder[0].length;
  const patterns = ladder.map((w, i) => (i === 0 || i === steps - 1 ? w.split('') : new Array(L).fill(null)));
  const start = ladder[0], end = ladder[steps - 1];
  const isUnique = () => {
    const r = countLadders(start, end, steps, patterns, { limit: 2 });
    return r.count === 1 && !r.overBudget;
  };
  const cells = [];
  for (let i = 1; i < steps - 1; i++) for (let j = 0; j < L; j++) cells.push([i, j]);
  const order = shuffle(cells.slice(), rand);
  let k = 0;
  while (!isUnique() && k < order.length) {
    const [i, j] = order[k++];
    patterns[i][j] = ladder[i][j];
  }
  // Prune redundant reveals: drop any hint the puzzle stays unique without, so
  // the minimal-hint set is genuinely minimal (no needlessly filled cells).
  for (const [i, j] of shuffle(cells.slice(), rand)) {
    if (patterns[i][j] == null) continue;
    const saved = patterns[i][j];
    patterns[i][j] = null;
    if (!isUnique()) patterns[i][j] = saved;
  }
  // Guiding hints on top of the minimal unique set.
  if (preset.style === 'guided') {
    // Leave at most one blank per intermediate rung.
    for (let i = 1; i < steps - 1; i++) {
      const blanks = () => patterns[i].reduce((n, c) => n + (c == null ? 1 : 0), 0);
      const pos = shuffle([...Array(L).keys()].filter((j) => patterns[i][j] == null), rand);
      let p = 0;
      while (blanks() > 1 && p < pos.length) { patterns[i][pos[p]] = ladder[i][pos[p]]; p++; }
    }
  } else if (preset.style === 'some') {
    const hidden = shuffle(cells.filter(([i, j]) => patterns[i][j] == null), rand);
    if (hidden.length) { const [i, j] = hidden[0]; patterns[i][j] = ladder[i][j]; }
  }
  return patterns.slice(1, steps - 1); // intermediate rungs only
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('wordladder', difficulty, config.audience);
  const length = config.length || preset.length;
  const steps = config.steps || preset.steps;

  const ladder = buildLadder(length, steps, rand);
  if (!ladder) { const err = new Error('wordladder.generate: could not build a ladder'); err.retryable = true; throw err; }
  const rungs = makeHints(ladder, preset, rand);
  const anyHints = rungs.some((r) => r.some((c) => c != null));

  return {
    type: 'wordladder',
    difficulty,
    theme: config.theme || null,
    title: config.title || 'Word Ladder',
    instructions: config.instructions
      || `Change one letter at a time to turn ${ladder[0].toUpperCase()} into ${ladder[steps - 1].toUpperCase()}. `
        + `Every rung must be a real word.${anyHints ? ' Some letters are filled in to help.' : ''}`,
    data: {
      length,
      steps,
      start: ladder[0],
      end: ladder[steps - 1],
      rungs, // intermediate reveals: array of (letter|null) rows
    },
    solution: { ladder },
  };
}

module.exports = { generate, buildLadder, makeHints };
