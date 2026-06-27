/**
 * Generator registry.
 *
 * Each puzzle type is a folder under generators/ that supplies the standard
 * module interface: generate, validate, solve, render. Adding a new type means
 * adding a folder and one line here — the engine never changes.
 */
const wordsearch = {
  type: 'wordsearch',
  generate: require('./wordsearch').generate,
  validate: require('./wordsearch/validator').validate,
  solve: require('./wordsearch/solver').solve,
  render: require('./wordsearch/renderer').render,
};

const sudoku = {
  type: 'sudoku',
  generate: require('./sudoku').generate,
  validate: require('./sudoku/validator').validate,
  solve: require('./sudoku/solver').solve,
  render: require('./sudoku/renderer').render,
};

const MODULES = { wordsearch, sudoku };

function listTypes() {
  return Object.keys(MODULES);
}

function getModule(type) {
  const mod = MODULES[type];
  if (!mod) {
    throw new Error(
      `Unknown puzzle type "${type}". Registered types: ${listTypes().join(', ')}`
    );
  }
  return mod;
}

module.exports = { getModule, listTypes, MODULES };
