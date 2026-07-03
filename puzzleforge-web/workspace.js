/**
 * PuzzleForge Workspace — a self-hosted LAN team backend.
 *
 * Zero external dependencies: a shared roster, a shared book library, and live
 * per-book comments, persisted to plain JSON files on disk and broadcast to
 * connected clients over Server-Sent Events. Designed to run on one machine on
 * a local network — no accounts host, no database, no monthly bill.
 *
 * Light metadata (members, book index, comments) lives in one small JSON file;
 * each book's full recipe is stored in its own file so posting a comment never
 * rewrites megabytes of image data. Express handles requests one at a time, so
 * in-process mutations are already serialized.
 *
 * Auth: set PUZZLEFORGE_WORKSPACE_TOKEN to require an `x-pf-workspace` header;
 * leave it unset to trust the LAN (the default).
 */
const path = require('path');
const fs = require('fs');
const express = require('express');

const DATA_DIR = process.env.PUZZLEFORGE_DATA_DIR || path.join(__dirname, 'data');
const BOOKS_DIR = path.join(DATA_DIR, 'books');
const DB_FILE = path.join(DATA_DIR, 'workspace.json');
const TOKEN = process.env.PUZZLEFORGE_WORKSPACE_TOKEN || '';

let db = { members: [], books: {}, comments: {} };

function ensureDirs() { fs.mkdirSync(BOOKS_DIR, { recursive: true }); }
function load() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) { db = {}; }
  db.members = Array.isArray(db.members) ? db.members : [];
  db.books = db.books && typeof db.books === 'object' ? db.books : {};
  db.comments = db.comments && typeof db.comments === 'object' ? db.comments : {};
}
function saveMeta() {
  ensureDirs();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
function bookFile(id) { return path.join(BOOKS_DIR, id.replace(/[^a-z0-9_-]/gi, '') + '.json'); }

const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const str = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const ROLES = ['Writer', 'Editor', 'Illustrator', 'Reviewer', 'Owner', 'Contributor'];

// --- store API (also unit-testable without HTTP) ---
function listMembers() { return db.members.slice(); }
function addMember(m) {
  const name = str(m.name, 80); if (!name) throw httpErr(400, 'A name is required.');
  const member = { id: uid('m_'), name, email: str(m.email, 160), role: ROLES.includes(m.role) ? m.role : 'Contributor', createdAt: Date.now() };
  db.members.push(member); saveMeta(); return member;
}
function removeMember(id) { const n = db.members.length; db.members = db.members.filter((x) => x.id !== id); if (db.members.length !== n) saveMeta(); }

function listBooks() { return Object.values(db.books).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }
function getBook(id) {
  const meta = db.books[id]; if (!meta) return null;
  let recipe = null; try { recipe = JSON.parse(fs.readFileSync(bookFile(id), 'utf8')); } catch (_) { /* */ }
  return { ...meta, recipe };
}
function saveBook(id, recipe, by) {
  const book = (recipe && recipe.book) || {};
  const meta = {
    id, title: str(book.title, 200) || 'Untitled book', subtitle: str(book.subtitle, 200),
    trimSize: str(book.trimSize, 20), pages: Array.isArray(recipe && recipe.pagePlan) ? recipe.pagePlan.length : null,
    updatedAt: Date.now(), updatedBy: str(by, 80) || 'Someone',
  };
  ensureDirs();
  const tmp = bookFile(id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(recipe));
  fs.renameSync(tmp, bookFile(id));
  db.books[id] = meta; saveMeta(); return meta;
}
function removeBook(id) {
  if (!db.books[id]) return;
  delete db.books[id]; delete db.comments[id]; saveMeta();
  try { fs.unlinkSync(bookFile(id)); } catch (_) { /* */ }
}

function listComments(bookId) { return (db.comments[bookId] || []).slice(); }
function addComment(bookId, c) {
  const text = str(c.text, 4000); if (!text) throw httpErr(400, 'Comment text is required.');
  const note = { id: uid('c_'), bookId, author: str(c.author, 80) || 'Someone', role: str(c.role, 30) || 'Contributor', text, createdAt: Date.now() };
  (db.comments[bookId] = db.comments[bookId] || []).push(note); saveMeta(); return note;
}

function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

// --- live updates (Server-Sent Events) ---
const clients = new Set();
function broadcast(evt) {
  const line = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of clients) { try { res.write(line); } catch (_) { /* */ } }
}

// --- router ---
function buildRouter() {
  load();
  const router = express.Router();

  // Token gate (status stays open so clients can discover whether a token is needed).
  router.use((req, res, next) => {
    if (req.path === '/status' || req.path === '/events') return next();
    if (TOKEN && req.get('x-pf-workspace') !== TOKEN) return res.status(401).json({ error: 'Workspace token required.' });
    next();
  });

  router.get('/status', (req, res) => res.json({ enabled: true, needsToken: !!TOKEN, members: db.members.length, books: Object.keys(db.books).length }));

  router.get('/events', (req, res) => {
    if (TOKEN && req.query.token !== TOKEN) return res.status(401).end();
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    if (res.flushHeaders) res.flushHeaders();
    res.write(': connected\n\n');
    clients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) { /* */ } }, 25000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
  });

  router.get('/members', (req, res) => res.json(listMembers()));
  router.post('/members', (req, res, next) => { try { const m = addMember(req.body || {}); broadcast({ type: 'member' }); res.json(m); } catch (e) { next(e); } });
  router.delete('/members/:id', (req, res) => { removeMember(req.params.id); broadcast({ type: 'member' }); res.json({ ok: true }); });

  router.get('/books', (req, res) => res.json(listBooks()));
  router.get('/books/:id', (req, res) => { const b = getBook(req.params.id); if (!b) return res.status(404).json({ error: 'Not found.' }); res.json(b); });
  router.put('/books/:id', (req, res, next) => {
    try {
      const body = req.body || {}; if (!body.recipe) throw httpErr(400, 'A recipe is required.');
      const meta = saveBook(req.params.id, body.recipe, body.by); broadcast({ type: 'book', id: meta.id, title: meta.title, by: meta.updatedBy }); res.json(meta);
    } catch (e) { next(e); }
  });
  router.delete('/books/:id', (req, res) => { removeBook(req.params.id); broadcast({ type: 'book', id: req.params.id, removed: true }); res.json({ ok: true }); });

  router.get('/books/:id/comments', (req, res) => res.json(listComments(req.params.id)));
  router.post('/books/:id/comments', (req, res, next) => {
    try { const c = addComment(req.params.id, req.body || {}); broadcast({ type: 'comment', bookId: req.params.id, author: c.author }); res.json(c); } catch (e) { next(e); }
  });

  router.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return router;
}

module.exports = {
  router: buildRouter(),
  // exported for tests
  _store: { load, listMembers, addMember, removeMember, listBooks, getBook, saveBook, removeBook, listComments, addComment },
};
