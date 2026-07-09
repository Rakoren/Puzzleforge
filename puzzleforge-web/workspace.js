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
const crypto = require('crypto');
const express = require('express');

const DATA_DIR = process.env.PUZZLEFORGE_DATA_DIR || path.join(__dirname, 'data');
const BOOKS_DIR = path.join(DATA_DIR, 'books');
const DB_FILE = path.join(DATA_DIR, 'workspace.json');
const TOKEN = process.env.PUZZLEFORGE_WORKSPACE_TOKEN || '';

let db = { profiles: [], sessions: {}, invites: {}, books: {}, comments: {} };

function ensureDirs() { fs.mkdirSync(BOOKS_DIR, { recursive: true }); }
function load() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) { db = {}; }
  // `members` was the old roster; profiles supersede it (one source of truth).
  db.profiles = Array.isArray(db.profiles) ? db.profiles : (Array.isArray(db.members) ? db.members : []);
  delete db.members;
  db.sessions = db.sessions && typeof db.sessions === 'object' ? db.sessions : {};
  db.invites = db.invites && typeof db.invites === 'object' ? db.invites : {};
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
const ROLES = ['Owner', 'Writer', 'Editor', 'Illustrator', 'Reviewer', 'Contributor'];
const token = () => crypto.randomBytes(24).toString('hex');

// --- profiles / identity ------------------------------------------------
// A profile is a person on the team. Sign-in is by picking a profile (plus an
// optional PIN); a session token then identifies the request. The `google` slot
// is reserved so "Sign in with Google" can link to a profile later without a
// data migration.

function hashPin(pin, salt) { return crypto.scryptSync(String(pin), salt, 32).toString('hex'); }
function setPin(p, pin) {
  if (pin) { p.pinSalt = crypto.randomBytes(12).toString('hex'); p.pinHash = hashPin(pin, p.pinSalt); }
  else { delete p.pinSalt; delete p.pinHash; }
}
function checkPin(p, pin) { return p.pinHash ? p.pinHash === hashPin(pin || '', p.pinSalt) : true; }

// Safe view of a profile (never leaks the PIN hash/salt).
function pub(p) {
  return p && {
    id: p.id, name: p.name, email: p.email || '', role: p.role, penName: p.penName || '',
    color: p.color || '', hasPin: !!p.pinHash, google: !!p.googleSub,
    createdAt: p.createdAt, lastSeenAt: p.lastSeenAt || null,
  };
}
function findProfile(id) { return db.profiles.find((x) => x.id === id) || null; }
function listProfiles() { return db.profiles.map(pub); }
function profileCount() { return db.profiles.length; }

const ALLOWED_ROLE = (r, fallback) => (ROLES.includes(r) ? r : fallback);

function createProfile(m = {}) {
  const name = str(m.name, 80); if (!name) throw httpErr(400, 'A name is required.');
  // The very first profile on a fresh workspace is the Owner.
  const role = db.profiles.length === 0 ? 'Owner' : ALLOWED_ROLE(m.role, 'Contributor');
  const p = {
    id: uid('u_'), name, email: str(m.email, 160), role,
    penName: str(m.penName, 120), color: str(m.color, 20),
    googleSub: null, createdAt: Date.now(), lastSeenAt: Date.now(),
  };
  setPin(p, m.pin);
  db.profiles.push(p); saveMeta(); return p;
}
function updateProfile(id, patch = {}) {
  const p = findProfile(id); if (!p) throw httpErr(404, 'Profile not found.');
  if (patch.name !== undefined) { const n = str(patch.name, 80); if (!n) throw httpErr(400, 'A name is required.'); p.name = n; }
  if (patch.email !== undefined) p.email = str(patch.email, 160);
  if (patch.penName !== undefined) p.penName = str(patch.penName, 120);
  if (patch.color !== undefined) p.color = str(patch.color, 20);
  if (patch.role !== undefined) p.role = ALLOWED_ROLE(patch.role, p.role);
  if (patch.pin !== undefined) setPin(p, patch.pin); // '' clears the PIN
  saveMeta(); return pub(p);
}
function removeProfile(id) {
  const n = db.profiles.length;
  db.profiles = db.profiles.filter((x) => x.id !== id);
  for (const t of Object.keys(db.sessions)) if (db.sessions[t].profileId === id) delete db.sessions[t];
  if (db.profiles.length !== n) saveMeta();
}

// --- sessions ---
function signIn(profileId, pin) {
  const p = findProfile(profileId); if (!p) throw httpErr(404, 'Profile not found.');
  if (!checkPin(p, pin)) throw httpErr(401, 'Incorrect PIN.');
  const t = token(); db.sessions[t] = { profileId, createdAt: Date.now() };
  p.lastSeenAt = Date.now(); saveMeta();
  return { token: t, profile: pub(p) };
}
function whoami(t) { const s = t && db.sessions[t]; return s ? pub(findProfile(s.profileId)) : null; }
function signOut(t) { if (t && db.sessions[t]) { delete db.sessions[t]; saveMeta(); } }

