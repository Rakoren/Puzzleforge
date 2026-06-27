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
const { exportPuzzlePdf, renderPuzzleHtml } = require('./engine/export');
const { getLayout } = require('./layouts');
const { loadTheme, listThemes } = require('./themes');

module.exports = {
  generate,
  exportPdf: exportPuzzlePdf,
  renderHtml: renderPuzzleHtml,
  getLayout,
  loadTheme,
  listThemes,
};
