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
  selectWords,
  clueMap,
  wordCount,
} = require('./themes');
const { listTypes } = require('./generators/registry');

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
  loadTheme,
  listThemes,
  listThemesDetailed,
  selectWords,
  clueMap,
  wordCount,
};
