/**
 * Sudoku — generate().
 *
 * Builds a complete, valid solution grid, then removes clues down toward the
 * difficulty's target given-count while preserving a unique solution. Uses
 * 180° rotational symmetry for clue removal — the publishing convention and a
 * nicer look on the page.
 *
 * Config:
 *   difficulty 1|2|3   easy / medium / hard (default 1)
 *   symmetric  boolean remove clues in symmetric pairs (default true)
 */
const { DIFFICULTY } = require('../../config/defaults');
const { solveGrid, countSolutions, candidates, cloneGrid, N, BOX } = require('./solver');

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build a fully solved grid via randomized backtracking.
function buildSolution(rand) {
  const grid = Array.from({ length: N }, () => Array(N).fill(0));

  function fill() {
    // Find first empty cell in row-major order.
    let r = -1;
    let c = -1;
    for (let i = 0; i < N && r < 0; i++) {
      for (let j = 0; j < N; j++) {
        if (grid[i][j] === 0) {
          r = i;
          c = j;
          break;
        }
      }
    }
    if (r < 0) return true; // full
    const cands = shuffle(candidates(grid, r, c), rand);
    for (const v of cands) {
      grid[r][c] = v;
      if (fill()) return true;
      grid[r][c] = 0;
    }
    return false;
  }

  fill();
  return grid;
}

/**
 * @param {object} config
 * @param {function} [rand=Math.random]
 * @returns {{ type, difficulty, theme, title, instructions, data, solution }}
 */
function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = DIFFICULTY.sudoku[difficulty] || DIFFICULTY.sudoku[1];
  // Symmetry: the caller can force it, else the tier decides (Expert drops it to
  // dig deeper).
  const symmetric = config.symmetric != null ? config.symmetric : preset.symmetric !== false;

  const solution = buildSolution(rand);
  const givens = cloneGrid(solution);

  // Order cells for removal. With symmetry we step through one half and remove
  // each cell together with its 180° partner.
  const cells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) cells.push([r, c]);
  }
  shuffle(cells, rand);

  let givenCount = N * N;
  const target = preset.target;
  const minGivens = preset.minGivens;

  for (const [r, c] of cells) {
    if (givenCount <= target) break;
    if (givens[r][c] === 0) continue;

    const partner = symmetric ? [N - 1 - r, N - 1 - c] : null;
    const removing = [[r, c]];
    if (partner && !(partner[0] === r && partner[1] === c) && givens[partner[0]][partner[1]] !== 0) {
      removing.push(partner);
    }
    // Don't drop below the floor.
    if (givenCount - removing.length < minGivens) continue;

    const backup = removing.map(([rr, cc]) => givens[rr][cc]);
    removing.forEach(([rr, cc]) => (givens[rr][cc] = 0));

    // Keep the removal only if the solution stays unique.
    if (countSolutions(givens, 2) === 1) {
      givenCount -= removing.length;
    } else {
      removing.forEach(([rr, cc], i) => (givens[rr][cc] = backup[i]));
    }
  }

  return {
    type: 'sudoku',
    difficulty,
    theme: null,
    title: config.title || `Sudoku — ${cap(preset.label)}`,
    instructions:
      config.instructions ||
      'Fill the grid so every row, column, and 3×3 box contains the digits 1 to 9.',
    data: {
      size: N,
      box: BOX,
      givens,
      givenCount,
      level: preset.label,
    },
    solution: {
      grid: solution,
    },
  };
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { generate, buildSolution };
