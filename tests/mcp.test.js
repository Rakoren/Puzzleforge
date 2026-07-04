'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// Spin up the real MCP server over stdio and drive it with the MCP client.
async function withClient(fn) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '..', 'mcp', 'server.js')],
  });
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(transport);
  try { return await fn(client); } finally { await client.close(); }
}

test('mcp: server exposes the expected tools', async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    for (const expected of ['list_puzzle_types', 'list_themes', 'list_trim_sizes', 'generate_puzzle', 'export_puzzle_pdf', 'assemble_book', 'export_book_pdf']) {
      assert.ok(names.includes(expected), `missing tool ${expected}`);
    }
  });
});

test('mcp: generate_puzzle returns a seeded, solvable puzzle', async () => {
  await withClient(async (client) => {
    const res = await client.callTool({ name: 'generate_puzzle', arguments: { type: 'wordladder', difficulty: 2, seed: 7 } });
    assert.ok(!res.isError);
    const p = JSON.parse(res.content[0].text);
    assert.equal(p.type, 'wordladder');
    assert.ok(Array.isArray(p.solution.ladder) && p.solution.ladder.length >= 4);
  });
});

test('mcp: assemble_book returns a page/type summary', async () => {
  await withClient(async (client) => {
    const res = await client.callTool({ name: 'assemble_book', arguments: { title: 'T', puzzles: [{ type: 'sudoku', count: 2, difficulty: '2' }], answerKey: true } });
    assert.ok(!res.isError);
    const b = JSON.parse(res.content[0].text);
    assert.equal(b.breakdown.sudoku, 2);
    assert.ok(b.pages >= 2);
  });
});

test('mcp: invalid input is reported as a tool error, not a crash', async () => {
  await withClient(async (client) => {
    const res = await client.callTool({ name: 'generate_puzzle', arguments: { type: 'wordsearch', difficulty: 1, words: ['a'] } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /Error:/);
  });
});
