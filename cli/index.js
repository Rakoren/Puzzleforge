#!/usr/bin/env node
/**
 * PuzzleForge CLI — single-puzzle generation and export.
 *
 * Examples:
 *   puzzleforge --type wordsearch --theme animals --difficulty 1 --out animals.pdf
 *   puzzleforge --type wordsearch --words cat,dog,fox --size 12 --html out.html
 *   puzzleforge --list-themes
 *
 * Phase 2 will add full-book assembly (engine/book.js). This entry point is
 * deliberately single-puzzle.
 */
const fs = require('fs');
const path = require('path');
const { generate } = require('../engine/generate');
const { assembleBook } = require('../engine/book');
const {
  exportPuzzlePdf,
  exportBookPdf,
  renderPuzzleHtml,
  renderBookHtml,
} = require('../engine/export');
const { listTypes } = require('../generators/registry');
const themes = require('../themes');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true; // boolean flag
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function usage() {
  return `PuzzleForge CLI

Usage:
  Single puzzle:
    puzzleforge --type <type> [--theme <id> | --words a,b,c] [options]
  Full book:
    puzzleforge --book <config.json> --out book.pdf [--html book.html]

Options:
  --type <type>          puzzle type (${listTypes().join(', ')})
  --theme <id>           built-in theme id (see --list-themes)
  --words a,b,c          custom comma-separated word list
  --size <n>             grid size (auto if omitted)
  --difficulty <1|2|3>   difficulty level (default 1)
  --count <n>            max words to draw from the theme
  --trim <size>          trim size: 8x10 | 8.5x11 | 8.5x8.5 | 6x9 (default 8.5x11)
  --audience kids|adult  font scaling preset
  --title "..."          override the puzzle title
  --book <config.json>   assemble and export a full book from a config file
  --out <file.pdf>       export a print-ready PDF
  --html <file.html>     write the print HTML (no Chromium needed)
  --answers              include an answer-key page / highlight answers
  --list-themes          list built-in themes and exit
  --list-types           list registered puzzle types and exit
  --help                 show this help
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) {
    process.stdout.write(usage());
    return;
  }
  if (args['list-themes']) {
    process.stdout.write(themes.listThemes().join('\n') + '\n');
    return;
  }
  if (args['list-types']) {
    process.stdout.write(listTypes().join('\n') + '\n');
    return;
  }

  // --- full-book mode ---
  if (args.book) {
    let config;
    try {
      config = JSON.parse(fs.readFileSync(args.book, 'utf8'));
    } catch (err) {
      fail(`Could not read book config "${args.book}": ${err.message}`);
      return;
    }
    let book;
    try {
      book = assembleBook(config);
    } catch (err) {
      fail(err.message);
      return;
    }
    process.stdout.write(
      `Assembled "${book.title}" — ${book.meta.puzzleCount} puzzles ` +
        `(${Object.entries(book.meta.byType).map(([t, n]) => `${n} ${t}`).join(', ')}), ` +
        `trim ${book.trimSize}.\n`
    );
    if (args.html) {
      fs.writeFileSync(args.html, renderBookHtml(book));
      process.stdout.write(`Wrote book HTML → ${path.resolve(args.html)}\n`);
    }
    if (args.out) {
      try {
        const res = await exportBookPdf(book, { outPath: args.out });
        process.stdout.write(
          `Wrote book PDF (${res.trimSize}, ~${res.pages} pages) → ${path.resolve(res.outPath)}\n`
        );
      } catch (err) {
        fail(err.message);
      }
    }
    if (!args.html && !args.out) {
      process.stdout.write('(No --out or --html given; nothing exported.)\n');
    }
    return;
  }

  const type = args.type || 'wordsearch';
  const difficulty = args.difficulty ? Number(args.difficulty) : 1;

  // Resolve the word list: explicit --words wins, otherwise pull from a theme.
  // Word/clue types (crossword, etc.) also need a clue map.
  let words;
  let clues = {};
  let themeId = args.theme || null;
  const WORD_TYPES = new Set(['wordsearch', 'wordscramble', 'crossword', 'krisskross']);
  if (args.words) {
    words = String(args.words)
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
  } else if (themeId) {
    const theme = themes.loadTheme(themeId);
    const count = args.count ? Number(args.count) : 14;
    words = themes.selectWords(theme, { difficulty, count });
    if (words.length === 0) {
      // Empty tier — fall back to the whole theme.
      words = themes.selectWords(theme, { count });
    }
    clues = themes.clueMap(theme);
  } else if (WORD_TYPES.has(type)) {
    fail('Provide either --theme <id> or --words a,b,c (see --help).');
  }

  const config = {
    type,
    difficulty,
    theme: themeId,
    words,
    clues,
    size: args.size ? Number(args.size) : undefined,
    title: typeof args.title === 'string' ? args.title : undefined,
  };

  let puzzle;
  try {
    puzzle = generate(config);
  } catch (err) {
    fail(err.message);
    return;
  }

  const d = puzzle.data;
  const detail = d.words
    ? `${d.size}x${d.size}, ${d.words.length} words`
    : d.numbers
    ? `${d.size}x${d.size}, ${d.numbers.length} numbers`
    : d.questions
    ? `${d.questions.length} questions`
    : d.size
    ? `${d.size}x${d.size}`
    : d.width
    ? `${d.width}x${d.height}`
    : '';
  process.stdout.write(
    `Generated ${puzzle.type} "${puzzle.title}"` +
      (detail ? ` (${detail},` : ' (') +
      ` score ${puzzle.meta.validationScore}, ${puzzle.meta.attempts} attempt(s)).\n`
  );
  if (puzzle.meta.warnings.length) {
    process.stdout.write('Warnings: ' + puzzle.meta.warnings.join(' | ') + '\n');
  }

  const trimSize = args.trim || '8.5x11';
  const audience = args.audience || undefined;
  const answerKey = Boolean(args.answers);

  if (args.html) {
    const html = renderPuzzleHtml(puzzle, { trimSize, audience, answerKey });
    fs.writeFileSync(args.html, html);
    process.stdout.write(`Wrote HTML → ${path.resolve(args.html)}\n`);
  }

  if (args.out) {
    try {
      const res = await exportPuzzlePdf(puzzle, {
        outPath: args.out,
        trimSize,
        audience,
        answerKey,
      });
      process.stdout.write(`Wrote PDF (${res.trimSize}) → ${path.resolve(res.outPath)}\n`);
    } catch (err) {
      fail(err.message);
    }
  }

  if (!args.html && !args.out) {
    process.stdout.write('(No --out or --html given; nothing exported.)\n');
  }
}

function fail(msg) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

main().catch((err) => fail(err.stack || err.message));
