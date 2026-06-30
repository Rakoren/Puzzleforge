/**
 * Maze — validate().
 *
 * Golden Standards:
 *   - start and end are reachable
 *   - no inaccessible regions (every cell reachable from the start)
 *   - exactly one solution path
 *
 * A maze with `cells*… ` open edges equal to (cellCount - 1) that is also fully
 * connected is a spanning tree, which guarantees exactly one simple path
 * between any two cells — so we verify those two properties rather than trying
 * to enumerate paths.
 */
const { solve } = require('./solver');
const { N, E, S, W } = require('./index');

function countOpenEdges(cells, width, height) {
  // Count each carved passage once by only looking East and South.
  let edges = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cells[y][x] & E) edges++;
      if (cells[y][x] & S) edges++;
    }
  }
  return edges;
}

function validate(puzzle) {
  const errors = [];
  const warnings = [];
  let score = 1.0;

  const { width, height, cells } = puzzle.data;
  const total = width * height;

  const { reachable, reachedCount } = solve(puzzle);
  if (!reachable) errors.push('No path exists from start to finish.');
  if (reachedCount !== total) {
    errors.push(
      `Maze has inaccessible regions (${total - reachedCount} of ${total} cells unreachable).`
    );
  }

  const edges = countOpenEdges(cells, width, height);
  if (reachedCount === total && edges !== total - 1) {
    // Connected but with extra edges => loops => multiple solution paths.
    errors.push(
      `Maze is not a perfect maze (${edges} passages; a unique-solution maze of ` +
        `${total} cells must have exactly ${total - 1}).`
    );
  }

  // Soft: very small mazes are trivial.
  if (total < 36) {
    warnings.push('Maze is small; consider a larger grid for more challenge.');
    score -= 0.05;
  }

  score = Math.max(0, Math.min(1, score));
  return { valid: errors.length === 0, errors, warnings, score };
}

module.exports = { validate, countOpenEdges };
