/* PuzzleForge — Page Editor. Freeform layout: move/resize the puzzle's pieces
 * (grid, title, instructions, word list) plus text and clip art. Pieces stay as
 * crisp HTML positioned with CSS transforms; export composites them at print
 * resolution through the book pipeline. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = {
    status: $('status'), main: $('editorMain'), empty: $('emptyState'),
    pageList: $('pageList'), stageOuter: $('stageOuter'), stageInner: $('stageInner'),
    addText: $('addText'), addImage: $('addImage'),
    selNone: $('selNone'), selControls: $('selControls'), textProps: $('textProps'), alignField: $('alignField'),
    fontSize: $('fontSize'), objColor: $('objColor'), align: $('align'),
    forward: $('forward'), backward: $('backward'), resetPos: $('resetPos'),
    hideObj: $('hideObj'), deleteObj: $('deleteObj'),
    border: $('border'), reroll: $('reroll'), resetLayout: $('resetLayout'),
    snapToggle: $('snapToggle'),
    save: $('save'), exportPdf: $('exportPdf'), loadRecipe: $('loadRecipe'),
  };

  let bookId = null, bookConfig = null, seed = null;
  let dims = { usableWidth: 636, usableHeight: 816 };
  let pageModels = []; // per page: { style, comps:[...], elements:[...], measured }
  let cur = -1, displayScale = 1, uid = 1;
  let sel = null; // { type:'comp'|'el', ref }

  const setStatus = (t, k) => { el.status.textContent = t || ''; el.status.className = 'status editor-status' + (k ? ' ' + k : ''); };

  // --- scope a puzzle's CSS to the stage so it can't leak into the editor UI ---
  function scopeCss(css, scope) {
    css = css.replace(/@page[^{]*\{[^}]*\}/gi, '');
    let out = '';
    const re = /([^{}]+)\{([^}]*)\}/g; let m;
    while ((m = re.exec(css)) !== null) {
      const decl = m[2].trim(); if (!decl) continue;
      const sels = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
        if (s === '*') return scope + ' *';
        if (s === 'html' || s === 'body') return scope;
        if (/^(html|body)\b/.test(s)) return s.replace(/^(html|body)\b/, scope);
        return scope + ' ' + s;
      });
      out += sels.join(', ') + '{' + decl + '}\n';
    }
    return out;
  }

  // --- model helpers ---
  function buildComps(components) {
    const seen = {};
    return components.map((c) => {
      const n = (seen[c.kind] = (seen[c.kind] || 0) + 1);
      const key = n > 1 ? c.kind + n : c.kind;
      return { kind: c.kind, key, html: c.html, x: 0, y: 0, scale: 1, rot: 0, hidden: false };
    });
  }

  function modelFromPage(p) {
    const comps = buildComps(p.components || []);
    const elements = [];
    let measured = false;
    const saved = p.state && p.state.layout;
    if (saved) {
      const cm = saved.comp || {};
      comps.forEach((c) => {
        const s = cm[c.key];
        if (s) { c.x = num(s.x, 0); c.y = num(s.y, 0); c.scale = num(s.scale, 1); c.rot = num(s.rot, 0); c.hidden = !!s.hidden; }
      });
      (saved.elements || []).forEach((e) => elements.push({ ...e, id: e.id || uid++ }));
      measured = true; // saved positions are authoritative
    }
    return { style: p.style || '', comps, elements, measured };
  }

  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

  // --- open ---
  async function openBook(payload) {
    setStatus('Opening book in the editor…', 'busy');
    try {
      const res = await fetch('/api/book/editor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open the book');
      bookId = data.bookId; seed = data.seed; dims = data.dims;
      pageModels = (data.pages || []).map(modelFromPage);
      el.empty.hidden = true; el.main.hidden = false;
      await loadBorderStyles();
      buildPageList(data.pages);
      computeScale();
      selectPage(0);
      setStatus(`Editing “${data.title}” — ${pageModels.length} pages.`, 'ok');
    } catch (err) { setStatus(err.message, 'err'); }
  }

  async function loadBorderStyles() {
    if (el.border.options.length > 1) return;
    try {
      const meta = await (await fetch('/api/meta')).json();
      for (const b of meta.borderStyles || []) {
        const o = document.createElement('option'); o.value = b.id; o.textContent = b.label; el.border.appendChild(o);
      }
    } catch (_) { /* leave default */ }
  }

  let pageMeta = [];
  function buildPageList(pages) {
    pageMeta = pages;
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
  function highlightPage() { [...el.pageList.children].forEach((li, i) => li.classList.toggle('active', i === cur)); }

  // --- stage sizing ---
  function computeScale() {
    const availW = Math.min(window.innerWidth - 540, 980);
    const availH = window.innerHeight - 220;
    displayScale = Math.min(availW / dims.usableWidth, availH / dims.usableHeight, 1.2);
    if (!Number.isFinite(displayScale) || displayScale <= 0) displayScale = 0.6;
    el.stageInner.style.width = dims.usableWidth + 'px';
    el.stageInner.style.height = dims.usableHeight + 'px';
    el.stageInner.style.transform = `scale(${displayScale})`;
    el.stageOuter.style.width = Math.round(dims.usableWidth * displayScale) + 'px';
    el.stageOuter.style.height = Math.round(dims.usableHeight * displayScale) + 'px';
  }

  // --- render a page ---
  function renderPage() {
    const pm = pageModels[cur];
    el.stageInner.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = scopeCss(pm.style, '#stageInner');
    el.stageInner.appendChild(style);

    pm.comps.forEach((c) => { if (!c.hidden) el.stageInner.appendChild(makeNode('comp', c, c.html)); });
    pm.elements.sort((a, b) => num(a.z, 0) - num(b.z, 0)).forEach((e) => el.stageInner.appendChild(makeNode('el', e, elHtml(e))));

    vGuide = document.createElement('div'); vGuide.className = 'pf-guide pf-guide-v'; vGuide.style.display = 'none';
    hGuide = document.createElement('div'); hGuide.className = 'pf-guide pf-guide-h'; hGuide.style.display = 'none';
    el.stageInner.appendChild(vGuide); el.stageInner.appendChild(hGuide);

    if (!pm.measured) { measureDefaults(pm); pm.measured = true; applyAll(); }
    selectNone();
  }

  // Bounding box of a node in page coordinates (scale applied; transform-origin
  // is top-left so x/y are the box's top-left).
  function bbox(ref) {
    const n = ref._node, s = num(ref.scale, 1);
    const w = n.offsetWidth * s, h = n.offsetHeight * s;
    return { l: ref.x, t: ref.y, r: ref.x + w, b: ref.y + h, cx: ref.x + w / 2, cy: ref.y + h / 2, w, h };
  }
  // Snap target lines: page edges + center, and every other piece's edges + center.
  function snapTargets(exclRef) {
    const xs = [0, dims.usableWidth / 2, dims.usableWidth];
    const ys = [0, dims.usableHeight / 2, dims.usableHeight];
    const all = [...pageModels[cur].comps.filter((c) => !c.hidden), ...pageModels[cur].elements];
    for (const r of all) {
      if (r === exclRef || !r._node) continue;
      const b = bbox(r);
      xs.push(b.l, b.cx, b.r); ys.push(b.t, b.cy, b.b);
    }
    return { xs, ys };
  }
  function showGuide(g, axis, v) {
    g.style.display = '';
    if (axis === 'x') g.style.left = v + 'px';
    else g.style.top = v + 'px';
  }
  function hideGuides() { if (vGuide) vGuide.style.display = 'none'; if (hGuide) hGuide.style.display = 'none'; }

  function elHtml(e) {
    if (e.kind === 'image') return `<img src="${e.src}" style="width:${num(e.width, 160)}px;display:block;pointer-events:none;" alt="">`;
    const color = /^#[0-9a-fA-F]{3,8}$/.test(e.color || '') ? e.color : '#222';
    const fam = e.fontFamily === 'serif' ? 'Georgia, serif' : 'Arial, Helvetica, sans-serif';
    return `<div class="pf-textbox" style="font-size:${num(e.fontSize, 24)}px;color:${color};font-family:${fam};text-align:${e.align || 'left'};width:${num(e.w, 240)}px;white-space:pre-wrap;line-height:1.25;">${escapeHtml(e.text || '')}</div>`;
  }
  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function makeNode(type, ref, html) {
    const node = document.createElement('div');
    node.className = 'pf-node';
    node.dataset.type = type;
    node.innerHTML = html;
    ref._node = node;
    node._ref = ref; node._type = type;
    applyTransform(ref);
    node.addEventListener('pointerdown', (ev) => onPointerDown(ev, type, ref));
    if (type === 'el' && ref.kind === 'text') node.addEventListener('dblclick', () => editText(ref));
    return node;
  }

  function applyTransform(ref) {
    if (!ref._node) return;
    ref._node.style.transform = `translate(${num(ref.x, 0)}px, ${num(ref.y, 0)}px) rotate(${num(ref.rot, 0)}deg) scale(${num(ref.scale, 1)})`;
  }
  function applyAll() { pageModels[cur].comps.forEach(applyTransform); pageModels[cur].elements.forEach(applyTransform); positionSelectBox(); }

  // Default centered/stacked placement so an un-touched page resembles the original.
  function measureDefaults(pm) {
    const order = { title: 0, instructions: 1, grid: 2, wordlist: 3, wordlist2: 4 };
    const sorted = pm.comps.slice().sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
    let y = 0;
    sorted.forEach((c) => {
      const w = c._node.offsetWidth, h = c._node.offsetHeight;
      c.x = Math.max(0, Math.round((dims.usableWidth - w) / 2));
      c.y = Math.round(y);
      y += h + 10;
    });
  }

  // --- selection ---
  let selBox = null, vGuide = null, hGuide = null;
  function selectNone() { sel = null; if (selBox) selBox.remove(); selBox = null; syncControls(); }
  function select(type, ref) {
    sel = { type, ref };
    if (!selBox) { selBox = document.createElement('div'); selBox.className = 'pf-selbox'; }
    el.stageInner.appendChild(selBox);
    const handle = document.createElement('div'); handle.className = 'pf-handle';
    handle.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); startResize(ev, ref); });
    selBox.innerHTML = ''; selBox.appendChild(handle);
    positionSelectBox(); syncControls();
  }
  function positionSelectBox() {
    if (!selBox || !sel || !sel.ref._node) return;
    const n = sel.ref._node;
    selBox.style.transform = `translate(${num(sel.ref.x, 0)}px, ${num(sel.ref.y, 0)}px)`;
    selBox.style.width = n.offsetWidth * num(sel.ref.scale, 1) + 'px';
    selBox.style.height = n.offsetHeight * num(sel.ref.scale, 1) + 'px';
  }

  function syncControls() {
    const has = !!sel;
    el.selNone.classList.toggle('hidden', has);
    el.selControls.classList.toggle('hidden', !has);
    if (!has) return;
    const isText = sel.type === 'el' && sel.ref.kind === 'text';
    el.textProps.style.display = isText ? '' : 'none';
    el.alignField.style.display = isText ? '' : 'none';
    el.hideObj.style.display = sel.type === 'comp' ? '' : 'none';
    el.deleteObj.style.display = sel.type === 'el' ? '' : 'none';
    if (isText) { el.fontSize.value = num(sel.ref.fontSize, 24); el.objColor.value = sel.ref.color || '#222222'; el.align.value = sel.ref.align || 'left'; }
  }

  // --- drag / resize ---
  function stageRect() { return el.stageInner.getBoundingClientRect(); }
  function onPointerDown(ev, type, ref) {
    ev.preventDefault();
    select(type, ref);
    const r = stageRect();
    const startX = ev.clientX, startY = ev.clientY, ox = num(ref.x, 0), oy = num(ref.y, 0);
    const move = (e) => {
      let nx = ox + (e.clientX - startX) / displayScale;
      let ny = oy + (e.clientY - startY) / displayScale;
      if (el.snapToggle.checked) {
        const s = num(ref.scale, 1), w = ref._node.offsetWidth * s, h = ref._node.offsetHeight * s;
        const t = snapTargets(ref), d = 7 / displayScale;
        let bx = null;
        for (const off of [0, w / 2, w]) for (const tx of t.xs) { const dd = tx - (nx + off); if (Math.abs(dd) < d && (!bx || Math.abs(dd) < Math.abs(bx.d))) bx = { d: dd, v: tx }; }
        if (bx) { nx += bx.d; showGuide(vGuide, 'x', bx.v); } else vGuide.style.display = 'none';
        let by = null;
        for (const off of [0, h / 2, h]) for (const ty of t.ys) { const dd = ty - (ny + off); if (Math.abs(dd) < d && (!by || Math.abs(dd) < Math.abs(by.d))) by = { d: dd, v: ty }; }
        if (by) { ny += by.d; showGuide(hGuide, 'y', by.v); } else hGuide.style.display = 'none';
      }
      ref.x = nx; ref.y = ny;
      applyTransform(ref); positionSelectBox();
    };
    const up = () => { hideGuides(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  // Align the selected object to the page (usable area).
  function alignSel(kind) {
    if (!sel) return;
    const ref = sel.ref, s = num(ref.scale, 1);
    const w = ref._node.offsetWidth * s, h = ref._node.offsetHeight * s;
    if (kind === 'left') ref.x = 0;
    else if (kind === 'centerh') ref.x = Math.round((dims.usableWidth - w) / 2);
    else if (kind === 'right') ref.x = dims.usableWidth - w;
    else if (kind === 'top') ref.y = 0;
    else if (kind === 'middle') ref.y = Math.round((dims.usableHeight - h) / 2);
    else if (kind === 'bottom') ref.y = dims.usableHeight - h;
    applyTransform(ref); positionSelectBox();
  }
  function nudge(dx, dy) {
    if (!sel) return;
    sel.ref.x = num(sel.ref.x, 0) + dx; sel.ref.y = num(sel.ref.y, 0) + dy;
    applyTransform(sel.ref); positionSelectBox();
  }
  function startResize(ev, ref) {
    ev.preventDefault();
    const naturalH = ref._node.offsetHeight || 1;
    const r = stageRect();
    const move = (e) => {
      const pageY = (e.clientY - r.top) / displayScale;
      ref.scale = Math.max(0.15, Math.min(8, (pageY - num(ref.y, 0)) / naturalH));
      applyTransform(ref); positionSelectBox();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  // --- page switching ---
  function selectPage(i) {
    if (i === cur) return;
    cur = i; highlightPage();
    const st = pageMeta[i] && pageMeta[i].state;
    el.border.value = st && st.layout == null && st.border != null ? st.border : (pageModels[i]._border || '');
    renderPage();
  }

  // --- actions ---
  function addText() {
    const e = { id: uid++, kind: 'text', x: dims.usableWidth / 2 - 100, y: dims.usableHeight / 2, scale: 1, rot: 0, z: 100, text: 'Your text', fontSize: 28, color: '#222222', align: 'left', w: 240 };
    pageModels[cur].elements.push(e);
    el.stageInner.appendChild(makeNode('el', e, elHtml(e)));
    select('el', e);
  }
  function addImageFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const e = { id: uid++, kind: 'image', x: dims.usableWidth / 2 - 80, y: dims.usableHeight / 2 - 80, scale: 1, rot: 0, z: 100, src: reader.result, width: 160 };
      pageModels[cur].elements.push(e);
      el.stageInner.appendChild(makeNode('el', e, elHtml(e)));
      select('el', e);
    };
    reader.readAsDataURL(file);
  }
  function editText(ref) {
    const box = ref._node.querySelector('.pf-textbox');
    box.setAttribute('contenteditable', 'true');
    box.focus();
    const done = () => {
      box.removeAttribute('contenteditable');
      ref.text = box.innerText;
      box.removeEventListener('blur', done);
    };
    box.addEventListener('blur', done);
  }
  function applyTextProp(prop, val) {
    if (!sel || sel.ref.kind !== 'text') return;
    sel.ref[prop] = val;
    sel.ref._node.innerHTML = elHtml(sel.ref);
    positionSelectBox();
  }
  function deleteSel() {
    if (!sel || sel.type !== 'el') return;
    const arr = pageModels[cur].elements;
    const i = arr.indexOf(sel.ref); if (i >= 0) arr.splice(i, 1);
    sel.ref._node.remove(); selectNone();
  }
  function hideComp() {
    if (!sel || sel.type !== 'comp') return;
    sel.ref.hidden = true; sel.ref._node.remove(); selectNone();
  }
  function bumpZ(dir) {
    if (!sel || sel.type !== 'el') return;
    sel.ref.z = num(sel.ref.z, 100) + dir * 10;
    renderPage(); // re-sort
    select('el', sel.ref);
  }
  function resetSize() { if (sel) { sel.ref.scale = 1; sel.ref.rot = 0; applyTransform(sel.ref); positionSelectBox(); } }
  function resetLayout() {
    const pm = pageModels[cur];
    pm.comps.forEach((c) => { c.hidden = false; c.scale = 1; c.rot = 0; });
    pm.elements = [];
    pm.measured = false;
    renderPage();
  }

  function setBorder() {
    pageModels[cur]._border = el.border.value;
  }

  async function reroll() {
    el.reroll.disabled = true; setStatus('Rerolling…', 'busy');
    try {
      const res = await fetch('/api/book/reroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId, index: cur }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reroll failed');
      const pm = pageModels[cur];
      const fresh = buildComps(data.components || []);
      // keep existing positions by key; replace html
      const byKey = {}; pm.comps.forEach((c) => (byKey[c.key] = c));
      pm.style = data.style || pm.style;
      pm.comps = fresh.map((f) => { const old = byKey[f.key]; return old ? { ...f, x: old.x, y: old.y, scale: old.scale, rot: old.rot, hidden: old.hidden } : f; });
      pm.measured = pm.comps.every((c) => byKey[c.key]); // if any new kind, re-measure
      renderPage();
      setStatus('Rerolled.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); }
    finally { el.reroll.disabled = false; }
  }

  // --- serialize / save / export ---
  function pageState(i) {
    const pm = pageModels[i];
    const comp = {};
    pm.comps.forEach((c) => { comp[c.key] = { x: Math.round(c.x), y: Math.round(c.y), scale: round2(c.scale), rot: round2(c.rot), hidden: c.hidden }; });
    const elements = pm.elements.map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), scale: round2(e.scale), rot: round2(e.rot), z: e.z, text: e.text, fontSize: e.fontSize, color: e.color, align: e.align, w: e.w, src: e.src, width: e.width }));
    const st = { layout: { comp, elements } };
    if (pm._border) st.border = pm._border;
    return st;
  }
  const round2 = (n) => Math.round(num(n, 0) * 100) / 100;
  function allPageState() { return pageModels.map((_, i) => pageState(i)); }

  function buildRecipe() {
    const book = { ...(bookConfig || {}) };
    delete book.seed; delete book.pageState; delete book.puzzleforgeBook;
    return { recipeVersion: 2, kind: 'book', book, seed, pageState: allPageState() };
  }
  function save() {
    const name = slug((bookConfig && bookConfig.title) || 'book');
    downloadBlob(new Blob([JSON.stringify(buildRecipe(), null, 2)], { type: 'application/json' }), name + '-book.json');
    setStatus('Recipe saved (with layout).', 'ok');
  }
  async function exportPdf() {
    setStatus('Rendering PDF…', 'busy'); el.exportPdf.disabled = true;
    try {
      const body = bookId ? { bookId, pageState: allPageState() } : { config: bookConfig, pageState: allPageState() };
      const res = await fetch('/api/book/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Export failed'); }
      downloadBlob(await res.blob(), slug((bookConfig && bookConfig.title) || 'book') + '.pdf');
      setStatus('PDF exported.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); }
    finally { el.exportPdf.disabled = false; }
  }
  const slug = (s) => (s || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'book';
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // --- init ---
  function init() {
    el.addText.addEventListener('click', addText);
    el.addImage.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });
    el.fontSize.addEventListener('input', () => applyTextProp('fontSize', Number(el.fontSize.value) || 24));
    el.objColor.addEventListener('input', () => applyTextProp('color', el.objColor.value));
    el.align.addEventListener('change', () => applyTextProp('align', el.align.value));
    el.forward.addEventListener('click', () => bumpZ(1));
    el.backward.addEventListener('click', () => bumpZ(-1));
    el.resetPos.addEventListener('click', resetSize);
    el.hideObj.addEventListener('click', hideComp);
    el.deleteObj.addEventListener('click', deleteSel);
    el.border.addEventListener('change', setBorder);
    el.reroll.addEventListener('click', reroll);
    el.resetLayout.addEventListener('click', resetLayout);
    el.save.addEventListener('click', save);
    el.exportPdf.addEventListener('click', exportPdf);
    el.loadRecipe.addEventListener('change', onLoadRecipe);
    document.querySelectorAll('.align-grid .iconbtn').forEach((b) => b.addEventListener('click', () => alignSel(b.dataset.align)));
    el.stageInner.addEventListener('pointerdown', (e) => { if (e.target === el.stageInner) selectNone(); });
    window.addEventListener('resize', () => { computeScale(); positionSelectBox(); });
    window.addEventListener('keydown', (e) => {
      if (!sel || el.main.hidden) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|SELECT|TEXTAREA/.test(tag) || (document.activeElement && document.activeElement.isContentEditable)) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { nudge(-step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { nudge(step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { nudge(0, -step); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { nudge(0, step); e.preventDefault(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel.type === 'el') { deleteSel(); e.preventDefault(); }
    });

    let handoff = null;
    try { const raw = localStorage.getItem('pf_editor'); if (raw) { handoff = JSON.parse(raw); localStorage.removeItem('pf_editor'); } } catch (_) { /* ignore */ }
    if (handoff && (handoff.config || handoff.bookId)) {
      bookConfig = handoff.config || null;
      openBook(handoff.bookId ? { bookId: handoff.bookId, config: handoff.config } : { config: handoff.config });
    } else { el.empty.hidden = false; setStatus('Open a book from the Book Builder, or load a recipe.', ''); }
  }
  function onLoadRecipe(ev) {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        const v2 = raw && raw.recipeVersion === 2 ? raw : { book: raw, seed: null, pageState: [] };
        bookConfig = { ...(v2.book || {}) };
        if (v2.seed != null) bookConfig.seed = v2.seed;
        if (Array.isArray(v2.pageState) && v2.pageState.length) bookConfig.pageState = v2.pageState;
        openBook({ config: bookConfig });
      } catch (_) { setStatus('That file is not a valid book recipe.', 'err'); }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }

  init();
})();
