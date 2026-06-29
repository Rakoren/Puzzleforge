/* PuzzleForge — Page Editor (Fabric.js decoration layer over puzzle pages). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    status: $('status'), main: $('editorMain'), empty: $('emptyState'),
    pageList: $('pageList'), bg: $('bg'), deco: $('deco'), stageWrap: $('stageWrap'),
    addText: $('addText'), addImage: $('addImage'),
    fontSize: $('fontSize'), objColor: $('objColor'),
    forward: $('forward'), backward: $('backward'), deleteObj: $('deleteObj'),
    border: $('border'), reroll: $('reroll'),
    save: $('save'), exportPdf: $('exportPdf'), loadRecipe: $('loadRecipe'),
  };

  let bookId = null;
  let bookConfig = null;
  let seed = null;
  let dims = { usableWidth: 636, usableHeight: 816 };
  let pages = []; // [{ index, type, title, activity, html, state }]
  let pageStates = []; // [{ border?, borderColor?, canvasState?:{fabric,svg} }]
  let cur = -1;
  let scale = 1;
  let canvas = null; // fabric canvas

  function setStatus(t, k) { el.status.textContent = t || ''; el.status.className = 'status editor-status' + (k ? ' ' + k : ''); }

  // --- load ---
  async function openBook(payload) {
    setStatus('Opening book in the editor…', 'busy');
    try {
      const res = await fetch('/api/book/editor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open the book');
      bookId = data.bookId;
      seed = data.seed;
      dims = data.dims;
      pages = data.pages || [];
      pageStates = pages.map((p) => (p.state && typeof p.state === 'object' ? p.state : {}));
      el.empty.hidden = true;
      el.main.hidden = false;
      await loadBorderStyles();
      buildPageList();
      computeScale();
      initCanvas();
      selectPage(0);
      setStatus(`Editing “${data.title}” — ${pages.length} pages.`, 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    }
  }

  async function loadBorderStyles() {
    if (el.border.options.length > 1) return;
    try {
      const meta = await (await fetch('/api/meta')).json();
      for (const b of meta.borderStyles || []) {
        const o = document.createElement('option');
        o.value = b.id; o.textContent = b.label;
        el.border.appendChild(o);
      }
    } catch (_) { /* leave default */ }
  }

  function buildPageList() {
    el.pageList.innerHTML = '';
    pages.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'page-item';
      li.textContent = `${i + 1}. ${labelFor(p)}`;
      li.addEventListener('click', () => selectPage(i));
      el.pageList.appendChild(li);
    });
  }
  const labelFor = (p) => ({ bleedguard: 'Blank (bleed guard)', breather: 'Breather' }[p.type] || p.title || p.type);

  function highlightPage() {
    [...el.pageList.children].forEach((li, i) => li.classList.toggle('active', i === cur));
  }

  // --- canvas / stage sizing ---
  function computeScale() {
    const availW = Math.min(window.innerWidth - 520, 900);
    const availH = window.innerHeight - 170;
    scale = Math.min(availW / dims.usableWidth, availH / dims.usableHeight, 1);
    if (!Number.isFinite(scale) || scale <= 0) scale = 0.6;
    const dw = Math.round(dims.usableWidth * scale);
    const dh = Math.round(dims.usableHeight * scale);
    el.stageWrap.style.width = dw + 'px';
    el.stageWrap.style.height = dh + 'px';
    // Background iframe: render at usable px, scaled down to fit.
    el.bg.style.width = dims.usableWidth + 'px';
    el.bg.style.height = dims.usableHeight + 'px';
    el.bg.style.transform = `scale(${scale})`;
    el.bg.style.transformOrigin = 'top left';
  }

  function initCanvas() {
    const dw = Math.round(dims.usableWidth * scale);
    const dh = Math.round(dims.usableHeight * scale);
    canvas = new fabric.Canvas(el.deco, { width: dw, height: dh });
    canvas.setZoom(scale); // object coords stay in usable px; display is scaled
    canvas.on('selection:created', syncSelected);
    canvas.on('selection:updated', syncSelected);
  }

  function syncSelected() {
    const o = canvas.getActiveObject();
    if (!o) return;
    if (o.fontSize) el.fontSize.value = Math.round(o.fontSize);
    if (o.fill && typeof o.fill === 'string' && o.fill[0] === '#') el.objColor.value = o.fill;
  }

  // --- page selection ---
  function saveCurrent() {
    if (cur < 0 || !canvas) return;
    const objs = canvas.getObjects();
    const st = pageStates[cur] || (pageStates[cur] = {});
    if (objs.length) st.canvasState = { fabric: canvas.toJSON(), svg: serializeSvg() };
    else delete st.canvasState;
  }

  async function selectPage(i) {
    if (i === cur) return;
    saveCurrent();
    cur = i;
    highlightPage();
    el.bg.srcdoc = pages[i].html;
    // border select reflects this page's override
    el.border.value = pageStates[i] && pageStates[i].border != null ? pageStates[i].border : '';
    // reset fabric layer and load any saved decorations
    canvas.clear();
    const cs = pageStates[i] && pageStates[i].canvasState;
    if (cs && cs.fabric) {
      canvas.loadFromJSON(cs.fabric, () => { canvas.renderAll(); });
    } else {
      canvas.renderAll();
    }
  }

  // Serialize the decoration layer to an SVG in usable-px coordinates (identity
  // viewport), so it overlays the page's usable area 1:1 at export.
  function serializeSvg() {
    const vt = canvas.viewportTransform;
    const w = canvas.width;
    const h = canvas.height;
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    canvas.setWidth(dims.usableWidth);
    canvas.setHeight(dims.usableHeight);
    const svg = canvas.toSVG();
    canvas.setWidth(w);
    canvas.setHeight(h);
    canvas.viewportTransform = vt;
    canvas.requestRenderAll();
    return svg;
  }

  // --- editing actions ---
  function addText() {
    const t = new fabric.IText('Your text', {
      left: dims.usableWidth / 2, top: dims.usableHeight / 2, originX: 'center', originY: 'center',
      fontSize: Number(el.fontSize.value) || 24, fill: el.objColor.value,
      fontFamily: 'Arial, Helvetica, sans-serif',
    });
    canvas.add(t).setActiveObject(t);
    canvas.requestRenderAll();
  }

  function addImageFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      fabric.Image.fromURL(reader.result, (img) => {
        const max = dims.usableWidth * 0.4;
        if (img.width > max) img.scale(max / img.width);
        img.set({ left: dims.usableWidth / 2, top: dims.usableHeight / 2, originX: 'center', originY: 'center' });
        canvas.add(img).setActiveObject(img);
        canvas.requestRenderAll();
      });
    };
    reader.readAsDataURL(file);
  }

  function applyFont() {
    const o = canvas.getActiveObject();
    if (o && o.set) { o.set('fontSize', Number(el.fontSize.value) || 24); canvas.requestRenderAll(); }
  }
  function applyColor() {
    const o = canvas.getActiveObject();
    if (o && o.set) { o.set('fill', el.objColor.value); canvas.requestRenderAll(); }
  }
  function deleteSelected() {
    const objs = canvas.getActiveObjects();
    objs.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject().requestRenderAll();
  }
  function forward() { const o = canvas.getActiveObject(); if (o) { o.bringForward(); canvas.requestRenderAll(); } }
  function backward() { const o = canvas.getActiveObject(); if (o) { o.sendBackwards(); canvas.requestRenderAll(); } }

  async function setBorder() {
    const v = el.border.value;
    const st = pageStates[cur] || (pageStates[cur] = {});
    if (v === '') delete st.border; else st.border = v;
    // Re-render the background with the override.
    try {
      const res = await fetch('/api/book/page-html', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, index: cur, state: st }),
      });
      const data = await res.json();
      if (res.ok) { pages[cur].html = data.html; el.bg.srcdoc = data.html; }
    } catch (_) { /* leave background */ }
  }

  async function reroll() {
    el.reroll.disabled = true;
    setStatus('Rerolling…', 'busy');
    try {
      const res = await fetch('/api/book/reroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId, index: cur }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reroll failed');
      pages[cur].html = data.html;
      el.bg.srcdoc = data.html;
      setStatus('Rerolled.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.reroll.disabled = false;
    }
  }

  // --- save / export ---
  function buildRecipe() {
    saveCurrent();
    const book = { ...(bookConfig || {}) };
    delete book.seed; delete book.pageState; delete book.puzzleforgeBook;
    return { recipeVersion: 2, kind: 'book', book, seed, pageState: pageStates };
  }

  function save() {
    const recipe = buildRecipe();
    const name = ((bookConfig && bookConfig.title) || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'book';
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' });
    downloadBlob(blob, name + '-book.json');
    setStatus('Recipe saved (with decorations).', 'ok');
  }

  async function exportPdf() {
    saveCurrent();
    setStatus('Rendering PDF with decorations…', 'busy');
    el.exportPdf.disabled = true;
    try {
      const body = bookId ? { bookId, pageState: pageStates } : { config: bookConfig, pageState: pageStates };
      const res = await fetch('/api/book/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Export failed'); }
      const name = ((bookConfig && bookConfig.title) || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'book';
      downloadBlob(await res.blob(), name + '.pdf');
      setStatus('PDF exported.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.exportPdf.disabled = false;
    }
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // --- init ---
  function init() {
    el.addText.addEventListener('click', addText);
    el.addImage.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });
    el.fontSize.addEventListener('input', applyFont);
    el.objColor.addEventListener('input', applyColor);
    el.deleteObj.addEventListener('click', deleteSelected);
    el.forward.addEventListener('click', forward);
    el.backward.addEventListener('click', backward);
    el.border.addEventListener('change', setBorder);
    el.reroll.addEventListener('click', reroll);
    el.save.addEventListener('click', save);
    el.exportPdf.addEventListener('click', exportPdf);
    el.loadRecipe.addEventListener('change', onLoadRecipe);
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && canvas && canvas.getActiveObject() && document.activeElement === document.body) {
        e.preventDefault(); deleteSelected();
      }
    });

    // Hand-off from the Book Builder.
    let handoff = null;
    try {
      const raw = localStorage.getItem('pf_editor');
      if (raw) { handoff = JSON.parse(raw); localStorage.removeItem('pf_editor'); }
    } catch (_) { /* ignore */ }

    if (handoff && (handoff.config || handoff.bookId)) {
      bookConfig = handoff.config || null;
      openBook(handoff.bookId ? { bookId: handoff.bookId, config: handoff.config } : { config: handoff.config });
    } else {
      el.empty.hidden = false;
      setStatus('Open a book from the Book Builder, or load a recipe.', '');
    }
  }

  function onLoadRecipe(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        const v2 = raw && raw.recipeVersion === 2 ? raw : { book: raw, seed: null, pageState: [] };
        bookConfig = { ...(v2.book || {}) };
        if (v2.seed != null) bookConfig.seed = v2.seed;
        if (Array.isArray(v2.pageState) && v2.pageState.length) bookConfig.pageState = v2.pageState;
        openBook({ config: bookConfig });
      } catch (_) {
        setStatus('That file is not a valid book recipe.', 'err');
      }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }

  init();
})();
