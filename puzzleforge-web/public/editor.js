/* PuzzleForge — Page Editor (v4). Pieces render in their ORIGINAL flow layout
 * (so an un-edited page is identical to the normal puzzle) and are moved with a
 * transform delta; text and clip art are absolute overlays. Includes undo/redo,
 * zoom + rulers, numeric panel, snapping/grid, multi-select, align/distribute,
 * arrange, flip, lock, duplicate/copy/paste. Export composites at print res. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PX_PER_IN = 96, GRID = 24;
  const el = {
    status: $('status'), main: $('editorMain'), empty: $('emptyState'), pageList: $('pageList'), addBlank: $('addBlank'),
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
  let pageModels = [], srcPages = [], pendingPlan = null, cur = -1, uid = 1, zoom = 1;
  let sels = [], clipboard = [];
  let vGuide = null, hGuide = null, gridEl = null, selLayer = null, flowEl = null;
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const setStatus = (t, k) => { el.status.textContent = t || ''; el.status.className = 'status editor-status' + (k ? ' ' + k : ''); };
  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const slug = (s) => (s || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'book';

  function scopeCss(css, scope) {
    css = css.replace(/@page[^{]*\{[^}]*\}/gi, ''); let out = ''; const re = /([^{}]+)\{([^}]*)\}/g; let m;
    while ((m = re.exec(css)) !== null) {
      const decl = m[2].trim(); if (!decl) continue;
      const ss = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s === '*' ? scope + ' *' : (s === 'html' || s === 'body') ? scope : /^(html|body)\b/.test(s) ? s.replace(/^(html|body)\b/, scope) : scope + ' ' + s);
      out += ss.join(', ') + '{' + decl + '}\n';
    }
    return out;
  }

  // --- model ---
  function buildComps(components) {
    const seen = {};
    return components.map((c) => {
      const n = (seen[c.kind] = (seen[c.kind] || 0) + 1);
      const key = n > 1 ? c.kind + n : c.kind;
      return { group: 'piece', kind: c.kind, key, html: c.html, dx: 0, dy: 0, scale: 1, rot: 0, hidden: false, locked: false, baseX: 0, baseY: 0, baseW: 0, baseH: 0 };
    });
  }
  // Apply a saved per-page state (layout deltas + overlays + border) onto a model.
  function restoreState(m, state) {
    const saved = state && state.layout;
    if (saved) {
      const cm = saved.comp || {};
      m.comps.forEach((c) => { const s = cm[c.key]; if (s) Object.assign(c, { dx: num(s.dx, 0), dy: num(s.dy, 0), scale: num(s.scale, 1), rot: num(s.rot, 0), hidden: !!s.hidden, locked: !!s.locked }); });
      m.elements = (saved.elements || []).map((e) => ({ ...e, group: 'el', id: e.id || uid++ }));
    }
    if (state && state.border) m._border = state.border;
    return m;
  }
  function modelFromPage(p) {
    const m = {
      role: p.role || 'content', matterKind: p.matterKind || null, src: p.src != null ? p.src : null,
      blank: false, type: p.type || '', title: p.title || p.type || '', activity: !!p.activity,
      style: p.style || '', comps: buildComps(p.components || []), elements: [], _border: '', undo: [], redo: [],
    };
    return restoreState(m, p.state);
  }
  // Rebuild pageModels from a saved page plan (final order, blanks, per-page
  // state), sourcing real pages fresh from the server's original leaf list.
  function applyPlan(plan) {
    const findSrc = (e) => {
      if (e.role === 'frontmatter' || e.role === 'backmatter') return srcPages.find((sp) => sp.role === e.role && sp.matterKind === e.matterKind);
      if (e.role === 'title' || e.role === 'answerkey') return srcPages.find((sp) => sp.role === e.role);
      if (e.role === 'content' || (!e.role && e.src != null)) return srcPages.find((sp) => sp.role === 'content' && sp.src === e.src);
      return null;
    };
    const rebuilt = plan.map((entry) => {
      if (!entry) return null;
      if (entry.blank || entry.role === 'blank') return restoreState(blankModel(), entry.state);
      const sp = findSrc(entry); if (!sp) return null;
      return restoreState(modelFromPage(sp), entry.state);
    }).filter(Boolean);
    if (rebuilt.length) pageModels = rebuilt;
  }
  // A user-inserted blank page (empty; can carry text/image overlays).
  function blankModel() {
    return { role: 'blank', matterKind: null, src: null, blank: true, type: 'bleedguard', title: 'Blank', activity: true, style: '', comps: [], elements: [], _border: '', undo: [], redo: [] };
  }
  // Deep-copy a page model for duplication (keeps its role/src so export reuses
  // the same source; fresh element ids so overlays are independent).
  function clonePageModel(pm) {
    return {
      role: pm.role, matterKind: pm.matterKind, src: pm.src, blank: pm.blank, type: pm.type, title: pm.title, activity: pm.activity,
      style: pm.style,
      comps: pm.comps.map((c) => ({ group: 'piece', kind: c.kind, key: c.key, html: c.html, dx: c.dx, dy: c.dy, scale: c.scale, rot: c.rot, hidden: c.hidden, locked: c.locked, baseX: 0, baseY: 0, baseW: 0, baseH: 0 })),
      elements: pm.elements.map((e) => { const { _node, ...r } = e; return { ...r, id: uid++ }; }),
      _border: pm._border, undo: [], redo: [],
    };
  }

  async function openBook(payload) {
    setStatus('Opening book in the editor…', 'busy');
    try {
      const res = await fetch('/api/book/editor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Could not open the book');
      bookId = data.bookId; seed = data.seed; dims = data.dims;
      srcPages = data.pages || [];
      pageModels = srcPages.map(modelFromPage);
      if (pendingPlan) { applyPlan(pendingPlan); pendingPlan = null; }
      el.empty.hidden = true; el.main.hidden = false;
      await loadBorderStyles(); buildPageList(); cur = 0; zoom = fitScale(); renderPage();
      setStatus(`Editing “${data.title}” — ${pageModels.length} pages.`, 'ok');
    } catch (err) { setStatus(err.message, 'err'); }
  }
  async function loadBorderStyles() {
    if (el.border.options.length > 1) return;
    try { const meta = await (await fetch('/api/meta')).json(); for (const b of meta.borderStyles || []) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.label; el.border.appendChild(o); } } catch (_) { /* */ }
  }
  let thumbSeq = 0;
  // A scaled, non-interactive snapshot of a page — the Publisher-style page rail.
  function paintThumb(pm) {
    const THUMB_W = 108, sc = THUMB_W / dims.usableWidth;
    const wrap = document.createElement('div'); wrap.className = 'thumb';
    wrap.style.width = THUMB_W + 'px'; wrap.style.height = Math.round(dims.usableHeight * sc) + 'px';
    const canvas = document.createElement('div'); canvas.className = 'thumb-canvas';
    const id = 'thm' + (++thumbSeq); canvas.id = id;
    canvas.style.width = dims.usableWidth + 'px'; canvas.style.height = dims.usableHeight + 'px'; canvas.style.transform = `scale(${sc})`;
    if (pm.style) { const st = document.createElement('style'); st.textContent = scopeCss(pm.style, '#' + id); canvas.appendChild(st); }
    const flow = document.createElement('div'); flow.className = 'pf-flow';
    pm.comps.forEach((c) => { if (c.hidden) return; const n = document.createElement('div'); n.className = 'pf-piece'; n.innerHTML = c.html; if (c.dx || c.dy || c.scale !== 1 || c.rot) n.style.transform = `translate(${c.dx}px,${c.dy}px) rotate(${c.rot}deg) scale(${c.scale})`; flow.appendChild(n); });
    canvas.appendChild(flow);
    pm.elements.slice().sort((a, b) => num(a.z, 0) - num(b.z, 0)).forEach((e) => { const n = document.createElement('div'); n.className = 'pf-node'; n.style.transform = `translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)})`; n.innerHTML = elHtml(e); canvas.appendChild(n); });
    wrap.appendChild(canvas);
    return wrap;
  }
  function buildPageList() {
    el.pageList.innerHTML = '';
    pageModels.forEach((pm, i) => {
      const li = document.createElement('li'); li.className = 'page-item';
      const thumb = paintThumb(pm); thumb.classList.add('page-thumb'); thumb.addEventListener('click', () => selectPage(i));
      const bar = document.createElement('div'); bar.className = 'page-bar';
      const lbl = document.createElement('span'); lbl.className = 'page-label'; lbl.textContent = `${i + 1}. ${labelFor(pm)}`;
      lbl.addEventListener('click', () => selectPage(i));
      const ops = document.createElement('span'); ops.className = 'page-ops';
      const mk = (txt, title, fn, cls) => { const b = document.createElement('button'); b.className = 'pageop' + (cls ? ' ' + cls : ''); b.textContent = txt; b.title = title; b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(i); }); return b; };
      ops.appendChild(mk('↑', 'Move up', (x) => movePage(x, -1)));
      ops.appendChild(mk('↓', 'Move down', (x) => movePage(x, 1)));
      ops.appendChild(mk('⧉', 'Duplicate page', duplicatePage));
      ops.appendChild(mk('✕', 'Delete page', deletePage, 'del'));
      bar.appendChild(lbl); bar.appendChild(ops);
      li.appendChild(thumb); li.appendChild(bar); el.pageList.appendChild(li);
    });
    highlightPage();
  }
  const labelFor = (pm) => pm.blank ? 'Blank page' : ({ bleedguard: 'Blank (bleed guard)', breather: 'Breather' }[pm.type] || pm.title || pm.type);
  function highlightPage() {
    [...el.pageList.children].forEach((li, i) => li.classList.toggle('active', i === cur));
    const active = el.pageList.children[cur]; if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  // --- page management ---
  function movePage(i, dir) {
    const j = i + dir; if (j < 0 || j >= pageModels.length) return;
    const t = pageModels[i]; pageModels[i] = pageModels[j]; pageModels[j] = t;
    if (cur === i) cur = j; else if (cur === j) cur = i;
    buildPageList(); renderPage();
  }
  function deletePage(i) {
    if (pageModels.length <= 1) { setStatus('A book needs at least one page.', 'err'); return; }
    pageModels.splice(i, 1);
    if (cur > i) cur--; else if (cur === i && cur >= pageModels.length) cur = pageModels.length - 1;
    buildPageList(); renderPage();
  }
  function duplicatePage(i) { pageModels.splice(i + 1, 0, clonePageModel(pageModels[i])); cur = i + 1; buildPageList(); renderPage(); }
  function insertBlankAfterCurrent() { const at = cur < 0 ? pageModels.length : cur + 1; pageModels.splice(at, 0, blankModel()); cur = at; buildPageList(); renderPage(); }

  // --- zoom / rulers ---
  function fitScale() { const aw = (el.stageScroll.clientWidth || 700) - 24, ah = window.innerHeight - 200; return Math.max(0.15, Math.min(aw / dims.usableWidth, ah / dims.usableHeight, 1.5)); }
  function applyZoom() {
    el.stageInner.style.width = dims.usableWidth + 'px'; el.stageInner.style.height = dims.usableHeight + 'px'; el.stageInner.style.transform = `scale(${zoom})`;
    el.stageOuter.style.width = Math.round(dims.usableWidth * zoom) + 'px'; el.stageOuter.style.height = Math.round(dims.usableHeight * zoom) + 'px';
    el.zoomLabel.textContent = Math.round(zoom * 100) + '%';
    const inch = PX_PER_IN * zoom;
    el.rulerTop.style.background = `repeating-linear-gradient(90deg,#b6bccb 0 1px,transparent 1px ${inch / 4}px),repeating-linear-gradient(90deg,#7a8194 0 1px,transparent 1px ${inch}px)`;
    el.rulerLeft.style.background = `repeating-linear-gradient(0deg,#b6bccb 0 1px,transparent 1px ${inch / 4}px),repeating-linear-gradient(0deg,#7a8194 0 1px,transparent 1px ${inch}px)`;
    syncRulers();
  }
  function syncRulers() { el.rulerTop.style.backgroundPositionX = (-el.stageScroll.scrollLeft) + 'px'; el.rulerLeft.style.backgroundPositionY = (-el.stageScroll.scrollTop) + 'px'; }
  const setZoom = (z) => { zoom = Math.max(0.15, Math.min(4, z)); applyZoom(); drawSel(); };

  // --- render ---
  function renderPage() {
    const pm = pageModels[cur]; highlightPage();
    el.stageInner.innerHTML = '';
    const style = document.createElement('style'); style.textContent = scopeCss(pm.style, '#stageInner'); el.stageInner.appendChild(style);
    gridEl = document.createElement('div'); gridEl.className = 'pf-grid-overlay'; gridEl.style.display = el.gridToggle.checked ? '' : 'none'; el.stageInner.appendChild(gridEl);

    // Flow pieces (original layout), in order.
    flowEl = document.createElement('div'); flowEl.className = 'pf-flow';
    pm.comps.forEach((c) => {
      const node = document.createElement('div'); node.className = 'pf-piece'; node.dataset.key = c.key;
      node.innerHTML = c.html; node.style.display = c.hidden ? 'none' : '';
      c._node = node; node._ref = c; node.addEventListener('pointerdown', (ev) => onPointerDown(ev, c));
      flowEl.appendChild(node);
    });
    el.stageInner.appendChild(flowEl);

    // Absolute element overlays.
    pm.elements.sort((a, b) => num(a.z, 0) - num(b.z, 0)).forEach((e) => el.stageInner.appendChild(makeEl(e)));

    vGuide = document.createElement('div'); vGuide.className = 'pf-guide pf-guide-v'; vGuide.style.display = 'none';
    hGuide = document.createElement('div'); hGuide.className = 'pf-guide pf-guide-h'; hGuide.style.display = 'none';
    selLayer = document.createElement('div'); selLayer.className = 'pf-sel-layer';
    el.stageInner.appendChild(vGuide); el.stageInner.appendChild(hGuide); el.stageInner.appendChild(selLayer);

    el.border.value = pm._border || ''; applyZoom();
    // Measure each piece's flow base (no transform yet), then apply transforms.
    requestAnimationFrame(() => { measureBases(pm); pm.comps.forEach(applyPieceTf); sels = []; syncSelUI(); drawSel(); });
  }
  function measureBases(pm) {
    const ir = el.stageInner.getBoundingClientRect();
    pm.comps.forEach((c) => {
      if (c.hidden) return;
      const r = c._node.getBoundingClientRect();
      c.baseX = (r.left - ir.left) / zoom; c.baseY = (r.top - ir.top) / zoom; c.baseW = r.width / zoom; c.baseH = r.height / zoom;
    });
  }
  function applyPieceTf(c) { if (c._node) c._node.style.transform = (c.dx || c.dy || c.scale !== 1 || c.rot) ? `translate(${c.dx}px,${c.dy}px) rotate(${c.rot}deg) scale(${c.scale})` : ''; }

  function makeEl(e) {
    const node = document.createElement('div'); node.className = 'pf-node'; node.innerHTML = elHtml(e);
    e._node = node; node._ref = e; applyElTf(e);
    node.addEventListener('pointerdown', (ev) => onPointerDown(ev, e));
    if (e.kind === 'text') node.addEventListener('dblclick', () => editText(e));
    return node;
  }
  function applyElTf(e) { if (e._node) e._node.style.transform = `translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)})`; }
  function elHtml(e) {
    if (e.kind === 'image') { const fx = `scale(${e.flipH ? -1 : 1},${e.flipV ? -1 : 1})`; return `<img src="${e.src}" style="width:${num(e.width, 160)}px;display:block;transform:${fx};pointer-events:none;" alt="">`; }
    const color = /^#[0-9a-fA-F]{3,8}$/.test(e.color || '') ? e.color : '#222';
    const fam = e.fontFamily === 'serif' ? 'Georgia, serif' : 'Arial, Helvetica, sans-serif';
    return `<div class="pf-textbox" style="font-size:${num(e.fontSize, 24)}px;color:${color};font-family:${fam};text-align:${e.align || 'left'};width:${num(e.w, 240)}px;white-space:pre-wrap;line-height:1.25;">${escapeHtml(e.text || '')}</div>`;
  }
  function allRefs() { return [...pageModels[cur].comps.filter((c) => !c.hidden), ...pageModels[cur].elements]; }

  // --- unified box model (page coords) ---
  function box(ref) {
    if (ref.group === 'piece') return { x: ref.baseX + ref.dx, y: ref.baseY + ref.dy, w: ref.baseW * ref.scale, h: ref.baseH * ref.scale };
    const n = ref._node, s = num(ref.scale, 1); return { x: num(ref.x, 0), y: num(ref.y, 0), w: n.offsetWidth * s, h: n.offsetHeight * s };
  }
  function moveTo(ref, x, y) {
    if (ref.group === 'piece') { ref.dx = x - ref.baseX; ref.dy = y - ref.baseY; applyPieceTf(ref); }
    else { ref.x = x; ref.y = y; applyElTf(ref); }
  }
  function setScale(ref, s) { ref.scale = s; ref.group === 'piece' ? applyPieceTf(ref) : applyElTf(ref); }
  function setRot(ref, r) { ref.rot = r; ref.group === 'piece' ? applyPieceTf(ref) : applyElTf(ref); }

  // --- history ---
  function snapshot(pm) { return JSON.stringify({ comps: pm.comps.map((c) => ({ key: c.key, dx: c.dx, dy: c.dy, scale: c.scale, rot: c.rot, hidden: c.hidden, locked: c.locked })), elements: pm.elements.map((e) => { const { _node, ...r } = e; return r; }) }); }
  function pushUndo() { const pm = pageModels[cur]; pm.undo.push(snapshot(pm)); if (pm.undo.length > 60) pm.undo.shift(); pm.redo = []; }
  function applySnap(pm, snap) { const s = JSON.parse(snap); const byKey = {}; pm.comps.forEach((c) => (byKey[c.key] = c)); s.comps.forEach((sc) => { const c = byKey[sc.key]; if (c) Object.assign(c, sc); }); pm.elements = s.elements.map((e) => ({ ...e, group: 'el' })); }
  function undo() { const pm = pageModels[cur]; if (!pm.undo.length) return; pm.redo.push(snapshot(pm)); applySnap(pm, pm.undo.pop()); renderPage(); }
  function redo() { const pm = pageModels[cur]; if (!pm.redo.length) return; pm.undo.push(snapshot(pm)); applySnap(pm, pm.redo.pop()); renderPage(); }

  // --- selection ---
  const isSel = (r) => sels.indexOf(r) >= 0;
  function setSel(a) { sels = a.slice(); syncSelUI(); drawSel(); }
  const primary = () => sels[sels.length - 1];
  function drawSel() {
    if (!selLayer) return; selLayer.innerHTML = '';
    sels.forEach((ref) => {
      if (!ref._node) return; const b = box(ref);
      const d = document.createElement('div'); d.className = 'pf-selbox'; d.style.transform = `translate(${b.x}px,${b.y}px)`; d.style.width = b.w + 'px'; d.style.height = b.h + 'px';
      if (sels.length === 1) { const h = document.createElement('div'); h.className = 'pf-handle'; h.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); startResize(ev, ref); }); d.appendChild(h); }
      selLayer.appendChild(d);
    });
  }
  function syncSelUI() {
    const has = sels.length > 0; el.selNone.classList.toggle('hidden', has); el.selControls.classList.toggle('hidden', !has); if (!has) return;
    const one = sels.length === 1 ? sels[0] : null; const isText = one && one.kind === 'text'; const isImg = one && one.kind === 'image'; const isEl = one && one.group === 'el';
    el.measurePanel.style.display = one ? '' : 'none'; el.textProps.style.display = isText ? '' : 'none'; el.alignField.style.display = isText ? '' : 'none';
    el.flipH.style.display = isImg ? '' : 'none'; el.flipV.style.display = isImg ? '' : 'none'; el.dupObj.style.display = isEl ? '' : 'none'; el.deleteObj.style.display = isEl ? '' : 'none';
    el.hideObj.style.display = one && !isEl ? '' : 'none'; el.distH.style.display = sels.length >= 3 ? '' : 'none'; el.distV.style.display = sels.length >= 3 ? '' : 'none';
    el.lockObj.textContent = one && one.locked ? 'Unlock' : 'Lock';
    if (one) { const b = box(one); el.mX.value = Math.round(b.x); el.mY.value = Math.round(b.y); el.mScale.value = Math.round(num(one.scale, 1) * 100); el.mRot.value = Math.round(num(one.rot, 0)); if (isText) { el.fontSize.value = num(one.fontSize, 24); el.objColor.value = one.color || '#222222'; el.align.value = one.align || 'left'; } }
  }

  function snapTargets(excl) {
    const xs = [0, dims.usableWidth / 2, dims.usableWidth], ys = [0, dims.usableHeight / 2, dims.usableHeight];
    for (const r of allRefs()) { if (excl.indexOf(r) >= 0 || !r._node) continue; const b = box(r); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); }
    return { xs, ys };
  }
  const showGuide = (g, a, v) => { g.style.display = ''; if (a === 'x') g.style.left = v + 'px'; else g.style.top = v + 'px'; };
  const hideGuides = () => { if (vGuide) vGuide.style.display = 'none'; if (hGuide) hGuide.style.display = 'none'; };

  // --- drag / resize ---
  function onPointerDown(ev, ref) {
    ev.preventDefault();
    if (ref.locked) { setSel([ref]); return; }
    if (ev.shiftKey) { if (!isSel(ref)) sels.push(ref); } else if (!isSel(ref)) sels = [ref];
    syncSelUI(); drawSel();
    const group = sels.slice(); const starts = group.map((r) => { const b = box(r); return { r, x: b.x, y: b.y, w: b.w, h: b.h }; });
    const sx = ev.clientX, sy = ev.clientY; let pushed = false;
    const move = (e) => {
      let dx = (e.clientX - sx) / zoom, dy = (e.clientY - sy) / zoom;
      if (!pushed && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) { pushUndo(); pushed = true; }
      const p = starts.find((s) => s.r === primary()) || starts[0];
      let nx = p.x + dx, ny = p.y + dy;
      if (el.gridToggle.checked) { nx = Math.round(nx / GRID) * GRID; ny = Math.round(ny / GRID) * GRID; dx = nx - p.x; dy = ny - p.y; }
      if (el.snapToggle.checked) {
        const t = snapTargets(group), d = 7 / zoom;
        let bx = null; for (const off of [0, p.w / 2, p.w]) for (const tx of t.xs) { const dd = tx - (nx + off); if (Math.abs(dd) < d && (!bx || Math.abs(dd) < Math.abs(bx.d))) bx = { d: dd, v: tx }; }
        if (bx) { dx += bx.d; showGuide(vGuide, 'x', bx.v); } else vGuide.style.display = 'none';
        let by = null; for (const off of [0, p.h / 2, p.h]) for (const ty of t.ys) { const dd = ty - (ny + off); if (Math.abs(dd) < d && (!by || Math.abs(dd) < Math.abs(by.d))) by = { d: dd, v: ty }; }
        if (by) { dy += by.d; showGuide(hGuide, 'y', by.v); } else hGuide.style.display = 'none';
      }
      starts.forEach((s) => moveTo(s.r, s.x + dx, s.y + dy)); drawSel();
    };
    const up = () => { hideGuides(); if (sels.length === 1) syncSelUI(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function startResize(ev, ref) {
    ev.preventDefault(); pushUndo();
    const b0 = box(ref); const natH = ref.group === 'piece' ? ref.baseH : ref._node.offsetHeight; const r = el.stageInner.getBoundingClientRect();
    const move = (e) => { const py = (e.clientY - r.top) / zoom; setScale(ref, Math.max(0.15, Math.min(8, (py - b0.y) / (natH || 1)))); drawSel(); syncSelUI(); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  // --- align / distribute ---
  function alignSel(kind) {
    if (!sels.length) return; pushUndo(); const horiz = ['left', 'centerh', 'right'].includes(kind); let lo, hi;
    if (sels.length >= 2) { const bs = sels.map(box); lo = Math.min(...bs.map((b) => (horiz ? b.x : b.y))); hi = Math.max(...bs.map((b) => (horiz ? b.x + b.w : b.y + b.h))); }
    else { lo = 0; hi = horiz ? dims.usableWidth : dims.usableHeight; }
    const mid = (lo + hi) / 2;
    sels.forEach((ref) => { const b = box(ref);
      if (kind === 'left') moveTo(ref, lo, b.y); else if (kind === 'right') moveTo(ref, hi - b.w, b.y); else if (kind === 'centerh') moveTo(ref, Math.round(mid - b.w / 2), b.y);
      else if (kind === 'top') moveTo(ref, b.x, lo); else if (kind === 'bottom') moveTo(ref, b.x, hi - b.h); else if (kind === 'middle') moveTo(ref, b.x, Math.round(mid - b.h / 2));
    });
    drawSel(); syncSelUI();
  }
  function distribute(axis) {
    if (sels.length < 3) return; pushUndo();
    const items = sels.map((r) => ({ r, b: box(r) })).sort((a, b) => (axis === 'x' ? (a.b.x + a.b.w / 2) - (b.b.x + b.b.w / 2) : (a.b.y + a.b.h / 2) - (b.b.y + b.b.h / 2)));
    const c0 = axis === 'x' ? items[0].b.x + items[0].b.w / 2 : items[0].b.y + items[0].b.h / 2;
    const last = items[items.length - 1].b; const c1 = axis === 'x' ? last.x + last.w / 2 : last.y + last.h / 2;
    const step = (c1 - c0) / (items.length - 1);
    items.forEach((it, i) => { const tc = c0 + step * i; if (axis === 'x') moveTo(it.r, Math.round(tc - it.b.w / 2), it.b.y); else moveTo(it.r, it.b.x, Math.round(tc - it.b.h / 2)); });
    drawSel();
  }

  // --- arrange / object ops ---
  function reorder(kind) {
    const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'el') return; pushUndo();
    const arr = pageModels[cur].elements; const zs = arr.map((e) => num(e.z, 100));
    if (kind === 'front') o.z = Math.max(...zs) + 10; else if (kind === 'back') o.z = Math.min(...zs) - 10; else if (kind === 'forward') o.z = num(o.z, 100) + 15; else if (kind === 'backward') o.z = num(o.z, 100) - 15;
    renderPage(); setTimeout(() => setSel([o]), 0);
  }
  function flip(axis) { const o = sels.length === 1 && sels[0]; if (!o || o.kind !== 'image') return; pushUndo(); if (axis === 'h') o.flipH = !o.flipH; else o.flipV = !o.flipV; o._node.innerHTML = elHtml(o); }
  function toggleLock() { const o = sels.length === 1 && sels[0]; if (!o) return; pushUndo(); o.locked = !o.locked; syncSelUI(); }

  function addText() { pushUndo(); const e = { group: 'el', id: uid++, kind: 'text', x: Math.round(dims.usableWidth / 2 - 100), y: Math.round(dims.usableHeight / 2), scale: 1, rot: 0, z: 100, text: 'Your text', fontSize: 28, color: '#222222', align: 'left', w: 240 }; pageModels[cur].elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); setSel([e]); }
  function addImageFile(file) { const r = new FileReader(); r.onload = () => { pushUndo(); const e = { group: 'el', id: uid++, kind: 'image', x: Math.round(dims.usableWidth / 2 - 80), y: Math.round(dims.usableHeight / 2 - 80), scale: 1, rot: 0, z: 100, src: r.result, width: 160 }; pageModels[cur].elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); setSel([e]); }; r.readAsDataURL(file); }
  function editText(ref) { const bx = ref._node.querySelector('.pf-textbox'); bx.setAttribute('contenteditable', 'true'); bx.focus(); pushUndo(); const done = () => { bx.removeAttribute('contenteditable'); ref.text = bx.innerText; bx.removeEventListener('blur', done); }; bx.addEventListener('blur', done); }
  function applyTextProp(prop, val) { const o = sels.length === 1 && sels[0]; if (!o || o.kind !== 'text') return; o[prop] = val; o._node.innerHTML = elHtml(o); drawSel(); }
  function duplicate() { const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'el') return; pushUndo(); const { _node, ...c } = o; c.id = uid++; c.x = num(o.x, 0) + 16; c.y = num(o.y, 0) + 16; c.z = num(o.z, 100) + 1; pageModels[cur].elements.push(c); el.stageInner.insertBefore(makeEl(c), selLayer); setSel([c]); }
  function copySel() { clipboard = sels.filter((r) => r.group === 'el').map((r) => { const { _node, ...c } = r; return c; }); }
  function paste() { if (!clipboard.length) return; pushUndo(); const made = []; clipboard.forEach((c) => { const e = { ...c, group: 'el', id: uid++, x: num(c.x, 0) + 16, y: num(c.y, 0) + 16, z: num(c.z, 100) + 1 }; pageModels[cur].elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); made.push(e); }); setSel(made); }
  function deleteSel() { const els = sels.filter((r) => r.group === 'el'); if (!els.length) return; pushUndo(); const arr = pageModels[cur].elements; els.forEach((r) => { const i = arr.indexOf(r); if (i >= 0) arr.splice(i, 1); if (r._node) r._node.remove(); }); setSel([]); }
  function hideComp() { const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'piece') return; pushUndo(); o.hidden = true; o._node.style.display = 'none'; setSel([]); }
  function resetSize() { if (!sels.length) return; pushUndo(); sels.forEach((r) => { setScale(r, 1); setRot(r, 0); }); drawSel(); syncSelUI(); }
  function nudge(dx, dy) { if (!sels.length) return; sels.forEach((r) => { if (!r.locked) { const b = box(r); moveTo(r, b.x + dx, b.y + dy); } }); drawSel(); syncSelUI(); }
  function setMeasure(prop, val) { const o = sels.length === 1 && sels[0]; if (!o) return; pushUndo(); const b = box(o); if (prop === 'x') moveTo(o, val, b.y); else if (prop === 'y') moveTo(o, b.x, val); else if (prop === 'scale') setScale(o, val); else if (prop === 'rot') setRot(o, val); drawSel(); syncSelUI(); }

  function resetLayout() { pushUndo(); const pm = pageModels[cur]; pm.comps.forEach((c) => { c.hidden = false; c.dx = 0; c.dy = 0; c.scale = 1; c.rot = 0; c.locked = false; }); pm.elements = []; renderPage(); }
  function setBorder() { pageModels[cur]._border = el.border.value; }
  async function reroll() {
    const pm = pageModels[cur];
    if (!pm || pm.role !== 'content' || pm.src == null) { setStatus('Only puzzle pages can be rerolled.', 'err'); return; }
    if (pm.activity) { setStatus('Activity pages have no puzzle to reroll.', 'err'); return; }
    el.reroll.disabled = true; setStatus('Rerolling…', 'busy');
    try {
      const res = await fetch('/api/book/reroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId, index: pm.src }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Reroll failed');
      const pm = pageModels[cur]; const fresh = buildComps(data.components || []); const byKey = {}; pm.comps.forEach((c) => (byKey[c.key] = c));
      pm.style = data.style || pm.style; pm.comps = fresh.map((f) => { const old = byKey[f.key]; return old ? { ...f, dx: old.dx, dy: old.dy, scale: old.scale, rot: old.rot, hidden: old.hidden, locked: old.locked } : f; });
      renderPage(); setStatus('Rerolled.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); } finally { el.reroll.disabled = false; }
  }
  function selectPage(i) { if (i === cur) return; cur = i; renderPage(); }

  // --- serialize ---
  const round2 = (n) => Math.round(num(n, 0) * 100) / 100;
  function pageStateOf(pm) {
    const comp = {};
    pm.comps.forEach((c) => { comp[c.key] = { dx: Math.round(c.dx), dy: Math.round(c.dy), scale: round2(c.scale), rot: round2(c.rot), hidden: c.hidden, locked: c.locked }; });
    const elements = pm.elements.map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), scale: round2(e.scale), rot: round2(e.rot), z: e.z, text: e.text, fontSize: e.fontSize, color: e.color, align: e.align, w: e.w, src: e.src, width: e.width, flipH: e.flipH, flipV: e.flipV }));
    const st = { layout: { comp, elements } }; if (pm._border) st.border = pm._border; return st;
  }
  // Per-page arrangement for export/recipe: keeps the final page order, marks
  // inserted blanks, and references each real page's original book index (src).
  const buildPagePlan = () => pageModels.map((pm) => {
    const state = pageStateOf(pm);
    if (pm.blank) return { role: 'blank', state };
    if (pm.role === 'content') return { role: 'content', src: pm.src, state };
    if (pm.role === 'frontmatter' || pm.role === 'backmatter') return { role: pm.role, matterKind: pm.matterKind, state };
    return { role: pm.role, state }; // title, answerkey
  });
  function buildRecipe() { const book = { ...(bookConfig || {}) }; delete book.seed; delete book.pageState; delete book.puzzleforgeBook; return { recipeVersion: 2, kind: 'book', book, seed, pagePlan: buildPagePlan() }; }
  function save() { downloadBlob(new Blob([JSON.stringify(buildRecipe(), null, 2)], { type: 'application/json' }), slug((bookConfig && bookConfig.title) || 'book') + '-book.json'); setStatus('Recipe saved (with layout).', 'ok'); }
  async function exportPdf() {
    setStatus('Rendering PDF…', 'busy'); el.exportPdf.disabled = true;
    try { const body = bookId ? { bookId, pagePlan: buildPagePlan() } : { config: bookConfig, pagePlan: buildPagePlan() };
      const res = await fetch('/api/book/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Export failed'); }
      downloadBlob(await res.blob(), slug((bookConfig && bookConfig.title) || 'book') + '.pdf'); setStatus('PDF exported.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); } finally { el.exportPdf.disabled = false; }
  }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

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
    el.distH.addEventListener('click', () => distribute('x')); el.distV.addEventListener('click', () => distribute('y'));
    el.toFront.addEventListener('click', () => reorder('front')); el.forward.addEventListener('click', () => reorder('forward')); el.backward.addEventListener('click', () => reorder('backward')); el.toBack.addEventListener('click', () => reorder('back'));
    el.flipH.addEventListener('click', () => flip('h')); el.flipV.addEventListener('click', () => flip('v')); el.lockObj.addEventListener('click', toggleLock);
    el.dupObj.addEventListener('click', duplicate); el.resetPos.addEventListener('click', resetSize); el.hideObj.addEventListener('click', hideComp); el.deleteObj.addEventListener('click', deleteSel);
    el.border.addEventListener('change', setBorder);
    el.gridToggle.addEventListener('change', () => { if (gridEl) gridEl.style.display = el.gridToggle.checked ? '' : 'none'; });
    el.reroll.addEventListener('click', reroll); el.resetLayout.addEventListener('click', resetLayout);
    el.addBlank.addEventListener('click', insertBlankAfterCurrent);
    el.undo.addEventListener('click', undo); el.redo.addEventListener('click', redo);
    el.zoomIn.addEventListener('click', () => setZoom(zoom * 1.2)); el.zoomOut.addEventListener('click', () => setZoom(zoom / 1.2)); el.zoomFit.addEventListener('click', () => setZoom(fitScale()));
    el.save.addEventListener('click', save); el.exportPdf.addEventListener('click', exportPdf); el.loadRecipe.addEventListener('change', onLoadRecipe);
    el.stageScroll.addEventListener('scroll', syncRulers);
    el.stageInner.addEventListener('pointerdown', (e) => { if (e.target === el.stageInner || e.target === gridEl || e.target === selLayer || e.target === flowEl) setSel([]); });
    window.addEventListener('resize', () => applyZoom());
    window.addEventListener('keydown', onKey);
    let handoff = null;
    try { const raw = localStorage.getItem('pf_editor'); if (raw) { handoff = JSON.parse(raw); localStorage.removeItem('pf_editor'); } } catch (_) { /* */ }
    if (handoff && (handoff.config || handoff.bookId)) { bookConfig = handoff.config || null; openBook(handoff.bookId ? { bookId: handoff.bookId, config: handoff.config } : { config: handoff.config }); }
    else { el.empty.hidden = false; setStatus('Open a book from the Book Builder, or load a recipe.', ''); }
  }
  function onKey(e) {
    if (el.main.hidden) return; const ae = document.activeElement, tag = (ae && ae.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || (ae && ae.isContentEditable)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copySel(); return; }
    if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); return; }
    if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (!sels.length) return; const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { nudge(-step, 0); e.preventDefault(); } else if (e.key === 'ArrowRight') { nudge(step, 0); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { nudge(0, -step); e.preventDefault(); } else if (e.key === 'ArrowDown') { nudge(0, step); e.preventDefault(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { deleteSel(); e.preventDefault(); }
  }
  function onLoadRecipe(ev) {
    const file = ev.target.files && ev.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        const v2 = raw && raw.recipeVersion === 2 ? raw : { book: raw, seed: null };
        bookConfig = { ...(v2.book || {}) }; if (v2.seed != null) bookConfig.seed = v2.seed;
        if (Array.isArray(v2.pagePlan) && v2.pagePlan.length) {
          // Structural plan: assemble clean pages, then rebuild the arrangement.
          pendingPlan = v2.pagePlan;
        } else if (Array.isArray(v2.pageState) && v2.pageState.length) {
          bookConfig.pageState = v2.pageState; // legacy recipes (order unchanged)
        }
        openBook({ config: bookConfig });
      } catch (_) { setStatus('That file is not a valid book recipe.', 'err'); }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }
  init();
})();
