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
const {
  exportPuzzlePdf,
  exportBookPdf,
  exportPuzzlesPdf,
  renderPuzzleHtml,
  renderPuzzlesHtml,
  renderBookHtml,
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
const offensive = require('./filters/offensive');

module.exports = {
  generate,
  assembleBook,
  exportPdf: exportPuzzlePdf,
  exportBookPdf,
  exportPuzzlesPdf,
  renderHtml: renderPuzzleHtml,
  renderPuzzlesHtml,
  renderBookHtml,
  getLayout,
  listTrimSizes,
  listTypes,
  isActivityType,
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
};