// --- invites ---
function createInvite(opts = {}, by) {
  const t = token();
  db.invites[t] = { role: ALLOWED_ROLE(opts.role, 'Contributor'), name: str(opts.name, 80), by: str(by, 80), createdAt: Date.now() };
  saveMeta();
  return { token: t, role: db.invites[t].role, name: db.invites[t].name };
}
function getInvite(t) { const i = t && db.invites[t]; return i ? { role: i.role, name: i.name, by: i.by } : null; }
function acceptInvite(t, who = {}) {
  const inv = t && db.invites[t]; if (!inv) throw httpErr(404, 'This invite is invalid or has already been used.');
  const p = createProfile({ name: who.name || inv.name, email: who.email, role: inv.role, penName: who.penName, pin: who.pin });
  delete db.invites[t]; saveMeta();
  return signIn(p.id, who.pin); // sign the new person in immediately
}

// Back-compat aliases: the older /members roster maps onto profiles.
const listMembers = listProfiles;
const addMember = (m) => createProfile(m);
const removeMember = removeProfile;

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

  router.get('/status', (req, res) => res.json({ enabled: true, needsToken: !!TOKEN, profiles: db.profiles.length, books: Object.keys(db.books).length }));

  // Resolve the signed-in profile from the session header (if any).
  router.use((req, _res, next) => { req.profile = whoami(req.get('x-pf-session')); next(); });
  const requireProfile = (req, res, next) => (req.profile ? next() : res.status(401).json({ error: 'Sign in first.' }));

  // --- identity: profiles, sessions, invites ---
  // Who am I right now (from the session token)?
  router.get('/me', (req, res) => res.json({ profile: req.profile, count: profileCount() }));

  // The roster (safe fields) — used by the sign-in picker and the team screen.
  router.get('/profiles', (req, res) => res.json(listProfiles()));

  // Create a profile. Open only for the FIRST profile (bootstrap Owner) or via
  // an accepted invite; otherwise a signed-in user adds teammates.
  router.post('/profiles', (req, res, next) => {
    try {
      if (profileCount() > 0 && !req.profile) throw httpErr(401, 'Ask an owner for an invite link to join.');
      const p = createProfile(req.body || {});
      broadcast({ type: 'member' });
      res.json(signIn(p.id, (req.body || {}).pin)); // auto sign-in the new profile
    } catch (e) { next(e); }
  });

  router.patch('/profiles/:id', requireProfile, (req, res, next) => {
    try {
      const target = req.params.id;
      if (req.profile.id !== target && req.profile.role !== 'Owner') throw httpErr(403, 'You can only edit your own profile.');
      // Only an Owner may change roles.
      const patch = { ...(req.body || {}) };
      if (req.profile.role !== 'Owner') delete patch.role;
      const p = updateProfile(target, patch);
      broadcast({ type: 'member' });
      res.json(p);
    } catch (e) { next(e); }
  });

  router.delete('/profiles/:id', requireProfile, (req, res, next) => {
    try {
      if (req.profile.id !== req.params.id && req.profile.role !== 'Owner') throw httpErr(403, 'Only an owner can remove other people.');
      removeProfile(req.params.id); broadcast({ type: 'member' }); res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Sign in / out.
  router.post('/session', (req, res, next) => {
    try { const { profileId, pin } = req.body || {}; res.json(signIn(profileId, pin)); } catch (e) { next(e); }
  });
  router.delete('/session', (req, res) => { signOut(req.get('x-pf-session')); res.json({ ok: true }); });

  // Invites.
  router.post('/invites', requireProfile, (req, res, next) => {
    try { res.json(createInvite(req.body || {}, req.profile.name)); } catch (e) { next(e); }
  });
  router.get('/invites/:token', (req, res) => { const i = getInvite(req.params.token); return i ? res.json(i) : res.status(404).json({ error: 'Invite invalid or already used.' }); });
  router.post('/invites/:token/accept', (req, res, next) => {
    try { const r = acceptInvite(req.params.token, req.body || {}); broadcast({ type: 'member' }); res.json(r); } catch (e) { next(e); }
  });

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
  _store: {
    load, listMembers, addMember, removeMember,
    listProfiles, createProfile, updateProfile, removeProfile, findProfile, profileCount,
    signIn, whoami, signOut, createInvite, getInvite, acceptInvite,
    listBooks, getBook, saveBook, removeBook, listComments, addComment,
  },
};
