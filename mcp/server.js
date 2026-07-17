#!/usr/bin/env node
/**
 * PuzzleForge MCP server.
 *
 * Exposes the puzzle engine over the Model Context Protocol (stdio transport) so
 * any MCP client — Claude Desktop, Cursor, an agent — can list types/themes,
 * generate a puzzle, assemble a book, and export print-ready PDFs.
 *
 * Wraps the same engine the CLI and web app use, so results are identical. The
 * transport owns stdout: this file must never write to stdout (logs go to
 * stderr) or the JSON-RPC stream is corrupted.
 *
 * Run:  node mcp/server.js       (or the `puzzleforge-mcp` bin)
 * PDF export needs a Chromium binary (set PUPPETEER_EXECUTABLE_PATH if it isn't
 * auto-detected, or pass executablePath to the export tools).
 */
const os = require('os');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const pf = require('../');
const pkg = require('../package.json');

const PLAYABLE = pf.listTypes().filter((t) => !pf.isActivityType(t));
const TYPE_LABELS = {
  wordsearch: 'Word Search', numbersearch: 'Number Search', sudoku: 'Sudoku', maze: 'Maze',
  cryptogram: 'Cryptogram', wordscramble: 'Word Scramble', crossword: 'Crossword',
  krisskross: 'Kriss-Kross', nonogram: 'Nonogram', trivia: 'Trivia Quiz',
  logicgrid: 'Logic Grid', wordladder: 'Word Ladder',
};

const jsonResult = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const textResult = (s) => ({ content: [{ type: 'text', text: String(s) }] });
const errorResult = (msg) => ({ content: [{ type: 'text', text: `Error: ${msg}` }], isError: true });

// A safe default output path for a generated PDF.
function defaultPdfPath(name) {
  const slug = String(name || 'puzzleforge').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'puzzleforge';
  return path.join(os.tmpdir(), `${slug}-${Date.now()}.pdf`);
}

const server = new McpServer({ name: 'puzzleforge', version: pkg.version });

// --- discovery -----------------------------------------------------------
server.registerTool(
  'list_puzzle_types',
  {
    title: 'List puzzle types',
    description: 'List the puzzle types PuzzleForge can generate (with human-readable names).',
    inputSchema: {},
  },
  async () => jsonResult(PLAYABLE.map((t) => ({ type: t, name: TYPE_LABELS[t] || t }))),
);

server.registerTool(
  'list_themes',
  {
    title: 'List themes',
    description: 'List built-in word themes (id, label, category). Optionally filter by category.',
    inputSchema: { category: z.string().optional().describe('Only return themes in this category.') },
  },
  async ({ category }) => {
    let themes = pf.listThemesDetailed().map((t) => ({ id: t.id, label: t.label, category: t.category, tags: t.tags }));
    if (category) themes = themes.filter((t) => (t.category || '').toLowerCase() === category.toLowerCase());
    return jsonResult(themes);
  },
);

server.registerTool(
  'list_trim_sizes',
  {
    title: 'List trim sizes',
    description: 'List the KDP trim (page) sizes available for export.',
    inputSchema: {},
  },
  async () => jsonResult(pf.listTrimSizes()),
);

// --- generation ----------------------------------------------------------
const genShape = {
  type: z.enum(PLAYABLE).describe('Puzzle type (see list_puzzle_types).'),
  difficulty: z.number().int().min(1).max(3).default(1).describe('1 = easy, 2 = medium, 3 = hard.'),
  theme: z.string().optional().describe('Theme id for word-based puzzles (see list_themes).'),
  words: z.array(z.string()).optional().describe('Custom word list (overrides theme) for word-based puzzles.'),
  seed: z.number().int().optional().describe('Seed for reproducible generation.'),
  title: z.string().optional().describe('Override the puzzle title.'),
};

server.registerTool(
  'generate_puzzle',
  {
    title: 'Generate a puzzle',
    description: 'Generate a single puzzle and return its data + solution as JSON. Does not export a file.',
    inputSchema: genShape,
  },
  async (args) => {
    try {
      const p = pf.generate({ type: args.type, difficulty: args.difficulty, theme: args.theme, words: args.words, seed: args.seed, title: args.title });
      return jsonResult({
        type: p.type, title: p.title, difficulty: p.difficulty, theme: p.theme,
        instructions: p.instructions, data: p.data, solution: p.solution, meta: p.meta,
      });
    } catch (e) { return errorResult(e.message); }
  },
);

