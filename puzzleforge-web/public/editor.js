/* PuzzleForge — Page Editor (v3). Desktop-publishing style freeform editor:
 * move/resize/rotate the puzzle's pieces (grid, title, instructions, word list)
 * plus text and clip art, with undo/redo, zoom + rulers, alignment + snapping,
 * multi-select, distribute, arrange, duplicate, flip, lock, and grid snapping.
 * Pieces stay crisp HTML (CSS transforms); export composites at print res. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PX_PER_IN = 96, GRID = 24;
  const el = {
    status: $('status'), main: $('editorMain'), empty: $('emptyState'),
    pageList: $('pageList'),
    stageScroll: $('stageScroll'), stageOuter: $('stageOuter'), stageInner: $('stageInner'),
    rulerTop: $('rulerTop'), rulerLeft: $('rulerLeft'),
    undo: $('undo'), redo: $('redo'), zoomOut: $('zoomOut'), zoomIn: $('zoomIn'), zoomFit: $('zoomFit'), zoomLabel: $('zoomLabel'),
    addText: $('addText'), addImage: $('addImage'),
    selNone: $('selNone'), selControls: $('selControls'), measurePanel: $('measurePanel'),
    mX: $('mX'), mY: $('mY'), mScale: $('mScale'), mRot: $('mRot'),
    textProps: $('textProps'), alignField: $('alignField'), fontSize: $('fontSize'), objColor: $('objColor'), align: $('align'),
    distH: $('distH'), distV: $('distV'),
    toFront: $('toFront'), forward: $('forward'), backward: $('backward'), toBack: $('toBack'),
    flipH: $('flipH'), flipV: $('flipV'), lockObj: $('lockObj'),
    dupObj: $('dupObj'), resetPos: $('resetPos'), hideObj: $('hideObj'), deleteObj: $('deleteObj'),
    border: $('border'), snapToggle: $('snapToggle'), gridToggle: $('gridToggle'),
    reroll: $('reroll'), resetLayout: $('resetLayout'),
    save: $('save'), exportPdf: $('exportPdf'), loadRecipe: $('loadRecipe'),
  };

  let bookId = null, bookConfig = null, seed = null, dims = { usableWidth: 636, usableHeight: 816 };
  let pageModels = [], pageMeta = [], cur = -1, uid = 1, zoom = 1;
  let sels = [];          // selected refs on the current page
  let clipboard = [];     // copied element snapshots
  let vGuide = null, hGuide = null, gridEl = null, selLayer = null;
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const setStatus = (t, k) => { el.status.textContent = t || ''; el.status.className = 'status editor-status' + (k ? ' ' + k : ''); };
  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const slug = (s) => (s || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'book';

  // --- scope a puzzle's CSS to the stage ---
  function scopeCss(css, scope) {
    css = css.replace(/@page[^{]*\{[^}]*\}/gi, '');
    let out = ''; const re = /([^{}]+)\{([^}]*)\}/g; let m;
    while ((m = re.exec(css)) !== null) {
      const decl = m[2].trim(); if (!decl) continue;
      const sels = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) =>
        s === '*' ? scope + ' *' : (s === 'html' || s === 'body') ? scope : /^(html|body)\b/.test(s) ? s.replace(/^(html|body)\b/, scope) : scope + ' ' + s);
      out += sels.join(', ') + '{' + decl + '}\n';
    }
    return out;
  }

  // --- model ---
  function buildComps(components) {
    const seen = {};
    return components.map((c) => {
      const n = (seen[c.kind] = (seen[c.kind] || 0) + 1);
      const key = n > 1 ? c.kind + n : c.kind;
      return { kind: c.kind, key, html: c.html, x: 0, y: 0, scale: 1, rot: 0, hidden: false, locked: false };
    });
  }
  function modelFromPage(p) {
    const comps = buildComps(p.components || []);
    const elements = [];
    let measured = false;
    const saved = p.state && p.state.layout;
    if (saved) {
      const cm = saved.comp || {};
      comps.forEach((c) => { const s = cm[c.key]; if (s) Object.assign(c, { x: num(s.x, 0), y: num(s.y, 0), scale: num(s.scale, 1), rot: num(s.rot, 0), hidden: !!s.hidden, locked: !!s.locked }); });
      (saved.elements || []).forEach((e) => elements.push({ ...e, id: e.id || uid++ }));
      measured = true;
    }
    return { style: p.style || '', comps, elements, measured, _border: (saved && p.state.border) || '', undo: [], redo: [] };
  }

  // --- open ---
  async function openBook(payload) {
    setStatus('Opening book in the editor…', 'busy');
    try {
      const res = await fetch('/api/book/editor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open the book');
      bookId = data.bookId; seed = data.seed; dims = data.dims;
      pageModels = (data.pages || []).map(modelFromPage); pageMeta = data.pages || [];
      el.empty.hidden = true; el.main.hidden = false;
      await loadBorderStyles(); buildPageList();
      cur = 0; zoom = fitScale(); renderPage();
      setStatus(`Editing “${data.title}” — ${pageModels.length} pages.`, 'ok');
    } catch (err) { setStatus(err.message, 'err'); }
  }
  async function loadBorderStyles() {
    if (el.border.options.length > 1) return;
    try {
      const meta = await (await fetch('/api/meta')).json();
      for (const b of meta.borderStyles || []) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.label; el.border.appendChild(o); }
    } catch (_) { /* leave default */ }
  }
  function buildPageList() {
    el.pageList.innerHTML = '';
    pageMeta.forEach((p, i) => {
      const li = document.createElement('li'); li.className = 'page-item';
      li.textContent = `${i + 1}. ${labelFor(p)}`;
      li.addEventListener('click', () => selectPage(i)); el.pageList.appendChild(li);
    });
  }
  const labelFor = (p) => ({ bleedguard: 'Blank (bleed guard)', breather: 'Breather' }[p.type] || p.title || p.type);
  function highlightPage() { [...el.pageList.children].forEach((li, i) => li.classList.toggle('active', i === cur)); }

  // --- zoom + rulers ---
  function fitScale() {
    const availW = (el.stageScroll.clientWidth || 700) - 24, availH = (window.innerHeight - 200);
    return Math.max(0.15, Math.min(availW / dims.usableWidth, availH / dims.usableHeight, 1.5));
  }
  function applyZoom() {
    el.stageInner.style.width = dims.usableWidth + 'px';
    el.stageInner.style.height = dims.usableHeight + 'px';
    el.stageInner.style.transform = `scale(${zoom})`;
    el.stageOuter.style.width = Math.round(dims.usableWidth * zoom) + 'px';
    el.stageOuter.style.height = Math.round(dims.usableHeight * zoom) + 'px';
    el.zoomLabel.textContent = Math.round(zoom * 100) + '%';
    const inch = PX_PER_IN * zoom;
    el.rulerTop.style.background = `repeating-linear-gradient(90deg,#b6bccb 0 1px,transparent 1px ${inch / 4}px),repeating-linear-gradient(90deg,#7a8194 0 1px,transparent 1px ${inch}px)`;
    el.rulerLeft.style.background = `repeating-linear-gradient(0deg,#b6bccb 0 1px,transparent 1px ${inch / 4}px),repeating-linear-gradient(0deg,#7a8194 0 1px,transparent 1px ${inch}px)`;
    syncRulers();
  }
  function syncRulers() {
    el.rulerTop.style.backgroundPositionX = (-el.stageScroll.scrollLeft) + 'px';
    el.rulerLeft.style.backgroundPositionY = (-el.stageScroll.scrollTop) + 'px';
  }
  const setZoom = (z) => { zoom = Math.max(0.15, Math.min(4, z)); applyZoom(); positionSel(); };

  // --- render a page ---
  function renderPage() {
    const pm = pageModels[cur];
    highlightPage();
    el.stageInner.innerHTML = '';
    const style = document.createElement('style'); style.textContent = scopeCss(pm.style, '#stageInner'); el.stageInner.appendChild(style);
    gridEl = document.createElement('div'); gridEl.className = 'pf-grid-overlay'; gridEl.style.display = el.gridToggle.checked ? '' : 'none'; el.stageInner.appendChild(gridEl);

    pm.comps.forEach((c) => { if (!c.hidden) el.stageInner.appendChild(makeNode('comp', c, c.html)); });
    pm.elements.sort((a, b) => num(a.z, 0) - num(b.z, 0)).forEach((e) => el.stageInner.appendChild(makeNode('el', e, elHtml(e))));

    vGuide = document.createElement('div'); vGuide.className = 'pf-guide pf-guide-v'; vGuide.style.display = 'none';
    hGuide = document.createElement('div'); hGuide.className = 'pf-guide pf-guide-h'; hGuide.style.display = 'none';
    selLayer = document.createElement('div'); selLayer.className = 'pf-sel-layer';
    el.stageInner.appendChild(vGuide); el.stageInner.appendChild(hGuide); el.stageInner.appendChild(selLayer);

    if (!pm.measured) { measureDefaults(pm); pm.measured = true; applyAll(); }
    el.border.value = pm._border || '';
    applyZoom();
    sels = []; syncSelUI(); drawSel();
  }
  function elHtml(e) {
    if (e.kind === 'image') {
      const fx = `scale(${e.flipH ? -1 : 1},${e.flipV ? -1 : 1})`;
      return `<img src="${e.src}" style="width:${num(e.width, 160)}px;display:block;transform:${fx};pointer-events:none;" alt="">`;
    }
    const color = /^#[0-9a-fA-F]{3,8}$/.test(e.color || '') ? e.color : '#222';
    const fam = e.fontFamily === 'serif' ? 'Georgia, serif' : 'Arial, Helvetica, sans-serif';
    return `<div class="pf-textbox" style="font-size:${num(e.fontSize, 24)}px;color:${color};font-family:${fam};text-align:${e.align || 'left'};width:${num(e.w, 240)}px;white-space:pre-wrap;line-height:1.25;">${escapeHtml(e.text || '')}</div>`;
  }
  function makeNode(type, ref, html) {
    const node = document.createElement('div'); node.className = 'pf-node'; node.dataset.type = type;
    node.innerHTML = html; ref._node = node; node._ref = ref; node._type = type;
    applyTransform(ref);
    node.addEventListener('pointerdown', (ev) => onPointerDown(ev, type, ref));
    if (type === 'el' && ref.kind === 'text') node.addEventListener('dblclick', () => editText(ref));
    return node;
  }
  function applyTransform(ref) {
    if (ref._node) ref._node.style.transform = `translate(${num(ref.x, 0)}px,${num(ref.y, 0)}px) rotate(${num(ref.rot, 0)}deg) scale(${num(ref.scale, 1)})`;
  }
  function allRefs() { return [...pageModels[cur].comps.filter((c) => !c.hidden), ...pageModels[cur].elements]; }
  function applyAll() { allRefs().forEach(applyTransform); }
  function measureDefaults(pm) {
    const order = { title: 0, instructions: 1, grid: 2, wordlist: 3, wordlist2: 4 };
    const sorted = pm.comps.slice().sort((a, b) => (order[a.key] ?? 9) - (order[b.key] ?? 9));
    let y = 0;
    sorted.forEach((c) => { const w = c._node.offsetWidth, h = c._node.offsetHeight; c.x = Math.max(0, Math.round((dims.usableWidth - w) / 2)); c.y = Math.round(y); y += h + 10; });
  }

  // --- geometry ---
  function bbox(ref) { const n = ref._node, s = num(ref.scale, 1); const w = n.offsetWidth * s, h = n.offsetHeight * s; return { l: ref.x, t: ref.y, r: ref.x + w, b: ref.y + h, cx: ref.x + w / 2, cy: ref.y + h / 2, w, h }; }

  // --- history ---
  function snapshot(pm) {
    return JSON.stringify({
      comps: pm.comps.map((c) => ({ key: c.key, x: c.x, y: c.y, scale: c.scale, rot: c.rot, hidden: c.hidden, locked: c.locked })),
      elements: pm.elements.map((e) => { const { _node, ...r } = e; return r; }),
    });
  }
  function pushUndo() { const pm = pageModels[cur]; pm.undo.push(snapshot(pm)); if (pm.undo.length > 60) pm.undo.shift(); pm.redo = []; }
  function applySnap(pm, snap) {
    const s = JSON.parse(snap); const byKey = {}; pm.comps.forEach((c) => (byKey[c.key] = c));
    s.comps.forEach((sc) => { const c = byKey[sc.key]; if (c) Object.assign(c, sc); });
    pm.elements = s.elements.map((e) => ({ ...e }));
  }
  function undo() { const pm = pageModels[cur]; if (!pm.undo.length) return; pm.redo.push(snapshot(pm)); applySnap(pm, pm.undo.pop()); renderPage(); }
  function redo() { const pm = pageModels[cur]; if (!pm.redo.length) return; pm.undo.push(snapshot(pm)); applySnap(pm, pm.redo.pop()); renderPage(); }

  // --- selection ---
  function isSel(ref) { return sels.indexOf(ref) >= 0; }
  function setSel(arr) { sels = arr.slice(); syncSelUI(); drawSel(); }
  function toggleSel(ref) { const i = sels.indexOf(ref); if (i >= 0) sels.splice(i, 1); else sels.push(ref); syncSelUI(); drawSel(); }
  const primary = () => sels[sels.length - 1];

  function drawSel() {
    if (!selLayer) return;
    selLayer.innerHTML = '';
    sels.forEach((ref, i) => {
      if (!ref._node) return;
      const b = bbox(ref);
      const box = document.createElement('div'); box.className = 'pf-selbox';
      box.style.transform = `translate(${ref.x}px,${ref.y}px)`; box.style.width = b.w + 'px'; box.style.height = b.h + 'px';
      if (sels.length === 1) {
        const handle = document.createElement('div'); handle.className = 'pf-handle';
        handle.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); startResize(ev, ref); });
        box.appendChild(handle);
      }
      selLayer.appendChild(box);
    });
  }
  function positionSel() { drawSel(); }

  function syncSelUI() {
    const has = sels.length > 0;
    el.selNone.classList.toggle('hidden', has);
    el.selControls.classList.toggle('hidden', !has);
    if (!has) return;
    const one = sels.length === 1 ? sels[0] : null;
    const isText = one && one.kind === 'text';
    const isImg = one && one.kind === 'image';
    const isEl = one && (one.kind === 'text' || one.kind === 'image');
    el.measurePanel.style.display = one ? '' : 'none';
    el.textProps.style.display = isText ? '' : 'none';
    el.alignField.style.display = isText ? '' : 'none';
    el.flipH.style.display = isImg ? '' : 'none';
    el.flipV.style.display = isImg ? '' : 'none';
    el.dupObj.style.display = isEl ? '' : 'none';
    el.deleteObj.style.display = isEl ? '' : 'none';
    el.hideObj.style.display = one && !isEl ? '' : 'none';
    el.distH.style.display = sels.length >= 3 ? '' : 'none';
    el.distV.style.display = sels.length >= 3 ? '' : 'none';
    el.lockObj.textContent = one && one.locked ? 'Unlock' : 'Lock';
    if (one) {
      el.mX.value = Math.round(one.x); el.mY.value = Math.round(one.y);
      el.mScale.value = Math.round(num(one.scale, 1) * 100); el.mRot.value = Math.round(num(one.rot, 0));
      if (isText) { el.fontSize.value = num(one.fontSize, 24); el.objColor.value = one.color || '#222222'; el.align.value = one.align || 'left'; }
    }
  }

  // --- snap targets ---
  function snapTargets(excl) {
    const xs = [0, dims.usableWidth / 2, dims.usableWidth], ys = [0, dims.usableHeight / 2, dims.usableHeight];
    for (const r of allRefs()) { if (excl.indexOf(r) >= 0 || !r._node) continue; const b = bbox(r); xs.push(b.l, b.cx, b.r); ys.push(b.t, b.cy, b.b); }
    return { xs, ys };
  }
  const showGuide = (g, axis, v) => { g.style.display = ''; if (axis === 'x') g.style.left = v + 'px'; else g.style.top = v + 'px'; };
  const hideGuides = () => { if (vGuide) vGuide.style.display = 'none'; if (hGuide) hGuide.style.display = 'none'; };

  // --- drag / resize ---
  function onPointerDown(ev, type, ref) {
    ev.preventDefault();
    if (ref.locked) { setSel([ref]); return; }
    if (ev.shiftKey) { if (!isSel(ref)) sels.push(ref); }
    else if (!isSel(ref)) sels = [ref];
    syncSelUI(); drawSel();

    const group = sels.slice();
    const starts = group.map((r) => ({ r, x: num(r.x, 0), y: num(r.y, 0) }));
    const sx = ev.clientX, sy = ev.clientY;
    let moved = false, pushed = false;
    const move = (e) => {
      let dx = (e.clientX - sx) / zoom, dy = (e.clientY - sy) / zoom;
      if (!moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) { moved = true; if (!pushed) { pushUndo(); pushed = true; } }
      // snap using the primary ref's box
      const p = starts.find((s) => s.r === primary()) || starts[0];
      let nx = p.x + dx, ny = p.y + dy;
      if (el.gridToggle.checked) { nx = Math.round(nx / GRID) * GRID; ny = Math.round(ny / GRID) * GRID; dx = nx - p.x; dy = ny - p.y; }
      if (el.snapToggle.checked) {
        const s = num(p.r.scale, 1), w = p.r._node.offsetWidth * s, h = p.r._node.offsetHeight * s;
        const t = snapTargets(group), d = 7 / zoom;
        let bx = null; for (const off of [0, w / 2, w]) for (const tx of t.xs) { const dd = tx - (nx + off); if (Math.abs(dd) < d && (!bx || Math.abs(dd) < Math.abs(bx.d))) bx = { d: dd, v: tx }; }
        if (bx) { dx += bx.d; showGuide(vGuide, 'x', bx.v); } else vGuide.style.display = 'none';
        let by = null; for (const off of [0, h / 2, h]) for (const ty of t.ys) { const dd = ty - (ny + off); if (Math.abs(dd) < d && (!by || Math.abs(dd) < Math.abs(by.d))) by = { d: dd, v: ty }; }
        if (by) { dy += by.d; showGuide(hGuide, 'y', by.v); } else hGuide.style.display = 'none';
      }
      starts.forEach((s) => { s.r.x = s.x + dx; s.r.y = s.y + dy; applyTransform(s.r); });
      drawSel();
    };
    const up = () => { hideGuides(); if (sels.length === 1) syncSelUI(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function startResize(ev, ref) {
    ev.preventDefault(); pushUndo();
    const naturalH = ref._node.offsetHeight || 1; const r = el.stageInner.getBoundingClientRect();
    const move = (e) => { const pageY = (e.clientY - r.top) / zoom; ref.scale = Math.max(0.15, Math.min(8, (pageY - num(ref.y, 0)) / naturalH)); applyTransform(ref); drawSel(); syncSelUI(); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  // --- align / distribute ---
  function alignSel(kind) {
    if (!sels.length) return; pushUndo();
    const horiz = ['left', 'centerh', 'right'].includes(kind);
    let lo, hi;
    if (sels.length >= 2) {
      const boxes = sels.map(bbox);
      lo = Math.min(...boxes.map((b) => (horiz ? b.l : b.t)));
      hi = Math.max(...boxes.map((b) => (horiz ? b.r : b.b)));
    } else { lo = 0; hi = horiz ? dims.usableWidth : dims.usableHeight; }
    const mid = (lo + hi) / 2;
    sels.forEach((ref) => {
      const b = bbox(ref);
      if (kind === 'left') ref.x = lo;
      else if (kind === 'right') ref.x = hi - b.w;
      else if (kind === 'centerh') ref.x = Math.round(mid - b.w / 2);
      else if (kind === 'top') ref.y = lo;
      else if (kind === 'bottom') ref.y = hi - b.h;
      else if (kind === 'middle') ref.y = Math.round(mid - b.h / 2);
      applyTransform(ref);
    });
    drawSel(); syncSelUI();
  }
  function distribute(axis) {
    if (sels.length < 3) return; pushUndo();
    const items = sels.map((r) => ({ r, b: bbox(r) })).sort((a, b) => (axis === 'x' ? a.b.cx - b.b.cx : a.b.cy - b.b.cy));
    const first = items[0].b, last = items[items.length - 1].b;
    const lo = axis === 'x' ? first.cx : first.cy, hi = axis === 'x' ? last.cx : last.cy;
    const step = (hi - lo) / (items.length - 1);
    items.forEach((it, i) => { const target = lo + step * i; if (axis === 'x') it.r.x = Math.round(target - it.b.w / 2); else it.r.y = Math.round(target - it.b.h / 2); applyTransform(it.r); });
    drawSel();
  }

  // --- arrange ---
  function reorder(kind) {
    const one = sels.length === 1 && sels[0]; if (!one || one.kind == null) return; // elements only have z; comps fixed
    pushUndo();
    const arr = pageModels[cur].elements; if (arr.indexOf(one) < 0) return;
    const zs = arr.map((e) => num(e.z, 100));
    if (kind === 'front') one.z = Math.max(...zs) + 10;
    else if (kind === 'back') one.z = Math.min(...zs) - 10;
    else if (kind === 'forward') one.z = num(one.z, 100) + 15;
    else if (kind === 'backward') one.z = num(one.z, 100) - 15;
    renderPage(); setSel([one]);
  }
  function flip(axis) { const o = sels.length === 1 && sels[0]; if (!o || o.kind !== 'image') return; pushUndo(); if (axis === 'h') o.flipH = !o.flipH; else o.flipV = !o.flipV; o._node.innerHTML = elHtml(o); }
  function toggleLock() { const o = sels.length === 1 && sels[0]; if (!o) return; pushUndo(); o.locked = !o.locked; syncSelUI(); }

  // --- add / edit / duplicate / delete ---
  function addText() {
    pushUndo();
    const e = { id: uid++, kind: 'text', x: Math.round(dims.usableWidth / 2 - 100), y: Math.round(dims.usableHeight / 2), scale: 1, rot: 0, z: 100, text: 'Your text', fontSize: 28, color: '#222222', align: 'left', w: 240 };
    pageModels[cur].elements.push(e); el.stageInner.insertBefore(makeNode('el', e, elHtml(e)), selLayer); setSel([e]);
  }
  function addImageFile(file) {
    const reader = new FileReader();
    reader.onload = () => { pushUndo(); const e = { id: uid++, kind: 'image', x: Math.round(dims.usableWidth / 2 - 80), y: Math.round(dims.usableHeight / 2 - 80), scale: 1, rot: 0, z: 100, src: reader.result, width: 160 }; pageModels[cur].elements.push(e); el.stageInner.insertBefore(makeNode('el', e, elHtml(e)), selLayer); setSel([e]); };
    reader.readAsDataURL(file);
  }
  function editText(ref) {
    const box = ref._node.querySelector('.pf-textbox'); box.setAttribute('contenteditable', 'true'); box.focus();
    pushUndo();
    const done = () => { box.removeAttribute('contenteditable'); ref.text = box.innerText; box.removeEventListener('blur', done); };
    box.addEventListener('blur', done);
  }
  function applyTextProp(prop, val) { const o = sels.length === 1 && sels[0]; if (!o || o.kind !== 'text') return; o[prop] = val; o._node.innerHTML = elHtml(o); drawSel(); }
  function duplicate() {
    const o = sels.length === 1 && sels[0]; if (!o || o.kind == null || !(o.kind === 'text' || o.kind === 'image')) return;
    pushUndo(); const { _node, ...copy } = o; copy.id = uid++; copy.x = num(o.x, 0) + 16; copy.y = num(o.y, 0) + 16; copy.z = num(o.z, 100) + 1;
    pageModels[cur].elements.push(copy); el.stageInner.insertBefore(makeNode('el', copy, elHtml(copy)), selLayer); setSel([copy]);
  }
  function copySel() { clipboard = sels.filter((r) => r.kind === 'text' || r.kind === 'image').map((r) => { const { _node, ...c } = r; return c; }); }
  function paste() {
    if (!clipboard.length) return; pushUndo(); const made = [];
    clipboard.forEach((c) => { const copy = { ...c, id: uid++, x: num(c.x, 0) + 16, y: num(c.y, 0) + 16, z: num(c.z, 100) + 1 }; pageModels[cur].elements.push(copy); el.stageInner.insertBefore(makeNode('el', copy, elHtml(copy)), selLayer); made.push(copy); });
    setSel(made);
  }
  function deleteSel() {
    const els = sels.filter((r) => r.kind === 'text' || r.kind === 'image'); if (!els.length) return; pushUndo();
    const arr = pageModels[cur].elements; els.forEach((r) => { const i = arr.indexOf(r); if (i >= 0) arr.splice(i, 1); if (r._node) r._node.remove(); });
    setSel([]);
  }
  function hideComp() { const o = sels.length === 1 && sels[0]; if (!o || o.kind != null) return; pushUndo(); o.hidden = true; o._node.remove(); setSel([]); }
  function resetSize() { if (!sels.length) return; pushUndo(); sels.forEach((r) => { r.scale = 1; r.rot = 0; applyTransform(r); }); drawSel(); syncSelUI(); }
  function nudge(dx, dy) { if (!sels.length) return; sels.forEach((r) => { if (!r.locked) { r.x = num(r.x, 0) + dx; r.y = num(r.y, 0) + dy; applyTransform(r); } }); drawSel(); syncSelUI(); }
  function setMeasure(prop, val) { const o = sels.length === 1 && sels[0]; if (!o) return; pushUndo(); o[prop] = val; applyTransform(o); drawSel(); }

  function resetLayout() { pushUndo(); const pm = pageModels[cur]; pm.comps.forEach((c) => { c.hidden = false; c.scale = 1; c.rot = 0; c.locked = false; }); pm.elements = []; pm.measured = false; renderPage(); }
  function setBorder() { pageModels[cur]._border = el.border.value; }
  async function reroll() {
    el.reroll.disabled = true; setStatus('Rerolling…', 'busy');
    try {
      const res = await fetch('/api/book/reroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId, index: cur }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Reroll failed');
      const pm = pageModels[cur]; const fresh = buildComps(data.components || []); const byKey = {}; pm.comps.forEach((c) => (byKey[c.key] = c));
      pm.style = data.style || pm.style;
      pm.comps = fresh.map((f) => { const old = byKey[f.key]; return old ? { ...f, x: old.x, y: old.y, scale: old.scale, rot: old.rot, hidden: old.hidden, locked: old.locked } : f; });
      pm.measured = pm.comps.every((c) => byKey[c.key]); renderPage(); setStatus('Rerolled.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); } finally { el.reroll.disabled = false; }
  }

  // --- page switch ---
  function selectPage(i) { if (i === cur) return; cur = i; renderPage(); }

  // --- serialize / save / export ---
  function pageState(i) {
    const pm = pageModels[i]; const comp = {};
    pm.comps.forEach((c) => { comp[c.key] = { x: Math.round(c.x), y: Math.round(c.y), scale: round2(c.scale), rot: round2(c.rot), hidden: c.hidden, locked: c.locked }; });
    const elements = pm.elements.map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), scale: round2(e.scale), rot: round2(e.rot), z: e.z, text: e.text, fontSize: e.fontSize, color: e.color, align: e.align, w: e.w, src: e.src, width: e.width, flipH: e.flipH, flipV: e.flipV }));
    const st = { layout: { comp, elements } }; if (pm._border) st.border = pm._border; return st;
  }
  const round2 = (n) => Math.round(num(n, 0) * 100) / 100;
  const allPageState = () => pageModels.map((_, i) => pageState(i));
  function buildRecipe() { const book = { ...(bookConfig || {}) }; delete book.seed; delete book.pageState; delete book.puzzleforgeBook; return { recipeVersion: 2, kind: 'book', book, seed, pageState: allPageState() }; }
  function save() { downloadBlob(new Blob([JSON.stringify(buildRecipe(), null, 2)], { type: 'application/json' }), slug((bookConfig && bookConfig.title) || 'book') + '-book.json'); setStatus('Recipe saved (with layout).', 'ok'); }
  async function exportPdf() {
    setStatus('Rendering PDF…', 'busy'); el.exportPdf.disabled = true;
    try {
      const body = bookId ? { bookId, pageState: allPageState() } : { config: bookConfig, pageState: allPageState() };
      const res = await fetch('/api/book/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Export failed'); }
      downloadBlob(await res.blob(), slug((bookConfig && bookConfig.title) || 'book') + '.pdf'); setStatus('PDF exported.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); } finally { el.exportPdf.disabled = false; }
  }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  // --- init ---
  function init() {
    el.addText.addEventListener('click', addText);
    el.addImage.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });
    el.fontSize.addEventListener('input', () => applyTextProp('fontSize', Number(el.fontSize.value) || 24));
    el.objColor.addEventListener('input', () => applyTextProp('color', el.objColor.value));
    el.align.addEventListener('change', () => applyTextProp('align', el.align.value));
    el.mX.addEventListener('change', () => setMeasure('x', Number(el.mX.value) || 0));
    el.mY.addEventListener('change', () => setMeasure('y', Number(el.mY.value) || 0));
    el.mScale.addEventListener('change', () => setMeasure('scale', Math.max(0.15, (Number(el.mScale.value) || 100) / 100)));
    el.mRot.addEventListener('change', () => setMeasure('rot', Number(el.mRot.value) || 0));
    document.querySelectorAll('.align-grid .iconbtn').forEach((b) => b.addEventListener('click', () => alignSel(b.dataset.align)));
    el.distH.addEventListener('click', () => distribute('x'));
    el.distV.addEventListener('click', () => distribute('y'));
    el.toFront.addEventListener('click', () => reorder('front'));
    el.forward.addEventListener('click', () => reorder('forward'));
    el.backward.addEventListener('click', () => reorder('backward'));
    el.toBack.addEventListener('click', () => reorder('back'));
    el.flipH.addEventListener('click', () => flip('h'));
    el.flipV.addEventListener('click', () => flip('v'));
    el.lockObj.addEventListener('click', toggleLock);
    el.dupObj.addEventListener('click', duplicate);
    el.resetPos.addEventListener('click', resetSize);
    el.hideObj.addEventListener('click', hideComp);
    el.deleteObj.addEventListener('click', deleteSel);
    el.border.addEventListener('change', setBorder);
    el.gridToggle.addEventListener('change', () => { if (gridEl) gridEl.style.display = el.gridToggle.checked ? '' : 'none'; });
    el.reroll.addEventListener('click', reroll);
    el.resetLayout.addEventListener('click', resetLayout);
    el.undo.addEventListener('click', undo); el.redo.addEventListener('click', redo);
    el.zoomIn.addEventListener('click', () => setZoom(zoom * 1.2));
    el.zoomOut.addEventListener('click', () => setZoom(zoom / 1.2));
    el.zoomFit.addEventListener('click', () => setZoom(fitScale()));
    el.save.addEventListener('click', save); el.exportPdf.addEventListener('click', exportPdf);
    el.loadRecipe.addEventListener('change', onLoadRecipe);
    el.stageScroll.addEventListener('scroll', syncRulers);
    el.stageInner.addEventListener('pointerdown', (e) => { if (e.target === el.stageInner || e.target === gridEl || e.target === selLayer) setSel([]); });
    window.addEventListener('resize', () => { applyZoom(); });
    window.addEventListener('keydown', onKey);

    let handoff = null;
    try { const raw = localStorage.getItem('pf_editor'); if (raw) { handoff = JSON.parse(raw); localStorage.removeItem('pf_editor'); } } catch (_) { /* ignore */ }
    if (handoff && (handoff.config || handoff.bookId)) { bookConfig = handoff.config || null; openBook(handoff.bookId ? { bookId: handoff.bookId, config: handoff.config } : { config: handoff.config }); }
    else { el.empty.hidden = false; setStatus('Open a book from the Book Builder, or load a recipe.', ''); }
  }
  function onKey(e) {
    if (el.main.hidden) return;
    const ae = document.activeElement, tag = (ae && ae.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || (ae && ae.isContentEditable)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copySel(); return; }
    if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); return; }
    if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (!sels.length) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { nudge(-step, 0); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { nudge(step, 0); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { nudge(0, -step); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { nudge(0, step); e.preventDefault(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { deleteSel(); e.preventDefault(); }
  }
  function onLoadRecipe(ev) {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result); const v2 = raw && raw.recipeVersion === 2 ? raw : { book: raw, seed: null, pageState: [] };
        bookConfig = { ...(v2.book || {}) }; if (v2.seed != null) bookConfig.seed = v2.seed; if (Array.isArray(v2.pageState) && v2.pageState.length) bookConfig.pageState = v2.pageState;
        openBook({ config: bookConfig });
      } catch (_) { setStatus('That file is not a valid book recipe.', 'err'); }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }

  init();
})();
