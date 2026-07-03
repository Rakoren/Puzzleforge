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
})();