server.registerTool(
  'export_puzzle_pdf',
  {
    title: 'Export a puzzle to PDF',
    description: 'Generate a single puzzle and export a print-ready PDF. Returns the output file path. Needs a Chromium binary.',
    inputSchema: {
      ...genShape,
      trimSize: z.string().default('8.5x11').describe('KDP trim size (see list_trim_sizes).'),
      answerKey: z.boolean().default(true).describe('Append an answer-key page.'),
      outPath: z.string().optional().describe('Absolute path to write the PDF (defaults to a temp file).'),
      executablePath: z.string().optional().describe('Path to a Chromium/Chrome binary if not auto-detected.'),
    },
  },
  async (args) => {
    try {
      const p = pf.generate({ type: args.type, difficulty: args.difficulty, theme: args.theme, words: args.words, seed: args.seed, title: args.title });
      const outPath = args.outPath || defaultPdfPath(p.title || args.type);
      await pf.exportPdf(p, { trimSize: args.trimSize, answerKey: args.answerKey, outPath, executablePath: args.executablePath });
      return jsonResult({ outPath, type: p.type, title: p.title, trimSize: args.trimSize });
    } catch (e) { return errorResult(e.message); }
  },
);

// --- books ---------------------------------------------------------------
const bookShape = {
  title: z.string().describe('Book title.'),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  trimSize: z.string().default('8.5x11').describe('KDP trim size (see list_trim_sizes).'),
  theme: z.string().optional().describe('Default theme id for word-based puzzles.'),
  answerKey: z.boolean().default(true).describe('Include a back-of-book answer key.'),
  seed: z.number().int().optional().describe('Seed to reproduce the whole book.'),
  puzzles: z.array(z.object({
    type: z.enum(PLAYABLE),
    count: z.number().int().min(1).max(40).default(1),
    difficulty: z.string().default('1').describe('Level (1|2|3) or a range like "1-3".'),
  })).min(1).describe('Ordered list of puzzle blocks.'),
};

function toBookConfig(a) {
  return {
    puzzleforgeBook: 1, title: a.title, subtitle: a.subtitle, author: a.author,
    trimSize: a.trimSize, theme: a.theme, answerKey: a.answerKey, seed: a.seed,
    puzzles: a.puzzles,
  };
}

server.registerTool(
  'assemble_book',
  {
    title: 'Assemble a book',
    description: 'Assemble a multi-puzzle book and return a summary (page count, puzzle count, type breakdown). Does not export a file.',
    inputSchema: bookShape,
  },
  async (args) => {
    try {
      const book = pf.assembleBook(toBookConfig(args));
      const breakdown = {};
      for (const pg of book.pages) breakdown[pg.puzzle.type] = (breakdown[pg.puzzle.type] || 0) + 1;
      return jsonResult({ title: book.title, trimSize: book.trimSize, pages: book.pages.length, puzzleCount: book.meta.puzzleCount, breakdown });
    } catch (e) { return errorResult(e.message); }
  },
);

server.registerTool(
  'export_book_pdf',
  {
    title: 'Export a book to PDF',
    description: 'Assemble a book and export a print-ready interior PDF. Returns the output path and page count. Needs a Chromium binary.',
    inputSchema: {
      ...bookShape,
      outPath: z.string().optional().describe('Absolute path to write the PDF (defaults to a temp file).'),
      executablePath: z.string().optional().describe('Path to a Chromium/Chrome binary if not auto-detected.'),
    },
  },
  async (args) => {
    try {
      const book = pf.assembleBook(toBookConfig(args));
      const outPath = args.outPath || defaultPdfPath(book.title);
      const r = await pf.exportBookPdf(book, { outPath, executablePath: args.executablePath });
      return jsonResult({ outPath, title: book.title, pages: r.pages, trimSize: book.trimSize });
    } catch (e) { return errorResult(e.message); }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`PuzzleForge MCP server v${pkg.version} ready (stdio) — ${PLAYABLE.length} puzzle types`);
}

main().catch((e) => { console.error('PuzzleForge MCP server failed to start:', e); process.exit(1); });
