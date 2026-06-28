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

const maze = {
  type: 'maze',
  generate: require('./maze').generate,
  validate: require('./maze/validator').validate,
  solve: require('./maze/solver').solve,
  render: require('./maze/renderer').render,
};

const cryptogram = {
  type: 'cryptogram',
  generate: require('./cryptogram').generate,
  validate: require('./cryptogram/validator').validate,
  solve: require('./cryptogram/solver').solve,
  render: require('./cryptogram/renderer').render,
};

const wordscramble = {
  type: 'wordscramble',
  generate: require('./wordscramble').generate,
  validate: require('./wordscramble/validator').validate,
  solve: require('./wordscramble/solver').solve,
  render: require('./wordscramble/renderer').render,
};

const crossword = {
  type: 'crossword',
  generate: require('./crossword').generate,
  validate: require('./crossword/validator').validate,
  solve: require('./crossword/solver').solve,
  render: require('./crossword/renderer').render,
};

const krisskross = {
  type: 'krisskross',
  generate: require('./krisskross').generate,
  validate: require('./krisskross/validator').validate,
  solve: require('./krisskross/solver').solve,
  render: require('./krisskross/renderer').render,
};

const nonogram = {
  type: 'nonogram',
  generate: require('./nonogram').generate,
  validate: require('./nonogram/validator').validate,
  solve: require('./nonogram/solver').solve,
  render: require('./nonogram/renderer').render,
};

const numbersearch = {
  type: 'numbersearch',
  generate: require('./numbersearch').generate,
  validate: require('./numbersearch/validator').validate,
  solve: require('./numbersearch/solver').solve,
  render: require('./numbersearch/renderer').render,
};

const trivia = {
  type: 'trivia',
  generate: require('./trivia').generate,
  validate: require('./trivia/validator').validate,
  solve: require('./trivia/solver').solve,
  render: require('./trivia/renderer').render,
};

// Activity pages for kids' books — no answer, no puzzle solving.
const coloring = {
  type: 'coloring',
  generate: require('./coloring').generate,
  validate: require('./coloring/validator').validate,
  solve: require('./coloring/solver').solve,
  render: require('./coloring/renderer').render,
};

const drawing = {
  type: 'drawing',
  generate: require('./drawing').generate,
  validate: require('./drawing/validator').validate,
  solve: require('./drawing/solver').solve,
  render: require('./drawing/renderer').render,
};

const bleedguard = {
  type: 'bleedguard',
  generate: require('./bleedguard').generate,
  validate: require('./bleedguard/validator').validate,
  solve: require('./bleedguard/solver').solve,
  render: require('./bleedguard/renderer').render,
};

const breather = {
  type: 'breather',
  generate: require('./breather').generate,
  validate: require('./breather/validator').validate,
  solve: require('./breather/solver').solve,
  render: require('./breather/renderer').render,
};

const MODULES = {
  wordsearch,
  sudoku,
  maze,
  cryptogram,
  wordscramble,
  crossword,
  krisskross,
  nonogram,
  numbersearch,
  trivia,
  coloring,
  drawing,
  bleedguard,
  breather,
};

// Activity (non-puzzle) page types: excluded from the answer key and from the
// "puzzle count".
const ACTIVITY_TYPES = new Set(['coloring', 'drawing', 'bleedguard', 'breather']);
function isActivityType(type) {
  return ACTIVITY_TYPES.has(type);
}

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

module.exports = { getModule, listTypes, MODULES, isActivityType, ACTIVITY_TYPES };
