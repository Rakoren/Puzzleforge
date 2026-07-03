/**
 * PuzzleForge book library — client-side persistence in IndexedDB.
 *
 * Books are stored in this browser (no server round-trip), so a recipe with
 * embedded image data URIs fits comfortably. Shared by the editor (autosave)
 * and the My Books dashboard. UMD-ish: exposes window.PFLibrary.
 *
 * Record shape: { id, title, subtitle, trimSize, pages, createdAt, updatedAt, recipe }
 */
(function () {
  const DB = 'pf-library';
  const STORE = 'books';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbp;
  }

  function list() {
    return open().then((db) => new Promise((res, rej) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => res((req.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
      req.onerror = () => rej(req.error);
    }));
  }

  function get(id) {
    return open().then((db) => new Promise((res, rej) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    }));
  }

  function put(rec) {
    rec.updatedAt = Date.now();
    if (!rec.createdAt) rec.createdAt = rec.updatedAt;
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(rec);
      t.oncomplete = () => res(rec);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }

  function remove(id) {
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).delete(id);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    }));
  }

  const newId = () => 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Build a library record's metadata from a recipe (for card display).
  function metaFromRecipe(recipe) {
    const book = (recipe && recipe.book) || {};
    const pages = Array.isArray(recipe && recipe.pagePlan) ? recipe.pagePlan.length : null;
    return { title: book.title || 'Untitled book', subtitle: book.subtitle || '', trimSize: book.trimSize || '', pages };
  }

  window.PFLibrary = { list, get, put, remove, newId, metaFromRecipe };

  // --- Team workspace client (talks to the self-hosted LAN server) ---------
  const WS = '/api/workspace';
  const token = () => { try { return localStorage.getItem('pf_ws_token') || ''; } catch (_) { return ''; } };
  function headers(json) { const h = {}; if (json) h['Content-Type'] = 'application/json'; const t = token(); if (t) h['x-pf-workspace'] = t; return h; }
  async function ws(method, url, body) {
    const r = await fetch(WS + url, { method, headers: headers(!!body), body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { const e = new Error('This workspace needs a token.'); e.needsToken = true; throw e; }
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) || {}).error || 'Workspace error');
    return r.json();
  }
  window.PFWorkspace = {
    status: () => fetch(WS + '/status').then((r) => (r.ok ? r.json() : { enabled: false })).catch(() => ({ enabled: false })),
    members: () => ws('GET', '/members'),
    addMember: (m) => ws('POST', '/members', m),
    removeMember: (id) => ws('DELETE', '/members/' + id),
    books: () => ws('GET', '/books'),
    getBook: (id) => ws('GET', '/books/' + id),
    shareBook: (id, recipe, by) => ws('PUT', '/books/' + id, { recipe, by }),
    removeBook: (id) => ws('DELETE', '/books/' + id),
    comments: (id) => ws('GET', '/books/' + id + '/comments'),
    addComment: (id, c) => ws('POST', '/books/' + id + '/comments', c),
    setToken: (t) => { try { localStorage.setItem('pf_ws_token', t || ''); } catch (_) {} },
    subscribe: (onEvt) => {
      const t = token();
      let es;
      try { es = new EventSource(WS + '/events' + (t ? '?token=' + encodeURIComponent(t) : '')); }
      catch (_) { return { close() {} }; }
      es.onmessage = (e) => { try { onEvt(JSON.parse(e.data)); } catch (_) {} };
      return es;
    },
  };
})();
