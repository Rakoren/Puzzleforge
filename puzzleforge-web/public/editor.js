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
    zoom100: $('zoom100'), zoomWhole: $('zoomWhole'), zoomWidth: $('zoomWidth'),
    rulerToggle: $('rulerToggle'), navToggle: $('navToggle'), boundToggle: $('boundToggle'), editorMain: $('editorMain'),
    addText: $('addText'), addImage: $('addImage'),
    selNone: $('selNone'), selControls: $('selControls'), measurePanel: $('measurePanel'),
    mX: $('mX'), mY: $('mY'), mScale: $('mScale'), mRot: $('mRot'),
    mW: $('mW'), mH: $('mH'), mWField: $('mWField'), mHField: $('mHField'),
    fontSize: $('fontSize'), objColor: $('objColor'),
    fontFamily: $('fontFamily'), boldBtn: $('boldBtn'), italicBtn: $('italicBtn'), underBtn: $('underBtn'),
    fontGrow: $('fontGrow'), fontShrink: $('fontShrink'), caseBtn: $('caseBtn'), clearFmt: $('clearFmt'), lineSpacing: $('lineSpacing'),
    cutBtn: $('cutBtn'), copyBtn: $('copyBtn'), pasteBtn: $('pasteBtn'), fmtPainter: $('fmtPainter'),
    hAddText: $('hAddText'), hAddImage: $('hAddImage'), hForward: $('hForward'), hBackward: $('hBackward'),
    hGroup: $('hGroup'), hUngroup: $('hUngroup'), findReplaceBtn: $('findReplaceBtn'), selectAllBtn: $('selectAllBtn'),
    frModal: $('frModal'), frClose: $('frClose'), frFind: $('frFind'), frReplace: $('frReplace'), frCase: $('frCase'), frReplaceAll: $('frReplaceAll'), frStatus: $('frStatus'),
    shapeProps: $('shapeProps'), fillColor: $('fillColor'), strokeColor: $('strokeColor'), strokeW: $('strokeW'), noFill: $('noFill'),
    groupBtn: $('groupBtn'), ungroupBtn: $('ungroupBtn'), borderAll: $('borderAll'),
    distH: $('distH'), distV: $('distV'),
    toFront: $('toFront'), forward: $('forward'), backward: $('backward'), toBack: $('toBack'),
    flipH: $('flipH'), flipV: $('flipV'), lockObj: $('lockObj'),
    dupObj: $('dupObj'), resetPos: $('resetPos'), hideObj: $('hideObj'), deleteObj: $('deleteObj'),
    border: $('border'), snapToggle: $('snapToggle'), gridToggle: $('gridToggle'),
    reroll: $('reroll'), resetLayout: $('resetLayout'), addBlankSide: $('addBlankSide'), darkToggle: $('darkToggle'),
    insertTpl: $('insertTpl'), insertTplSide: $('insertTplSide'), savePageTpl: $('savePageTpl'),
    dupPage: $('dupPage'), aiArtBtn: $('aiArtBtn'), wordArt: $('wordArt'), symbolPick: $('symbolPick'), insertDate: $('insertDate'),
    trimInfo: $('trimInfo'), marginGuide: $('marginGuide'), renamePage: $('renamePage'), delPage: $('delPage'),
    movePageUp: $('movePageUp'), movePageDown: $('movePageDown'), schemeGallery: $('schemeGallery'),
    revSpelling: $('revSpelling'), revThesaurus: $('revThesaurus'), revWordCount: $('revWordCount'), revLanguage: $('revLanguage'),
    revModal: $('revModal'), revClose: $('revClose'), revTitle: $('revTitle'), revSub: $('revSub'), revBody: $('revBody'),
    helpBtn: $('helpBtn'), supportBtn: $('supportBtn'), shortcutsBtn: $('shortcutsBtn'),
    helpModal: $('helpModal'), helpClose: $('helpClose'), helpSearch: $('helpSearch'), helpCats: $('helpCats'),
    helpArticles: $('helpArticles'), helpToSupport: $('helpToSupport'),
    supportModal: $('supportModal'), supportClose: $('supportClose'), supType: $('supType'), supTitle: $('supTitle'),
    supBody: $('supBody'), supIncludeCtx: $('supIncludeCtx'), supSubmit: $('supSubmit'), supBrowse: $('supBrowse'), supStatus: $('supStatus'),
    teamBtn: $('teamBtn'), inviteBtn: $('inviteBtn'), mailRecipient: $('mailRecipient'), emailBookBtn: $('emailBookBtn'),
    linkBtn: $('linkBtn'), mailStage: $('mailStage'), assignBtn: $('assignBtn'), notesBtn: $('notesBtn'),
    teamModal: $('teamModal'), teamClose: $('teamClose'), teamName: $('teamName'), teamEmail: $('teamEmail'),
    teamRole: $('teamRole'), teamAdd: $('teamAdd'), teamList: $('teamList'),
    notesModal: $('notesModal'), notesClose: $('notesClose'), notesSub: $('notesSub'), notesList: $('notesList'),
    noteText: $('noteText'), noteAdd: $('noteAdd'),
    tplModal: $('tplModal'), tplClose: $('tplClose'), tplBuiltin: $('tplBuiltin'), tplSaved: $('tplSaved'),
    tplSavedCount: $('tplSavedCount'), tplSavedEmpty: $('tplSavedEmpty'),
    publishBtn: $('publishBtn'), pubModal: $('pubModal'), pubClose: $('pubClose'),
    pubRunChecks: $('pubRunChecks'), pubCheckStatus: $('pubCheckStatus'), pubReport: $('pubReport'),
    pubPrice: $('pubPrice'), pubPaper: $('pubPaper'), pubAge: $('pubAge'), pubDesc: $('pubDesc'),
    pubKeywords: $('pubKeywords'), pubCategories: $('pubCategories'), pubAiText: $('pubAiText'), pubAiImages: $('pubAiImages'),
    pubCoverBg: $('pubCoverBg'), pubCoverText: $('pubCoverText'), pubExport: $('pubExport'), pubExportStatus: $('pubExportStatus'),
    pubCoverStatus: $('pubCoverStatus'), pubOpenCover: $('pubOpenCover'), pubClearCover: $('pubClearCover'), pubSimpleCover: $('pubSimpleCover'),
    save: $('save'), exportPdf: $('exportPdf'), loadRecipe: $('loadRecipe'),
  };
  let bookId = null, bookConfig = null, seed = null, dims = { usableWidth: 636, usableHeight: 816 };
  let pageModels = [], srcPages = [], pendingPlan = null, cur = -1, uid = 1, zoom = 1;
  let sels = [], clipboard = [];
  let vGuide = null, hGuide = null, gridEl = null, selLayer = null, flowEl = null;
  let ribbonActivate = null, ribbonPrevTab = 'home';
  let lastProofIssues = [];
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const setStatus = (t, k) => { el.status.textContent = t || ''; el.status.className = 'status editor-status' + (k ? ' ' + k : ''); };
  const slug = (s) => (s || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'book';
  const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
      m.comps.forEach((c) => {
        const s = cm[c.key]; if (!s) return;
        Object.assign(c, { dx: num(s.dx, 0), dy: num(s.dy, 0), scale: num(s.scale, 1), rot: num(s.rot, 0), hidden: !!s.hidden, locked: !!s.locked });
        if (s.gid) c.gid = s.gid;
        // Restore a matter piece's measured anchor so export matches the editor.
        if (Number.isFinite(Number(s.ax))) { c.baseX = num(s.ax, 0); c.baseY = num(s.ay, 0); c.baseW = num(s.aw, 0); m._measured = true; }
      });
      m.elements = (saved.elements || []).map((e) => ({ ...e, group: 'el', id: e.id || uid++ }));
    }
    if (state && state.border) m._border = state.border;
    if (state && state.borderColor) m._borderColor = state.borderColor;
    return m;
  }
  function modelFromPage(p) {
    const m = {
      role: p.role || 'content', matterKind: p.matterKind || null, src: p.src != null ? p.src : null,
      akIndex: p.akIndex != null ? p.akIndex : null,
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
      if (e.role === 'answerkey') return srcPages.find((sp) => sp.role === 'answerkey' && (sp.akIndex || 0) === (e.akIndex || 0)) || srcPages.find((sp) => sp.role === 'answerkey');
      if (e.role === 'title') return srcPages.find((sp) => sp.role === 'title');
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
    return { role: 'blank', matterKind: null, src: null, akIndex: null, blank: true, type: 'bleedguard', title: 'Blank', activity: true, style: '', comps: [], elements: [], _border: '', undo: [], redo: [] };
  }
  // Deep-copy a page model for duplication (keeps its role/src so export reuses
  // the same source; fresh element ids so overlays are independent).
  function clonePageModel(pm) {
    return {
      role: pm.role, matterKind: pm.matterKind, src: pm.src, akIndex: pm.akIndex, blank: pm.blank, type: pm.type, title: pm.title, activity: pm.activity,
      style: pm.style,
      comps: pm.comps.map((c) => ({ group: 'piece', kind: c.kind, key: c.key, html: c.html, dx: c.dx, dy: c.dy, scale: c.scale, rot: c.rot, hidden: c.hidden, locked: c.locked, baseX: 0, baseY: 0, baseW: 0, baseH: 0 })),
      elements: pm.elements.map((e) => { const { _node, ...r } = e; return { ...r, id: uid++ }; }),
      _border: pm._border, _borderColor: pm._borderColor, name: pm.name || null, undo: [], redo: [],
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
      if (el.trimInfo && dims) el.trimInfo.textContent = `${dims.widthIn}" × ${dims.heightIn}" trim`;
      if (el.revLanguage && bookConfig && bookConfig.language) el.revLanguage.value = bookConfig.language;
      loadTeamState();
      await loadBorderStyles(); buildPageList(); cur = 0; zoom = fitScale(); renderPage();
      setStatus(inviteGreeting || `Editing “${data.title}” — ${pageModels.length} pages.`, 'ok');
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
    if (isMatterPage(pm) && !pm._measured) {
      // Faithful snapshot of the original matter layout (positions not yet known).
      flow.style.minHeight = dims.usableHeight + 'px';
      flow.innerHTML = pm.comps.filter((c) => !c.hidden).map((c) => c.html).join('');
    } else if (isMatterPage(pm)) {
      flow.style.minHeight = dims.usableHeight + 'px';
      pm.comps.forEach((c) => { if (c.hidden) return; const n = document.createElement('div'); n.className = 'pf-piece'; n.innerHTML = c.html; n.style.cssText = `position:absolute;left:${c.baseX}px;top:${c.baseY}px;${c.baseW ? `width:${c.baseW}px;` : ''}transform-origin:top left;`; if (c.dx || c.dy || c.scale !== 1 || c.rot) n.style.transform = `translate(${c.dx}px,${c.dy}px) rotate(${c.rot}deg) scale(${c.scale})`; flow.appendChild(n); });
    } else {
      pm.comps.forEach((c) => { if (c.hidden) return; const n = document.createElement('div'); n.className = 'pf-piece'; n.innerHTML = c.html; if (c.dx || c.dy || c.scale !== 1 || c.rot) n.style.transform = `translate(${c.dx}px,${c.dy}px) rotate(${c.rot}deg) scale(${c.scale})`; flow.appendChild(n); });
    }
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
  const labelFor = (pm) => pm.name || (pm.blank ? (pm.title && pm.title !== 'Blank' ? pm.title : 'Blank page') : ({ bleedguard: 'Blank (bleed guard)', breather: 'Breather' }[pm.type] || pm.title || pm.type));
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

  // --- page templates -------------------------------------------------------
  // Matter and layout pages live in the editor as templates: inserting one
  // drops a fresh page whose content is ordinary, editable text/shape objects.
  const tEl = (o) => ({ group: 'el', kind: 'text', scale: 1, rot: 0, z: 100, color: '#222222', align: 'left', fontSize: 24, w: 240, ...o });
  const sEl = (o) => ({ group: 'el', kind: 'shape', scale: 1, rot: 0, z: 90, fill: 'none', stroke: '#222222', strokeW: 2, ...o });
  const R = Math.round;
  const BUILTIN_TPLS = [
    { id: 'title', name: 'Title Page', desc: 'Book title, subtitle & author', make: (c) => {
      const big = Math.max(34, R(c.W / 7)); const y0 = R(c.H * 0.3);
      const els = [tEl({ text: c.title || 'Book Title', x: 0, y: y0, w: c.W, fontSize: big, align: 'center', bold: true })];
      let ay = y0 + R(big * 1.5);
      if (c.subtitle) { els.push(tEl({ text: c.subtitle, x: R(c.W * 0.1), y: ay, w: R(c.W * 0.8), fontSize: Math.max(16, R(c.W / 24)), align: 'center', color: '#333333' })); ay += R(c.W / 16); }
      els.push(tEl({ text: c.author ? `by ${c.author}` : 'by Your Name', x: 0, y: R(c.H * 0.62), w: c.W, fontSize: Math.max(16, R(c.W / 26)), align: 'center' }));
      return els;
    } },
    { id: 'copyright', name: 'Copyright', desc: 'Legal boilerplate, bottom of page', make: (c) => {
      const fs = Math.max(11, R(c.W / 46)); const x = R(c.W * 0.08), w = R(c.W * 0.84), y0 = R(c.H * 0.72);
      return [
        tEl({ text: `Copyright © ${c.year} ${c.author || c.title || 'Your Name'}`, x, y: y0, w, fontSize: fs }),
        tEl({ text: 'All rights reserved.', x, y: y0 + R(fs * 1.8), w, fontSize: fs }),
        tEl({ text: 'No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission of the publisher, except for brief quotations in reviews.', x, y: y0 + R(fs * 3.8), w, fontSize: Math.max(9, R(fs * 0.86)), color: '#555555' }),
      ];
    } },
    { id: 'belongsTo', name: 'This Book Belongs To', desc: 'Kids ownership page, centered', make: (c) => {
      const fs = Math.max(20, R(c.W / 16));
      return [
        tEl({ text: 'This Book Belongs To', x: 0, y: R(c.H * 0.32), w: c.W, fontSize: fs, align: 'center', bold: true }),
        sEl({ shape: 'line', x: R(c.W * 0.15), y: R(c.H * 0.46), w: R(c.W * 0.7), h: 6, stroke: '#000000', strokeW: 3, fill: 'none' }),
        tEl({ text: '★ ★ ★', x: 0, y: R(c.H * 0.54), w: c.W, fontSize: R(fs * 0.9), align: 'center' }),
      ];
    } },
    { id: 'intro', name: 'Introduction / Welcome', desc: 'Heading + a welcome paragraph', make: (c) => {
      const h = Math.max(22, R(c.W / 14)); const x = R(c.W * 0.08), w = R(c.W * 0.84), y0 = R(c.H * 0.14);
      return [
        tEl({ text: 'Welcome!', x, y: y0, w, fontSize: h, bold: true }),
        tEl({ text: 'Grab a pencil and get ready for hours of fun. Take your time — and if you get stuck, the answers are in the back. Happy puzzling!', x, y: y0 + R(h * 1.8), w, fontSize: Math.max(13, R(c.W / 40)) }),
      ];
    } },
    { id: 'about', name: 'About the Author', desc: 'Heading + short bio', make: (c) => {
      const h = Math.max(20, R(c.W / 15)); const y0 = R(c.H * 0.12);
      return [
        tEl({ text: 'About the Author', x: 0, y: y0, w: c.W, fontSize: h, align: 'center', bold: true }),
        tEl({ text: `${c.author || 'Your name'} makes puzzle and activity books for all ages. Write a short, friendly bio here.`, x: R(c.W * 0.12), y: y0 + R(h * 2), w: R(c.W * 0.76), fontSize: Math.max(13, R(c.W / 40)), align: 'center' }),
      ];
    } },
    { id: 'morebooks', name: 'More Books', desc: 'Cross-promo list page', make: (c) => {
      const h = Math.max(20, R(c.W / 15)); const y0 = R(c.H * 0.14);
      return [
        tEl({ text: "More Books You'll Love", x: 0, y: y0, w: c.W, fontSize: h, align: 'center', bold: true }),
        tEl({ text: '•  Title One\n•  Title Two\n•  Title Three', x: 0, y: y0 + R(h * 2.2), w: c.W, fontSize: Math.max(14, R(c.W / 34)), align: 'center' }),
      ];
    } },
    { id: 'section', name: 'Section Divider', desc: 'Big centered chapter title', make: (c) => (
      [tEl({ text: 'Chapter One', x: 0, y: R(c.H * 0.44), w: c.W, fontSize: Math.max(30, R(c.W / 9)), align: 'center', bold: true })]
    ) },
  ];

  function openTplPicker() { if (el.main.hidden) return; renderTplPicker(); el.tplModal.hidden = false; }
  function closeTplPicker() { el.tplModal.hidden = true; }
  function tplCard(name, desc, onPick, onDelete) {
    const card = document.createElement('div'); card.className = 'pf-tpl-card';
    const pick = document.createElement('button'); pick.className = 'pf-tpl-pick';
    pick.innerHTML = `<span class="pf-tpl-name">${escHtml(name)}</span><span class="pf-tpl-desc">${escHtml(desc)}</span>`;
    pick.addEventListener('click', onPick); card.appendChild(pick);
    if (onDelete) { const d = document.createElement('button'); d.className = 'pf-tpl-del'; d.textContent = '✕'; d.title = 'Delete template'; d.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); }); card.appendChild(d); }
    return card;
  }
  function renderTplPicker() {
    el.tplBuiltin.innerHTML = '';
    BUILTIN_TPLS.forEach((t) => el.tplBuiltin.appendChild(tplCard(t.name, t.desc, () => { insertBuiltinTpl(t); closeTplPicker(); })));
    const saved = loadSavedTemplates();
    el.tplSaved.innerHTML = '';
    el.tplSavedEmpty.hidden = saved.length > 0;
    el.tplSavedCount.textContent = saved.length ? `(${saved.length})` : '';
    saved.forEach((t) => el.tplSaved.appendChild(tplCard(
      t.name, `${t.elements.length} object${t.elements.length !== 1 ? 's' : ''}`,
      () => { insertSavedTpl(t); closeTplPicker(); },
      () => { deleteSavedTemplate(t.id); renderTplPicker(); }
    )));
  }
  function insertBuiltinTpl(t) {
    const ctx = { W: dims.usableWidth, H: dims.usableHeight, title: (bookConfig && bookConfig.title) || '', subtitle: (bookConfig && bookConfig.subtitle) || '', author: (bookConfig && bookConfig.author) || '', year: new Date().getFullYear() };
    insertPageWithEls(t.make(ctx).map((e) => ({ ...e, id: uid++ })), t.name);
  }
  function insertSavedTpl(t) {
    const sx = dims.usableWidth / (t.refW || dims.usableWidth), sy = dims.usableHeight / (t.refH || dims.usableHeight);
    insertPageWithEls((t.elements || []).map((e) => scaleEl(e, sx, sy)), t.name);
  }
  function scaleEl(e, sx, sy) {
    const { _node, ...r } = e; const o = { ...r, group: 'el', id: uid++ };
    o.x = R(num(e.x, 0) * sx); o.y = R(num(e.y, 0) * sy);
    if (e.kind === 'text') { if (e.w != null) o.w = R(num(e.w, 240) * sx); if (e.fontSize != null) o.fontSize = Math.max(6, R(num(e.fontSize, 24) * sx)); }
    else if (e.kind === 'image') { if (e.width != null) o.width = R(num(e.width, 160) * sx); }
    else if (e.kind === 'shape') { if (e.w != null) o.w = R(num(e.w, 160) * sx); if (e.h != null) o.h = R(num(e.h, 120) * sy); }
    return o;
  }
  function insertPageWithEls(els, name) {
    const m = blankModel(); m.title = name || 'Template'; m.elements = els;
    const at = cur < 0 ? pageModels.length : cur + 1;
    pageModels.splice(at, 0, m); cur = at; buildPageList(); renderPage();
    setStatus(`Inserted “${name}”.`, 'ok');
  }
  function savePageAsTemplate() {
    const pm = pageModels[cur];
    if (!pm || !pm.elements || !pm.elements.length) { setStatus('Add text or shapes to this page first, then save it as a template.', 'err'); return; }
    const name = (window.prompt('Name this template:', pm.title && pm.title !== 'Blank' ? pm.title : 'My template') || '').trim();
    if (!name) return;
    const tpl = { id: 't' + Date.now().toString(36), name, refW: R(dims.usableWidth), refH: R(dims.usableHeight),
      elements: pm.elements.map((e) => { const { _node, id, ...r } = e; return r; }) };
    const list = loadSavedTemplates(); list.push(tpl); saveSavedTemplates(list);
    setStatus(`Saved template “${name}”. Find it under Insert → Page template.`, 'ok');
  }
  function loadSavedTemplates() { try { return JSON.parse(localStorage.getItem('pf_templates') || '[]'); } catch (_) { return []; } }
  function saveSavedTemplates(l) { try { localStorage.setItem('pf_templates', JSON.stringify(l)); } catch (_) { setStatus('Could not save the template (browser storage full?).', 'err'); } }
  function deleteSavedTemplate(id) { saveSavedTemplates(loadSavedTemplates().filter((t) => t.id !== id)); }

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
  // Fit the page to the window width only (height may scroll) — Publisher's "Page Width".
  function fitWidth() { const aw = (el.stageScroll.clientWidth || 700) - 24; return Math.max(0.15, Math.min(aw / dims.usableWidth, 4)); }
  // View toggles: rulers, the page-rail sidebar, and the page boundary outline.
  function toggleRulers() { el.editorMain.querySelector('.editor-stage').classList.toggle('no-rulers', !el.rulerToggle.checked); if (el.rulerToggle.checked) applyZoom(); }
  function toggleNav() { el.editorMain.classList.toggle('no-nav', !el.navToggle.checked); applyZoom(); }
  function toggleBounds() { el.stageInner.classList.toggle('show-bounds', el.boundToggle.checked); }

  // Matter pages (title, copyright, …) position content via the page context,
  // so their pieces are placed ABSOLUTELY at a measured page rect rather than in
  // document flow. Content (puzzle) pages keep the flow + delta model.
  const isMatterPage = (pm) => !!(pm && pm.role && pm.role !== 'content' && !pm.blank);
  function applyAbsBase(c) {
    if (!c._node) return;
    c._node.style.position = 'absolute'; c._node.style.left = c.baseX + 'px'; c._node.style.top = c.baseY + 'px';
    if (c.baseW) c._node.style.width = c.baseW + 'px';
  }
  // One-time faithful measure of a matter page: render its original body (no
  // per-piece wrappers) and capture each top-level element's page rectangle.
  function measureMatterBases(pm) {
    const meas = document.createElement('div'); meas.className = 'pf-flow';
    meas.style.cssText = 'position:absolute;top:0;left:0;visibility:hidden;min-height:' + dims.usableHeight + 'px;width:' + dims.usableWidth + 'px;';
    meas.innerHTML = pm.comps.map((c) => c.html).join('');
    el.stageInner.appendChild(meas);
    const ir = el.stageInner.getBoundingClientRect();
    const kids = [...meas.children];
    pm.comps.forEach((c, i) => {
      const k = kids[i]; if (!k) return;
      const r = k.getBoundingClientRect();
      c.baseX = (r.left - ir.left) / zoom; c.baseY = (r.top - ir.top) / zoom; c.baseW = r.width / zoom; c.baseH = r.height / zoom;
    });
    el.stageInner.removeChild(meas);
    pm._measured = true;
  }

  // --- render ---
  function renderPage() {
    const pm = pageModels[cur]; highlightPage();
    const matter = isMatterPage(pm);
    el.stageInner.innerHTML = '';
    const style = document.createElement('style'); style.textContent = scopeCss(pm.style, '#stageInner'); el.stageInner.appendChild(style);
    gridEl = document.createElement('div'); gridEl.className = 'pf-grid-overlay'; gridEl.style.display = el.gridToggle.checked ? '' : 'none'; el.stageInner.appendChild(gridEl);

    el.border.value = pm._border || ''; applyZoom();
    // Matter pages need their true page positions before creating pieces.
    if (matter && pm.comps.length && !pm._measured) measureMatterBases(pm);

    // Pieces: absolute (matter) or in original flow (content), in order.
    flowEl = document.createElement('div'); flowEl.className = 'pf-flow';
    if (matter) flowEl.style.minHeight = dims.usableHeight + 'px';
    pm.comps.forEach((c) => {
      const node = document.createElement('div'); node.className = 'pf-piece' + (matter ? ' pf-abs' : ''); node.dataset.key = c.key;
      node.innerHTML = c.html; node.style.display = c.hidden ? 'none' : '';
      c._node = node; node._ref = c; node.addEventListener('pointerdown', (ev) => onPointerDown(ev, c));
      if (matter) applyAbsBase(c);
      flowEl.appendChild(node);
    });
    el.stageInner.appendChild(flowEl);

    // Absolute element overlays.
    pm.elements.sort((a, b) => num(a.z, 0) - num(b.z, 0)).forEach((e) => el.stageInner.appendChild(makeEl(e)));

    vGuide = document.createElement('div'); vGuide.className = 'pf-guide pf-guide-v'; vGuide.style.display = 'none';
    hGuide = document.createElement('div'); hGuide.className = 'pf-guide pf-guide-h'; hGuide.style.display = 'none';
    selLayer = document.createElement('div'); selLayer.className = 'pf-sel-layer';
    el.stageInner.appendChild(vGuide); el.stageInner.appendChild(hGuide); el.stageInner.appendChild(selLayer);
    applyMarginGuide();

    // Content: measure flow bases (no transform yet). Matter: bases already set.
    requestAnimationFrame(() => { if (!matter) measureBases(pm); pm.comps.forEach(applyPieceTf); sels = []; syncSelUI(); drawSel(); });
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
  // Elements render through the engine's shared renderer (element-html.js), so
  // what's on screen is byte-identical to what the PDF composer prints.
  const elHtml = (e) => window.PFElements.elementHtml(e);
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
  // Which resize handles an object gets: shapes resize freely on all 8;
  // text/images resize width on the sides and scale on the corners; puzzle
  // pieces scale on the corners only.
  function handleDirs(ref) {
    if (ref.kind === 'shape') return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    if (ref.kind === 'text' || ref.kind === 'image') return ['nw', 'ne', 'se', 'sw', 'e', 'w'];
    return ['nw', 'ne', 'se', 'sw'];
  }
  function drawSel() {
    if (!selLayer) return; selLayer.innerHTML = '';
    sels.forEach((ref) => {
      if (!ref._node) return; const b = box(ref);
      const d = document.createElement('div'); d.className = 'pf-selbox'; d.style.transform = `translate(${b.x}px,${b.y}px) rotate(${num(ref.rot, 0)}deg)`; d.style.width = b.w + 'px'; d.style.height = b.h + 'px';
      if (sels.length === 1 && !ref.locked) {
        handleDirs(ref).forEach((dir) => {
          const h = document.createElement('div'); h.className = 'pf-h'; h.dataset.d = dir;
          h.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); startResize(ev, ref, dir); });
          d.appendChild(h);
        });
        const stem = document.createElement('div'); stem.className = 'pf-rot-stem'; d.appendChild(stem);
        const rot = document.createElement('div'); rot.className = 'pf-rot'; rot.title = 'Rotate (Shift snaps to 15°)';
        rot.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); startRotate(ev, ref); });
        d.appendChild(rot);
      }
      selLayer.appendChild(d);
    });
  }
  function syncFontUI(one) {
    const isText = one && one.kind === 'text';
    el.boldBtn.classList.toggle('on', isText && !!one.bold);
    el.italicBtn.classList.toggle('on', isText && !!one.italic);
    el.underBtn.classList.toggle('on', isText && !!one.underline);
    document.querySelectorAll('.palign').forEach((b) => b.classList.toggle('on', isText && (one.align || 'left') === b.dataset.align));
    if (isText) {
      el.fontSize.value = num(one.fontSize, 24); el.objColor.value = one.color || '#222222';
      el.fontFamily.value = one.fontFamily || 'sans'; el.lineSpacing.value = String(num(one.lineHeight, 1.25));
    }
  }
  function syncSelUI() {
    const has = sels.length > 0; el.selNone.classList.toggle('hidden', has); el.selControls.classList.toggle('hidden', !has);
    const one = sels.length === 1 ? sels[0] : null; const isText = one && one.kind === 'text'; const isImg = one && one.kind === 'image'; const isShape = one && one.kind === 'shape'; const isEl = one && one.group === 'el';
    syncFontUI(one);
    if (!has) return;
    el.measurePanel.style.display = one ? '' : 'none';
    el.shapeProps.style.display = isShape ? '' : 'none';
    el.mWField.style.display = isEl ? '' : 'none'; el.mHField.style.display = isShape ? '' : 'none';
    el.flipH.style.display = isImg || isShape ? '' : 'none'; el.flipV.style.display = isImg || isShape ? '' : 'none'; el.dupObj.style.display = isEl ? '' : 'none'; el.deleteObj.style.display = isEl ? '' : 'none';
    el.hideObj.style.display = one && !isEl ? '' : 'none'; el.distH.style.display = sels.length >= 3 ? '' : 'none'; el.distV.style.display = sels.length >= 3 ? '' : 'none';
    el.lockObj.textContent = one && one.locked ? 'Unlock' : 'Lock';
    el.groupBtn.style.display = sels.length >= 2 ? '' : 'none';
    el.ungroupBtn.style.display = sels.some((r) => r.gid) ? '' : 'none';
    if (one) {
      const b = box(one); el.mX.value = Math.round(b.x); el.mY.value = Math.round(b.y); el.mScale.value = Math.round(num(one.scale, 1) * 100); el.mRot.value = Math.round(num(one.rot, 0));
      if (isEl) el.mW.value = Math.round(num(one.kind === 'image' ? one.width : one.w, 0));
      if (isShape) el.mH.value = Math.round(num(one.h, 0));
      if (isShape) {
        el.fillColor.value = /^#/.test(one.fill || '') ? one.fill : '#ffd43b';
        el.strokeColor.value = /^#/.test(one.stroke || '') ? one.stroke : '#222222';
        el.strokeW.value = num(one.strokeW, 2); el.noFill.checked = one.fill === 'none';
      }
    }
  }

  function snapTargets(excl) {
    const xs = [0, dims.usableWidth / 2, dims.usableWidth], ys = [0, dims.usableHeight / 2, dims.usableHeight];
    for (const r of allRefs()) { if (excl.indexOf(r) >= 0 || !r._node) continue; const b = box(r); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); }
    return { xs, ys };
  }
  const showGuide = (g, a, v) => { g.style.display = ''; if (a === 'x') g.style.left = v + 'px'; else g.style.top = v + 'px'; };
  const hideGuides = () => { if (vGuide) vGuide.style.display = 'none'; if (hGuide) hGuide.style.display = 'none'; };

  // --- drag / resize ---
  // Grouped objects select and move as one (Publisher-style groups).
  function expandGroups(list) {
    const gids = new Set(list.map((r) => r.gid).filter(Boolean));
    if (!gids.size) return list;
    const out = list.slice();
    allRefs().forEach((r) => { if (r.gid && gids.has(r.gid) && out.indexOf(r) < 0 && !r.locked) out.push(r); });
    return out;
  }
  function onPointerDown(ev, ref) {
    ev.preventDefault(); hideCtx();
    if (painter && ev.button !== 2 && applyPainter(ref)) { setSel([ref]); return; }
    if (ev.button === 2) { if (!isSel(ref)) setSel(expandGroups([ref])); return; }
    if (ref.locked) { setSel([ref]); return; }
    if (ev.shiftKey) { if (!isSel(ref)) sels.push(ref); } else if (!isSel(ref)) sels = [ref];
    sels = expandGroups(sels);
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
  function startResize(ev, ref, dir) {
    ev.preventDefault(); pushUndo();
    const b0 = box(ref); const r = el.stageInner.getBoundingClientRect();
    const right = b0.x + b0.w, bottom = b0.y + b0.h;
    const move = (e) => {
      const px = (e.clientX - r.left) / zoom, py = (e.clientY - r.top) / zoom;
      if (ref.kind === 'shape') {
        // Shapes resize their intrinsic w/h; the opposite edge stays put.
        let w = ref.w, h = ref.h;
        if (dir.includes('e')) w = px - b0.x;
        if (dir.includes('w')) w = right - px;
        if (dir.includes('s')) h = py - b0.y;
        if (dir.includes('n')) h = bottom - py;
        ref.w = Math.max(8, Math.round(w)); ref.h = Math.max(4, Math.round(h));
        ref._node.innerHTML = elHtml(ref);
        const nb = box(ref);
        moveTo(ref, dir.includes('w') ? right - nb.w : b0.x, dir.includes('n') ? bottom - nb.h : b0.y);
      } else if ((dir === 'e' || dir === 'w') && (ref.kind === 'text' || ref.kind === 'image')) {
        // Side handles set the text box / image width.
        const w = Math.max(20, Math.round((dir === 'e' ? px - b0.x : right - px) / num(ref.scale, 1)));
        if (ref.kind === 'text') ref.w = w; else ref.width = w;
        ref._node.innerHTML = elHtml(ref);
        const nb = box(ref);
        moveTo(ref, dir === 'w' ? right - nb.w : b0.x, b0.y);
      } else {
        // Corner handles scale proportionally; the opposite corner stays put.
        const natW = ref.group === 'piece' ? ref.baseW : ref._node.offsetWidth;
        const natH = ref.group === 'piece' ? ref.baseH : ref._node.offsetHeight;
        const ax = dir.includes('w') ? right : b0.x;
        const ay = dir.includes('n') ? bottom : b0.y;
        const s = Math.max(0.15, Math.min(8, Math.max(Math.abs(px - ax) / (natW || 1), Math.abs(py - ay) / (natH || 1))));
        setScale(ref, s);
        const nb = box(ref);
        moveTo(ref, dir.includes('w') ? ax - nb.w : b0.x, dir.includes('n') ? ay - nb.h : b0.y);
      }
      drawSel(); syncSelUI();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function startRotate(ev, ref) {
    ev.preventDefault(); pushUndo();
    const r = el.stageInner.getBoundingClientRect();
    const b = box(ref); const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const move = (e) => {
      const px = (e.clientX - r.left) / zoom, py = (e.clientY - r.top) / zoom;
      let ang = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      ang = ((ang + 180) % 360 + 360) % 360 - 180;
      setRot(ref, Math.round(ang)); drawSel(); syncSelUI();
    };
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
  function flip(axis) { const o = sels.length === 1 && sels[0]; if (!o || (o.kind !== 'image' && o.kind !== 'shape')) return; pushUndo(); if (axis === 'h') o.flipH = !o.flipH; else o.flipV = !o.flipV; o._node.innerHTML = elHtml(o); }
  function toggleLock() { const o = sels.length === 1 && sels[0]; if (!o) return; pushUndo(); o.locked = !o.locked; syncSelUI(); }

  function addElement(e) { pushUndo(); pageModels[cur].elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); setSel([e]); }
  function addText() { addElement({ group: 'el', id: uid++, kind: 'text', x: Math.round(dims.usableWidth / 2 - 100), y: Math.round(dims.usableHeight / 2), scale: 1, rot: 0, z: 100, text: 'Your text', fontSize: 28, color: '#222222', align: 'left', w: 240 }); }
  function addImageFile(file) { const r = new FileReader(); r.onload = () => addElement({ group: 'el', id: uid++, kind: 'image', x: Math.round(dims.usableWidth / 2 - 80), y: Math.round(dims.usableHeight / 2 - 80), scale: 1, rot: 0, z: 100, src: r.result, width: 160 }); r.readAsDataURL(file); }
  function addShape(shape) {
    const line = shape === 'line';
    addElement({
      group: 'el', id: uid++, kind: 'shape', shape,
      x: Math.round(dims.usableWidth / 2 - 80), y: Math.round(dims.usableHeight / 2 - 60),
      scale: 1, rot: 0, z: 100,
      w: line ? 220 : 160, h: line ? 12 : 120,
      fill: line ? 'none' : schemeFill(), stroke: schemeStroke(), strokeW: line ? 3 : 2,
    });
  }

  // --- Insert: WordArt, Symbol, Date, AI Art ---
  const WORDART = [
    { name: 'Bold Outline', style: { fontSize: 56, bold: true, color: '#ffd43b', fontFamily: 'sans', textStroke: '#222222', textStrokeW: 2 } },
    { name: 'Candy Shadow', style: { fontSize: 52, bold: true, color: '#e64980', fontFamily: 'hand', textShadow: '#00000033' } },
    { name: 'Sky Pop', style: { fontSize: 54, bold: true, color: '#4dabf7', fontFamily: 'sans', textStroke: '#1c3d5a', textStrokeW: 1.5 } },
    { name: 'Classic Serif', style: { fontSize: 48, bold: true, color: '#222222', fontFamily: 'serif' } },
    { name: 'Ghost Outline', style: { fontSize: 58, bold: true, color: '#ffffff', fontFamily: 'sans', textStroke: '#222222', textStrokeW: 2 } },
    { name: 'Sunset', style: { fontSize: 54, bold: true, color: '#ff922b', fontFamily: 'hand', textStroke: '#7a3b00', textStrokeW: 1.5, textShadow: '#00000030' } },
  ];
  const SYMBOLS = '★ ☆ ♥ ● ○ ◆ ■ ▲ ► ◄ ▼ → ← ↑ ↓ ⇒ ✓ ✗ ✚ ✦ ✪ ☀ ☁ ☂ ☺ ☹ ♪ ♫ ✏ ✂ ⚑ ❄ ☘ ⬤ ⬛ ⬜ 🔢 🎯'.split(' ');
  function addWordArt(preset) {
    if (!preset) return;
    addElement({ group: 'el', id: uid++, kind: 'text', x: Math.round(dims.usableWidth / 2 - 160), y: Math.round(dims.usableHeight * 0.3),
      scale: 1, rot: 0, z: 110, text: 'Your Title', align: 'center', w: 320, lineHeight: 1.15, ...preset.style });
  }
  function addSymbol(sym) {
    if (!sym) return;
    const o = selText();
    if (o) { pushUndo(); o.text = (o.text || '') + sym; o._node.innerHTML = elHtml(o); drawSel(); }
    else addElement({ group: 'el', id: uid++, kind: 'text', x: Math.round(dims.usableWidth / 2 - 30), y: Math.round(dims.usableHeight / 2 - 30), scale: 1, rot: 0, z: 100, text: sym, fontSize: 48, color: '#222222', align: 'center', w: 60 });
  }
  function insertDate() {
    addElement({ group: 'el', id: uid++, kind: 'text', x: Math.round(dims.usableWidth / 2 - 90), y: Math.round(dims.usableHeight / 2), scale: 1, rot: 0, z: 100, text: new Date().toLocaleDateString(), fontSize: 22, color: '#222222', align: 'center', w: 180 });
  }
  function openAiArt() { window.open('aiart.html', '_blank'); }
  function populateInsertMenus() {
    if (el.wordArt.options.length <= 1) WORDART.forEach((w, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = w.name; el.wordArt.appendChild(o); });
    if (el.symbolPick.options.length <= 1) SYMBOLS.forEach((s) => { const o = document.createElement('option'); o.value = s; o.textContent = s; el.symbolPick.appendChild(o); });
  }

  // --- Page Design: color schemes ---
  const SCHEMES = [
    { id: 'office', name: 'Office', colors: ['#3b5bdb', '#e64980', '#f59f00', '#2b8a3e'] },
    { id: 'ocean', name: 'Ocean', colors: ['#1864ab', '#1c7ed6', '#22b8cf', '#0ca678'] },
    { id: 'candy', name: 'Candy', colors: ['#d6336c', '#e64980', '#f783ac', '#f59f00'] },
    { id: 'forest', name: 'Forest', colors: ['#2b8a3e', '#37b24d', '#94d82d', '#66a80f'] },
    { id: 'sunset', name: 'Sunset', colors: ['#e8590c', '#f76707', '#f59f00', '#e03131'] },
    { id: 'grape', name: 'Grape', colors: ['#6741d9', '#9c36b5', '#ae3ec9', '#7048e8'] },
    { id: 'slate', name: 'Slate', colors: ['#212529', '#495057', '#1c7ed6', '#adb5bd'] },
    { id: 'classic', name: 'Classic', colors: ['#000000', '#444444', '#888888', '#bbbbbb'] },
  ];
  let activeScheme = null;
  const schemeFill = () => (activeScheme ? activeScheme.colors[2] : '#ffd43b');
  const schemeStroke = () => (activeScheme ? activeScheme.colors[0] : '#222222');
  function renderSchemes() {
    if (!el.schemeGallery || el.schemeGallery.childElementCount) return;
    SCHEMES.forEach((s) => {
      const chip = document.createElement('button'); chip.className = 'scheme-chip'; chip.dataset.id = s.id; chip.title = s.name;
      chip.innerHTML = `<span class="scheme-sw">${s.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span><span class="scheme-nm">${s.name}</span>`;
      chip.addEventListener('click', () => applyScheme(s));
      el.schemeGallery.appendChild(chip);
    });
  }
  function applyScheme(s) {
    activeScheme = s;
    pageModels.forEach((pm) => { pm._borderColor = s.colors[0]; });
    // Immediate feedback: recolor whatever's selected to the scheme.
    if (sels.length) {
      pushUndo();
      sels.forEach((r) => {
        if (r.kind === 'shape') { r.fill = s.colors[2]; r.stroke = s.colors[0]; r._node.innerHTML = elHtml(r); }
        else if (r.kind === 'text') { r.color = s.colors[0]; r._node.innerHTML = elHtml(r); }
      });
      drawSel(); syncSelUI();
    }
    [...el.schemeGallery.children].forEach((c) => c.classList.toggle('active', c.dataset.id === s.id));
    setStatus(`“${s.name}” scheme active — new shapes and page frames use these colors (frames show on export). Selected items were recolored.`, 'ok');
  }

  // --- Page Design: rename / margin guide ---
  function renamePagePrompt() {
    const pm = pageModels[cur]; if (!pm) return;
    const name = window.prompt('Name this page (shown in the page list):', pm.name || labelFor(pm));
    if (name === null) return;
    pm.name = name.trim() || null; buildPageList();
  }
  function applyMarginGuide() {
    if (!el.stageInner) return;
    let g = el.stageInner.querySelector('.pf-margin-guide');
    if (el.marginGuide.checked) {
      if (!g) { g = document.createElement('div'); g.className = 'pf-margin-guide'; el.stageInner.appendChild(g); }
      const inset = 24; // ~0.25in keep-clear from the usable edge
      g.style.cssText = `position:absolute;left:${inset}px;top:${inset}px;right:${inset}px;bottom:${inset}px;border:1px dashed #ff2d9b;pointer-events:none;z-index:5;`;
    } else if (g) { g.remove(); }
  }
  function applyShapeProp(prop, val) { const o = sels.length === 1 && sels[0]; if (!o || o.kind !== 'shape') return; o[prop] = val; o._node.innerHTML = elHtml(o); drawSel(); }
  // W/H from the measure panel: intrinsic size per kind.
  function setElSize(prop, val) {
    const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'el') return; pushUndo();
    if (prop === 'w') { if (o.kind === 'image') o.width = Math.max(8, val); else o.w = Math.max(8, val); }
    else if (o.kind === 'shape') o.h = Math.max(4, val);
    o._node.innerHTML = elHtml(o); drawSel(); syncSelUI();
  }

  // --- group / clipboard extras / select all ---
  function groupSel() { if (sels.length < 2) return; pushUndo(); const gid = 'g' + uid++; sels.forEach((r) => { r.gid = gid; }); syncSelUI(); }
  function ungroupSel() { if (!sels.some((r) => r.gid)) return; pushUndo(); sels.forEach((r) => { delete r.gid; }); syncSelUI(); }
  function cutSel() { copySel(); deleteSel(); }
  function selectAll() { setSel(allRefs().filter((r) => !r.locked)); }

  // --- marquee (rubber-band) selection ---
  function startMarquee(ev) {
    hideCtx();
    const r = el.stageInner.getBoundingClientRect();
    const sx = (ev.clientX - r.left) / zoom, sy = (ev.clientY - r.top) / zoom;
    const mq = document.createElement('div'); mq.className = 'pf-marquee'; mq.style.display = 'none';
    el.stageInner.appendChild(mq);
    let rect = null;
    const move = (e) => {
      const px = (e.clientX - r.left) / zoom, py = (e.clientY - r.top) / zoom;
      rect = { x: Math.min(sx, px), y: Math.min(sy, py), w: Math.abs(px - sx), h: Math.abs(py - sy) };
      if (rect.w > 3 || rect.h > 3) {
        mq.style.display = '';
        mq.style.left = rect.x + 'px'; mq.style.top = rect.y + 'px'; mq.style.width = rect.w + 'px'; mq.style.height = rect.h + 'px';
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      mq.remove();
      if (rect && (rect.w > 3 || rect.h > 3)) {
        const hit = allRefs().filter((rf) => {
          if (rf.locked || !rf._node) return false; const b = box(rf);
          return b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y;
        });
        setSel(expandGroups(hit));
      } else setSel([]);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  // --- right-click context menu ---
  let ctxEl = null;
  function hideCtx() { if (ctxEl) { ctxEl.remove(); ctxEl = null; } }
  function showCtx(ev) {
    ev.preventDefault(); hideCtx();
    const one = sels.length === 1 ? sels[0] : null;
    const hasEl = sels.some((r) => r.group === 'el');
    const items = [];
    if (sels.length) {
      if (hasEl) items.push({ label: 'Cut', fn: cutSel }, { label: 'Copy', fn: copySel });
      else items.push({ label: 'Copy', fn: copySel });
    }
    if (clipboard.length) items.push({ label: 'Paste', fn: paste });
    if (one && one.group === 'el') items.push({ label: 'Duplicate', fn: duplicate });
    if (hasEl) items.push({ label: 'Delete', fn: deleteSel });
    if (items.length) items.push('-');
    if (one && one.group === 'el') items.push({ label: 'Bring to front', fn: () => reorder('front') }, { label: 'Send to back', fn: () => reorder('back') }, '-');
    if (sels.length >= 2) items.push({ label: 'Group', fn: groupSel });
    if (sels.some((r) => r.gid)) items.push({ label: 'Ungroup', fn: ungroupSel });
    if (one) items.push({ label: one.locked ? 'Unlock' : 'Lock', fn: toggleLock });
    if (one && one.group === 'piece') items.push({ label: 'Hide piece', fn: hideComp });
    if (!items.length) return;
    ctxEl = document.createElement('div'); ctxEl.className = 'pf-ctx';
    items.forEach((it) => {
      if (it === '-') { const s = document.createElement('div'); s.className = 'pf-ctx-sep'; ctxEl.appendChild(s); return; }
      const b = document.createElement('button'); b.textContent = it.label;
      b.addEventListener('click', () => { hideCtx(); it.fn(); });
      ctxEl.appendChild(b);
    });
    document.body.appendChild(ctxEl);
    const mw = ctxEl.offsetWidth, mh = ctxEl.offsetHeight;
    ctxEl.style.left = Math.min(ev.clientX, window.innerWidth - mw - 8) + 'px';
    ctxEl.style.top = Math.min(ev.clientY, window.innerHeight - mh - 8) + 'px';
  }
  function editText(ref) { const bx = ref._node.querySelector('.pf-textbox'); bx.setAttribute('contenteditable', 'true'); bx.focus(); pushUndo(); const done = () => { bx.removeAttribute('contenteditable'); ref.text = bx.innerText; bx.removeEventListener('blur', done); }; bx.addEventListener('blur', done); }
  function applyTextProp(prop, val) { const o = sels.length === 1 && sels[0]; if (!o || o.kind !== 'text') return; o[prop] = val; o._node.innerHTML = elHtml(o); drawSel(); syncFontUI(o); }
  const applyTextPropU = (prop, val) => { const o = sels.length === 1 && sels[0]; if (o && o.kind === 'text') { pushUndo(); applyTextProp(prop, val); } };
  const selText = () => { const o = sels.length === 1 && sels[0]; return o && o.kind === 'text' ? o : null; };
  // --- Home: font & paragraph tools ---
  function fontStep(delta) { const o = selText(); if (!o) return; applyTextPropU('fontSize', Math.max(6, Math.min(200, num(o.fontSize, 24) + delta))); }
  function changeCase() {
    const o = selText(); if (!o) return; const t = String(o.text || '');
    const upper = t.toUpperCase(), lower = t.toLowerCase();
    const title = t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    // Cycle UPPER → lower → Title; anything mixed starts the cycle at UPPER.
    const next = t === upper ? lower : t === lower ? title : t === title ? upper : upper;
    applyTextPropU('text', next);
  }
  function clearTextFmt() {
    const o = selText(); if (!o) return; pushUndo();
    Object.assign(o, { fontFamily: 'sans', fontSize: 24, color: '#222222', bold: false, italic: false, underline: false, align: 'left', lineHeight: 1.25 });
    o._node.innerHTML = elHtml(o); drawSel(); syncFontUI(o);
  }
  // --- Format Painter: copy an object's look, apply to the next one clicked ---
  let painter = null;
  const TEXT_STYLE = ['fontFamily', 'fontSize', 'color', 'bold', 'italic', 'underline', 'align', 'lineHeight'];
  const SHAPE_STYLE = ['fill', 'stroke', 'strokeW'];
  function togglePainter() {
    if (painter) { painter = null; el.fmtPainter.classList.remove('on'); return; }
    const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'el' || o.kind === 'image') { setStatus('Select a text box or shape first, then Format Painter.', 'err'); return; }
    const keys = o.kind === 'text' ? TEXT_STYLE : SHAPE_STYLE;
    painter = { kind: o.kind, style: {} }; keys.forEach((k) => { painter.style[k] = o[k]; });
    el.fmtPainter.classList.add('on'); setStatus('Format Painter armed — click a ' + o.kind + ' to apply the look.', 'busy');
  }
  function applyPainter(ref) {
    if (!painter || !ref || ref.kind !== painter.kind) return false;
    pushUndo(); Object.assign(ref, painter.style); ref._node.innerHTML = elHtml(ref);
    painter = null; el.fmtPainter.classList.remove('on'); setStatus('Look applied.', 'ok'); return true;
  }
  // --- Find & Replace (across every page's text objects) ---
  function openFindReplace() { if (el.main.hidden) return; el.frStatus.textContent = ''; el.frModal.hidden = false; el.frFind.focus(); }
  function closeFindReplace() { el.frModal.hidden = true; }
  function doReplaceAll() {
    const find = el.frFind.value; if (!find) { el.frStatus.textContent = 'Enter text to find.'; el.frStatus.className = 'pf-pub-status err'; return; }
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), el.frCase.checked ? 'g' : 'gi');
    const repl = el.frReplace.value;
    let count = 0; const pagesTouched = new Set();
    pushUndo(); // undo covers the current page; other pages update in memory
    pageModels.forEach((pm, pi) => {
      pm.elements.forEach((e) => {
        if (e.kind === 'text' && typeof e.text === 'string') {
          const m = e.text.match(re);
          if (m) { count += m.length; e.text = e.text.replace(re, repl); pagesTouched.add(pi); }
        }
      });
    });
    if (count) { renderPage(); el.frStatus.textContent = `Replaced ${count} occurrence${count !== 1 ? 's' : ''} across ${pagesTouched.size} page${pagesTouched.size !== 1 ? 's' : ''}.`; el.frStatus.className = 'pf-pub-status ok'; }
    else { el.frStatus.textContent = 'No matches found.'; el.frStatus.className = 'pf-pub-status'; }
  }
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
  // A page with no moved/hidden pieces and no overlays renders faithfully from
  // the original template — export it as passthrough (no layout), which is
  // pixel-perfect and avoids any measurement drift on matter pages.
  function isPristine(pm) {
    if (pm.elements && pm.elements.length) return false;
    return pm.comps.every((c) => !c.dx && !c.dy && c.scale === 1 && !c.rot && !c.hidden && !c.locked);
  }
  function pageStateOf(pm) {
    const st = {};
    if (!isPristine(pm)) {
      const matter = isMatterPage(pm);
      const comp = {};
      pm.comps.forEach((c) => {
        const o = { dx: Math.round(c.dx), dy: Math.round(c.dy), scale: round2(c.scale), rot: round2(c.rot), hidden: c.hidden, locked: c.locked };
        if (c.gid) o.gid = c.gid;
        // Matter pieces carry their measured page anchor so the server can pin
        // them absolutely (it has no DOM to measure with).
        if (matter) { o.ax = Math.round(c.baseX); o.ay = Math.round(c.baseY); o.aw = Math.round(c.baseW); }
        comp[c.key] = o;
      });
      const elements = pm.elements.map((e) => ({
        kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), scale: round2(e.scale), rot: round2(e.rot), z: e.z,
        text: e.text, fontSize: e.fontSize, color: e.color, align: e.align, w: e.w,
        fontFamily: e.fontFamily, bold: e.bold, italic: e.italic, underline: e.underline, lineHeight: e.lineHeight,
        textStroke: e.textStroke, textStrokeW: e.textStrokeW, textShadow: e.textShadow,
        src: e.src, width: e.width, flipH: e.flipH, flipV: e.flipV,
        shape: e.shape, h: e.h, fill: e.fill, stroke: e.stroke, strokeW: e.strokeW,
        gid: e.gid,
      }));
      st.layout = { comp, elements };
    }
    if (pm._border) st.border = pm._border;
    if (pm._borderColor) st.borderColor = pm._borderColor;
    return st;
  }
  // Per-page arrangement for export/recipe: keeps the final page order, marks
  // inserted blanks, and references each real page's original book index (src).
  const buildPagePlan = () => pageModels.map((pm) => {
    const state = pageStateOf(pm);
    if (pm.blank) return { role: 'blank', state };
    if (pm.role === 'content') return { role: 'content', src: pm.src, state };
    if (pm.role === 'frontmatter' || pm.role === 'backmatter') return { role: pm.role, matterKind: pm.matterKind, state };
    if (pm.role === 'answerkey') return { role: 'answerkey', akIndex: pm.akIndex || 0, state };
    return { role: pm.role, state }; // title
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

  // --- Publish flow (pre-flight + KDP package) ------------------------------
  const bookBody = () => (bookId ? { bookId, pagePlan: buildPagePlan() } : { config: bookConfig, pagePlan: buildPagePlan() });
  function openPublish() { if (el.main.hidden) return; refreshCoverState(); el.pubModal.hidden = false; }
  function closePublish() { el.pubModal.hidden = true; }
  const bookTitle = () => (bookConfig && bookConfig.title) || '';
  function savedCover() { try { return JSON.parse(localStorage.getItem('pf_cover') || 'null'); } catch (_) { return null; } }
  function refreshCoverState() {
    const cover = savedCover();
    if (cover) {
      el.pubCoverStatus.textContent = `✓ Using your Cover Builder design${cover.title ? ` (“${cover.title}”)` : ''}. Trim & spine are matched to this book automatically.`;
      el.pubCoverStatus.className = 'pf-cover-status ok';
      el.pubClearCover.hidden = false; el.pubSimpleCover.hidden = true;
    } else {
      el.pubCoverStatus.textContent = 'No custom cover yet — a simple cover is generated from your title and the colors below. Or design one in the Cover Builder.';
      el.pubCoverStatus.className = 'pf-cover-status';
      el.pubClearCover.hidden = true; el.pubSimpleCover.hidden = false;
    }
  }
  function openCoverBuilder() {
    const seed = { title: bookTitle(), subtitle: (bookConfig && bookConfig.subtitle) || '', author: (bookConfig && bookConfig.author) || '',
      trimSize: (bookConfig && bookConfig.trimSize) || '', pageCount: pageModels.length, blurb: el.pubDesc.value || '' };
    try { localStorage.setItem('pf_cover_seed', JSON.stringify(seed)); } catch (_) { /* */ }
    window.open('cover.html', '_blank');
    el.pubCoverStatus.textContent = 'Design your cover in the new tab, click “Use for this book”, then come back — it’ll be picked up here.';
    el.pubCoverStatus.className = 'pf-cover-status busy';
  }
  function clearCover() { try { localStorage.removeItem('pf_cover'); } catch (_) { /* */ } refreshCoverState(); }
  function gatherMeta() {
    return { description: el.pubDesc.value, keywords: el.pubKeywords.value, categories: el.pubCategories.value, readingAge: el.pubAge.value,
      listPrice: el.pubPrice.value, paper: el.pubPaper.value, aiText: el.pubAiText.checked, aiImages: el.pubAiImages.checked,
      language: (bookConfig && bookConfig.language) || (el.revLanguage && el.revLanguage.value) || 'en' };
  }
  const gatherCover = () => ({ bgColor: el.pubCoverBg.value, textColor: el.pubCoverText.value, paper: el.pubPaper.value, blurb: el.pubDesc.value });
  const setPubStatus = (node, text, kind) => { node.textContent = text || ''; node.className = 'pf-pub-status' + (kind ? ' ' + kind : ''); };

  // --- Review tab: spelling / thesaurus / word count / language ---
  function openReview(title, sub) {
    if (!el.revModal) return;
    el.revTitle.textContent = title; el.revSub.textContent = sub || ''; el.revBody.innerHTML = '';
    el.revModal.hidden = false;
  }
  function closeReview() { if (el.revModal) el.revModal.hidden = true; }
  async function runSpelling() {
    if (el.main.hidden) return;
    openReview('Spelling & grammar', 'Checking every text box you’ve added (titles, matter, labels). Puzzle grids and clues are skipped.');
    el.revBody.innerHTML = '<div class="rep-note">Proofreading…</div>';
    try {
      const r = await fetch('/api/book/proofread', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookBody()) });
      const data = await r.json();
      if (!r.ok) { el.revBody.innerHTML = `<div class="rep-note err">${escHtml(data.error || 'Proofread failed.')}</div>`; return; }
      const iss = data.issues || [];
      if (data.note && !iss.length) { el.revBody.innerHTML = `<div class="rep-note">${escHtml(data.note)}</div>`; return; }
      if (!iss.length) { el.revBody.innerHTML = `<div class="rep-ok">No spelling or grammar issues found across ${data.checked} text ${data.checked === 1 ? 'box' : 'boxes'}.</div>`; return; }
      el.revBody.innerHTML = `<div class="rep-summary">${iss.length} issue${iss.length === 1 ? '' : 's'} found · ${data.checked} text boxes checked</div><ul class="rep-list">` +
        iss.map((x) => `<li class="${x.severity === 'error' ? 'blocker' : 'warning'}"><b>p.${x.page}:</b> “${escHtml(x.original)}” → “${escHtml(x.fix)}”${x.note ? ` <span class="rep-dim">(${escHtml(x.note)})</span>` : ''}</li>`).join('') + '</ul>';
    } catch (err) { el.revBody.innerHTML = `<div class="rep-note err">${escHtml(err.message)}</div>`; }
  }
  async function runThesaurus() {
    if (el.main.hidden) return;
    const one = sels.length === 1 && sels[0];
    if (!one || one.kind !== 'text') { setStatus('Select a single text box first, then click Thesaurus.', 'err'); return; }
    const word = String(one.text || '').trim();
    if (!word) { setStatus('That text box is empty — nothing to look up.', 'err'); return; }
    openReview('Thesaurus', `Synonyms for “${word.length > 40 ? word.slice(0, 40) + '…' : word}”. Click one to replace the selected text box.`);
    el.revBody.innerHTML = '<div class="rep-note">Looking up…</div>';
    try {
      const r = await fetch('/api/thesaurus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word }) });
      const data = await r.json();
      if (!r.ok) { el.revBody.innerHTML = `<div class="rep-note err">${escHtml(data.error || 'Lookup failed.')}</div>`; return; }
      const syns = data.synonyms || [];
      if (!syns.length) { el.revBody.innerHTML = `<div class="rep-note">${escHtml(data.note || 'No synonyms found for that word.')}</div>`; return; }
      const wrap = document.createElement('div'); wrap.className = 'syn-list';
      syns.forEach((s) => { const b = document.createElement('button'); b.className = 'syn-chip'; b.textContent = s; b.addEventListener('click', () => replaceSelText(one, s)); wrap.appendChild(b); });
      el.revBody.innerHTML = ''; el.revBody.appendChild(wrap);
    } catch (err) { el.revBody.innerHTML = `<div class="rep-note err">${escHtml(err.message)}</div>`; }
  }
  function replaceSelText(ref, text) {
    if (!pageModels[cur] || pageModels[cur].elements.indexOf(ref) < 0) { setStatus('That text box is no longer on the current page.', 'err'); return; }
    pushUndo(); ref.text = text; ref._node.innerHTML = elHtml(ref); drawSel(); syncSelUI();
    closeReview(); setStatus(`Replaced with “${text}”.`, 'ok');
  }
  function reviewWordCount() {
    if (el.main.hidden) return;
    let words = 0, chars = 0, boxes = 0;
    const add = (t) => { const s = String(t || '').trim(); if (!s) return; boxes++; chars += s.length; words += (s.match(/\S+/g) || []).length; };
    if (bookConfig) { add(bookConfig.title); add(bookConfig.subtitle); }
    pageModels.forEach((pm) => pm.elements.forEach((e) => { if (e.kind === 'text') add(e.text); }));
    openReview('Word count', 'Counts the reader-facing text you’ve added. Puzzle grids, clues, and answer keys are generated and not counted.');
    el.revBody.innerHTML = `<div class="wc-grid">
      <div class="wc-cell"><b>${words}</b><span>words</span></div>
      <div class="wc-cell"><b>${chars}</b><span>characters</span></div>
      <div class="wc-cell"><b>${boxes}</b><span>text boxes</span></div>
      <div class="wc-cell"><b>${pageModels.length}</b><span>pages</span></div>
    </div>`;
  }

  // --- Help tab: Help Center + Contact Support ---
  const GH_REPO = 'https://github.com/Rakoren/Puzzleforge';
  const HELP_ARTICLES = [
    { cat: 'Getting Started', q: 'How do I open a book in the editor?',
      a: 'Build a book in the <b>Book Builder</b> and click <b>Open in Editor</b>, or use <b>Open recipe</b> to load a saved <code>.json</code> book. Every page — title, matter, puzzles, and answer keys — appears in the page rail on the left.' },
    { cat: 'Getting Started', q: 'What are the parts of the workspace?',
      a: 'The <b>ribbon</b> (Home, Insert, Page Design, Review, View, Help) holds every tool. The <b>page rail</b> on the left lists your pages — click to open one, drag the ↑ ↓ ⧉ ✕ controls to reorder, duplicate, or delete. The <b>canvas</b> in the middle is your page; rulers frame it. Select an object to reveal the contextual <b>Format</b> tab.' },
    { cat: 'Getting Started', q: 'How do I save my work?',
      a: '<b>Save</b> writes a recipe file you can reopen later; it captures your page order and every text/shape/image you added. <b>Export</b> composites the whole book into a print-resolution PDF. Nothing is stored on a server — keep your recipe file safe.' },

    { cat: 'Create & Format', q: 'How do I add text, shapes, and images?',
      a: 'Use the <b>Insert</b> tab: <b>Text Box</b>, the shape buttons (rectangle, ellipse, triangle, star, line), <b>Image</b>, <b>WordArt</b> for styled titles, and <b>Symbol</b> for special characters. New objects drop onto the current page and can be dragged, resized (○ handle), and rotated.' },
    { cat: 'Create & Format', q: 'How do I format text?',
      a: 'Select a text box and use the <b>Home</b> tab: font, size, bold/italic/underline, color, alignment, and line spacing. <b>Format Painter</b> copies one object’s look onto another. <b>Find &amp; Replace</b> (Home) edits text across every page at once.' },
    { cat: 'Create & Format', q: 'What is WordArt?',
      a: '<b>Insert → WordArt</b> drops a preset styled title (outline + shadow effects). Because the editor and the PDF share one renderer, the effect prints exactly as you see it on screen.' },

    { cat: 'Layout & Templates', q: 'How do I add a title page, copyright, or intro?',
      a: 'Use <b>Insert → Page template</b>. Pick from built-in templates (Title Page, Copyright, Intro, and more) — each inserts a real, editable page. Build a page you like and use <b>Save as template…</b> to reuse it later.' },
    { cat: 'Layout & Templates', q: 'How do I reorder, rename, or delete pages?',
      a: 'From the <b>page rail</b> use ↑ ↓ to move, ⧉ to duplicate, ✕ to delete. The <b>Page Design</b> tab has the same controls plus <b>Rename</b>, which gives a page a friendly name in the rail.' },
    { cat: 'Layout & Templates', q: 'How do color schemes and page frames work?',
      a: '<b>Page Design → Schemes</b> applies a palette: it sets each page’s frame accent color, recolors your current selection, and becomes the default color for new shapes. Pair it with a border style so the frame prints.' },
    { cat: 'Layout & Templates', q: 'How do I check my margins?',
      a: 'Turn on <b>Page Design → Show safe-margin guide</b> for a keep-clear overlay, and <b>View → Boundaries</b> to outline the page edge. Neither prints — they’re on-screen guides only.' },

    { cat: 'Print & Export', q: 'How do I export a print-ready PDF?',
      a: 'Click <b>Export</b>. The PDF honors your book’s trim size and bleed, and composites every object at print resolution. What you see on the canvas is what prints.' },
    { cat: 'Print & Export', q: 'How do I publish to KDP?',
      a: 'Open <b>Publish</b>. It runs a <b>pre-flight check</b> (trim, page count, margins) and a <b>proofread</b>, then bundles everything KDP needs — <code>interior.pdf</code>, <code>cover.pdf</code>, and a <code>build-info.txt</code> sheet — into one <code>.zip</code>. You can export even with warnings for now.' },
    { cat: 'Print & Export', q: 'How do I make a cover?',
      a: 'From the Publish window click <b>Open Cover Builder</b>. Design your cover, click <b>Use for this book</b>, and return — the package picks it up and matches the spine width to your real page count automatically.' },

    { cat: 'Troubleshooting', q: 'Spelling or Thesaurus says it needs an API key',
      a: 'Those tools use Claude. Set the <code>ANTHROPIC_API_KEY</code> environment variable and restart the server. Word Count and everything else work without a key.' },
    { cat: 'Troubleshooting', q: 'My object looks different in the exported PDF',
      a: 'The editor and PDF use the same renderer, so differences usually mean a font fell back. Stick to the provided font families, and remember the safe-margin guide and boundaries are screen-only and never print.' },
    { cat: 'Troubleshooting', q: 'Export produces a blank or failed PDF',
      a: 'PDF export needs Chromium available to the server. If it can’t be found, the server logs a message with how to point it at a Chromium binary. Re-run once that’s set.' },

    { cat: 'Shortcuts', q: 'Keyboard shortcuts',
      a: '<b>Ctrl+Z / Ctrl+Y</b> undo / redo · <b>Ctrl+C / Ctrl+V</b> copy / paste · <b>Ctrl+D</b> duplicate · <b>Delete</b> remove selected · <b>Arrow keys</b> nudge 1px (<b>Shift</b> = 10px) · drag to move, ○ handle to resize.' },
  ];
  function openHelp(cat) {
    if (!el.helpModal) return;
    el.helpModal.hidden = false;
    if (cat) el.helpSearch.value = '';
    renderHelp(el.helpSearch.value.trim(), cat || null);
    if (!cat) setTimeout(() => el.helpSearch.focus(), 30);
  }
  function closeHelp() { if (el.helpModal) el.helpModal.hidden = true; }
  let helpCat = null;
  function renderHelp(query, cat) {
    if (cat !== undefined) helpCat = cat;
    const q = (query || '').toLowerCase();
    const cats = [...new Set(HELP_ARTICLES.map((a) => a.cat))];
    // Category rail (search overrides the active category filter).
    el.helpCats.innerHTML = '';
    const mkCat = (name, label) => { const b = document.createElement('button'); b.className = 'pf-help-cat' + ((!q && helpCat === name) ? ' active' : ''); b.textContent = label; b.addEventListener('click', () => { el.helpSearch.value = ''; renderHelp('', name); }); return b; };
    el.helpCats.appendChild(mkCat(null, 'All topics'));
    cats.forEach((c) => el.helpCats.appendChild(mkCat(c, c)));
    // Articles filtered by search, else by active category.
    const list = HELP_ARTICLES.filter((a) => q ? (a.q + ' ' + a.a + ' ' + a.cat).toLowerCase().includes(q) : (!helpCat || a.cat === helpCat));
    if (!list.length) { el.helpArticles.innerHTML = `<p class="pf-modal-sub">No articles match “${escHtml(query)}”. Try another word, or <b>Contact Support</b>.</p>`; return; }
    let html = ''; let lastCat = null;
    list.forEach((a) => {
      if (a.cat !== lastCat) { html += `<h3 class="pf-help-group">${escHtml(a.cat)}</h3>`; lastCat = a.cat; }
      html += `<details class="pf-help-art"${q ? ' open' : ''}><summary>${escHtml(a.q)}</summary><div class="pf-help-ans">${a.a}</div></details>`;
    });
    el.helpArticles.innerHTML = html;
  }

  function openSupport() {
    if (!el.supportModal) return;
    if (el.supBrowse) el.supBrowse.href = GH_REPO + '/issues';
    el.supStatus.textContent = ''; el.supStatus.className = 'pf-pub-status';
    el.supportModal.hidden = false;
    setTimeout(() => el.supTitle.focus(), 30);
  }
  function closeSupport() { if (el.supportModal) el.supportModal.hidden = true; }
  function supportContext() {
    const trim = (bookConfig && bookConfig.trimSize) || (dims ? `${dims.widthIn}×${dims.heightIn}in` : 'unknown');
    return ['', '', '---', `Book: ${bookTitle() || '(untitled)'} · trim ${trim} · ${pageModels.length} pages`,
      `Browser: ${navigator.userAgent}`, `Page: ${location.href}`].join('\n');
  }
  function submitSupport() {
    const title = el.supTitle.value.trim();
    if (!title) { el.supStatus.textContent = 'Add a one-line summary first.'; el.supStatus.className = 'pf-pub-status err'; return; }
    const type = el.supType.value;
    const prefix = type === 'bug' ? '[Bug] ' : type === 'feature' ? '[Feature] ' : '[Question] ';
    const label = type === 'bug' ? 'bug' : type === 'feature' ? 'enhancement' : 'question';
    let body = el.supBody.value.trim() || '(no details provided)';
    if (el.supIncludeCtx.checked) body += supportContext();
    const url = `${GH_REPO}/issues/new?title=${encodeURIComponent(prefix + title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(label)}`;
    window.open(url, '_blank', 'noopener');
    el.supStatus.textContent = 'Opened a pre-filled issue on GitHub in a new tab — review and post it there.';
    el.supStatus.className = 'pf-pub-status ok';
  }

  // --- Mailings tab: team roster, handoffs, personalized links, notes ---
  // Everything is local-first (roster in this browser; invites/handoffs open a
  // pre-filled email you send). This is the seed for real accounts + sync later.
  const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64d = (s) => decodeURIComponent(escape(atob(s)));
  let team = loadTeam();
  let me = { name: 'Me', role: 'Owner' };            // who I am (may be set by an invite link)
  let inviteGreeting = null;                          // shown after the book finishes opening
  let teamState = { stage: 'Draft', assigneeId: null, notes: [] };
  const ROLE_COLORS = { Writer: '#1c7ed6', Editor: '#e8590c', Illustrator: '#9c36b5', Reviewer: '#2b8a3e', Owner: '#495057', Contributor: '#868e96' };
  function loadTeam() { try { return JSON.parse(localStorage.getItem('pf_team') || '[]'); } catch (_) { return []; } }
  function saveTeam() { try { localStorage.setItem('pf_team', JSON.stringify(team)); } catch (_) { /* */ } }
  function loadTeamState() {
    // Prefer state saved with the recipe; fall back to the last active book's.
    let st = (bookConfig && bookConfig.teamState) || null;
    if (!st) { try { st = JSON.parse(localStorage.getItem('pf_teamstate') || 'null'); } catch (_) { st = null; } }
    teamState = Object.assign({ stage: 'Draft', assigneeId: null, notes: [] }, st || {});
    if (!Array.isArray(teamState.notes)) teamState.notes = [];
    if (el.mailStage) el.mailStage.value = teamState.stage || 'Draft';
  }
  function saveTeamState() {
    if (bookConfig) bookConfig.teamState = teamState;            // travels with Save (recipe)
    try { localStorage.setItem('pf_teamstate', JSON.stringify(teamState)); } catch (_) { /* */ }
  }
  const memberById = (id) => team.find((m) => m.id === id) || null;
  const selectedMember = () => memberById(el.mailRecipient && el.mailRecipient.value);
  function personalizedLink(m) {
    return `${location.origin}${location.pathname}?invite=${encodeURIComponent(b64e(JSON.stringify({ n: m.name, r: m.role })))}`;
  }
  function renderRecipients() {
    if (!el.mailRecipient) return;
    const keep = el.mailRecipient.value;
    el.mailRecipient.innerHTML = '<option value="">— pick a team member —</option>' +
      team.map((m) => `<option value="${m.id}">${escHtml(m.name)} · ${escHtml(m.role)}</option>`).join('');
    if (keep && memberById(keep)) el.mailRecipient.value = keep;
  }
  function renderTeamList() {
    if (!el.teamList) return;
    if (!team.length) { el.teamList.innerHTML = '<p class="pf-modal-sub">No team members yet. Add someone above.</p>'; return; }
    el.teamList.innerHTML = '';
    team.forEach((m) => {
      const row = document.createElement('div'); row.className = 'pf-team-row';
      const badge = `<span class="pf-role" style="background:${ROLE_COLORS[m.role] || '#868e96'}">${escHtml(m.role)}</span>`;
      const assigned = teamState.assigneeId === m.id ? ' <span class="pf-assigned">● assigned</span>' : '';
      row.innerHTML = `<div class="pf-team-who">${badge} <b>${escHtml(m.name)}</b>${assigned}<br><span class="pf-dim">${escHtml(m.email || 'no email')}</span></div>`;
      const acts = document.createElement('div'); acts.className = 'pf-team-acts';
      const mk = (label, title, fn) => { const b = document.createElement('button'); b.className = 'ghost mini'; b.textContent = label; b.title = title; b.addEventListener('click', fn); return b; };
      acts.appendChild(mk('Invite', 'Email an invite to join', () => inviteMember(m)));
      acts.appendChild(mk('Email book', 'Email this book to them', () => emailBook(m)));
      acts.appendChild(mk('Copy link', 'Copy their personalized link', () => copyLink(m)));
      const del = mk('✕', 'Remove', () => removeMember(m.id)); del.classList.add('del');
      acts.appendChild(del);
      row.appendChild(acts); el.teamList.appendChild(row);
    });
  }
  function openTeam(focusAdd) { if (!el.teamModal) return; renderTeamList(); el.teamModal.hidden = false; if (focusAdd) setTimeout(() => el.teamName.focus(), 30); }
  function closeTeam() { if (el.teamModal) el.teamModal.hidden = true; }
  function addMember() {
    const name = el.teamName.value.trim(); const email = el.teamEmail.value.trim();
    if (!name) { setStatus('Give the team member a name.', 'err'); el.teamName.focus(); return; }
    team.push({ id: 't' + Date.now().toString(36), name, email, role: el.teamRole.value });
    saveTeam(); el.teamName.value = ''; el.teamEmail.value = '';
    renderTeamList(); renderRecipients();
    setStatus(`Added ${name} (${el.teamRole.value}) to the team.`, 'ok');
  }
  function removeMember(id) {
    team = team.filter((m) => m.id !== id);
    if (teamState.assigneeId === id) { teamState.assigneeId = null; saveTeamState(); }
    saveTeam(); renderTeamList(); renderRecipients();
  }
  async function copyLink(m) {
    const url = personalizedLink(m);
    try { await navigator.clipboard.writeText(url); setStatus(`Copied ${m.name}'s personalized link. Send it to them so their notes are signed as ${m.role}.`, 'ok'); }
    catch (_) { window.prompt(`Copy ${m.name}'s personalized link:`, url); }
  }
  function mailto(to, subject, body) {
    window.open(`mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  }
  function inviteMember(m) {
    const subject = 'Join me on PuzzleForge';
    const body = [`Hi ${m.name},`, '', `I'd like you to help make puzzle books with me on PuzzleForge as ${m.role}.`,
      '', 'Open your personalized link to get started:', personalizedLink(m), '', `— ${me.name}`].join('\n');
    mailto(m.email, subject, body);
    setStatus(`Opened an invite email for ${m.name}.`, 'ok');
  }
  function emailBook(m) {
    const title = bookTitle() || 'Untitled book';
    const stage = teamState.stage || 'Draft';
    const subject = `PuzzleForge — “${title}” (${stage})`;
    const body = [`Hi ${m.name},`, '', `Handing off “${title}” to you as ${m.role}. Current stage: ${stage}.`,
      `Pages: ${pageModels.length}.`, '', 'Please find the exported PDF / recipe attached (I\'ll add it in my email app).',
      '', 'Your link:', personalizedLink(m), '', `— ${me.name}`].join('\n');
    mailto(m.email, subject, body);
    setStatus(`Opened a handoff email for ${m.name}. Remember to attach your exported file.`, 'ok');
  }
  function assignBook() {
    const m = selectedMember();
    if (!m) { setStatus('Pick a team member in the Recipient list first.', 'err'); return; }
    teamState.assigneeId = m.id; saveTeamState(); renderTeamList();
    setStatus(`“${bookTitle() || 'This book'}” assigned to ${m.name} (${m.role}) at the ${teamState.stage} stage.`, 'ok');
  }
  function shareAction(fn) { const m = selectedMember(); if (!m) { setStatus('Pick a team member in the Recipient list first.', 'err'); return; } fn(m); }
  // Handoff notes
  function openNotes() { if (!el.notesModal) return; renderNotes(); el.notesModal.hidden = false; setTimeout(() => el.noteText.focus(), 30); }
  function closeNotes() { if (el.notesModal) el.notesModal.hidden = true; }
  function renderNotes() {
    if (!el.notesList) return;
    if (!teamState.notes.length) { el.notesList.innerHTML = '<p class="pf-modal-sub">No notes yet. Post the first handoff note below.</p>'; return; }
    el.notesList.innerHTML = teamState.notes.map((n) => {
      const badge = `<span class="pf-role" style="background:${ROLE_COLORS[n.role] || '#868e96'}">${escHtml(n.role)}</span>`;
      return `<div class="pf-note"><div class="pf-note-head">${badge} <b>${escHtml(n.author)}</b> <span class="pf-dim">${escHtml(n.when)}</span></div><div class="pf-note-body">${escHtml(n.text)}</div></div>`;
    }).join('');
  }
  function addNote() {
    const text = el.noteText.value.trim(); if (!text) return;
    teamState.notes.push({ author: me.name, role: me.role, when: new Date().toLocaleString(), text });
    saveTeamState(); el.noteText.value = ''; renderNotes();
  }
  function parseInvite() {
    try {
      const inv = new URLSearchParams(location.search).get('invite'); if (!inv) return;
      const d = JSON.parse(b64d(decodeURIComponent(inv)));
      if (d && d.n) { me = { name: String(d.n).slice(0, 60), role: String(d.r || 'Contributor').slice(0, 30) };
        inviteGreeting = `Welcome, ${me.name} — you're here as ${me.role}. Your handoff notes will be signed with your name.`;
        setStatus(inviteGreeting, 'ok'); }
    } catch (_) { /* ignore malformed invite */ }
  }

  async function runPreflight() {
    el.pubRunChecks.disabled = true; setPubStatus(el.pubCheckStatus, 'Rendering & checking…', 'busy');
    const body = bookBody();
    try {
      const [chkR, proR] = await Promise.allSettled([
        fetch('/api/book/checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
        fetch('/api/book/proofread', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, data: await r.json() })),
      ]);
      const chk = chkR.status === 'fulfilled' ? chkR.value : { error: 'Could not render the book for checks.' };
      let proof = { issues: [] };
      if (proR.status === 'fulfilled') proof = proR.value.ok ? proR.value.data : { issues: [], error: proR.value.data.error };
      else proof = { issues: [], error: 'Proofread request failed.' };
      lastProofIssues = proof.issues || [];
      renderReport(chk, proof);
      setPubStatus(el.pubCheckStatus, '');
    } catch (err) { setPubStatus(el.pubCheckStatus, err.message, 'err'); }
    finally { el.pubRunChecks.disabled = false; }
  }
  function renderReport(chk, proof) {
    el.pubReport.hidden = false;
    const parts = [];
    if (chk.error) parts.push(`<div class="rep-note err">Checklist error: ${escHtml(chk.error)}</div>`);
    else {
      const s = chk.summary || { blockers: 0, warnings: 0, passes: 0 };
      parts.push(`<div class="rep-summary"><b>${chk.pageCount || '?'}</b> pages · <span class="rep-b">🔴 ${s.blockers}</span> <span class="rep-w">🟡 ${s.warnings}</span> <span class="rep-p">🟢 ${s.passes}</span></div>`);
      const fails = (chk.items || []).filter((i) => i.status !== 'pass');
      if (fails.length) parts.push('<ul class="rep-list">' + fails.map((i) => `<li class="${i.severity}"><b>${i.severity === 'blocker' ? 'Blocker' : 'Warning'}:</b> ${escHtml(i.label)} — ${escHtml(i.message)}</li>`).join('') + '</ul>');
      else parts.push('<div class="rep-ok">All structural &amp; print-spec checks passed.</div>');
    }
    parts.push('<div class="rep-subhead">✍️ Proofread</div>');
    if (proof.error) parts.push(`<div class="rep-note">Unavailable: ${escHtml(proof.error)}</div>`);
    else if (proof.note && !(proof.issues || []).length) parts.push(`<div class="rep-note">${escHtml(proof.note)}</div>`);
    else {
      const iss = proof.issues || [];
      if (iss.length) parts.push('<ul class="rep-list">' + iss.map((x) => `<li class="${x.severity === 'error' ? 'blocker' : 'warning'}"><b>p.${x.page}:</b> “${escHtml(x.original)}” → “${escHtml(x.fix)}”${x.note ? ` <span class="rep-dim">(${escHtml(x.note)})</span>` : ''}</li>`).join('') + '</ul>');
      else parts.push('<div class="rep-ok">No spelling or grammar issues found.</div>');
    }
    el.pubReport.innerHTML = parts.join('');
  }
  async function exportPackage() {
    el.pubExport.disabled = true; setPubStatus(el.pubExportStatus, 'Building package…', 'busy');
    try {
      const body = { ...bookBody(), metadata: gatherMeta(), proofreadIssues: lastProofIssues };
      const cover = savedCover();
      if (cover) body.coverFull = cover; else body.cover = gatherCover();
      const res = await fetch('/api/book/package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Export failed'); }
      downloadBlob(await res.blob(), slug((bookConfig && bookConfig.title) || 'book') + '-kdp-package.zip');
      setPubStatus(el.pubExportStatus, 'Package downloaded ✓', 'ok');
    } catch (err) { setPubStatus(el.pubExportStatus, err.message, 'err'); }
    finally { el.pubExport.disabled = false; }
  }

  // --- ribbon (MS Publisher–style tabbed toolbar) ---
  function setupRibbon() {
    const tabs = [...document.querySelectorAll('.rtab')];
    const panels = [...document.querySelectorAll('.ribbon-panel')];
    if (!tabs.length) return;
    ribbonActivate = (name) => {
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
    };
    tabs.forEach((t) => t.addEventListener('click', () => { if (t.dataset.tab !== 'format') ribbonPrevTab = t.dataset.tab; ribbonActivate(t.dataset.tab); }));
  }
  // Reveal the contextual Format tab when an object is selected (like Publisher's
  // contextual tabs); return to the previous tab when the selection clears. Don't
  // steal focus from the Arrange tab, where align/order tools are used with a
  // live selection.
  function showFormatTab(has) {
    if (!ribbonActivate) return;
    const active = document.querySelector('.rtab.active');
    const cur = active ? active.dataset.tab : 'home';
    if (has) { if (cur !== 'format' && cur !== 'arrange') { ribbonPrevTab = cur; ribbonActivate('format'); } }
    else if (cur === 'format') { ribbonActivate(ribbonPrevTab || 'home'); }
  }

  // --- theme (editor skin) ---
  function applyTheme(dark) {
    document.body.classList.toggle('theme-dark', dark);
    try { localStorage.setItem('pf_theme', dark ? 'dark' : 'light'); } catch (_) { /* */ }
  }
  function setupTheme() {
    let saved = null; try { saved = localStorage.getItem('pf_theme'); } catch (_) { /* */ }
    const dark = saved ? saved === 'dark' : true; // default to the dark Publisher skin
    if (el.darkToggle) { el.darkToggle.checked = dark; el.darkToggle.addEventListener('change', () => applyTheme(el.darkToggle.checked)); }
    applyTheme(dark);
  }

  function init() {
    setupRibbon(); setupTheme();
    el.addText.addEventListener('click', addText);
    el.addImage.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });
    document.querySelectorAll('.shape-btn').forEach((b) => b.addEventListener('click', () => addShape(b.dataset.shape)));
    // Font: live update on input, commit an undo entry on change.
    el.fontSize.addEventListener('input', () => applyTextProp('fontSize', Number(el.fontSize.value) || 24));
    el.fontSize.addEventListener('change', () => { if (selText()) pushUndo(); });
    el.objColor.addEventListener('input', () => applyTextProp('color', el.objColor.value));
    el.objColor.addEventListener('change', () => { if (selText()) pushUndo(); });
    el.fontFamily.addEventListener('change', () => applyTextPropU('fontFamily', el.fontFamily.value));
    el.fontGrow.addEventListener('click', () => fontStep(2));
    el.fontShrink.addEventListener('click', () => fontStep(-2));
    el.caseBtn.addEventListener('click', changeCase);
    el.clearFmt.addEventListener('click', clearTextFmt);
    el.lineSpacing.addEventListener('change', () => applyTextPropU('lineHeight', Number(el.lineSpacing.value) || 1.25));
    document.querySelectorAll('.palign').forEach((b) => b.addEventListener('click', () => applyTextPropU('align', b.dataset.align)));
    const tstyle = (prop) => { const o = selText(); if (o) applyTextPropU(prop, !o[prop]); };
    el.boldBtn.addEventListener('click', () => tstyle('bold'));
    el.italicBtn.addEventListener('click', () => tstyle('italic'));
    el.underBtn.addEventListener('click', () => tstyle('underline'));
    // Home Clipboard / Objects / Arrange / Editing
    el.cutBtn.addEventListener('click', cutSel); el.copyBtn.addEventListener('click', copySel); el.pasteBtn.addEventListener('click', paste);
    el.fmtPainter.addEventListener('click', togglePainter);
    el.hAddText.addEventListener('click', addText);
    el.hAddImage.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });
    el.hForward.addEventListener('click', () => reorder('forward')); el.hBackward.addEventListener('click', () => reorder('backward'));
    el.hGroup.addEventListener('click', groupSel); el.hUngroup.addEventListener('click', ungroupSel);
    el.findReplaceBtn.addEventListener('click', openFindReplace); el.selectAllBtn.addEventListener('click', selectAll);
    el.frClose.addEventListener('click', closeFindReplace);
    el.frModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeFindReplace(); });
    el.frReplaceAll.addEventListener('click', doReplaceAll);
    el.fillColor.addEventListener('input', () => { el.noFill.checked = false; applyShapeProp('fill', el.fillColor.value); });
    el.strokeColor.addEventListener('input', () => applyShapeProp('stroke', el.strokeColor.value));
    el.strokeW.addEventListener('input', () => applyShapeProp('strokeW', Math.max(0, Number(el.strokeW.value) || 0)));
    el.noFill.addEventListener('change', () => applyShapeProp('fill', el.noFill.checked ? 'none' : el.fillColor.value));
    el.groupBtn.addEventListener('click', groupSel); el.ungroupBtn.addEventListener('click', ungroupSel);
    el.borderAll.addEventListener('click', () => { pageModels.forEach((pm) => { pm._border = el.border.value; }); setStatus(el.border.value ? 'Border applied to all pages.' : 'Border override cleared on all pages.', 'ok'); });
    el.mX.addEventListener('change', () => setMeasure('x', Number(el.mX.value) || 0));
    el.mY.addEventListener('change', () => setMeasure('y', Number(el.mY.value) || 0));
    el.mW.addEventListener('change', () => setElSize('w', Number(el.mW.value) || 0));
    el.mH.addEventListener('change', () => setElSize('h', Number(el.mH.value) || 0));
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
    if (el.addBlankSide) el.addBlankSide.addEventListener('click', insertBlankAfterCurrent);
    if (el.insertTpl) el.insertTpl.addEventListener('click', openTplPicker);
    if (el.insertTplSide) el.insertTplSide.addEventListener('click', openTplPicker);
    if (el.savePageTpl) el.savePageTpl.addEventListener('click', savePageAsTemplate);
    if (el.dupPage) el.dupPage.addEventListener('click', () => { if (cur >= 0) duplicatePage(cur); });
    if (el.aiArtBtn) el.aiArtBtn.addEventListener('click', openAiArt);
    if (el.insertDate) el.insertDate.addEventListener('click', insertDate);
    // Page Design tab
    if (el.renamePage) el.renamePage.addEventListener('click', renamePagePrompt);
    if (el.delPage) el.delPage.addEventListener('click', () => { if (cur >= 0) deletePage(cur); });
    if (el.movePageUp) el.movePageUp.addEventListener('click', () => { if (cur >= 0) movePage(cur, -1); });
    if (el.movePageDown) el.movePageDown.addEventListener('click', () => { if (cur >= 0) movePage(cur, 1); });
    if (el.marginGuide) el.marginGuide.addEventListener('change', applyMarginGuide);
    renderSchemes();
    // Review tab
    if (el.revSpelling) el.revSpelling.addEventListener('click', runSpelling);
    if (el.revThesaurus) el.revThesaurus.addEventListener('click', runThesaurus);
    if (el.revWordCount) el.revWordCount.addEventListener('click', reviewWordCount);
    if (el.revClose) el.revClose.addEventListener('click', closeReview);
    if (el.revModal) el.revModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeReview(); });
    if (el.revLanguage) el.revLanguage.addEventListener('change', () => {
      if (bookConfig) bookConfig.language = el.revLanguage.value;
      setStatus(`Book language set to ${el.revLanguage.options[el.revLanguage.selectedIndex].text} (used in the KDP package metadata).`, 'ok');
    });
    // Help tab
    if (el.helpBtn) el.helpBtn.addEventListener('click', () => openHelp());
    if (el.shortcutsBtn) el.shortcutsBtn.addEventListener('click', () => openHelp('Shortcuts'));
    if (el.helpClose) el.helpClose.addEventListener('click', closeHelp);
    if (el.helpModal) el.helpModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeHelp(); });
    if (el.helpSearch) el.helpSearch.addEventListener('input', () => renderHelp(el.helpSearch.value.trim()));
    if (el.helpToSupport) el.helpToSupport.addEventListener('click', () => { closeHelp(); openSupport(); });
    if (el.supportBtn) el.supportBtn.addEventListener('click', openSupport);
    if (el.supportClose) el.supportClose.addEventListener('click', closeSupport);
    if (el.supportModal) el.supportModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeSupport(); });
    if (el.supSubmit) el.supSubmit.addEventListener('click', submitSupport);
    // Mailings tab
    if (el.teamBtn) el.teamBtn.addEventListener('click', () => openTeam(false));
    if (el.inviteBtn) el.inviteBtn.addEventListener('click', () => openTeam(true));
    if (el.teamClose) el.teamClose.addEventListener('click', closeTeam);
    if (el.teamModal) el.teamModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeTeam(); });
    if (el.teamAdd) el.teamAdd.addEventListener('click', addMember);
    if (el.teamName) el.teamName.addEventListener('keydown', (e) => { if (e.key === 'Enter') addMember(); });
    if (el.emailBookBtn) el.emailBookBtn.addEventListener('click', () => shareAction(emailBook));
    if (el.linkBtn) el.linkBtn.addEventListener('click', () => shareAction(copyLink));
    if (el.assignBtn) el.assignBtn.addEventListener('click', assignBook);
    if (el.mailStage) el.mailStage.addEventListener('change', () => { teamState.stage = el.mailStage.value; saveTeamState(); setStatus(`Workflow stage set to ${teamState.stage}.`, 'ok'); });
    if (el.notesBtn) el.notesBtn.addEventListener('click', openNotes);
    if (el.notesClose) el.notesClose.addEventListener('click', closeNotes);
    if (el.notesModal) el.notesModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeNotes(); });
    if (el.noteAdd) el.noteAdd.addEventListener('click', addNote);
    renderRecipients();
    parseInvite();
    populateInsertMenus();
    if (el.wordArt) el.wordArt.addEventListener('change', () => { const i = Number(el.wordArt.value); if (WORDART[i]) addWordArt(WORDART[i]); el.wordArt.value = ''; });
    if (el.symbolPick) el.symbolPick.addEventListener('change', () => { addSymbol(el.symbolPick.value); el.symbolPick.value = ''; });
    if (el.tplClose) el.tplClose.addEventListener('click', closeTplPicker);
    if (el.tplModal) el.tplModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeTplPicker(); });
    if (el.publishBtn) el.publishBtn.addEventListener('click', openPublish);
    if (el.pubClose) el.pubClose.addEventListener('click', closePublish);
    if (el.pubModal) el.pubModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closePublish(); });
    if (el.pubRunChecks) el.pubRunChecks.addEventListener('click', runPreflight);
    if (el.pubExport) el.pubExport.addEventListener('click', exportPackage);
    if (el.pubOpenCover) el.pubOpenCover.addEventListener('click', openCoverBuilder);
    if (el.pubClearCover) el.pubClearCover.addEventListener('click', clearCover);
    // Re-check for a Cover Builder hand-off when returning to this tab.
    window.addEventListener('focus', () => { if (el.pubModal && !el.pubModal.hidden) refreshCoverState(); });
    el.undo.addEventListener('click', undo); el.redo.addEventListener('click', redo);
    el.zoomIn.addEventListener('click', () => setZoom(zoom * 1.2)); el.zoomOut.addEventListener('click', () => setZoom(zoom / 1.2)); el.zoomFit.addEventListener('click', () => setZoom(fitScale()));
    if (el.zoom100) el.zoom100.addEventListener('click', () => setZoom(1));
    if (el.zoomWhole) el.zoomWhole.addEventListener('click', () => setZoom(fitScale()));
    if (el.zoomWidth) el.zoomWidth.addEventListener('click', () => setZoom(fitWidth()));
    if (el.rulerToggle) el.rulerToggle.addEventListener('change', toggleRulers);
    if (el.navToggle) el.navToggle.addEventListener('change', toggleNav);
    if (el.boundToggle) el.boundToggle.addEventListener('change', toggleBounds);
    el.save.addEventListener('click', save); el.exportPdf.addEventListener('click', exportPdf); el.loadRecipe.addEventListener('change', onLoadRecipe);
    el.stageScroll.addEventListener('scroll', syncRulers);
    el.stageInner.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target === el.stageInner || e.target === gridEl || e.target === selLayer || e.target === flowEl) { setSel([]); startMarquee(e); }
    });
    el.stageInner.addEventListener('contextmenu', (e) => {
      const t = e.target.closest ? e.target.closest('.pf-piece, .pf-node') : null;
      const ref = t && t._ref;
      if (ref && !isSel(ref)) setSel(expandGroups([ref]));
      else if (!ref) setSel([]);
      showCtx(e);
    });
    document.addEventListener('pointerdown', (e) => { if (ctxEl && !ctxEl.contains(e.target)) hideCtx(); }, true);
    el.stageScroll.addEventListener('scroll', hideCtx);
    window.addEventListener('resize', () => applyZoom());
    window.addEventListener('keydown', onKey);
    let handoff = null;
    try { const raw = localStorage.getItem('pf_editor'); if (raw) { handoff = JSON.parse(raw); localStorage.removeItem('pf_editor'); } } catch (_) { /* */ }
    if (handoff && (handoff.config || handoff.bookId)) { bookConfig = handoff.config || null; openBook(handoff.bookId ? { bookId: handoff.bookId, config: handoff.config } : { config: handoff.config }); }
    else { el.empty.hidden = false; setStatus('Open a book from the Book Builder, or load a recipe.', ''); }
  }
  function onKey(e) {
    if (el.tplModal && !el.tplModal.hidden) { if (e.key === 'Escape') closeTplPicker(); return; }
    if (el.pubModal && !el.pubModal.hidden) { if (e.key === 'Escape') closePublish(); return; }
    if (el.frModal && !el.frModal.hidden) { if (e.key === 'Escape') closeFindReplace(); return; }
    if (el.main.hidden) return; const ae = document.activeElement, tag = (ae && ae.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || (ae && ae.isContentEditable)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { hideCtx(); setSel([]); return; }
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (ctrl && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return; }
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copySel(); return; }
    if (ctrl && e.key.toLowerCase() === 'x') { e.preventDefault(); cutSel(); return; }
    if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); return; }
    if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (ctrl && e.key.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
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
