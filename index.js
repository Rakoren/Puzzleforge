/**
 * PuzzleForge Engine — public API surface.
 *
 * Importers should use this module rather than reaching into engine internals.
 *
 *   const pf = require('puzzleforge-engine');
 *   const puzzle = pf.generate({ type: 'wordsearch', theme: 'animals', difficulty: 1 });
 *   await pf.exportPdf(puzzle, { trimSize: '8x10', outPath: 'out.pdf' });
 */
const { generate } = require('./engine/generate');
const { assembleBook } = require('./engine/book');
const { runChecklist } = require('./engine/checklist');
const { splitPuzzle, splitHtml, composePage } = require('./engine/components');
const kdp = require('./engine/kdp');
const recipe = require('./engine/recipe');
const {
  exportPuzzlePdf,
  exportBookPdf,
  exportPuzzlesPdf,
  exportCoverPdf,
  exportHtmlPdf,
  renderPuzzleHtml,
  renderPuzzlesHtml,
  renderBookHtml,
  renderCoverHtml,
  coverDimensions,
  defaultLeaves,
  renderMatterDoc,
} = require('./engine/export');
const { getLayout, listTrimSizes } = require('./layouts');
const {
  loadTheme,
  listThemes,
  listThemesDetailed,
  resolveTheme,
  themesInCategory,
  selectWords,
  clueMap,
  wordCount,
  THEME_DIR,
} = require('./themes');
const { listTypes, isActivityType } = require('./generators/registry');
const { BORDER_STYLES } = require('./engine/decor');
const offensive = require('./filters/offensive');
const difficulty = require('./config/difficulty');

module.exports = {
  generate,
  assembleBook,
  runChecklist,
  splitPuzzle,
  splitHtml,
  composePage,
  defaultLeaves,
  renderMatterDoc,
  royaltyEstimate: kdp.royaltyEstimate,
  printingCostUSD: kdp.printingCostUSD,
  normalizeMetadata: kdp.normalizeMetadata,
  aiDisclosure: kdp.aiDisclosure,
  recipeVersion: recipe.RECIPE_VERSION,
  migrateRecipe: recipe.migrate,
  recipeToBookConfig: recipe.toBookConfig,
  bookToRecipe: recipe.fromBook,
  isBookRecipe: recipe.isBookRecipe,
  exportPdf: exportPuzzlePdf,
  exportBookPdf,
  exportPuzzlesPdf,
  exportCoverPdf,
  exportHtmlPdf,
  renderHtml: renderPuzzleHtml,
  renderPuzzlesHtml,
  renderBookHtml,
  renderCoverHtml,
  coverDimensions,
  getLayout,
  listTrimSizes,
  listTypes,
  isActivityType,
  borderStyles: BORDER_STYLES,
  loadTheme,
  listThemes,
  listThemesDetailed,
  resolveTheme,
  themesInCategory,
  selectWords,
  clueMap,
  wordCount,
  themesDir: THEME_DIR,
  isOffensiveWord: offensive.isOffensiveWord,
  scanTextForOffensive: offensive.scanText,
  // Difficulty labels/tiers (internal levels 1–4 → audience-specific labels).
  difficultyLevels: difficulty.LEVELS,
  difficultyTier: difficulty.difficultyTier,
  difficultyLabel: difficulty.difficultyLabel,
  difficultyOptions: difficulty.levelOptions,
};
