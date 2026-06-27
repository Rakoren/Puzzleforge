/**
 * Maze — solve().
 *
 * BFS from start to end across open passages. Returns the shortest path (for a
 * perfect maze this is the only path) plus connectivity info used by the
 * validator: the count of cells reachable from the start.
 */
const { N, E, S, W, DX, DY } = require('./index');

function solve(puzzle) {
  const { width, height, cells, start, end } = puzzle.data;
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const seen = new Set([key(start.x, start.y)]);
  const queue = [[start.x, start.y]];
  let reached = false;

  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === end.x && y === end.y) reached = true;
    // Do not stop early: continue flooding so `reachedCount` reflects full
    // connectivity (the validator relies on it to detect isolated regions).
    const mask = cells[y][x];
    for (const d of [N, E, S, W]) {
      if ((mask & d) === 0) continue; // wall — no passage
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }

  let path = [];
  if (reached) {
    let cur = key(end.x, end.y);
    while (cur) {
      const [x, y] = cur.split(',').map(Number);
      path.push({ x, y });
      cur = prev.get(cur);
    }
    path.reverse();
  }

  return {
    path,
    reachable: reached,
    reachedCount: seen.size,
    totalCells: width * height,
  };
}

module.exports = { solve };
