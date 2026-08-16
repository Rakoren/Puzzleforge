/**
 * Maze — generate().
 *
 * Produces a "perfect" maze (a spanning tree over the grid: exactly one path
 * between any two cells, no inaccessible regions) using the recursive
 * backtracker algorithm. Difficulty selects the grid dimensions.
 *
 * Cell walls are stored as a per-cell bitmask of open passages. The dual
 * representation (which walls are carved) is what the renderer draws.
 *
 * Config:
 *   difficulty 1|2|3
 *   width, height  optional explicit dimensions (cells)
 */
const { presetFor } = require('../../config/defaults');

// Direction bits: N E S W. A set bit means the passage in that direction is OPEN.
const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DX = { [E]: 1, [W]: -1, [N]: 0, [S]: 0 };
const DY = { [N]: -1, [S]: 1, [E]: 0, [W]: 0 };
const OPP = { [N]: S, [S]: N, [E]: W, [W]: E };
const DIRS = [N, E, S, W];

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generate(config = {}, rand = Math.random) {
  const difficulty = config.difficulty || 1;
  const preset = presetFor('maze', difficulty, config.audience);
  const width = config.width || preset.width;
  const height = config.height || preset.height;

  // cells[y][x] = bitmask of open passages.
  const cells = Array.from({ length: height }, () => Array(width).fill(0));
  const visited = Array.from({ length: height }, () => Array(width).fill(false));

  // Iterative recursive-backtracker to avoid stack limits on large mazes.
  const stack = [[0, 0]];
  visited[0][0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = shuffle(DIRS.slice(), rand);
    let advanced = false;
    for (const d of dirs) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited[ny][nx]) continue;
      // Carve passage between (x,y) and (nx,ny).
      cells[y][x] |= d;
      cells[ny][nx] |= OPP[d];
      visited[ny][nx] = true;
      stack.push([nx, ny]);
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }

  const start = { x: 0, y: 0 };
  const end = { x: width - 1, y: height - 1 };

  const puzzle = {
    type: 'maze',
    difficulty,
    theme: null,
    title: config.title || `Maze — ${cap(preset.label)}`,
    instructions:
      config.instructions || 'Find a path from the start (top-left) to the finish (bottom-right).',
    data: { width, height, cells, start, end },
    solution: null, // filled by solver via the engine; see solver.solve()
  };

  // Attach the solution path immediately so the standalone object is complete.
  const { solve } = require('./solver');
  const { path } = solve(puzzle);
  puzzle.solution = { path };

  return puzzle;
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { generate, N, E, S, W, DX, DY, OPP, DIRS };
