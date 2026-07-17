'use strict';
const { test: _test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// workspace.js lives in the web app. In an engine-only checkout (after the repo
// split) it isn't present, so the whole suite skips instead of erroring.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-ws-'));
process.env.PUZZLEFORGE_DATA_DIR = TMP;
let _store = null;
try { _store = require('../puzzleforge-web/workspace')._store; } catch (_) { /* engine-only repo */ }
const _skip = _store ? undefined : 'puzzleforge-web not present';
const test = (name, fn) => _test(name, { skip: _skip }, fn);
if (_store) _store.load();

const recipe = (title) => ({ recipeVersion: 2, kind: 'book', book: { title, subtitle: 'Sub', trimSize: '6x9' }, seed: 1, pagePlan: [{}, {}, {}] });

test('roster: add, list, remove', () => {
  const owner = _store.addMember({ name: 'Owner', role: 'Owner' }); // first profile = Owner
  const m = _store.addMember({ name: 'Sam', email: 'sam@x.com', role: 'Editor' });
  assert.equal(m.role, 'Editor');
  assert.ok(m.id);
  assert.equal(_store.listMembers().length, 2);
  _store.removeMember(m.id);
  _store.removeMember(owner.id);
  assert.equal(_store.listMembers().length, 0);
});

test('roster: name is required; unknown role falls back', () => {
  assert.throws(() => _store.addMember({ name: '' }), /name/i);
  const owner = _store.addMember({ name: 'Owner' }); // first = Owner
  const m = _store.addMember({ name: 'Alex', role: 'Wizard' });
  assert.equal(m.role, 'Contributor');
  _store.removeMember(m.id);
  _store.removeMember(owner.id);
});

test('books: save writes a recipe file + metadata; get returns full recipe', () => {
  const meta = _store.saveBook('bk_test1', recipe('Team Book'), 'Sam');
  assert.equal(meta.title, 'Team Book');
  assert.equal(meta.pages, 3);
  assert.equal(meta.updatedBy, 'Sam');
  assert.ok(fs.existsSync(path.join(TMP, 'books', 'bk_test1.json')));
  const full = _store.getBook('bk_test1');
  assert.equal(full.recipe.book.title, 'Team Book');
  assert.equal(_store.listBooks().length, 1);
});

test('books: update in place (no duplicate), then delete removes file + comments', () => {
  _store.saveBook('bk_test1', recipe('Team Book v2'), 'Alex');
  assert.equal(_store.listBooks().length, 1);
  assert.equal(_store.getBook('bk_test1').recipe.book.title, 'Team Book v2');
  _store.addComment('bk_test1', { author: 'Sam', role: 'Editor', text: 'Tighten the intro' });
  assert.equal(_store.listComments('bk_test1').length, 1);
  _store.removeBook('bk_test1');
  assert.equal(_store.getBook('bk_test1'), null);
  assert.equal(_store.listComments('bk_test1').length, 0);
  assert.ok(!fs.existsSync(path.join(TMP, 'books', 'bk_test1.json')));
});

test('comments: require text, carry author/role, persist per book', () => {
  _store.saveBook('bk_c', recipe('C'), 'Sam');
  assert.throws(() => _store.addComment('bk_c', { text: '' }), /text/i);
  const c = _store.addComment('bk_c', { author: 'Jo', role: 'Reviewer', text: 'Nice' });
  assert.equal(c.author, 'Jo');
  assert.equal(c.role, 'Reviewer');
  assert.equal(_store.listComments('bk_c')[0].text, 'Nice');
});

test('persistence: a fresh load() sees data written to disk', () => {
  // Re-read from disk into the in-memory db and confirm the shared book survived.
  _store.load();
  assert.ok(_store.listBooks().some((b) => b.id === 'bk_c'));
});

// --- identity: profiles, sessions, invites ---
test('identity: first profile is Owner; sign-in issues a resolvable session', { skip: _skip }, () => {
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-id-'));
  process.env.PUZZLEFORGE_DATA_DIR = fresh;
  _store.load();
  const owner = _store.createProfile({ name: 'Lyle', email: 'l@x.com', penName: 'L. Brownlee' });
  assert.equal(owner.role, 'Owner', 'the first profile bootstraps as Owner');
  const second = _store.createProfile({ name: 'Guest', role: 'Reviewer' });
  assert.equal(second.role, 'Reviewer', 'later profiles keep their requested role');

  const sess = _store.signIn(owner.id);
  assert.ok(sess.token && sess.profile.name === 'Lyle');
  assert.equal(_store.whoami(sess.token).id, owner.id, 'session resolves to the profile');
  assert.equal(_store.whoami('bogus'), null);
  _store.signOut(sess.token);
  assert.equal(_store.whoami(sess.token), null, 'sign-out invalidates the session');
});

test('identity: PIN gates sign-in and is never exposed', { skip: _skip }, () => {
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-id-'));
  process.env.PUZZLEFORGE_DATA_DIR = fresh;
  _store.load();
  _store.createProfile({ name: 'Owner' });
  const p = _store.createProfile({ name: 'Sara', role: 'Editor', pin: '1234' });
  assert.equal(p.hasPin, true);
  assert.equal(p.pinHash, undefined, 'the public profile never carries the PIN hash');
  assert.throws(() => _store.signIn(p.id, '0000'), /pin/i);
  assert.equal(_store.signIn(p.id, '1234').profile.name, 'Sara');
});

test('identity: an invite creates a signed-in profile with the invited role, once', { skip: _skip }, () => {
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-id-'));
  process.env.PUZZLEFORGE_DATA_DIR = fresh;
  _store.load();
  _store.createProfile({ name: 'Lyle' }); // Owner
  const inv = _store.createInvite({ role: 'Illustrator', name: 'Sara' }, 'Lyle');
  assert.equal(_store.getInvite(inv.token).role, 'Illustrator');
  const joined = _store.acceptInvite(inv.token, { name: 'Sara', pin: '99' });
  assert.equal(joined.profile.role, 'Illustrator');
  assert.ok(joined.token, 'accepting an invite signs you in');
  assert.equal(_store.getInvite(inv.token), null, 'the invite is single-use');
  assert.throws(() => _store.acceptInvite(inv.token, { name: 'X' }), /invalid|used/i);
});
