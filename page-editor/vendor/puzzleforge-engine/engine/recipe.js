/**
 * Book recipe format — versioning + migration.
 *
 * Recipe v2 wraps the book config with a `seed` (so the page *structure* —
 * ordering, difficulty ranges — reproduces) and a `pageState` array (per-page
 * overrides today, reserved Fabric.js `canvasState` for the future Page Editor).
 * v1 recipes (the bare book config, tagged `puzzleforgeBook: 1`) load and
 * migrate automatically, so saved files never break.
 *
 * Shape (v2):
 *   {
 *     recipeVersion: 2,
 *     kind: "book",
 *     book: { ...book config (puzzles, theme, options)... },
 *     seed: 1234 | null,
 *     pageState: [ { border?, borderColor?, canvasState? }, ... ]  // by page index
 *   }
 *
 * Exact puzzle-grid reproduction (seeded generators) is a future step; for now
 * the seed reproduces structure and per-page state lines up by index.
 *
 * (Single-puzzle recipes — `puzzleforgeRecipe` — are a separate, unchanged v1
 * format handled by the web app directly.)
 */
const RECIPE_VERSION = 2;

// Keys that live at the v2 wrapper level, never inside `book`.
const WRAPPER_KEYS = new Set(['recipeVersion', 'kind', 'book', 'seed', 'pageState', 'puzzleforgeBook']);

function stripWrapper(config) {
  const out = {};
  for (const k of Object.keys(config || {})) {
    if (!WRAPPER_KEYS.has(k)) out[k] = config[k];
  }
  return out;
}

function isBookRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return false;
  return recipe.recipeVersion === 2 || recipe.puzzleforgeBook != null || Array.isArray(recipe.puzzles);
}

/**
 * Normalize any supported recipe to the current v2 shape.
 * @param {object} recipe v1 (bare config) or v2 book recipe
 * @returns {object} v2 recipe
 */
function migrate(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('recipe: not a recipe object');
  }
  if (recipe.recipeVersion === 2) {
    return {
      recipeVersion: 2,
      kind: 'book',
      book: stripWrapper(recipe.book || {}),
      seed: Number.isFinite(recipe.seed) ? recipe.seed >>> 0 : null,
      pageState: Array.isArray(recipe.pageState) ? recipe.pageState : [],
    };
  }
  // v1: the recipe *is* the book config (puzzleforgeBook: 1).
  if (recipe.puzzleforgeBook != null || Array.isArray(recipe.puzzles)) {
    return { recipeVersion: 2, kind: 'book', book: stripWrapper(recipe), seed: null, pageState: [] };
  }
  throw new Error('recipe: unrecognized format (expected a book recipe)');
}

/**
 * Resolve a recipe into an assembleBook() config (seed + pageState merged in).
 * @param {object} recipe
 * @returns {object} config accepted by assembleBook
 */
function toBookConfig(recipe) {
  const v2 = migrate(recipe);
  const config = { ...v2.book };
  if (v2.seed != null) config.seed = v2.seed;
  if (v2.pageState.length) config.pageState = v2.pageState;
  return config;
}

/**
 * Serialize an assembled book back to a v2 recipe.
 * @param {object} bookConfig the config that produced the book
 * @param {object} book assembled book (carries seed + per-page state)
 * @returns {object} v2 recipe
 */
function fromBook(bookConfig, book) {
  const pageState = (book.pages || []).map((p) => p.state || {});
  const allEmpty = pageState.every((s) => !s || Object.keys(s).length === 0);
  return {
    recipeVersion: RECIPE_VERSION,
    kind: 'book',
    book: stripWrapper(bookConfig),
    seed: Number.isFinite(book.seed) ? book.seed >>> 0 : null,
    pageState: allEmpty ? [] : pageState,
  };
}

module.exports = { RECIPE_VERSION, migrate, toBookConfig, fromBook, isBookRecipe };
