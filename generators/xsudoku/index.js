/**
 * X-Sudoku (Diagonal Sudoku) — generate().
 *
 * Builds a full valid diagonal-sudoku solution, then removes clues (in 180°
 * symmetric pairs) toward the difficulty's given-count while keeping the
 * solution unique under the diagonal rule.
 *
 * Config:
 *   difficulty 1|2|3|4
 *   symmetric  boolean (default true)
 */
const { presetFor } = require('../../config/defaults');
const { candidates, countSolutions, cloneGrid, N } = require('./solver');

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// A full solution via randomized backtracking (diagonal-aware candidates).
function buildSolution(rand) {
  const grid = Array.from({ length: N }, () => Array(N).fill(0));
  function fill() {
    let r = -1, c = -1;
    for (let i = 0; i < N && r < 0; i++) {
      for (let j = 0; j < N; j++) if (grid[i][j] === 0) { r = i; c = j; break; }
    }
    if (r < 0) return true;
    for (const v of shuffle(candidates(grid, r, c), rand)) {
      grid[r][c] = v;
      if (fill()) return true;
      grid[r][c] = 0;
    }
    return false;
  }
  fill();
  return grid;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('xsudoku', difficulty, config.audience) || { givens: 34 };
  const targetGivens = config.givens || preset.givens;
  const symmetric = config.symmetric !== false;

  const solution = buildSolution(rand);
  const givens = cloneGrid(solution);

  // Remove clues (symmetric pairs) as long as the solution stays unique.
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push([r, c]);
  shuffle(cells, rand);

  let filled = N * N;
  for (const [r, c] of cells) {
    if (filled <= targetGivens) break;
    if (givens[r][c] === 0) continue;
    const pr = N - 1 - r, pc = N - 1 - c;
    const pair = symmetric && !(pr === r && pc === c) ? [[r, c], [pr, pc]] : [[r, c]];
    if (pair.some(([rr, cc]) => givens[rr][cc] === 0)) continue;
    const saved = pair.map(([rr, cc]) => givens[rr][cc]);
    pair.forEach(([rr, cc]) => { givens[rr][cc] = 0; });
    if (countSolutions(givens, 2) === 1) {
      filled -= pair.length;
    } else {
      pair.forEach(([rr, cc], i) => { givens[rr][cc] = saved[i]; }); // undo — would break uniqueness
    }
  }

  return {
    type: 'xsudoku',
    difficulty,
    theme: null,
    title: config.title || 'X-Sudoku',
    instructions: config.instructions ||
      'Fill the grid so every row, column, 3×3 box, AND both shaded diagonals contain 1–9.',
    data: { size: N, givens, givenCount: filled },
    solution: { grid: solution },
  };
}

module.exports = { generate };
