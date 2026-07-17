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
    rulerToggle: $('rulerToggle'), navToggle: $('navToggle'), boundToggle: $('boundToggle'), editorMain: $('editorMain'), spreadToggle: $('spreadToggle'),
    viewNormal: $('viewNormal'), viewMaster: $('viewMaster'), viewSingle: $('viewSingle'), viewSpread: $('viewSpread'),
    addText: $('addText'), addImage: $('addImage'), addPicPlaceholder: $('addPicPlaceholder'), addTable: $('addTable'), addQr: $('addQr'),
    addCalendarBtn: $('addCalendarBtn'), insLinkBtn: $('insLinkBtn'), insBookmarkBtn: $('insBookmarkBtn'),
    qrControls: $('qrControls'), qrNone: $('qrNone'), qrUrl: $('qrUrl'), qrFg: $('qrFg'), qrBg: $('qrBg'),
    qrTransparent: $('qrTransparent'), qrW: $('qrW'), qrTest: $('qrTest'), qrEclDropBtn: $('qrEclDropBtn'),
    qrForward: $('qrForward'), qrBackward: $('qrBackward'), qrDup: $('qrDup'), qrReset: $('qrReset'), qrHide: $('qrHide'),
    tableProps: $('tableProps'), tblAddRow: $('tblAddRow'), tblDelRow: $('tblDelRow'), tblAddCol: $('tblAddCol'), tblDelCol: $('tblDelCol'),
    tblBorder: $('tblBorder'), tblHeaderFill: $('tblHeaderFill'), tblHeader: $('tblHeader'),
    ctxTab: $('ctxTab'), ctxTab2: $('ctxTab2'), ctxTabTD: $('ctxTabTD'), ctxTabTL: $('ctxTabTL'), ctxTabPic: $('ctxTabPic'), ctxTabQr: $('ctxTabQr'),
    picControls: $('picControls'), picNone: $('picNone'), picChange: $('picChange'), picReset: $('picReset'),
    picForward: $('picForward'), picBackward: $('picBackward'), picFlipH: $('picFlipH'), picFlipV: $('picFlipV'), picW: $('picW'), picCaptionText: $('picCaptionText'),
    picCropBtn: $('picCropBtn'), picCropReset: $('picCropReset'), picCropFill: $('picCropFill'),
    picSwap: $('picSwap'), picCompressCrop: $('picCompressCrop'),
    tdControls: $('tdControls'), tdNone: $('tdNone'), tdBorderW: $('tdBorderW'), tdHeader: $('tdHeader'),
    tlControls: $('tlControls'), tlNone: $('tlNone'), tlEditText: $('tlEditText'), tlForward: $('tlForward'), tlBackward: $('tlBackward'),
    tlInsAbove: $('tlInsAbove'), tlInsBelow: $('tlInsBelow'), tlInsLeft: $('tlInsLeft'), tlInsRight: $('tlInsRight'),
    tlMerge: $('tlMerge'), tlSplit: $('tlSplit'), tlDiagonal: $('tlDiagonal'),
    sfControls: $('sfControls'), sfNone: $('sfNone'), sfEditText: $('sfEditText'),
    sfForward: $('sfForward'), sfBackward: $('sfBackward'), sfGroup: $('sfGroup'), sfUngroup: $('sfUngroup'), sfH: $('sfH'), sfW: $('sfW'),
    selNone: $('selNone'), selControls: $('selControls'), measurePanel: $('measurePanel'),
    mX: $('mX'), mY: $('mY'), mScale: $('mScale'), mRot: $('mRot'),
    mW: $('mW'), mH: $('mH'), mWField: $('mWField'), mHField: $('mHField'),
    fontSize: $('fontSize'), objColor: $('objColor'), tbHyphenBtn: $('tbHyphenBtn'),
    tbLinkCreate: $('tbLinkCreate'), tbLinkBreak: $('tbLinkBreak'), tbLinkPrev: $('tbLinkPrev'), tbLinkNext: $('tbLinkNext'), tbStyDrop: $('tbStyDrop'),
    fontFamily: $('fontFamily'), boldBtn: $('boldBtn'), italicBtn: $('italicBtn'), underBtn: $('underBtn'),
    fontGrow: $('fontGrow'), fontShrink: $('fontShrink'), caseBtn: $('caseBtn'), clearFmt: $('clearFmt'), lineSpacing: $('lineSpacing'),
    cutBtn: $('cutBtn'), copyBtn: $('copyBtn'), pasteBtn: $('pasteBtn'), fmtPainter: $('fmtPainter'),
    hAddText: $('hAddText'), hAddImage: $('hAddImage'), hForward: $('hForward'), hBackward: $('hBackward'),
    hGroup: $('hGroup'), hUngroup: $('hUngroup'), findReplaceBtn: $('findReplaceBtn'), selectAllBtn: $('selectAllBtn'), breakApartBtn: $('breakApartBtn'),
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
    trimInfo: $('trimInfo'), sizeInfo: $('sizeInfo'), orientInfo: $('orientInfo'), marginGuide: $('marginGuide'), renamePage: $('renamePage'), delPage: $('delPage'),
    alignGuidesChk: $('alignGuidesChk'), alignObjectsChk: $('alignObjectsChk'),
    movePageUp: $('movePageUp'), movePageDown: $('movePageDown'), schemeGallery: $('schemeGallery'),
    masterEnabled: $('masterEnabled'), editMasterBtn: $('editMasterBtn'), insertPageNo: $('insertPageNo'),
    insHeader: $('insHeader'), insFooter: $('insFooter'),
    masterApplyTo: $('masterApplyTo'), masterSkip: $('masterSkip'), masterStart: $('masterStart'),
    masterBanner: $('masterBanner'), exitMasterBtn: $('exitMasterBtn'),
    revSpelling: $('revSpelling'), revThesaurus: $('revThesaurus'), revWordCount: $('revWordCount'), revLanguage: $('revLanguage'),
    revModal: $('revModal'), revClose: $('revClose'), revTitle: $('revTitle'), revSub: $('revSub'), revBody: $('revBody'),
    helpBtn: $('helpBtn'), supportBtn: $('supportBtn'), shortcutsBtn: $('shortcutsBtn'),
    helpModal: $('helpModal'), helpClose: $('helpClose'), helpSearch: $('helpSearch'), helpCats: $('helpCats'),
    helpArticles: $('helpArticles'), helpToSupport: $('helpToSupport'),
    supportModal: $('supportModal'), supportClose: $('supportClose'), supType: $('supType'), supTitle: $('supTitle'),
    supBody: $('supBody'), supIncludeCtx: $('supIncludeCtx'), supSubmit: $('supSubmit'), supBrowse: $('supBrowse'), supStatus: $('supStatus'),
    shareTeamBtn: $('shareTeamBtn'), saveMineBtn: $('saveMineBtn'), wsStatus: $('wsStatus'),
    teamBtn: $('teamBtn'), inviteBtn: $('inviteBtn'), mailRecipient: $('mailRecipient'), emailBookBtn: $('emailBookBtn'),
    linkBtn: $('linkBtn'), mailStage: $('mailStage'), assignBtn: $('assignBtn'), notesBtn: $('notesBtn'),
    teamModal: $('teamModal'), teamClose: $('teamClose'), teamName: $('teamName'), teamEmail: $('teamEmail'),
    teamRole: $('teamRole'), teamAdd: $('teamAdd'), teamList: $('teamList'),
    notesModal: $('notesModal'), notesClose: $('notesClose'), notesSub: $('notesSub'), notesList: $('notesList'),
    noteText: $('noteText'), noteAdd: $('noteAdd'),
    tplModal: $('tplModal'), tplClose: $('tplClose'), tplBuiltin: $('tplBuiltin'), tplSaved: $('tplSaved'),
    tplSavedCount: $('tplSavedCount'), tplSavedEmpty: $('tplSavedEmpty'),
    changeTplBtn: $('changeTplBtn'), changeTplModal: $('changeTplModal'), changeTplClose: $('changeTplClose'),
    changeTplBuiltin: $('changeTplBuiltin'), changeTplSaved: $('changeTplSaved'),
    changeTplSavedCount: $('changeTplSavedCount'), changeTplSavedEmpty: $('changeTplSavedEmpty'),
    changeTplPageName: $('changeTplPageName'),
    fontUpload: $('fontUpload'),
    bgColors: $('bgColors'), bgColor: $('bgColor'), bgColor2: $('bgColor2'), bgAngle: $('bgAngle'),
    bgColor2Field: $('bgColor2Field'), bgAngleField: $('bgAngleField'),
    puzModal: $('puzModal'), puzClose: $('puzClose'), puzType: $('puzType'), puzTheme: $('puzTheme'),
    puzAudience: $('puzAudience'), puzDiff: $('puzDiff'), puzColorRow: $('puzColorRow'), puzColorStyle: $('puzColorStyle'),
    puzCount: $('puzCount'), puzInsert: $('puzInsert'), puzStatus: $('puzStatus'),
    publishBtn: $('publishBtn'), pubModal: $('pubModal'), pubClose: $('pubClose'),
    pubRunChecks: $('pubRunChecks'), pubCheckStatus: $('pubCheckStatus'), pubReport: $('pubReport'),
    pubPrice: $('pubPrice'), pubPaper: $('pubPaper'), pubAge: $('pubAge'), pubDesc: $('pubDesc'),
    pubKeywords: $('pubKeywords'), pubCategories: $('pubCategories'), pubAiText: $('pubAiText'), pubAiImages: $('pubAiImages'),
    pubCoverBg: $('pubCoverBg'), pubCoverText: $('pubCoverText'), pubExport: $('pubExport'), pubExportStatus: $('pubExportStatus'),
    pubCoverStatus: $('pubCoverStatus'), pubOpenCover: $('pubOpenCover'), pubClearCover: $('pubClearCover'), pubSimpleCover: $('pubSimpleCover'),
    save: $('save'), exportPdf: $('exportPdf'), loadRecipe: $('loadRecipe'), saveState: $('saveState'),
  };
  let bookId = null, bookConfig = null, seed = null, dims = { usableWidth: 636, usableHeight: 816 };
  // Autosave to the My Books library (IndexedDB, this browser).
  let currentLibId = null, bookOpen = false, lastSavedJson = null;
  // Team workspace (self-hosted LAN server): whether it's reachable, and this
  // book's shared id once it has been shared.
  let wsEnabled = false, workspaceId = null, wsSub = null, detached = false;
  let pageModels = [], srcPages = [], pendingPlan = null, cur = -1, uid = 1, zoom = 1;
  let sels = [], clipboard = [];
  let vGuide = null, hGuide = null, gridEl = null, selLayer = null, flowEl = null;
  let ribbonActivate = null, ribbonPrevTab = 'home';
  let lastProofIssues = [];
  // Master page: an overlay of free elements repeated across pages. `masterMode`
  // swaps the canvas to editing the master itself (via curModel()).
  let master = { enabled: true, applyTo: 'all', skipFirst: 1, startAt: 1, elements: [] };
  let masterMode = false;
  // When a book is imported from the Book Builder, auto-break each puzzle page
  // (title / instructions / word list → editable text) the first time it's
  // shown, so the generated labels are editable without a manual click.
  let autoBreak = false;
  // Page Design → Layout: what dragged objects snap to, and the margin-guide inset.
  let alignGuides = true, alignObjects = true;
  let marginInset = GRID; // px; 0.25in default (Narrow)
  const masterModel = { role: 'master', matterKind: null, blank: true, type: 'master', title: 'Master', comps: [], elements: master.elements, style: '', _border: '', undo: [], redo: [] };
  const curModel = () => (masterMode ? masterModel : pageModels[cur]);
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
    if (state && state.bg && state.bg.type) m._bg = state.bg;
    if (state && state.guides) m.guides = { v: (state.guides.v || []).map(Number), h: (state.guides.h || []).map(Number) };
    return m;
  }
  function modelFromPage(p) {
    const m = {
      role: p.role || 'content', matterKind: p.matterKind || null, src: p.src != null ? p.src : null,
      akIndex: p.akIndex != null ? p.akIndex : null,
      blank: false, type: p.type || '', title: p.title || p.type || '', activity: !!p.activity,
      style: p.style || '', comps: buildComps(p.components || []), elements: [], _border: '', undo: [], redo: [],
      // Editor-inserted puzzle pages carry their own puzzle object (no src).
      puzzle: p.puzzle || null,
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
      // Editor-inserted puzzle page: rebuild from the plan's own render cache.
      if (entry.role === 'content' && entry.puzzle && entry.page) {
        return restoreState(modelFromPage({
          role: 'content', type: entry.page.type, title: entry.page.title, activity: true,
          style: entry.page.style, components: entry.page.components, puzzle: entry.puzzle,
        }), entry.state);
      }
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
      puzzle: pm.puzzle || null,
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
      if (dims) {
        if (el.sizeInfo) el.sizeInfo.textContent = `${dims.widthIn} × ${dims.heightIn} in`;
        if (el.orientInfo) el.orientInfo.textContent = dims.heightIn >= dims.widthIn ? 'Portrait' : 'Landscape';
      }
      if (el.revLanguage && bookConfig && bookConfig.language) el.revLanguage.value = bookConfig.language;
      loadTeamState();
      if (bookConfig && bookConfig.master && typeof bookConfig.master === 'object') {
        master = Object.assign({ enabled: true, applyTo: 'all', skipFirst: 1, startAt: 1, elements: [] }, bookConfig.master);
        if (!Array.isArray(master.elements)) master.elements = [];
      }
      masterMode = false; updateMasterUI(); syncMasterScopeUI();
      await loadBorderStyles(); buildPageList(); cur = 0; zoom = fitScale(); renderPage();
      setStatus(inviteGreeting || `Editing “${data.title}” — ${pageModels.length} pages.`, 'ok');
      startAutosave();
    } catch (err) { setStatus(err.message, 'err'); }
  }
  async function loadBorderStyles() {
    if (el.border.options.length > 1) return;
    try { const meta = await (await fetch('/api/meta')).json(); for (const b of meta.borderStyles || []) { const o = document.createElement('option'); o.value = b.id; o.textContent = b.label; el.border.appendChild(o); } } catch (_) { /* */ }
  }
  let thumbSeq = 0;
  // A scaled, non-interactive snapshot of a page. Used for the page rail
  // (small) and the two-page-spread facing page (full size, with master).
  function paintPageCanvas(pm, pageIndex, sc, showMaster) {
    const wrap = document.createElement('div'); wrap.className = 'thumb';
    wrap.style.width = Math.round(dims.usableWidth * sc) + 'px'; wrap.style.height = Math.round(dims.usableHeight * sc) + 'px';
    const canvas = document.createElement('div'); canvas.className = 'thumb-canvas';
    const id = 'thm' + (++thumbSeq); canvas.id = id;
    canvas.style.width = dims.usableWidth + 'px'; canvas.style.height = dims.usableHeight + 'px'; canvas.style.transform = `scale(${sc})`;
    const bgv = pageBgCss(pm._bg); if (bgv) canvas.style.background = bgv;
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
    // Master overlay (page numbers, headers, frames) — same resolution as export.
    if (showMaster && master.enabled && master.elements.length && masterAppliesTo(pageIndex)) {
      const no = masterPageNo(pageIndex);
      master.elements.slice().sort((a, b) => num(a.z, 0) - num(b.z, 0)).forEach((e) => {
        const shown = e.field === 'pageNumber' ? { ...e, text: String(no) } : e;
        const n = document.createElement('div'); n.className = 'pf-node';
        n.style.transform = `translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)})`;
        n.innerHTML = elHtml(shown); canvas.appendChild(n);
      });
    }
    wrap.appendChild(canvas);
    return wrap;
  }
  const paintThumb = (pm) => paintPageCanvas(pm, pageModels.indexOf(pm), 108 / dims.usableWidth, false);
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

  // --- Ribbon split-button dropdowns (Publisher-style) ---
  function initDropdowns() {
    const closeAll = (except) => document.querySelectorAll('.rdrop-menu').forEach((m) => { if (m !== except) { m.hidden = true; const b = m.parentElement.querySelector('.rdrop-btn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
    // Position a floating menu just under its button, kept on-screen.
    const place = (btn, menu) => {
      menu.hidden = false;
      const r = btn.getBoundingClientRect(); const mw = menu.offsetWidth;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8));
      menu.style.left = left + 'px'; menu.style.top = (r.bottom + 4) + 'px';
    };
    document.querySelectorAll('.rdrop').forEach((drop) => {
      const btn = drop.querySelector('.rdrop-btn'); const menu = drop.querySelector('.rdrop-menu');
      if (!btn || !menu) return;
      btn.addEventListener('click', (e) => { e.stopPropagation(); const open = menu.hidden; closeAll(); if (open) { place(btn, menu); btn.setAttribute('aria-expanded', 'true'); } else { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
      // Action items (data-act or .rdrop-item) dismiss the menu; form controls
      // (checkboxes, colour pickers, selects) inside a menu leave it open.
      menu.addEventListener('click', (e) => { const it = e.target.closest('[data-act], .rdrop-item'); if (!it) return; menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (it.dataset.act) handleDropAct(drop.id, it.dataset.act); });
    });
    // A floating menu closes on any click outside a menu (so interacting with a
    // control inside one keeps it open).
    document.addEventListener('click', (e) => { if (!e.target.closest('.rdrop-menu')) closeAll(); });
    window.addEventListener('resize', () => closeAll());
    // Close when the page scrolls under a floating menu, but NOT when the scroll
    // happens inside a menu (e.g. spinning the wheel over the Fonts list).
    document.addEventListener('scroll', (e) => { const t = e.target; if (t && t.closest && t.closest('.rdrop-menu')) return; closeAll(); }, true);
  }
  function handleDropAct(dropId, act) {
    if (dropId === 'pageDrop') {
      if (act === 'blank') insertBlankAfterCurrent();
      else if (act === 'dup') { if (cur >= 0) duplicatePage(cur); }
      else if (act === 'tpl') openTplPicker();
      else if (act === 'puzzle') openPuzzleInsert();
    } else if (dropId === 'qrEclDrop') {
      setQrEcl(act);
    } else if (dropId === 'qrColorsDrop') {
      if (act === 'reset') applyQrStyle({ fg: '#000000', bg: '#ffffff' });
    } else if (dropId === 'alignDrop' || dropId === 'sfAlignDrop' || dropId === 'tlAlignDrop' || dropId === 'picAlignDrop' || dropId === 'qrAlignDrop') {
      const m = { aleft: 'left', acenter: 'centerh', aright: 'right', atop: 'top', amiddle: 'middle', abottom: 'bottom' };
      if (m[act]) alignSel(m[act]);
      else if (act === 'disth') distribute('x');
      else if (act === 'distv') distribute('y');
    } else if (dropId === 'rotateDrop' || dropId === 'sfRotateDrop' || dropId === 'tlRotateDrop' || dropId === 'picRotateDrop') {
      if (act === 'rright') rotateBy(90);
      else if (act === 'rleft') rotateBy(-90);
      else if (act === 'flipv') flip('v');
      else if (act === 'fliph') flip('h');
      else if (act === 'free') freeRotate();
    } else if (dropId === 'wrapDrop' || dropId === 'sfWrapDrop' || dropId === 'tlWrapDrop' || dropId === 'picWrapDrop') {
      if (act === 'wfront') reorder('front');
      else if (act === 'wbehind') reorder('back');
    } else if (dropId === 'sfEffectsDrop') {
      shapeEffects(act);
    } else if (dropId === 'picEffectsDrop') {
      picEffects(act);
    } else if (dropId === 'picCaptionDrop') {
      picCaption(act);
    } else if (dropId === 'picCompressDrop') {
      const m = { ppi300: 300, ppi220: 220, ppi150: 150, ppi96: 96 };
      if (m[act] != null) compressSel(m[act], el.picCompressCrop ? el.picCompressCrop.checked : true);
    } else if (dropId === 'tdBordersDrop') {
      const m = { all: 1, thin: 0.5, thick: 2, none: 0 }; if (m[act] != null) tblSet('borderW', m[act]);
    } else if (dropId === 'tlDeleteDrop') {
      if (act === 'row') tblDelRow(); else if (act === 'col') tblDelCol();
    } else if (dropId === 'tlMarginsDrop') {
      const m = { none: 0, narrow: 3, moderate: 6, wide: 12 }; if (m[act] != null) tblSet('cellPad', m[act]);
    } else if (dropId === 'pageNoDrop') {
      insertPageNumber(act);
    } else if (dropId === 'accentDrop') {
      addAccentBar(act);
    } else if (dropId === 'guidesDrop') {
      if (act === 'addh') addGuide('h');
      else if (act === 'addv') addGuide('v');
      else if (act === 'clear') clearGuides();
    } else if (dropId === 'marginsDrop') {
      if (act === 'fit') fitToMargins(false); else setMargins(act);
    } else if (dropId === 'bgDrop') {
      setBgType(act);
    } else if (dropId === 'fmtArrangeDrop') {
      const orders = { ofront: 'front', oforward: 'forward', obackward: 'backward', oback: 'back' };
      if (orders[act]) reorder(orders[act]);
      else if (act === 'rright') rotateBy(90);
      else if (act === 'rleft') rotateBy(-90);
      else if (act === 'fliph') flip('h');
      else if (act === 'flipv') flip('v');
      else if (act === 'disth') distribute('x');
      else if (act === 'distv') distribute('y');
    } else if (dropId === 'tbDirDrop') {
      const o = selText(); if (o) { pushUndo(); o.rot = act === 'd90' ? 90 : act === 'd270' ? 270 : 0; applyElTf(o); drawSel(); syncSelUI(); }
    } else if (dropId === 'tbFitDrop') {
      applyTextFit(act);
    } else if (dropId === 'tbColsDrop') {
      applyTextPropU('columns', Number(act) || 1);
    } else if (dropId === 'tbMarginsDrop') {
      setTextMargins(act);
    } else if (dropId === 'tbDropCapDrop') {
      applyTextPropU('dropCap', Number(act) || 0);
    } else if (dropId === 'tbNumDrop') {
      applyTextPropU('numStyle', act === 'default' ? undefined : act);
    } else if (dropId === 'tbLigDrop') {
      applyTextPropU('ligatures', act === 'standard' ? undefined : act);
    } else if (dropId === 'tbStyDrop') {
      const o = selText(); if (!o) return; pushUndo();
      if (/^ss\d$/.test(act)) o.stySet = Number(act.slice(2)) || undefined;
      else if (act === 'swash') o.swash = !o.swash;
      else if (act === 'salt') o.styAlt = !o.styAlt;
      else if (act === 'calt') { if (o.contextual === false) delete o.contextual; else o.contextual = false; }
      o._node.innerHTML = elHtml(o); drawSel(); syncFontUI(o);
    } else if (dropId === 'tbEffectsDrop') {
      const o = selText(); if (!o) return; pushUndo();
      if (act === 'shadow') { if (o.textShadow) delete o.textShadow; else o.textShadow = '#00000040'; }
      else if (act === 'none') { delete o.textStroke; delete o.textStrokeW; delete o.textShadow; }
      o._node.innerHTML = elHtml(o); drawSel();
    }
  }

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

  // Building Blocks: pre-designed clusters of objects (heading / pull quote /
  // sidebar) dropped onto the CURRENT page as a movable group. `c` carries the
  // page size and scheme colors.
  const PAGE_PARTS = [
    { cat: 'Headings', name: 'Heading + rule', make: (c) => {
      const w = R(c.W * 0.8), x = R(c.W * 0.1), y = R(c.H * 0.12);
      return [
        tEl({ text: 'Heading', x, y, w, fontSize: Math.max(28, R(c.W / 16)), bold: true, color: c.color }),
        sEl({ shape: 'line', x, y: y + R(c.W / 12), w, h: 12, fill: 'none', stroke: c.stroke, strokeW: 3 }),
      ];
    } },
    { cat: 'Headings', name: 'Bar heading', make: (c) => {
      const w = R(c.W * 0.8), x = R(c.W * 0.1), y = R(c.H * 0.12), h = R(c.W / 9);
      return [
        sEl({ shape: 'rect', x, y, w, h, fill: c.fill, stroke: 'none', strokeW: 0, z: 90 }),
        tEl({ text: 'Heading', x: x + 16, y: y + R(h * 0.24), w: w - 32, fontSize: Math.max(22, R(c.W / 18)), bold: true, color: '#ffffff', z: 100 }),
      ];
    } },
    { cat: 'Pull Quotes', name: 'Lined quote', make: (c) => {
      const w = R(c.W * 0.6), x = R(c.W * 0.2), y = R(c.H * 0.2), fs = Math.max(18, R(c.W / 26));
      return [
        sEl({ shape: 'line', x, y, w, h: 12, fill: 'none', stroke: c.stroke, strokeW: 2 }),
        tEl({ text: '“A short, punchy line to draw the reader in.”', x, y: y + 18, w, fontSize: fs, italic: true, align: 'center', color: c.color }),
        sEl({ shape: 'line', x, y: y + 18 + R(c.W / 8), w, h: 12, fill: 'none', stroke: c.stroke, strokeW: 2 }),
      ];
    } },
    { cat: 'Pull Quotes', name: 'Boxed quote', make: (c) => {
      const w = R(c.W * 0.6), x = R(c.W * 0.2), y = R(c.H * 0.2), h = R(c.W / 4);
      return [
        sEl({ shape: 'rect', x, y, w, h, fill: 'none', stroke: c.stroke, strokeW: 2, z: 90 }),
        tEl({ text: '“Wrap a memorable line in a clean box.”', x: x + 18, y: y + R(h * 0.32), w: w - 36, fontSize: Math.max(18, R(c.W / 26)), italic: true, align: 'center', color: c.color, z: 100 }),
      ];
    } },
    { cat: 'Sidebars', name: 'Color sidebar', make: (c) => {
      const w = R(c.W * 0.32), x = R(c.W * 0.62), y = R(c.H * 0.12), h = R(c.H * 0.5);
      return [
        sEl({ shape: 'rect', x, y, w, h, fill: c.fill, stroke: 'none', strokeW: 0, z: 90 }),
        tEl({ text: 'Did you know?', x: x + 14, y: y + 16, w: w - 28, fontSize: Math.max(16, R(c.W / 28)), bold: true, color: '#ffffff', z: 100 }),
        tEl({ text: 'Add a fun fact or tip here.', x: x + 14, y: y + 16 + R(c.W / 7), w: w - 28, fontSize: Math.max(13, R(c.W / 36)), color: '#ffffff', z: 100 }),
      ];
    } },
    { cat: 'Sidebars', name: 'Bordered sidebar', make: (c) => {
      const w = R(c.W * 0.32), x = R(c.W * 0.62), y = R(c.H * 0.12), h = R(c.H * 0.5);
      return [
        sEl({ shape: 'rect', x, y, w, h, fill: 'none', stroke: c.stroke, strokeW: 2, z: 90 }),
        tEl({ text: 'Notes', x: x + 14, y: y + 16, w: w - 28, fontSize: Math.max(16, R(c.W / 28)), bold: true, color: c.color, z: 100 }),
        tEl({ text: 'Jot a note or a short list here.', x: x + 14, y: y + 16 + R(c.W / 7), w: w - 28, fontSize: Math.max(13, R(c.W / 36)), color: c.color, z: 100 }),
      ];
    } },
  ];
  function insertPagePart(part) {
    if (el.main.hidden || !part) return;
    pushUndo();
    const c = { W: dims.usableWidth, H: dims.usableHeight, fill: schemeFill(), stroke: schemeStroke(), color: '#222222' };
    const els = part.make(c).map((e) => ({ ...e, group: 'el', id: uid++ }));
    const gid = els.length > 1 ? 'g' + uid++ : null;
    const pm = curModel();
    els.forEach((e) => { if (gid) e.gid = gid; pm.elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); });
    setSel(els);
    setStatus(`Inserted “${part.name}”.`, 'ok');
  }
  function buildPagePartsMenu() {
    const host = document.getElementById('pagePartsMenu'); if (!host) return;
    host.innerHTML = '';
    const byCat = {};
    PAGE_PARTS.forEach((part) => { (byCat[part.cat] = byCat[part.cat] || []).push(part); });
    Object.keys(byCat).forEach((cat) => {
      const h = document.createElement('div'); h.className = 'shapegal-cat'; h.textContent = cat; host.appendChild(h);
      byCat[cat].forEach((part) => {
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = part.name;
        btn.addEventListener('click', () => { closeObjMenus(); insertPagePart(part); });
        host.appendChild(btn);
      });
    });
  }

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

  // --- Change Template: apply a layout to the CURRENT page (with previews) ---
  function tplCtx() {
    return { W: dims.usableWidth, H: dims.usableHeight, title: (bookConfig && bookConfig.title) || '',
      subtitle: (bookConfig && bookConfig.subtitle) || '', author: (bookConfig && bookConfig.author) || '',
      year: new Date().getFullYear(), fill: schemeFill(), stroke: schemeStroke(), color: '#222222' };
  }
  // Element list for a template, already scaled to the current page.
  function tplEls(t) {
    if (t.make) return t.make(tplCtx()).map((e) => ({ ...e, id: uid++ }));
    const sx = dims.usableWidth / (t.refW || dims.usableWidth), sy = dims.usableHeight / (t.refH || dims.usableHeight);
    return (t.elements || []).map((e) => scaleEl(e, sx, sy));
  }
  // A small non-interactive visual preview of a template's elements.
  function tplThumb(els, refW, refH) {
    const W = 138, s = W / (refW || dims.usableWidth), H = Math.round((refH || dims.usableHeight) * s);
    const box = document.createElement('div'); box.className = 'pf-tplchg-thumb';
    box.style.width = W + 'px'; box.style.height = H + 'px';
    const inner = document.createElement('div');
    inner.style.cssText = `position:absolute;top:0;left:0;width:${refW}px;height:${refH}px;transform:scale(${s});transform-origin:top left;`;
    (els || []).forEach((e) => {
      const d = document.createElement('div'); d.style.position = 'absolute';
      d.style.left = num(e.x, 0) + 'px'; d.style.top = num(e.y, 0) + 'px';
      if (e.kind === 'text') {
        d.style.width = num(e.w, 240) + 'px'; d.style.fontSize = Math.max(6, num(e.fontSize, 24)) + 'px';
        d.style.color = e.color || '#222'; d.style.textAlign = e.align || 'left';
        d.style.fontWeight = e.bold ? '700' : '400'; d.style.fontStyle = e.italic ? 'italic' : 'normal';
        d.style.lineHeight = '1.15'; d.style.overflow = 'hidden';
        d.textContent = String(e.text || '').slice(0, 120);
      } else if (e.kind === 'shape' && e.shape === 'line') {
        d.style.width = num(e.w, 120) + 'px'; d.style.borderTop = `${Math.max(1, num(e.strokeW, 2))}px solid ${e.stroke || '#222'}`;
      } else if (e.kind === 'shape') {
        d.style.width = num(e.w, 120) + 'px'; d.style.height = num(e.h, 80) + 'px';
        if (e.fill && e.fill !== 'none') d.style.background = e.fill;
        if (e.stroke && e.stroke !== 'none') d.style.border = `${Math.max(1, num(e.strokeW, 2))}px solid ${e.stroke}`;
      } else if (e.kind === 'image') {
        d.style.width = num(e.width, 160) + 'px'; d.style.height = num(e.width, 160) * 0.66 + 'px';
        d.style.background = '#e7ebf5'; d.style.border = '1px dashed #b7c0d8';
      } else return;
      inner.appendChild(d);
    });
    box.appendChild(inner); return box;
  }
  function changeTplCard(name, desc, els, refW, refH, onPick, onDelete) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'pf-tplchg-card';
    card.appendChild(tplThumb(els, refW, refH));
    const n = document.createElement('span'); n.className = 'pf-tplchg-name'; n.textContent = name; card.appendChild(n);
    if (desc) { const dd = document.createElement('span'); dd.className = 'pf-tplchg-desc'; dd.textContent = desc; card.appendChild(dd); }
    card.addEventListener('click', onPick);
    if (onDelete) { const del = document.createElement('span'); del.className = 'pf-tplchg-del'; del.textContent = '✕'; del.title = 'Delete template';
      del.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); }); card.appendChild(del); }
    return card;
  }
  function openChangeTpl() { if (el.main.hidden) { setStatus('Open a book first.', ''); return; } renderChangeTpl(); el.changeTplModal.hidden = false; }
  function closeChangeTpl() { el.changeTplModal.hidden = true; }
  function renderChangeTpl() {
    const pm = curModel();
    el.changeTplPageName.textContent = (pm && pm.title) ? `“${pm.title}”` : 'this page';
    el.changeTplBuiltin.innerHTML = '';
    BUILTIN_TPLS.forEach((t) => {
      const els = t.make(tplCtx());
      el.changeTplBuiltin.appendChild(changeTplCard(t.name, t.desc, els, dims.usableWidth, dims.usableHeight,
        () => { applyTplToPage(t); closeChangeTpl(); }));
    });
    const saved = loadSavedTemplates();
    el.changeTplSaved.innerHTML = '';
    el.changeTplSavedEmpty.hidden = saved.length > 0;
    el.changeTplSavedCount.textContent = saved.length ? `(${saved.length})` : '';
    saved.forEach((t) => el.changeTplSaved.appendChild(changeTplCard(
      t.name, `${t.elements.length} object${t.elements.length !== 1 ? 's' : ''}`, t.elements, t.refW, t.refH,
      () => { applyTplToPage(t); closeChangeTpl(); },
      () => { deleteSavedTemplate(t.id); renderChangeTpl(); }
    )));
  }
  function applyTplToPage(t) {
    const pm = curModel(); if (!pm) return;
    const had = (pm.elements && pm.elements.length) || 0;
    if (had && !window.confirm(`Replace this page's ${had} object${had !== 1 ? 's' : ''} with the “${t.name}” layout?`)) return;
    pushUndo();
    pm.elements = tplEls(t);
    pm.title = pm.title && pm.title !== 'Blank' ? pm.title : t.name;
    renderPage(); buildPageList();
    setStatus(`Applied “${t.name}” to this page.`, 'ok');
  }

  // --- Fonts: built-in stacks + uploaded custom fonts ------------------------
  // Values mirror the FONTS map in engine/element-html.js so a font renders the
  // same on screen and in the exported PDF. Custom fonts use `custom:<id>`.
  const FONT_LIST = [
    { v: 'sans', label: 'Sans (Arial)' }, { v: 'serif', label: 'Serif (Georgia)' },
    { v: 'rounded', label: 'Rounded (Verdana)' }, { v: 'trebuchet', label: 'Trebuchet MS' },
    { v: 'tahoma', label: 'Tahoma' }, { v: 'century', label: 'Century Gothic' },
    { v: 'palatino', label: 'Palatino' }, { v: 'garamond', label: 'Garamond' },
    { v: 'mono', label: 'Mono (Courier)' }, { v: 'hand', label: 'Handwritten' },
    { v: 'brush', label: 'Brush Script' }, { v: 'impact', label: 'Impact' },
  ];
  const FONT_MIME = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
  function loadCustomFonts() { try { return JSON.parse(localStorage.getItem('pf_fonts') || '[]'); } catch (_) { return []; } }
  function saveCustomFonts(l) { try { localStorage.setItem('pf_fonts', JSON.stringify(l)); return true; } catch (_) { setStatus('Could not save the font — browser storage is full.', 'err'); return false; } }
  function fontSlug(name) { return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32); }
  // Custom fonts formatted for the shared @font-face builder / PDF send.
  function customFontsForSend() { return loadCustomFonts().map((f) => ({ family: 'pf-custom-' + f.id, dataUrl: f.dataUrl })); }
  // Only the custom fonts actually used by a text object anywhere in the book —
  // keeps export payloads lean (font data URLs are large).
  function usedCustomFontsForSend() {
    const used = new Set();
    pageModels.forEach((pm) => (pm.elements || []).forEach((e) => { if (e.kind === 'text' && String(e.fontFamily || '').slice(0, 7) === 'custom:') used.add(e.fontFamily.slice(7)); }));
    return loadCustomFonts().filter((f) => used.has(f.id)).map((f) => ({ family: 'pf-custom-' + f.id, dataUrl: f.dataUrl }));
  }
  // Keep a <style> in <head> with @font-face rules for every uploaded font so
  // the live editor renders them (the PDF export gets the same rules server-side).
  function injectCustomFontFaces() {
    let st = document.getElementById('pf-custom-fonts');
    if (!st) { st = document.createElement('style'); st.id = 'pf-custom-fonts'; document.head.appendChild(st); }
    st.textContent = (window.PFElements && PFElements.fontFaceCss) ? PFElements.fontFaceCss(customFontsForSend()) : '';
  }
  function fontOptionsHtml() {
    let opts = FONT_LIST.map((f) => `<option value="${f.v}">${escHtml(f.label)}</option>`).join('');
    const custom = loadCustomFonts();
    if (custom.length) opts += `<optgroup label="Your fonts">${custom.map((f) => `<option value="custom:${escHtml(f.id)}">${escHtml(f.name)}</option>`).join('')}</optgroup>`;
    return opts;
  }
  function refreshFontSelects() {
    if (el.fontFamily) { const c = el.fontFamily.value; el.fontFamily.innerHTML = fontOptionsHtml(); if (c) el.fontFamily.value = c; }
    buildFontsMenu();
  }
  const fontStackFor = (v) => (window.PFElements && PFElements.fontStack) ? PFElements.fontStack(v) : 'inherit';
  // Publisher-style Fonts gallery: each row previews the font in itself and
  // applies it as the page font. Custom uploads sit under "Your fonts" with a
  // remove button; the Upload control lives in the menu footer (in the HTML).
  function buildFontsMenu() {
    const host = document.getElementById('fontsList'); if (!host) return;
    host.innerHTML = '';
    const cur = (curModel() && curModel()._font) || '';
    const addRow = (value, label, stack, onDel) => {
      const row = document.createElement('div'); row.className = 'font-row' + (value === cur ? ' on' : '');
      const use = document.createElement('button'); use.type = 'button'; use.className = 'font-row-use rdrop-item';
      use.innerHTML = `<span class="font-row-aa">Aa</span><span class="font-row-name">${escHtml(label)}</span>`;
      use.style.fontFamily = stack;
      use.addEventListener('click', () => applyPageFont(value));
      row.appendChild(use);
      if (onDel) { const del = document.createElement('button'); del.type = 'button'; del.className = 'font-menu-del'; del.textContent = '✕'; del.title = 'Remove font'; del.addEventListener('click', (e) => { e.stopPropagation(); onDel(); }); row.appendChild(del); }
      host.appendChild(row);
    };
    FONT_LIST.forEach((f) => addRow(f.v, f.label, fontStackFor(f.v)));
    const custom = loadCustomFonts();
    if (custom.length) {
      const cat = document.createElement('div'); cat.className = 'font-cat'; cat.textContent = 'Your fonts'; host.appendChild(cat);
      custom.forEach((f) => addRow('custom:' + f.id, f.name, `'pf-custom-${f.id}', sans-serif`, () => removeCustomFont(f.id)));
    }
  }
  function onFontUpload(input) {
    const file = input && input.files && input.files[0]; if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!FONT_MIME[ext]) { setStatus('Pick a .ttf, .otf, .woff, or .woff2 font file.', 'err'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || '').split(',')[1] || '';
      if (!b64) { setStatus('Could not read that font file.', 'err'); return; }
      const dataUrl = `data:${FONT_MIME[ext]};base64,${b64}`;
      const name = file.name.replace(/\.[^.]+$/, '');
      const list = loadCustomFonts();
      let id = fontSlug(name) || ('f' + Date.now().toString(36));
      while (list.some((f) => f.id === id)) id += '-2';
      list.push({ id, name, dataUrl });
      if (!saveCustomFonts(list)) return;
      injectCustomFontFaces(); refreshFontSelects();
      applyPageFont('custom:' + id);
      setStatus(`Added font “${name}”.`, 'ok');
    };
    reader.onerror = () => setStatus('Could not read that font file.', 'err');
    reader.readAsDataURL(file); input.value = '';
  }
  function removeCustomFont(id) {
    saveCustomFonts(loadCustomFonts().filter((f) => f.id !== id));
    injectCustomFontFaces(); refreshFontSelects();
    setStatus('Removed font.', 'ok');
  }
  // Set the default font for every text object on the current page.
  function applyPageFont(v) {
    if (!v) return;
    const pm = curModel(); if (!pm) return;
    pushUndo();
    pm._font = v;
    (pm.elements || []).forEach((e) => { if (e.kind === 'text') e.fontFamily = v; });
    renderPage(); buildFontsMenu();
    const label = v.slice(0, 7) === 'custom:' ? (loadCustomFonts().find((f) => 'custom:' + f.id === v) || {}).name || 'custom' : (FONT_LIST.find((f) => f.v === v) || {}).label || v;
    setStatus(`Page font set to ${label}.`, 'ok');
  }

  // --- Insert a freshly generated puzzle page ---
  const PUZ_LABELS = { wordsearch: 'Word Search', numbersearch: 'Number Search', sudoku: 'Sudoku', maze: 'Maze', cryptogram: 'Cryptogram', wordscramble: 'Word Scramble', crossword: 'Crossword', krisskross: 'Kriss-Kross', nonogram: 'Nonogram', trivia: 'Trivia', logicgrid: 'Logic Grid', wordladder: 'Word Ladder', wordwheel: 'Word Wheel', cipher: 'Cipher', coloring: 'Coloring', drawing: 'Drawing' };
  let puzTypesLoaded = false;
  let insertMeta = null;
  const ACTIVITY_TYPES = new Set(['coloring', 'drawing']);
  async function loadPuzzleTypes() {
    if (puzTypesLoaded || !el.puzType) return;
    try {
      insertMeta = await (await fetch('/api/meta')).json();
      // bleedguard = the blank filler (its own menu item); breather = an
      // auto-inserted kids rest page. Neither is a user-selectable page.
      const HIDDEN = new Set(['bleedguard', 'breather']);
      (insertMeta.types || []).forEach((t) => {
        const id = typeof t === 'string' ? t : t.id;
        if (HIDDEN.has(id)) return;
        const label = (typeof t === 'object' && t.label) || PUZ_LABELS[id] || id;
        const o = document.createElement('option'); o.value = id; o.textContent = label; el.puzType.appendChild(o);
      });
      const ws = [...el.puzType.options].find((o) => o.value === 'wordsearch'); if (ws) el.puzType.value = 'wordsearch';
      fillThemeSelect(el.puzTheme, insertMeta.themes || [], '— book theme —');
      puzTypesLoaded = el.puzType.options.length > 0;
    } catch (_) { /* leave empty; insert will warn */ }
  }
  // Difficulty labels track the audience (kids ages vs adult Easy–Expert).
  function fillPuzDiffOptions() {
    const kids = String(el.puzAudience.value).toLowerCase() === 'kids';
    const list = (insertMeta && insertMeta.difficulty && (kids ? insertMeta.difficulty.kids : insertMeta.difficulty.adult)) || [];
    const prev = el.puzDiff.value;
    el.puzDiff.innerHTML = '';
    (list.length ? list : [{ value: 1, label: 'Easy' }, { value: 2, label: 'Medium' }, { value: 3, label: 'Hard' }, { value: 4, label: 'Expert' }])
      .forEach((o) => { const opt = document.createElement('option'); opt.value = String(o.value); opt.textContent = kids && o.ages ? `${o.label} (${o.ages})` : o.label; el.puzDiff.appendChild(opt); });
    if ([...el.puzDiff.options].some((o) => o.value === prev)) el.puzDiff.value = prev;
  }
  // Coloring pages take a style, not a difficulty — show the right control.
  function syncPuzTypeUI() {
    const isColor = el.puzType.value === 'coloring';
    if (el.puzColorRow) el.puzColorRow.hidden = !isColor;
  }
  // Grouped theme picker (mirrors the Book Builder). Blank option = book theme.
  function fillThemeSelect(select, themeList, defaultLabel) {
    if (!select) return;
    select.innerHTML = '';
    if (defaultLabel) { const o = document.createElement('option'); o.value = ''; o.textContent = defaultLabel; select.appendChild(o); }
    const byCat = {};
    (themeList || []).forEach((th) => { (byCat[th.category] = byCat[th.category] || []).push(th); });
    Object.keys(byCat).sort().forEach((cat) => {
      const group = document.createElement('optgroup'); group.label = cat;
      byCat[cat].forEach((th) => { const o = document.createElement('option'); o.value = th.id; o.textContent = `${th.label} (${th.wordCount})`; group.appendChild(o); });
      select.appendChild(group);
    });
  }
  async function openPuzzleInsert() {
    if (el.main.hidden) { setStatus('Open a book first.', ''); return; }
    await loadPuzzleTypes();
    // Default the audience to the book's, then fill difficulty to match.
    el.puzAudience.value = (bookConfig && bookConfig.audience) === 'adult' ? 'adult' : 'kids';
    fillPuzDiffOptions();
    const d0 = bookConfig && bookConfig.puzzles && bookConfig.puzzles[0] && bookConfig.puzzles[0].difficulty;
    if (d0 && [...el.puzDiff.options].some((o) => o.value === String(d0))) el.puzDiff.value = String(d0);
    syncPuzTypeUI();
    el.puzStatus.textContent = ''; el.puzModal.hidden = false;
  }
  function closePuzzleInsert() { el.puzModal.hidden = true; }
  async function insertPuzzlePages() {
    const type = el.puzType.value;
    const difficulty = Number(el.puzDiff.value) || 1;
    const count = Math.max(1, Math.min(50, Number(el.puzCount.value) || 1));
    const audience = el.puzAudience.value === 'adult' ? 'adult' : 'kids';
    const style = (type === 'coloring' && el.puzColorStyle && el.puzColorStyle.value) || undefined;
    if (!type) { el.puzStatus.textContent = 'Pick a puzzle type.'; return; }
    el.puzStatus.textContent = 'Generating…'; el.puzInsert.disabled = true;
    try {
      const res = await fetch('/api/book/insert-puzzle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: bookConfig, type, difficulty, count, audience, style, theme: (el.puzTheme && el.puzTheme.value) || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate the puzzle.');
      const pages = data.pages || [];
      if (!pages.length) throw new Error('No puzzle was generated.');
      let at = cur < 0 ? pageModels.length : cur + 1;
      pages.forEach((pg) => { pageModels.splice(at, 0, modelFromPage(pg)); at += 1; });
      cur = at - 1; buildPageList(); renderPage();
      closePuzzleInsert();
      const label = PUZ_LABELS[type] || type;
      setStatus(`Inserted ${pages.length} ${label} page${pages.length > 1 ? 's' : ''}.`, 'ok');
    } catch (err) { el.puzStatus.textContent = err.message; }
    finally { el.puzInsert.disabled = false; }
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
    if (spreadMode && !masterMode) layoutSpread(); else clearSpread();
  }

  // --- Two-page spread (View) ---
  // Shows the active page next to its facing page (live, non-interactive) so you
  // can check the gutter and across-the-spread layout. Recto (odd page numbers)
  // sits on the right, like a real book opening.
  const SPREAD_GUT = 28;
  let spreadMode = false;
  const activeIsLeft = (i) => i % 2 === 1;                 // even display number (i+1) = verso/left
  function facingIndex(i) {
    const j = i % 2 === 1 ? i + 1 : i - 1;
    return (j >= 0 && j < pageModels.length) ? j : null;
  }
  function clearSpread() {
    el.stageOuter.querySelectorAll('.spread-facing, .spread-gutter').forEach((n) => n.remove());
    el.stageInner.style.position = ''; el.stageInner.style.left = ''; el.stageInner.style.top = '';
  }
  function layoutSpread() {
    el.stageOuter.querySelectorAll('.spread-facing, .spread-gutter').forEach((n) => n.remove());
    const pageW = dims.usableWidth, pageH = dims.usableHeight;
    const rightX = (pageW + SPREAD_GUT) * zoom;
    const aLeft = activeIsLeft(cur), fIdx = facingIndex(cur);
    el.stageOuter.style.width = Math.round((2 * pageW + SPREAD_GUT) * zoom) + 'px';
    el.stageOuter.style.height = Math.round(pageH * zoom) + 'px';
    el.stageInner.style.position = 'absolute'; el.stageInner.style.top = '0';
    el.stageInner.style.left = (aLeft ? 0 : rightX) + 'px';
    if (fIdx != null && pageModels[fIdx]) {
      const wrap = paintPageCanvas(pageModels[fIdx], fIdx, zoom, true);
      wrap.classList.add('spread-facing');
      wrap.style.position = 'absolute'; wrap.style.top = '0'; wrap.style.left = (aLeft ? rightX : 0) + 'px';
      wrap.title = 'Click to edit this facing page';
      wrap.addEventListener('click', () => selectPage(fIdx));
      el.stageOuter.appendChild(wrap);
    }
    const band = document.createElement('div'); band.className = 'spread-gutter';
    band.style.cssText = `position:absolute;top:0;height:${Math.round(pageH * zoom)}px;left:${Math.round(pageW * zoom)}px;width:${Math.round(SPREAD_GUT * zoom)}px;`;
    el.stageOuter.appendChild(band);
  }
  function fitSpread() {
    const aw = (el.stageScroll.clientWidth || 700) - 24, ah = window.innerHeight - 200;
    return Math.max(0.12, Math.min(aw / (2 * dims.usableWidth + SPREAD_GUT), ah / dims.usableHeight, 1.5));
  }
  function toggleSpread() {
    spreadMode = el.spreadToggle.checked;
    if (spreadMode) zoom = Math.min(zoom, fitSpread());
    renderPage(); updateViewButtons();
    setStatus(spreadMode ? 'Two-page spread — the facing page is a live preview; click it to edit it.' : 'Single-page view.', 'ok');
  }
  // Drive the View-tab Single/Spread buttons (they set the hidden checkbox).
  function setSpreadMode(on) { el.spreadToggle.checked = on; toggleSpread(); }
  // Reflect Normal/Master and Single/Spread active state on the View buttons.
  function updateViewButtons() {
    if (el.viewNormal) el.viewNormal.classList.toggle('on', !masterMode);
    if (el.viewMaster) el.viewMaster.classList.toggle('on', masterMode);
    if (el.viewSingle) el.viewSingle.classList.toggle('on', !spreadMode);
    if (el.viewSpread) el.viewSpread.classList.toggle('on', spreadMode);
  }
  // Align the ruler tick gradients + draw inch numbers against the page's actual
  // on-screen position (the page is centred in the scroll area, so we can't just
  // use scrollLeft). Called on zoom, scroll, and page render.
  function syncRulers() {
    const stage = el.editorMain.querySelector('.editor-stage');
    if (!stage || stage.classList.contains('no-rulers')) return;
    const inner = el.stageInner.getBoundingClientRect();
    const offX = inner.left - el.rulerTop.getBoundingClientRect().left;
    const offY = inner.top - el.rulerLeft.getBoundingClientRect().top;
    const inch = PX_PER_IN * zoom;
    el.rulerTop.style.backgroundPositionX = offX + 'px';
    el.rulerLeft.style.backgroundPositionY = offY + 'px';
    const marks = (ruler) => { let m = ruler.querySelector('.ruler-marks'); if (!m) { m = document.createElement('div'); m.className = 'ruler-marks'; ruler.appendChild(m); } return m; };
    const wIn = Math.round(dims.usableWidth / PX_PER_IN), hIn = Math.round(dims.usableHeight / PX_PER_IN);
    const mt = marks(el.rulerTop); mt.innerHTML = '';
    for (let i = 0; i <= wIn; i++) { const s = document.createElement('span'); s.textContent = i; s.style.left = (offX + i * inch) + 'px'; mt.appendChild(s); }
    const ml = marks(el.rulerLeft); ml.innerHTML = '';
    for (let i = 0; i <= hIn; i++) { const s = document.createElement('span'); s.textContent = i; s.style.top = (offY + i * inch) + 'px'; ml.appendChild(s); }
  }
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
    const pm = curModel(); highlightPage();
    const matter = isMatterPage(pm);
    el.stageInner.innerHTML = '';
    el.stageInner.style.background = pageBgCss(pm && pm._bg);
    const style = document.createElement('style'); style.textContent = scopeCss(pm.style, '#stageInner'); el.stageInner.appendChild(style);
    renderBorderFrame(pm);
    gridEl = document.createElement('div'); gridEl.className = 'pf-grid-overlay'; gridEl.style.display = el.gridToggle.checked ? '' : 'none'; el.stageInner.appendChild(gridEl);

    el.border.value = pm._border || ''; syncBgUI(); applyZoom();
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

    // Free objects render in z-order, split across the puzzle: objects flagged
    // `behind` sit UNDER the puzzle/title/word-list (backgrounds, watermarks,
    // frames); the rest sit on top. The puzzle itself stays a protected object.
    const ordered = pm.elements.slice().sort((a, b) => num(a.z, 0) - num(b.z, 0));
    ordered.filter((e) => e.behind).forEach((e) => el.stageInner.appendChild(makeEl(e)));
    el.stageInner.appendChild(flowEl);
    ordered.filter((e) => !e.behind).forEach((e) => el.stageInner.appendChild(makeEl(e)));

    vGuide = document.createElement('div'); vGuide.className = 'pf-guide pf-guide-v'; vGuide.style.display = 'none';
    hGuide = document.createElement('div'); hGuide.className = 'pf-guide pf-guide-h'; hGuide.style.display = 'none';
    selLayer = document.createElement('div'); selLayer.className = 'pf-sel-layer';
    el.stageInner.appendChild(vGuide); el.stageInner.appendChild(hGuide); el.stageInner.appendChild(selLayer);
    applyMarginGuide();
    renderUserGuides();
    if (!masterMode) renderMasterOverlay();

    // Content: measure flow bases (no transform yet). Matter: bases already set.
    requestAnimationFrame(() => {
      if (!matter) measureBases(pm);
      // A piece pinned during break-apart keeps its original page position even
      // after its siblings are hidden (which would otherwise let it reflow up).
      // Convert the pin to a one-time dx/dy delta against the fresh flow base.
      pm.comps.forEach((c) => {
        if (!c._pin) return;
        c.dx = num(c._pinX, c.baseX) - c.baseX; c.dy = num(c._pinY, c.baseY) - c.baseY;
        delete c._pin; delete c._pinX; delete c._pinY;
      });
      pm.comps.forEach(applyPieceTf);
      // Auto-break imported puzzle pages once, after the pieces are measured
      // (break-apart needs their on-screen geometry). breakApartPuzzle re-renders.
      if (autoBreak && !matter && !masterMode && pm === pageModels[cur] && !pm._broken && pm.comps.some((c) => !c.hidden && BREAKABLE.includes(c.kind))) {
        pm._broken = true; breakApartPuzzle(true); return;
      }
      sels = []; syncSelUI(); drawSel();
    });
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
    const node = document.createElement('div'); node.className = 'pf-node' + (e.behind ? ' pf-behind' : ''); node.innerHTML = elHtml(e);
    e._node = node; node._ref = e; applyElTf(e);
    node.addEventListener('pointerdown', (ev) => onPointerDown(ev, e));
    if (e.kind === 'text') node.addEventListener('dblclick', () => editText(e));
    if (e.kind === 'table') { node.addEventListener('dblclick', (ev) => editTableCell(e, ev)); node.addEventListener('pointerdown', (ev) => onTableCellDown(e, ev), true); }
    if (e.kind === 'image') node.addEventListener('dblclick', () => pickImageFor(e));
    return node;
  }
  function applyElTf(e) { if (e._node) e._node.style.transform = `translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)})`; }
  // Elements render through the engine's shared renderer (element-html.js), so
  // what's on screen is byte-identical to what the PDF composer prints.
  const elHtml = (e) => window.PFElements.elementHtml(e);
  function allRefs() { const pm = curModel(); return [...pm.comps.filter((c) => !c.hidden), ...pm.elements]; }

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
  function snapshot(pm) { return JSON.stringify({ comps: pm.comps.map((c) => ({ key: c.key, dx: c.dx, dy: c.dy, scale: c.scale, rot: c.rot, hidden: c.hidden, locked: c.locked })), elements: pm.elements.map((e) => { const { _node, ...r } = e; return r; }), guides: pm.guides ? { v: pm.guides.v.slice(), h: pm.guides.h.slice() } : { v: [], h: [] } }); }
  function pushUndo() { const pm = curModel(); pm.undo.push(snapshot(pm)); if (pm.undo.length > 60) pm.undo.shift(); pm.redo = []; }
  function applySnap(pm, snap) { const s = JSON.parse(snap); const byKey = {}; pm.comps.forEach((c) => (byKey[c.key] = c)); s.comps.forEach((sc) => { const c = byKey[sc.key]; if (c) Object.assign(c, sc); }); pm.elements = s.elements.map((e) => ({ ...e, group: 'el' })); pm.guides = s.guides ? { v: (s.guides.v || []).slice(), h: (s.guides.h || []).slice() } : { v: [], h: [] }; }
  function undo() { const pm = curModel(); if (!pm.undo.length) return; pm.redo.push(snapshot(pm)); applySnap(pm, pm.undo.pop()); if (masterMode) master.elements = pm.elements; renderPage(); }
  function redo() { const pm = curModel(); if (!pm.redo.length) return; pm.undo.push(snapshot(pm)); applySnap(pm, pm.redo.pop()); if (masterMode) master.elements = pm.elements; renderPage(); }

  // --- selection ---
  const isSel = (r) => sels.indexOf(r) >= 0;
  function setSel(a) { if (cropTarget && a[0] !== cropTarget) endCrop(true); sels = a.slice(); syncSelUI(); drawSel(); }
  const primary = () => sels[sels.length - 1];
  // Which resize handles an object gets: shapes resize freely on all 8;
  // text/images resize width on the sides and scale on the corners; puzzle
  // pieces scale on the corners only.
  function handleDirs(ref) {
    if (ref.kind === 'shape') return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    // A linked (flow) text box also gets a bottom handle to size its region.
    if (ref.kind === 'text' && ref.chainId) return ['nw', 'ne', 'se', 'sw', 'e', 'w', 's'];
    if (ref.kind === 'text' || ref.kind === 'image') return ['nw', 'ne', 'se', 'sw', 'e', 'w'];
    return ['nw', 'ne', 'se', 'sw'];
  }
  function drawSel() {
    if (!selLayer) return; selLayer.innerHTML = '';
    if (cropTarget) return; // crop overlay replaces the selection handles
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
    const setOn = (sel, on) => document.querySelectorAll(sel).forEach((b) => b.classList.toggle('on', !!on));
    setOn('.js-bold', isText && one.bold);
    setOn('.js-italic', isText && one.italic);
    setOn('.js-underline', isText && one.underline);
    document.querySelectorAll('.palign').forEach((b) => b.classList.toggle('on', isText && (one.align || 'left') === b.dataset.align));
    if (isText) {
      const setVal = (sel, v) => document.querySelectorAll(sel).forEach((i) => { i.value = v; });
      setVal('.js-font-size', num(one.fontSize, 24));
      setVal('.js-font-color', one.color || '#222222');
      setVal('.js-font-family', one.fontFamily || 'sans');
      setVal('.js-line-spacing', String(num(one.lineHeight, 1.25)));
      if (el.tbHyphenBtn) el.tbHyphenBtn.classList.toggle('on', !!one.hyphens);
      // Typography → Stylistic Sets menu: mark the active set and toggles.
      const styMenu = el.tbStyDrop && el.tbStyDrop.querySelector('.rdrop-menu');
      if (styMenu) {
        const ss = Math.round(num(one.stySet, 0));
        styMenu.querySelectorAll('[data-act]').forEach((b) => {
          const a = b.dataset.act;
          const on = a === 'ss' + ss || (a === 'swash' && one.swash) || (a === 'salt' && one.styAlt) || (a === 'calt' && one.contextual !== false);
          b.classList.toggle('rdrop-on', !!on);
        });
      }
    }
  }
  function syncShapeFormatUI() {
    const ok = sfApplicable(); const o = sfSel();
    if (el.sfNone) el.sfNone.classList.toggle('hidden', ok);
    if (el.sfControls) el.sfControls.classList.toggle('hidden', !ok);
    if (!ok || !o) return;
    if (el.sfW) el.sfW.value = Math.round(num(o.w, 0));
    if (el.sfH) el.sfH.value = Math.round(num(o.h, o._node && o._node.firstElementChild ? o._node.firstElementChild.offsetHeight : 0));
    if (el.sfEditText) el.sfEditText.style.display = o.kind === 'text' ? '' : 'none';
  }
  function syncSelUI() {
    const has = sels.length > 0; el.selNone.classList.toggle('hidden', has); el.selControls.classList.toggle('hidden', !has);
    const one = sels.length === 1 ? sels[0] : null; const isText = one && one.kind === 'text'; const isImg = one && one.kind === 'image'; const isShape = one && one.kind === 'shape'; const isTable = one && one.kind === 'table'; const isQr = one && one.kind === 'qr'; const isEl = one && one.group === 'el';
    syncFontUI(one);
    updateContextTab();
    syncShapeFormatUI();
    syncTableTabsUI();
    syncPictureUI();
    syncQrUI(one);
    if (!has) return;
    document.querySelectorAll('.tb-group').forEach((g) => { g.style.display = isText ? '' : 'none'; });
    // Generic Size / Arrange / Object groups live on the Shape Format tab for a
    // text box, so hide them on the (pure) Text Box tab; keep them for images/tables/QR.
    document.querySelectorAll('#selControls .gen-group').forEach((g) => { g.style.display = isText ? 'none' : ''; });
    el.measurePanel.style.display = one && !isText ? '' : 'none';
    el.shapeProps.style.display = isShape ? '' : 'none';
    if (el.tableProps) el.tableProps.style.display = isTable ? '' : 'none';
    el.mWField.style.display = isEl && !isTable ? '' : 'none'; el.mHField.style.display = isShape ? '' : 'none';
    el.dupObj.style.display = isEl ? '' : 'none'; el.deleteObj.style.display = isEl ? '' : 'none';
    el.hideObj.style.display = one && !isEl ? '' : 'none';
    el.lockObj.textContent = one && one.locked ? 'Unlock' : 'Lock';
    el.groupBtn.style.display = sels.length >= 2 ? '' : 'none';
    el.ungroupBtn.style.display = sels.some((r) => r.gid) ? '' : 'none';
    if (one) {
      const b = box(one); el.mX.value = Math.round(b.x); el.mY.value = Math.round(b.y); el.mScale.value = Math.round(num(one.scale, 1) * 100); el.mRot.value = Math.round(num(one.rot, 0));
      if (isEl && !isTable) el.mW.value = Math.round(num(one.kind === 'image' ? one.width : one.w, 0));
      if (isShape) el.mH.value = Math.round(num(one.h, 0));
      if (isShape) {
        el.fillColor.value = /^#/.test(one.fill || '') ? one.fill : '#ffd43b';
        el.strokeColor.value = /^#/.test(one.stroke || '') ? one.stroke : '#222222';
        el.strokeW.value = num(one.strokeW, 2); el.noFill.checked = one.fill === 'none';
      }
      if (isTable && el.tblBorder) {
        el.tblBorder.value = /^#/.test(one.borderColor || '') ? one.borderColor : '#333333';
        el.tblHeaderFill.value = /^#/.test(one.headerFill || '') ? one.headerFill : '#eef1fe';
        el.tblHeader.checked = !!one.header;
      }
    }
  }

  function snapTargets(excl) {
    // Page edges/centers always snap; objects and guides are gated by the
    // Page Design → Align To checkboxes.
    const xs = [0, dims.usableWidth / 2, dims.usableWidth], ys = [0, dims.usableHeight / 2, dims.usableHeight];
    if (alignObjects) for (const r of allRefs()) { if (excl.indexOf(r) >= 0 || !r._node) continue; const b = box(r); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); }
    if (alignGuides) { const g = ensureGuides(curModel()); if (g) { xs.push(...g.v); ys.push(...g.h); } }
    return { xs, ys };
  }
  const showGuide = (g, a, v) => { g.style.display = ''; if (a === 'x') g.style.left = v + 'px'; else g.style.top = v + 'px'; };
  const hideGuides = () => { if (vGuide) vGuide.style.display = 'none'; if (hGuide) hGuide.style.display = 'none'; };

  // --- user ruler guides (drag off a ruler to place; snap objects to them) ----
  // Stored per page in unscaled page px: pm.guides = { v: [x…], h: [y…] }.
  function ensureGuides(pm) { if (pm && !pm.guides) pm.guides = { v: [], h: [] }; return pm && pm.guides; }
  function renderUserGuides() {
    el.stageInner.querySelectorAll('.pf-user-guide').forEach((n) => n.remove());
    const pm = curModel(); const g = ensureGuides(pm); if (!g) return;
    g.v.forEach((x, i) => el.stageInner.appendChild(makeGuideEl('v', x, i)));
    g.h.forEach((y, i) => el.stageInner.appendChild(makeGuideEl('h', y, i)));
  }
  function makeGuideEl(axis, pos, idx) {
    const node = document.createElement('div');
    node.className = 'pf-user-guide ' + axis;
    node.style[axis === 'v' ? 'left' : 'top'] = pos + 'px';
    node.title = 'Drag to move · double-click (or drag onto the ruler) to remove';
    node.addEventListener('pointerdown', (ev) => startGuideDrag(ev, axis, idx));
    node.addEventListener('dblclick', (ev) => { ev.stopPropagation(); const g = ensureGuides(curModel()); pushUndo(); (axis === 'v' ? g.v : g.h).splice(idx, 1); renderUserGuides(); });
    return node;
  }
  // Position of a client point in unscaled page px along one axis.
  const pageX = (clientX) => (clientX - el.stageInner.getBoundingClientRect().left) / zoom;
  const pageY = (clientY) => (clientY - el.stageInner.getBoundingClientRect().top) / zoom;

  // Press on a ruler and drag onto the page to drop a new guide.
  function startRulerCreate(ev, axis) {
    ev.preventDefault();
    const pm = curModel(); const g = ensureGuides(pm); if (!g) return;
    const preview = document.createElement('div');
    preview.className = 'pf-user-guide ' + axis + ' dragging';
    el.stageInner.appendChild(preview);
    let pos = null;
    const move = (e) => {
      const rect = el.stageInner.getBoundingClientRect();
      if (axis === 'h') { pos = Math.max(0, Math.min(dims.usableHeight, (e.clientY - rect.top) / zoom)); preview.style.top = pos + 'px'; }
      else { pos = Math.max(0, Math.min(dims.usableWidth, (e.clientX - rect.left) / zoom)); preview.style.left = pos + 'px'; }
    };
    const up = (e) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      preview.remove();
      const rect = el.stageInner.getBoundingClientRect();
      const onPage = axis === 'h' ? e.clientY >= rect.top : e.clientX >= rect.left; // dropped onto the page, not back on the ruler
      if (pos == null || !onPage) return;
      pushUndo();
      (axis === 'h' ? g.h : g.v).push(Math.round(pos));
      renderUserGuides();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    move(ev);
  }

  // Drag an existing guide; releasing back over the ruler removes it.
  function startGuideDrag(ev, axis, idx) {
    ev.preventDefault(); ev.stopPropagation();
    const g = ensureGuides(curModel()); const arr = axis === 'v' ? g.v : g.h; pushUndo();
    const move = (e) => {
      arr[idx] = axis === 'v'
        ? Math.round(Math.max(0, Math.min(dims.usableWidth, pageX(e.clientX))))
        : Math.round(Math.max(0, Math.min(dims.usableHeight, pageY(e.clientY))));
      renderUserGuides();
    };
    const up = (e) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const rect = el.stageInner.getBoundingClientRect();
      if ((axis === 'v' && e.clientX < rect.left) || (axis === 'h' && e.clientY < rect.top)) { arr.splice(idx, 1); renderUserGuides(); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

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
    // A cell (or text box) mid-edit: let the browser place the caret, don't drag.
    if (ev.target && ev.target.isContentEditable) return;
    // Picking a link target (Text Box → Linking → Create Link).
    if (linkPickMode) { ev.preventDefault(); ev.stopPropagation(); finishLink(ref); return; }
    // Picking a swap partner (Picture Format → Swap).
    if (swapPickMode) { ev.preventDefault(); ev.stopPropagation(); const src = swapPickMode; cancelSwap(); if (ref.kind === 'image') swapContents(src, ref); else setStatus('Swap needs another picture.', ''); return; }
    ev.preventDefault(); hideCtx();
    if (painter && ev.button !== 2 && applyPainter(ref)) { setSel([ref]); return; }
    if (ev.button === 2) { if (!isSel(ref)) setSel(expandGroups([ref])); return; }
    if (ref.locked) { setSel([ref]); return; }
    // Shift / Ctrl / Cmd extend the selection (Ctrl/Cmd is what most people
    // reach for). A modifier-click on an already-selected object toggles it out.
    const additive = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    if (additive) {
      if (isSel(ref)) {
        const gid = ref.gid;
        sels = sels.filter((r) => r !== ref && !(gid && r.gid === gid));
        syncSelUI(); drawSel(); return; // toggled out — nothing to drag
      }
      sels.push(ref);
    } else if (!isSel(ref)) sels = [ref];
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
      } else if (dir === 's' && ref.kind === 'text' && ref.chainId) {
        // Bottom handle on a linked box sets the flow region height; text reflows.
        ref.flowH = Math.max(24, Math.round((py - b0.y) / num(ref.scale, 1)));
        reflowChain(ref.chainId);
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
    const arr = curModel().elements; const zs = arr.map((e) => num(e.z, 100));
    // "Send to back" drops the object behind the puzzle layer; "Bring to front"
    // pulls it back above. Forward/backward step it within its current layer.
    if (kind === 'front') { o.behind = false; o.z = Math.max(...zs) + 10; }
    else if (kind === 'back') { o.behind = true; o.z = Math.min(...zs) - 10; }
    else if (kind === 'forward') o.z = num(o.z, 100) + 15;
    else if (kind === 'backward') o.z = num(o.z, 100) - 15;
    renderPage(); setTimeout(() => setSel([o]), 0);
  }
  // --- Break apart a puzzle: title / instructions / word-list pieces become
  // ordinary editable text objects, matching their on-screen typography. The
  // GRID stays a protected piece (integrity, reroll, and answer keys intact).
  const BREAKABLE = ['title', 'instructions', 'wordlist'];
  function canBreakApart() {
    const pm = pageModels[cur];
    return !!(pm && !isMatterPage(pm) && !masterMode && pm.comps.some((c) => !c.hidden && BREAKABLE.includes(c.kind)));
  }
  const rgbToHex = (rgb) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
    if (!m) return '#222222';
    const h = (n) => Number(n).toString(16).padStart(2, '0');
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  };
  const mapFontFamily = (ff) => {
    const s = (ff || '').toLowerCase();
    if (s.includes('courier') || s.includes('mono')) return 'mono';
    if (s.includes('comic') || s.includes('cursive')) return 'hand';
    if (s.includes('georgia') || s.includes('times') || (s.includes('serif') && !s.includes('sans'))) return 'serif';
    return 'sans';
  };
  // The word list is a multi-column <ul>; rebuild it as an editable TABLE that
  // preserves the columns (plain innerText would collapse it to one column).
  function wordlistToTable(c, pm) {
    const node = c._node; if (!node) return false;
    const ul = node.querySelector('ul');
    const lis = ul ? [...ul.querySelectorAll('li')] : [];
    const words = lis.map((li) => li.textContent.trim()).filter(Boolean);
    if (!ul || !words.length) return false;
    const ir = el.stageInner.getBoundingClientRect();
    const boxOf = (n) => { const r = n.getBoundingClientRect(); return { x: (r.left - ir.left) / zoom, y: (r.top - ir.top) / zoom, w: r.width / zoom, h: r.height / zoom }; };
    // Keep the "WORDS TO FIND" heading as its own text object above the table.
    const h2 = node.querySelector('h2');
    if (h2 && h2.textContent.trim()) {
      const hb = boxOf(h2); const hcs = getComputedStyle(h2);
      pm.elements.push({ group: 'el', id: uid++, kind: 'text', x: Math.round(hb.x), y: Math.round(hb.y), scale: 1, rot: 0, z: 80,
        w: Math.max(60, Math.round(hb.w)), text: h2.textContent.trim(),
        fontSize: Math.max(8, Math.round(parseFloat(hcs.fontSize))), bold: parseInt(hcs.fontWeight, 10) >= 600, italic: false,
        align: 'center', color: rgbToHex(hcs.color), lineHeight: 1.3, fontFamily: mapFontFamily(hcs.fontFamily) });
    }
    // Detect the column count from the rendered layout, then fill column-major
    // to match CSS balanced columns (down column 1, then column 2, …).
    const colXs = [];
    [...new Set(lis.map((li) => Math.round(boxOf(li).x)))].sort((a, z) => a - z).forEach((x) => { if (!colXs.length || x - colXs[colXs.length - 1] > 20) colXs.push(x); });
    const cols = Math.min(Math.max(1, colXs.length), 6, words.length);
    const rows = Math.ceil(words.length / cols);
    const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
    words.forEach((w, i) => { const col = Math.floor(i / rows), row = i % rows; if (row < rows && col < cols) cells[row][col] = w; });
    const ub = boxOf(ul); const lcs = getComputedStyle(lis[0] || ul);
    pm.elements.push({ group: 'el', id: uid++, kind: 'table', x: Math.round(ub.x), y: Math.round(ub.y), scale: 1, rot: 0, z: 80,
      rows, cols, cells, colW: Array(cols).fill(Math.max(50, Math.round(ub.w / cols))), header: false,
      borderColor: '#333333', borderW: 0, headerFill: '#eef1fe', cellPad: 4,
      fontSize: Math.max(8, Math.round(parseFloat(lcs.fontSize))), fontFamily: mapFontFamily(lcs.fontFamily),
      color: rgbToHex(lcs.color), align: 'center' });
    c.hidden = true;
    return true;
  }
  function breakApartPuzzle(silent) {
    const pm = pageModels[cur];
    if (!canBreakApart()) { if (!silent) setStatus('Open a puzzle page with a title or word list to break apart.', 'err'); return; }
    const targets = pm.comps.filter((c) => !c.hidden && BREAKABLE.includes(c.kind));
    pushUndo();
    // Pin every piece that will REMAIN visible (the grid) to where it sits now.
    // Once the title/instructions/word-list pieces are hidden they leave the
    // flow, so an un-pinned grid would slide up and overlap the new text
    // objects; the pin (applied on the next render) holds it in place.
    pm.comps.forEach((c) => {
      if (c.hidden || BREAKABLE.includes(c.kind)) return;
      const b = box(c); c._pin = true; c._pinX = b.x; c._pinY = b.y;
    });
    let made = 0;
    targets.forEach((c) => {
      // Word list → editable multi-column table; everything else → text.
      if (c.kind === 'wordlist' && wordlistToTable(c, pm)) { made += 1; return; }
      const styled = (c._node && c._node.firstElementChild) || c._node;
      const cs = styled ? getComputedStyle(styled) : null;
      const text = (c._node ? c._node.innerText : c.html.replace(/<[^>]+>/g, ' ')).replace(/\n{3,}/g, '\n\n').trim();
      if (!text) { c.hidden = true; return; }
      const b = box(c);
      pm.elements.push({
        group: 'el', id: uid++, kind: 'text',
        x: Math.round(b.x), y: Math.round(b.y), scale: 1, rot: 0, z: 80,
        w: Math.max(60, Math.round(b.w)), text,
        fontSize: cs ? Math.max(8, Math.round(parseFloat(cs.fontSize))) : (c.kind === 'title' ? 30 : 16),
        bold: cs ? parseInt(cs.fontWeight, 10) >= 600 : c.kind === 'title',
        italic: cs ? cs.fontStyle === 'italic' : false,
        align: cs && ['left', 'center', 'right'].includes(cs.textAlign) ? cs.textAlign : (c.kind === 'title' ? 'center' : 'left'),
        color: cs ? rgbToHex(cs.color) : '#222222',
        lineHeight: cs ? Math.min(3, Math.max(0.8, parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.3)) : 1.3,
        fontFamily: cs ? mapFontFamily(cs.fontFamily) : 'sans',
      });
      c.hidden = true;                       // hide the baked piece (undo restores it)
      made += 1;
    });
    renderPage();
    if (!silent) setStatus(`Broke apart ${made} label${made === 1 ? '' : 's'} into editable text — the puzzle grid stays protected. Undo to reverse.`, 'ok');
  }

  function flip(axis) { const o = sels.length === 1 && sels[0]; if (!o || (o.kind !== 'image' && o.kind !== 'shape')) return; pushUndo(); if (axis === 'h') o.flipH = !o.flipH; else o.flipV = !o.flipV; o._node.innerHTML = elHtml(o); }
  const norm360 = (d) => ((Math.round(d) % 360) + 360) % 360;
  function rotateBy(delta) { if (!sels.length) return; pushUndo(); sels.forEach((r) => setRot(r, norm360(num(r.rot, 0) + delta))); drawSel(); syncSelUI(); }
  function freeRotate() {
    const o = sels.length === 1 && sels[0]; if (!o) { setStatus('Select one object to rotate.', ''); return; }
    const v = window.prompt('Rotate to how many degrees?', String(norm360(num(o.rot, 0))));
    if (v == null) return; const n = Number(v); if (!Number.isFinite(n)) return;
    pushUndo(); setRot(o, norm360(n)); drawSel(); syncSelUI();
  }
  function toggleLock() { const o = sels.length === 1 && sels[0]; if (!o) return; pushUndo(); o.locked = !o.locked; syncSelUI(); }

  function addElement(e) { pushUndo(); curModel().elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); setSel([e]); return e; }
  function addText() { const pm = curModel(); addElement({ group: 'el', id: uid++, kind: 'text', x: Math.round(dims.usableWidth / 2 - 100), y: Math.round(dims.usableHeight / 2), scale: 1, rot: 0, z: 100, text: 'Your text', fontSize: 28, color: '#222222', align: 'left', w: 240, fontFamily: (pm && pm._font) || 'sans' }); }
  function addImageFile(file) { const r = new FileReader(); r.onload = () => { const o = addElement({ group: 'el', id: uid++, kind: 'image', x: Math.round(dims.usableWidth / 2 - 80), y: Math.round(dims.usableHeight / 2 - 80), scale: 1, rot: 0, z: 100, src: r.result, width: 160 }); captureNatSize(o); }; r.readAsDataURL(file); }
  // An empty picture frame — double-click it (or use Insert → Picture) to fill.
  function addPicturePlaceholder() {
    addElement({ group: 'el', id: uid++, kind: 'image', placeholder: true, x: Math.round(dims.usableWidth / 2 - 100), y: Math.round(dims.usableHeight / 2 - 70), scale: 1, rot: 0, z: 100, width: 200, h: 140 });
  }
  // Fill (or replace) an image element by picking a file from disk.
  function pickImageFor(e) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { pushUndo(); e.src = r.result; e.placeholder = false; delete e.crop; captureNatSize(e); e._node.innerHTML = elHtml(e); requestAnimationFrame(drawSel); };
      r.readAsDataURL(f);
    });
    inp.click();
  }

  // --- Picture Format tab (contextual: adjust / style / arrange a picture) ---
  const selImage = () => { const o = sels.length === 1 && sels[0]; return o && o.kind === 'image' ? o : null; };
  const picRerender = (o) => { o._node.innerHTML = elHtml(o); drawSel(); };
  const RECOLOR_FILTERS = { grayscale: 'grayscale(1)', sepia: 'sepia(0.75)', washout: 'grayscale(.4) brightness(1.45) contrast(.7)', blue: 'grayscale(1) sepia(1) hue-rotate(170deg) saturate(4)', gold: 'sepia(1) saturate(2.2) hue-rotate(-12deg)', green: 'grayscale(1) sepia(1) hue-rotate(75deg) saturate(2.5)' };
  const CORRECTIONS = [
    { label: 'Brighten', b: 1.3, c: 1 }, { label: 'Normal', b: 1, c: 1 }, { label: 'Darken', b: 0.72, c: 1 },
    { label: 'More Contrast', b: 1, c: 1.45 }, { label: 'Soften', b: 1.1, c: 0.78 }, { label: 'Sharpen', b: 1.05, c: 1.25 },
  ];
  const RECOLORS = [['', 'None'], ['grayscale', 'Grayscale'], ['sepia', 'Sepia'], ['washout', 'Washout'], ['blue', 'Blue'], ['gold', 'Gold'], ['green', 'Green']];
  function picPreviewBtn(filter, label) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pic-sw rdrop-item'; b.title = label;
    const sw = document.createElement('span'); sw.className = 'pic-sw-img'; sw.style.filter = filter || 'none';
    b.appendChild(sw); return b;
  }
  function buildPicMenus() {
    const corr = document.getElementById('picCorrMenu');
    if (corr) { corr.innerHTML = ''; const g = document.createElement('div'); g.className = 'pic-grid';
      CORRECTIONS.forEach((c) => { const b = picPreviewBtn(`brightness(${c.b}) contrast(${c.c})`, c.label); b.addEventListener('click', () => { const o = selImage(); if (o) { pushUndo(); o.brightness = c.b; o.contrast = c.c; picRerender(o); } }); g.appendChild(b); });
      corr.appendChild(g); }
    const rec = document.getElementById('picRecolorMenu');
    if (rec) { rec.innerHTML = ''; const g = document.createElement('div'); g.className = 'pic-grid';
      RECOLORS.forEach(([v, label]) => { const b = picPreviewBtn(v ? RECOLOR_FILTERS[v] : '', label); b.addEventListener('click', () => { const o = selImage(); if (o) { pushUndo(); if (v) o.recolor = v; else delete o.recolor; picRerender(o); } }); g.appendChild(b); });
      rec.appendChild(g); }
  }
  const PIC_STYLES = [{}, { picBorder: '#222222', picBorderW: 3 }, { picBorder: '#ffffff', picBorderW: 4, picShadow: '#00000045' }, { picRadius: 14 }, { picRadius: 14, picBorder: '#adb5bd', picBorderW: 2 }, { picShadow: '#00000055' }];
  function applyPicStyle(st) { const o = selImage(); if (!o) return; pushUndo(); delete o.picBorder; delete o.picBorderW; delete o.picRadius; delete o.picShadow; Object.assign(o, st); picRerender(o); }
  function buildPicStyleGallery() {
    const host = document.getElementById('picStyleGallery'); if (!host) return; host.innerHTML = '';
    PIC_STYLES.forEach((st) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pic-style-sw'; const im = document.createElement('span'); im.className = 'pic-style-img';
      if (st.picBorder) im.style.border = `${st.picBorderW || 2}px solid ${st.picBorder}`; if (st.picRadius) im.style.borderRadius = st.picRadius + 'px'; if (st.picShadow) im.style.boxShadow = `2px 2px 5px ${st.picShadow}`;
      b.appendChild(im); b.addEventListener('click', () => applyPicStyle(st)); host.appendChild(b); });
  }
  function buildPicBorderMenu() {
    buildColorMenu(document.getElementById('picBorderMenu'), {
      apply: (c) => { const o = selImage(); if (o) { pushUndo(); o.picBorder = c; if (!num(o.picBorderW, 0)) o.picBorderW = 2; picRerender(o); } },
      noneLabel: '✕ No Border', onNone: () => { const o = selImage(); if (o) { pushUndo(); delete o.picBorder; delete o.picBorderW; picRerender(o); } },
      weights: true, weight: (w) => { const o = selImage(); if (o) { pushUndo(); if (!o.picBorder) o.picBorder = '#333333'; o.picBorderW = w; picRerender(o); } }, sampleLabel: 'Sample border colour…',
    });
  }
  function picEffects(act) { const o = selImage(); if (!o) return; pushUndo(); if (act === 'shadow') { if (o.picShadow) delete o.picShadow; else o.picShadow = '#00000040'; } else if (act === 'round') { o.picRadius = num(o.picRadius, 0) ? 0 : 14; } else { delete o.picShadow; o.picRadius = 0; } picRerender(o); }
  function picCaption(act) { const o = selImage(); if (!o) return; pushUndo(); if (act === 'none') o.captionStyle = 'none'; else o.captionStyle = act; if (el.picCaptionText && !o.caption) o.caption = el.picCaptionText.value || 'Caption'; picRerender(o); }
  function picResetAdjust() { const o = selImage(); if (!o) return; pushUndo(); delete o.brightness; delete o.contrast; delete o.recolor; picRerender(o); setStatus('Picture adjustments cleared.', 'ok'); }
  // --- Compress Pictures ----------------------------------------------------
  // Downsample the stored image to a target print resolution. The page renders
  // at 96 CSS-ppi (so a picture shown at W css-px prints W/96 inches wide);
  // the kept region needs W·ppi/96 pixels for `ppi` at that print size. PNG /
  // GIF / WebP keep their format (alpha); anything else re-encodes to JPEG.
  const picByteLen = (s) => { s = String(s || ''); const i = s.indexOf(','); const b = i >= 0 ? s.slice(i + 1) : s; return Math.floor(b.length * 0.75); };
  const fmtBytes = (n) => { n = Math.max(0, Math.round(n)); return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; };
  function compressOne(o, ppi, bakeCrop) {
    return new Promise((resolve) => {
      if (!o || !o.src || o.placeholder) { resolve(0); return; }
      const before = picByteLen(o.src);
      const img = new Image();
      img.onload = () => {
        const nW = img.naturalWidth, nH = img.naturalHeight;
        const cr = o.crop || { l: 0, t: 0, r: 0, b: 0 };
        const hasCrop = !!(num(cr.l, 0) || num(cr.t, 0) || num(cr.r, 0) || num(cr.b, 0));
        const doBake = bakeCrop && hasCrop;
        let sx = 0, sy = 0, sw = nW, sh = nH;
        if (doBake) { sx = Math.round(cr.l * nW); sy = Math.round(cr.t * nH); sw = Math.max(1, Math.round(nW * (1 - cr.l - cr.r))); sh = Math.max(1, Math.round(nH * (1 - cr.t - cr.b))); }
        const fullDispW = num(o.width, 160);
        const keepDispW = doBake ? fullDispW * (1 - cr.l - cr.r) : fullDispW;
        const targetW = Math.max(1, Math.min(sw, Math.round(keepDispW * ppi / 96)));
        const targetH = Math.max(1, Math.round(sh * (targetW / sw)));
        const cv = document.createElement('canvas'); cv.width = targetW; cv.height = targetH;
        const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        const keepAlpha = /^data:image\/(png|gif|webp)/i.test(o.src);
        const out = keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85);
        if (picByteLen(out) < before) { o.src = out; o.natW = targetW; o.natH = targetH; if (doBake) { delete o.crop; o.width = Math.max(8, Math.round(keepDispW)); } }
        resolve(before - picByteLen(o.src));
      };
      img.onerror = () => resolve(0);
      img.src = o.src;
    });
  }
  function compressSel(ppi, bakeCrop) {
    const imgs = sels.filter((r) => r.kind === 'image' && r.src && !r.placeholder);
    if (!imgs.length) { setStatus('Select a picture to compress.', ''); return; }
    pushUndo();
    Promise.all(imgs.map((o) => compressOne(o, ppi, bakeCrop))).then((saved) => {
      imgs.forEach((o) => picRerender(o));
      const total = saved.reduce((a, b) => a + b, 0);
      setStatus(total > 0 ? `Compressed ${imgs.length} picture${imgs.length > 1 ? 's' : ''} — saved ${fmtBytes(total)}.` : 'Pictures already at or below that resolution.', total > 0 ? 'ok' : '');
      syncSelUI();
    });
  }
  // --- Swap Pictures --------------------------------------------------------
  // Exchange the contents (image + adjustments) of two pictures, each keeping
  // its own frame: position, size, border, caption. Two selected → swap; one
  // selected → pick the partner by clicking it.
  let swapPickMode = null;
  const SWAP_KEYS = ['src', 'natW', 'natH', 'crop', 'flipH', 'flipV', 'brightness', 'contrast', 'recolor', 'placeholder'];
  function swapContents(a, b) {
    if (!a || !b || a === b || a.kind !== 'image' || b.kind !== 'image') return;
    pushUndo();
    SWAP_KEYS.forEach((k) => { const t = a[k]; a[k] = b[k]; b[k] = t; });
    picRerender(a); picRerender(b); drawSel();
    setStatus('Picture contents swapped.', 'ok');
  }
  function cancelSwap() { swapPickMode = null; document.body.classList.remove('pf-linking'); }
  function swapPictures() {
    const imgs = sels.filter((r) => r.kind === 'image');
    if (imgs.length === 2) { swapContents(imgs[0], imgs[1]); return; }
    if (swapPickMode) { cancelSwap(); return; }
    const one = selImage(); if (!one) { setStatus('Select a picture (or two) to swap.', ''); return; }
    swapPickMode = one; document.body.classList.add('pf-linking');
    setStatus('Click another picture to swap contents with (Esc to cancel).', '');
  }
  function syncPictureUI() {
    const o = selImage();
    if (el.picNone) el.picNone.classList.toggle('hidden', !!o);
    if (el.picControls) el.picControls.classList.toggle('hidden', !o);
    if (!o) return;
    if (el.picW) el.picW.value = Math.round(num(o.width, 160));
    if (el.picCaptionText) el.picCaptionText.value = o.caption || '';
  }
  // Record the natural pixel size of a picture (needed to compute crop aspect).
  function captureNatSize(o) {
    if (!o || !o.src) return;
    const img = new Image();
    img.onload = () => { o.natW = img.naturalWidth; o.natH = img.naturalHeight; };
    img.src = o.src;
  }
  // --- Interactive crop -----------------------------------------------------
  const clampF = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round4 = (v) => Math.round(v * 1e4) / 1e4;
  function imgFilterCss(o) { const parts = []; if (num(o.brightness, 1) !== 1) parts.push(`brightness(${o.brightness})`); if (num(o.contrast, 1) !== 1) parts.push(`contrast(${o.contrast})`); if (RECOLOR_FILTERS[o.recolor]) parts.push(RECOLOR_FILTERS[o.recolor]); return parts.length ? `filter:${parts.join(' ')};` : ''; }
  let cropTarget = null, cropAnchor = null, cropLayer = null;
  function startCrop() {
    const o = selImage(); if (!o) { setStatus('Select a picture to crop.', ''); return; }
    if (cropTarget) { endCrop(true); return; }
    if (!num(o.natW, 0) || !num(o.natH, 0)) { captureNatSize(o); setStatus('Picture still loading — try Crop again in a moment.', ''); return; }
    const cr = o.crop || { l: 0, t: 0, r: 0, b: 0 };
    const fullW = num(o.width, 160), fullH = fullW * (o.natH / o.natW), sc = num(o.scale, 1);
    cropAnchor = { fx: o.x - num(cr.l, 0) * fullW * sc, fy: o.y - num(cr.t, 0) * fullH * sc, fullW, fullH, sc, crop: { l: num(cr.l, 0), t: num(cr.t, 0), r: num(cr.r, 0), b: num(cr.b, 0) } };
    cropTarget = o; document.body.classList.add('cropping');
    if (el.picCropBtn) el.picCropBtn.classList.add('on');
    renderCropOverlay();
    setStatus('Drag the handles to crop — click Crop again or press Enter to apply, Esc to cancel.', '');
  }
  function endCrop(apply) {
    if (!cropTarget) return; const o = cropTarget, a = cropAnchor;
    if (apply) {
      pushUndo();
      o.crop = { l: round4(a.crop.l), t: round4(a.crop.t), r: round4(a.crop.r), b: round4(a.crop.b) };
      o.x = Math.round(a.fx + o.crop.l * a.fullW * a.sc); o.y = Math.round(a.fy + o.crop.t * a.fullH * a.sc);
      picRerender(o);
    }
    cropTarget = null; cropAnchor = null;
    if (cropLayer) { cropLayer.remove(); cropLayer = null; }
    document.body.classList.remove('cropping');
    if (el.picCropBtn) el.picCropBtn.classList.remove('on');
    drawSel(); syncSelUI();
  }
  function renderCropOverlay() {
    if (!cropTarget) return; const a = cropAnchor, o = cropTarget;
    if (cropLayer) cropLayer.remove();
    cropLayer = document.createElement('div'); cropLayer.className = 'pf-crop-layer';
    cropLayer.style.cssText = `position:absolute;left:0;top:0;transform:translate(${a.fx}px,${a.fy}px) scale(${a.sc});transform-origin:top left;z-index:60;`;
    const box = document.createElement('div'); box.style.cssText = `position:absolute;left:0;top:0;width:${a.fullW}px;height:${a.fullH}px;overflow:hidden;`;
    const img = document.createElement('img'); img.src = o.src; img.style.cssText = `position:absolute;left:0;top:0;width:${a.fullW}px;height:${a.fullH}px;${imgFilterCss(o)}`;
    box.appendChild(img);
    const { l, t, r, b } = a.crop; const vw = a.fullW * (1 - l - r), vh = a.fullH * (1 - t - b);
    const rect = document.createElement('div'); rect.className = 'pf-crop-rect';
    rect.style.cssText = `position:absolute;left:${l * a.fullW}px;top:${t * a.fullH}px;width:${vw}px;height:${vh}px;`;
    [['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5], ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5]].forEach(([d, hx, hy]) => {
      const h = document.createElement('div'); h.className = 'pf-crop-h'; h.style.left = `calc(${hx * 100}% - 7px)`; h.style.top = `calc(${hy * 100}% - 7px)`;
      h.addEventListener('pointerdown', (ev) => startCropDrag(ev, d)); rect.appendChild(h);
    });
    box.appendChild(rect); cropLayer.appendChild(box); el.stageInner.appendChild(cropLayer);
  }
  function startCropDrag(ev, dir) {
    ev.stopPropagation(); ev.preventDefault(); const a = cropAnchor; if (!a) return;
    const sx = ev.clientX, sy = ev.clientY, c0 = { ...a.crop };
    const move = (e) => {
      const dxl = (e.clientX - sx) / zoom / a.sc / a.fullW, dyl = (e.clientY - sy) / zoom / a.sc / a.fullH;
      let { l, t, r, b } = c0;
      if (dir.includes('w')) l = clampF(c0.l + dxl, 0, 1 - c0.r - 0.05);
      if (dir.includes('e')) r = clampF(c0.r - dxl, 0, 1 - c0.l - 0.05);
      if (dir.includes('n')) t = clampF(c0.t + dyl, 0, 1 - c0.b - 0.05);
      if (dir.includes('s')) b = clampF(c0.b - dyl, 0, 1 - c0.t - 0.05);
      a.crop = { l, t, r, b }; renderCropOverlay();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function resetCrop() { const o = selImage(); if (!o) return; if (cropTarget === o) endCrop(false); pushUndo(); delete o.crop; picRerender(o); syncSelUI(); }
  function cropToSquare() {
    const o = selImage(); if (!o) return; if (!num(o.natW, 0) || !num(o.natH, 0)) { captureNatSize(o); return; }
    const aspect = o.natH / o.natW; pushUndo();
    // trim the longer axis to a centered square
    if (aspect > 1) { const cut = (1 - 1 / aspect) / 2; o.crop = { l: 0, r: 0, t: cut, b: cut }; }
    else { const cut = (1 - aspect) / 2; o.crop = { l: cut, r: cut, t: 0, b: 0 }; }
    picRerender(o); syncSelUI();
  }
  function addShape(shape) {
    const line = shape === 'line';
    const bubble = shape === 'speech' || shape === 'thought';
    addElement({
      group: 'el', id: uid++, kind: 'shape', shape,
      x: Math.round(dims.usableWidth / 2 - 90), y: Math.round(dims.usableHeight / 2 - 65),
      scale: 1, rot: 0, z: 100,
      w: line ? 220 : bubble ? 200 : 160, h: line ? 12 : bubble ? 130 : 120,
      fill: line ? 'none' : schemeFill(), stroke: schemeStroke(), strokeW: line ? 3 : 2,
    });
  }

  // Decorative accent bar spanning most of the content width (Publisher-style).
  function addAccentBar(style) {
    const w = Math.round(dims.usableWidth * 0.9);
    const x = Math.round((dims.usableWidth - w) / 2);
    const y = Math.round(dims.usableHeight / 2);
    if (style === 'line' || style === 'double') {
      addElement({ group: 'el', id: uid++, kind: 'shape', shape: 'line', x, y, scale: 1, rot: 0, z: 100,
        w, h: 12, fill: 'none', stroke: schemeStroke(), strokeW: style === 'double' ? 5 : 2 });
    } else {
      addElement({ group: 'el', id: uid++, kind: 'shape', shape: 'rect', x, y, scale: 1, rot: 0, z: 100,
        w, h: style === 'thick' ? 22 : 10, fill: schemeFill(), stroke: 'none', strokeW: 0 });
    }
  }

  // Insert a month calendar as a title text + a 7-column table, grouped.
  function addCalendar() {
    const now = new Date();
    const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const spec = window.prompt('Calendar month (YYYY-MM):', def);
    if (spec == null) return;
    const m = /^(\d{4})-(\d{1,2})$/.exec(String(spec).trim());
    const year = m ? Number(m[1]) : now.getFullYear();
    const month = (m ? Math.max(1, Math.min(12, Number(m[2]))) : now.getMonth() + 1) - 1;
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeks = Math.ceil((startDay + daysInMonth) / 7);
    const rows = weeks + 1; // header row + weeks
    const cols = 7;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(''));
    names.forEach((d, i) => { cells[0][i] = d; });
    let day = 1;
    for (let r = 1; r < rows && day <= daysInMonth; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r - 1) * 7 + c >= startDay && day <= daysInMonth) cells[r][c] = String(day++);
      }
    }
    const colW = Math.max(48, Math.round((dims.usableWidth * 0.86) / cols));
    const tblW = colW * cols;
    const x = Math.round((dims.usableWidth - tblW) / 2), y = Math.round(dims.usableHeight * 0.2);
    const title = first.toLocaleString('en-US', { month: 'long' }) + ' ' + year;
    pushUndo();
    const gid = 'g' + uid++;
    const els = [
      { group: 'el', id: uid++, gid, kind: 'text', text: title, x, y, w: tblW, scale: 1, rot: 0, z: 100,
        fontSize: 22, bold: true, align: 'center', color: '#222222', fontFamily: 'sans' },
      { group: 'el', id: uid++, gid, kind: 'table', x, y: y + 40, scale: 1, rot: 0, z: 100,
        rows, cols, cells, colW: Array(cols).fill(colW), header: true, borderColor: schemeStroke(), borderW: 1,
        headerFill: '#eef1fe', cellPad: 6, fontSize: 13, fontFamily: 'sans', color: '#222222', align: 'center' },
    ];
    const pm = curModel();
    els.forEach((e) => { pm.elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); });
    setSel(els);
    setStatus(`Inserted a ${title} calendar.`, 'ok');
  }
  // Make the selected object a clickable link (renders as an <a> in the PDF).
  function linkSel() {
    const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'el') { setStatus('Select an object first, then add a link.', ''); return; }
    const url = window.prompt('Link to (URL) — leave blank to remove:', o.link || 'https://');
    if (url == null) return;
    pushUndo(); o.link = url.trim() || undefined; o._node.innerHTML = elHtml(o); requestAnimationFrame(drawSel);
    setStatus(o.link ? 'Link added — the object is clickable in a digital PDF.' : 'Link removed.', 'ok');
  }
  // Tag the selected object with a bookmark name (a jump target in a digital PDF).
  function bookmarkSel() {
    const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'el') { setStatus('Select an object first, then add a bookmark.', ''); return; }
    const name = window.prompt('Bookmark name — leave blank to remove:', o.bookmark || '');
    if (name == null) return;
    pushUndo(); o.bookmark = name.trim() || undefined; o._node.innerHTML = elHtml(o); requestAnimationFrame(drawSel);
    setStatus(o.bookmark ? `Bookmark “${o.bookmark}” added.` : 'Bookmark removed.', 'ok');
  }

  // --- Tables ---
  function emptyCells(rows, cols) { return Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')); }
  function addTable(rows, cols) {
    rows = Math.max(1, Math.min(60, rows || 3));
    cols = Math.max(1, Math.min(20, cols || 3));
    addElement({
      group: 'el', id: uid++, kind: 'table',
      x: Math.round(dims.usableWidth / 2 - 135), y: Math.round(dims.usableHeight / 2 - 60),
      scale: 1, rot: 0, z: 100,
      rows, cols, cells: emptyCells(rows, cols), colW: Array(cols).fill(90),
      header: true, borderColor: schemeStroke(), borderW: 1, headerFill: '#eef1fe', cellPad: 6,
      fontSize: 15, fontFamily: 'sans', color: '#222222', align: 'left',
    });
  }
  // Build the Home → Objects dropdowns: a hover grid-picker for tables and a
  // categorised shape gallery (Publisher-style). Both live in .rdrop menus, so
  // initDropdowns() already handles open/close/placement.
  const SHAPE_GALLERY = [
    { name: 'Lines', shapes: [['line', 'Line'], ['arrow-right', 'Arrow']] },
    { name: 'Basic Shapes', shapes: [
      ['rect', 'Rectangle'], ['roundrect', 'Rounded rectangle'], ['ellipse', 'Ellipse'],
      ['triangle', 'Triangle'], ['righttriangle', 'Right triangle'], ['diamond', 'Diamond'],
      ['pentagon', 'Pentagon'], ['hexagon', 'Hexagon'], ['octagon', 'Octagon'],
      ['trapezoid', 'Trapezoid'], ['parallelogram', 'Parallelogram'], ['cross', 'Cross'], ['heart', 'Heart'],
    ] },
    { name: 'Block Arrows', shapes: [
      ['arrow-right', 'Right arrow'], ['arrow-left', 'Left arrow'], ['arrow-up', 'Up arrow'], ['arrow-down', 'Down arrow'],
    ] },
    { name: 'Stars & Banners', shapes: [['star4', '4-point star'], ['star', '5-point star'], ['star6', '6-point star']] },
    { name: 'Callouts', shapes: [['speech', 'Speech bubble'], ['thought', 'Thought bubble']] },
  ];
  function shapeIcon(shape) {
    // A tiny preview drawn by the shared renderer, so gallery icons match output.
    const line = shape === 'line';
    return elHtml({ kind: 'shape', shape, w: 26, h: line ? 16 : 22, fill: line ? 'none' : '#dbe4ff', stroke: '#3b4a66', strokeW: line ? 2 : 1.5 });
  }
  function buildShapeGallery(hostId) {
    const host = document.getElementById(hostId || 'shapeGallery'); if (!host) return;
    host.innerHTML = '';
    SHAPE_GALLERY.forEach((cat) => {
      const h = document.createElement('div'); h.className = 'shapegal-cat'; h.textContent = cat.name; host.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'shapegal-grid';
      cat.shapes.forEach(([shape, label]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'iconbtn shape-btn'; b.dataset.shape = shape; b.title = label;
        b.innerHTML = shapeIcon(shape);
        grid.appendChild(b);
      });
      host.appendChild(grid);
    });
  }
  function buildTablePicker(gridId, labelId, moreId) {
    const grid = document.getElementById(gridId || 'tablepickGrid');
    const label = document.getElementById(labelId || 'tablepickLabel');
    const more = document.getElementById(moreId || 'tablepickMore');
    if (!grid) return;
    const MAXR = 8, MAXC = 10;
    grid.style.gridTemplateColumns = `repeat(${MAXC}, 16px)`;
    grid.innerHTML = '';
    const cells = [];
    const paint = (rr, cc) => {
      cells.forEach((cell) => cell.classList.toggle('on', cell._r <= rr && cell._c <= cc));
      label.textContent = rr && cc ? `${rr} × ${cc} Table` : 'Insert Table';
    };
    for (let r = 1; r <= MAXR; r++) {
      for (let c = 1; c <= MAXC; c++) {
        const cell = document.createElement('span'); cell.className = 'tablepick-cell'; cell._r = r; cell._c = c;
        cell.addEventListener('mouseenter', () => paint(r, c));
        cell.addEventListener('click', () => { closeObjMenus(); addTable(r, c); });
        cells.push(cell); grid.appendChild(cell);
      }
    }
    grid.addEventListener('mouseleave', () => paint(0, 0));
    if (more) more.addEventListener('click', () => {
      closeObjMenus();
      const spec = window.prompt('Table size — rows × columns:', '3 x 3');
      if (spec == null) return;
      const m = String(spec).match(/(\d+)\s*[x×,]\s*(\d+)/i);
      if (m) addTable(Number(m[1]), Number(m[2]));
    });
  }
  function closeObjMenus() {
    document.querySelectorAll('.rdrop-menu').forEach((m) => {
      m.hidden = true; const b = m.parentElement.querySelector('.rdrop-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function buildObjectMenus() {
    buildShapeGallery('shapeGallery');
    buildShapeGallery('insShapeGallery');
    buildTablePicker('tablepickGrid', 'tablepickLabel', 'tablepickMore');
    buildTablePicker('insTablepickGrid', 'insTablepickLabel', 'insTablepickMore');
    buildPagePartsMenu();
  }

  // --- QR codes ---
  // Encode a URL into a module matrix using the shared qrcode-generator lib
  // (window.qrcode), the same encoder the engine uses — so the editor QR is
  // byte-identical to a server-generated one.
  function qrModules(text, ecl) {
    try {
      const qr = window.qrcode(0, ['L', 'M', 'Q', 'H'].includes(ecl) ? ecl : 'M');
      qr.addData(String(text == null ? '' : text));
      qr.make();
      const n = qr.getModuleCount(); const mods = [];
      for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(qr.isDark(r, c) ? 1 : 0); mods.push(row); }
      return mods;
    } catch (_) { return []; }
  }
  function addQr() {
    const url = window.prompt('QR code links to (URL or text):', 'https://');
    if (url == null) return;
    const ecl = 'M';
    addElement({
      group: 'el', id: uid++, kind: 'qr',
      x: Math.round(dims.usableWidth / 2 - 70), y: Math.round(dims.usableHeight / 2 - 70),
      scale: 1, rot: 0, z: 100, w: 140, url: url.trim(), ecl, fg: '#000000', bg: '#ffffff',
      modules: qrModules(url.trim(), ecl),
    });
  }
  const selQr = () => { const o = sels.length === 1 && sels[0]; return o && o.kind === 'qr' ? o : null; };
  function reencodeQr(q) { q.modules = qrModules(q.url, q.ecl); q._node.innerHTML = elHtml(q); requestAnimationFrame(drawSel); }
  // Re-render a QR node in place (colour/size change — no re-encode needed).
  function qrRender(q) { q._node.innerHTML = elHtml(q); requestAnimationFrame(drawSel); }
  const QR_ECL_LABEL = { L: 'L — Low', M: 'M — Medium', Q: 'Q — Quartile', H: 'H — High' };
  function setQrEcl(v) { const q = selQr(); if (!q || !QR_ECL_LABEL[v]) return; pushUndo(); q.ecl = v; reencodeQr(q); syncQrUI(q); }
  // Colour presets shown in the Styles gallery (same swatch pattern as Picture/WordArt).
  const QR_STYLES = [
    { fg: '#000000', bg: '#ffffff' }, { fg: '#1f2937', bg: '#f8fafc' },
    { fg: '#1d4ed8', bg: '#ffffff' }, { fg: '#047857', bg: '#ffffff' },
    { fg: '#7c3aed', bg: '#ffffff' }, { fg: '#ffffff', bg: '#111827' },
  ];
  function applyQrStyle(st) { const q = selQr(); if (!q) return; pushUndo(); q.fg = st.fg; q.bg = st.bg; qrRender(q); syncQrUI(q); }
  function buildQrStyleGallery() {
    const host = document.getElementById('qrStyleGallery'); if (!host) return; host.innerHTML = '';
    QR_STYLES.forEach((st) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pic-style-sw'; b.title = 'Apply QR colours';
      const im = document.createElement('span'); im.className = 'pic-style-img qr-style-img';
      im.style.background = st.bg; im.style.color = st.fg;
      b.appendChild(im); b.addEventListener('click', () => applyQrStyle(st)); host.appendChild(b);
    });
  }
  function syncQrUI(one) {
    if (!el.qrControls) return;
    const q = one && one.kind === 'qr' ? one : null;
    el.qrControls.classList.toggle('hidden', !q); if (el.qrNone) el.qrNone.classList.toggle('hidden', !!q);
    if (!q) return;
    if (el.qrUrl) el.qrUrl.value = q.url || '';
    const ecl = QR_ECL_LABEL[q.ecl] ? q.ecl : 'M';
    if (el.qrEclDropBtn) { const lab = el.qrEclDropBtn.childNodes[el.qrEclDropBtn.childNodes.length - 2]; if (lab) lab.textContent = 'Correction (' + ecl + ') '; }
    const transparent = q.bg === 'none';
    if (el.qrFg) el.qrFg.value = /^#/.test(q.fg || '') ? q.fg : '#000000';
    if (el.qrBg) { el.qrBg.value = /^#/.test(q.bg || '') ? q.bg : '#ffffff'; el.qrBg.disabled = transparent; }
    if (el.qrTransparent) el.qrTransparent.checked = transparent;
    if (el.qrW) el.qrW.value = Math.round(num(q.w, 140));
  }
  const selTable = () => { const o = sels.length === 1 && sels[0]; return o && o.kind === 'table' ? o : null; };
  function ensureCells(t) {
    if (!Array.isArray(t.cells)) t.cells = [];
    for (let r = 0; r < t.rows; r++) { if (!Array.isArray(t.cells[r])) t.cells[r] = []; for (let c = 0; c < t.cols; c++) if (t.cells[r][c] == null) t.cells[r][c] = ''; }
  }
  function redrawTable(t) { t._node.innerHTML = elHtml(t); highlightCells(t); requestAnimationFrame(drawSel); }
  // Cell-range selection inside a selected table (click a cell, Shift-click to
  // extend), used by Merge / Split / Diagonals on the Table Layout tab.
  function onTableCellDown(t, ev) {
    if (ev.button !== 0) return;
    if (!(sels.length === 1 && sels[0] === t)) return; // not in cell mode → let the element drag
    const td = ev.target.closest && ev.target.closest('td'); if (!td) return;
    ev.stopImmediatePropagation();
    const r = Number(td.dataset.r), c = Number(td.dataset.c);
    if (ev.shiftKey && t._sel) { t._sel.r1 = r; t._sel.c1 = c; } else t._sel = { r0: r, c0: c, r1: r, c1: c };
    highlightCells(t);
  }
  function highlightCells(t) {
    if (!t || !t._node) return; const sel = t._sel;
    t._node.querySelectorAll('td.cell-sel').forEach((td) => td.classList.remove('cell-sel'));
    if (!sel) return;
    const minR = Math.min(sel.r0, sel.r1), maxR = Math.max(sel.r0, sel.r1), minC = Math.min(sel.c0, sel.c1), maxC = Math.max(sel.c0, sel.c1);
    t._node.querySelectorAll('td[data-r]').forEach((td) => { const r = +td.dataset.r, c = +td.dataset.c; if (r >= minR && r <= maxR && c >= minC && c <= maxC) td.classList.add('cell-sel'); });
  }
  function mergeTableCells() {
    const t = selTable(); if (!t || !t._sel) { setStatus('Click a cell, then Shift-click another, to pick a range to merge.', ''); return; }
    const s = t._sel; const minR = Math.min(s.r0, s.r1), maxR = Math.max(s.r0, s.r1), minC = Math.min(s.c0, s.c1), maxC = Math.max(s.c0, s.c1);
    if (minR === maxR && minC === maxC) { setStatus('Select two or more cells to merge (Shift-click a second cell).', ''); return; }
    pushUndo(); ensureCells(t);
    t.spans = (t.spans || []).filter((sp) => { const er = sp[0] + sp[2] - 1, ec = sp[1] + sp[3] - 1; return (er < minR || sp[0] > maxR || ec < minC || sp[1] > maxC); });
    const parts = [];
    for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) { const v = (t.cells[r] && t.cells[r][c]) || ''; if (v) parts.push(v); if (!(r === minR && c === minC)) t.cells[r][c] = ''; }
    t.cells[minR][minC] = parts.join(' ');
    t.spans.push([minR, minC, maxR - minR + 1, maxC - minC + 1]);
    t._sel = { r0: minR, c0: minC, r1: minR, c1: minC };
    redrawTable(t); setStatus('Cells merged.', 'ok');
  }
  function splitTableCells() {
    const t = selTable(); if (!t || !t._sel) { setStatus('Click the merged cell to split first.', ''); return; }
    const r = Math.min(t._sel.r0, t._sel.r1), c = Math.min(t._sel.c0, t._sel.c1);
    pushUndo();
    t.spans = (t.spans || []).filter((sp) => !(sp[0] <= r && r < sp[0] + sp[2] && sp[1] <= c && c < sp[1] + sp[3]));
    redrawTable(t); setStatus('Cell split.', 'ok');
  }
  function toggleTableDiagonal() {
    const t = selTable(); if (!t || !t._sel) { setStatus('Click a cell first, then add a diagonal.', ''); return; }
    const r = Math.min(t._sel.r0, t._sel.r1), c = Math.min(t._sel.c0, t._sel.c1);
    pushUndo(); t.diags = t.diags || [];
    const i = t.diags.findIndex((d) => d[0] === r && d[1] === c);
    if (i >= 0) t.diags.splice(i, 1); else t.diags.push([r, c]);
    redrawTable(t);
  }
  function tableOp(fn) { const t = selTable(); if (!t) return; pushUndo(); ensureCells(t); fn(t); ensureCells(t); redrawTable(t); syncSelUI(); }
  function editTableCell(t, ev) {
    const td = ev.target.closest('td'); if (!td) return;
    const r = Number(td.dataset.r), c = Number(td.dataset.c);
    ensureCells(t);
    td.setAttribute('contenteditable', 'true'); td.focus();
    // Put the caret at the end of the cell.
    const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(td); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
    let committed = false;
    const done = () => {
      if (committed) return; committed = true;
      td.removeAttribute('contenteditable');
      pushUndo(); t.cells[r][c] = td.innerText.replace(/\n+$/, '');
      td.removeEventListener('blur', done); td.removeEventListener('keydown', onk);
      redrawTable(t);
    };
    const onk = (e) => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); td.blur(); } };
    td.addEventListener('blur', done); td.addEventListener('keydown', onk);
  }

  // --- Table Design / Table Layout (two contextual tabs, Publisher-style) ---
  function tblSet(prop, val) { const t = selTable(); if (!t) return; pushUndo(); t[prop] = val; redrawTable(t); syncSelUI(); }
  const TABLE_FORMATS = [
    { name: 'Plain', borderColor: '#333333', borderW: 1, header: false, headerFill: '#f0f0f0', cellFill: 'none' },
    { name: 'Grid', borderColor: '#495057', borderW: 1, header: true, headerFill: '#e9ecef', cellFill: 'none' },
    { name: 'Blue', borderColor: '#1c7ed6', borderW: 1, header: true, headerFill: '#d0ebff', cellFill: 'none' },
    { name: 'Warm', borderColor: '#e8590c', borderW: 1, header: true, headerFill: '#ffe8cc', cellFill: '#fff9f0' },
    { name: 'Green', borderColor: '#2b8a3e', borderW: 1, header: true, headerFill: '#d3f9d8', cellFill: 'none' },
    { name: 'Minimal', borderColor: '#adb5bd', borderW: 0.5, header: true, headerFill: '#f8f9fa', cellFill: 'none' },
  ];
  function applyTableFormat(fmt) { const t = selTable(); if (!t) return; pushUndo(); Object.assign(t, { borderColor: fmt.borderColor, borderW: fmt.borderW, header: fmt.header, headerFill: fmt.headerFill, cellFill: fmt.cellFill }); redrawTable(t); syncSelUI(); }
  function buildTableFormatGallery() {
    const host = document.getElementById('tdFormatGallery'); if (!host) return; host.innerHTML = '';
    TABLE_FORMATS.forEach((fmt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'td-fmt-sw'; b.title = fmt.name;
      b.innerHTML = `<span class="td-fmt-h" style="background:${fmt.header ? fmt.headerFill : '#fff'};border-color:${fmt.borderColor}"></span><span class="td-fmt-b" style="background:${fmt.cellFill === 'none' ? '#fff' : fmt.cellFill};border-color:${fmt.borderColor}"></span>`;
      b.addEventListener('click', () => applyTableFormat(fmt)); host.appendChild(b); });
  }
  function buildTableMenus() {
    buildColorMenu(document.getElementById('tdFillMenu'), { apply: (c) => tblSet('cellFill', c), noneLabel: '✕ No Fill', onNone: () => tblSet('cellFill', 'none') });
    buildColorMenu(document.getElementById('tdHeaderFillMenu'), { apply: (c) => tblSet('headerFill', c), noneLabel: '✕ No Fill', onNone: () => tblSet('headerFill', 'none') });
    buildColorMenu(document.getElementById('tdLineColorMenu'), { apply: (c) => tblSet('borderColor', c), noneLabel: 'Automatic (dark)', onNone: () => tblSet('borderColor', '#333333') });
  }
  // Structural edits clear merges/diagonals (their row/col indices would shift).
  const tblClearSpans = (t) => { t.spans = []; t.diags = []; t._sel = null; };
  function tblInsRow(where) { tableOp((t) => { ensureCells(t); const row = Array(t.cols).fill(''); if (where === 'above') t.cells.unshift(row); else t.cells.push(row); t.rows++; tblClearSpans(t); }); }
  function tblInsCol(where) { tableOp((t) => { ensureCells(t); t.cells.forEach((r) => { if (where === 'left') r.unshift(''); else r.push(''); }); if (where === 'left') t.colW.unshift(90); else t.colW.push(90); t.cols++; tblClearSpans(t); }); }
  function tblDelRow() { tableOp((t) => { if (t.rows > 1) { t.rows--; t.cells.pop(); tblClearSpans(t); } }); }
  function tblDelCol() { tableOp((t) => { if (t.cols > 1) { t.cols--; t.colW.pop(); t.cells.forEach((r) => r.pop()); tblClearSpans(t); } }); }
  function syncTableTabsUI() {
    const t = selTable();
    if (el.tdNone) el.tdNone.classList.toggle('hidden', !!t);
    if (el.tdControls) el.tdControls.classList.toggle('hidden', !t);
    if (el.tlNone) el.tlNone.classList.toggle('hidden', !!t);
    if (el.tlControls) el.tlControls.classList.toggle('hidden', !t);
    if (!t) return;
    if (el.tdBorderW) el.tdBorderW.value = num(t.borderW, 1);
    if (el.tdHeader) el.tdHeader.checked = !!t.header;
    document.querySelectorAll('.tbl-align').forEach((b) => b.classList.toggle('on', (t.align || 'left') === b.dataset.talign));
  }

  // --- Master pages ---
  function masterPageNo(i) { const skip = Math.max(0, num(master.skipFirst, 0)); if (i < skip) return null; return i - skip + num(master.startAt, 1); }
  function masterAppliesTo(i) { const n = masterPageNo(i); if (n == null) return false; if (master.applyTo === 'odd') return n % 2 === 1; if (master.applyTo === 'even') return n % 2 === 0; return true; }
  function renderMasterOverlay() {
    if (!master.enabled || !master.elements.length || !masterAppliesTo(cur)) return;
    const no = masterPageNo(cur);
    master.elements.slice().sort((a, b) => num(a.z, 0) - num(b.z, 0)).forEach((e) => {
      const shown = e.field === 'pageNumber' ? { ...e, text: String(no) } : e;
      const node = document.createElement('div'); node.className = 'pf-node pf-master-ov';
      node.style.transform = `translate(${num(e.x, 0)}px,${num(e.y, 0)}px) rotate(${num(e.rot, 0)}deg) scale(${num(e.scale, 1)})`;
      node.innerHTML = elHtml(shown);
      el.stageInner.insertBefore(node, vGuide);
    });
  }
  function updateMasterUI() {
    if (el.masterBanner) el.masterBanner.hidden = !masterMode;
    if (el.editMasterBtn) { el.editMasterBtn.classList.toggle('on', masterMode); el.editMasterBtn.textContent = masterMode ? '✓ Editing Master' : '✎ Edit Master Page'; }
    document.body.classList.toggle('master-editing', masterMode);
    updateViewButtons();
  }
  function enterMaster() {
    if (masterMode) return;
    masterModel.elements = master.elements;   // edit the live overlay array
    masterMode = true; sels = []; updateMasterUI(); renderPage();
    setStatus('Editing the Master Page — add page numbers, headers, or a frame that repeat on every page in scope.', 'ok');
  }
  function exitMaster() {
    if (!masterMode) return;
    master.elements = masterModel.elements;   // keep the source array in sync
    masterMode = false; sels = []; updateMasterUI(); renderPage();
    setStatus('Back to the book. The master overlay shows on every page in scope.', 'ok');
  }
  const toggleMaster = () => (masterMode ? exitMaster() : enterMaster());
  // Position within the page margins for a header/footer/page-number field.
  // `pos` is a two-letter code: [t|b][l|c|r] (top/bottom × left/center/right).
  function marginPos(pos) {
    const code = typeof pos === 'string' ? pos : 'bc';
    const top = code[0] === 't';
    const col = code[1];
    const w = 140;
    const y = top ? 22 : Math.round(dims.usableHeight - 34);
    let x, align;
    if (col === 'l') { x = 0; align = 'left'; }
    else if (col === 'r') { x = Math.round(dims.usableWidth - w); align = 'right'; }
    else { x = Math.round(dims.usableWidth / 2 - w / 2); align = 'center'; }
    return { x, y, w, align };
  }
  function insertPageNumber(pos) {
    if (!masterMode) enterMaster();
    const p = marginPos(pos || 'bc');
    addElement({ group: 'el', id: uid++, kind: 'text', field: 'pageNumber', text: '#',
      x: p.x, y: p.y, scale: 1, rot: 0, z: 200, fontSize: 13, color: '#333333', align: p.align, w: p.w, fontFamily: 'sans' });
    setStatus('Page-number field added to the master — it prints each page’s number. Move it where you want.', 'ok');
  }
  // A repeating header/footer lives on the master page (edits enter master mode).
  function addMasterText(which) {
    if (!masterMode) enterMaster();
    const footer = which === 'footer';
    const p = marginPos(footer ? 'bc' : 'tc');
    addElement({ group: 'el', id: uid++, kind: 'text', text: footer ? 'Footer' : 'Header',
      x: 0, y: p.y, scale: 1, rot: 0, z: 190, fontSize: 13, color: '#555555', align: 'center', w: dims.usableWidth, fontFamily: 'sans' });
    setStatus(`${footer ? 'Footer' : 'Header'} added to the master — it repeats on every page. Double-click to edit the text.`, 'ok');
  }
  function syncMasterScopeUI() {
    if (el.masterApplyTo) el.masterApplyTo.value = master.applyTo || 'all';
    if (el.masterSkip) el.masterSkip.value = num(master.skipFirst, 1);
    if (el.masterStart) el.masterStart.value = num(master.startAt, 1);
    if (el.masterEnabled) el.masterEnabled.checked = master.enabled !== false;
  }
  // Sent to the server so the overlay applies on export/preview/package. Strips
  // the live DOM node (`_node`) so the payload is JSON-serializable.
  function masterForSend() {
    if (!master.enabled || !master.elements.length) return null;
    return { enabled: true, applyTo: master.applyTo || 'all', skipFirst: num(master.skipFirst, 0), startAt: num(master.startAt, 1),
      elements: master.elements.map(({ _node, ...e }) => e) };
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
  // Apply a WordArt preset's style to the SELECTED text box (the Insert-tab
  // WordArt inserts a new box; this restyles the current one, like Publisher).
  function applyWordArt(preset) {
    const o = selText(); if (!o || !preset) return; pushUndo();
    Object.assign(o, preset.style);
    o._node.innerHTML = elHtml(o); drawSel(); syncFontUI(o);
  }
  function setTextOutline(color) {
    const o = selText(); if (!o) return; pushUndo();
    o.textStroke = color; if (!num(o.textStrokeW, 0)) o.textStrokeW = 1.5;
    o._node.innerHTML = elHtml(o); drawSel();
  }
  function buildWordArtGallery() {
    const host = document.getElementById('wordartGallery'); if (!host) return;
    host.innerHTML = '';
    WORDART.forEach((w) => {
      const s = w.style;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wordart-swatch'; b.title = w.name; b.textContent = 'A';
      b.style.color = s.color || '#222'; b.style.fontFamily = fontStackFor(s.fontFamily || 'sans'); b.style.fontWeight = s.bold ? '700' : '400';
      if (s.textStroke) b.style.webkitTextStroke = `1px ${s.textStroke}`;
      b.addEventListener('click', () => applyWordArt(w));
      host.appendChild(b);
    });
  }
  // --- Text Box tab: colour palettes (Text Fill / Text Outline), Fit, Margins ---
  const STD_COLORS = ['#000000', '#444444', '#666666', '#888888', '#bbbbbb', '#ffffff', '#c0392b', '#e74c3c', '#e67e22', '#f1c40f', '#f9e79f', '#2ecc71', '#27ae60', '#16a085', '#3498db', '#2980b9', '#6741d9', '#9c36b5', '#d6336c', '#f783ac'];
  const schemePalette = () => { const s = activeScheme ? activeScheme.colors.slice() : ['#3b5bdb', '#e64980', '#f59f00', '#2b8a3e']; return ['#000000', '#ffffff', ...s, '#495057', '#adb5bd']; };
  function buildColorMenu(host, opts) {
    if (!host) return; host.innerHTML = '';
    const sec = (t) => { const h = document.createElement('div'); h.className = 'color-sec'; h.textContent = t; host.appendChild(h); };
    const rowOf = (colors) => { const r = document.createElement('div'); r.className = 'color-row'; colors.forEach((c) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'color-sw rdrop-item'; b.style.background = c; b.title = c; b.addEventListener('click', () => opts.apply(c)); r.appendChild(b); }); host.appendChild(r); };
    const sep = () => { const d = document.createElement('div'); d.className = 'rdrop-sep'; host.appendChild(d); };
    const opt = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rdrop-item color-opt'; b.textContent = label; b.addEventListener('click', fn); host.appendChild(b); };
    sec('Scheme Colors'); rowOf(schemePalette());
    sec('Standard Colors'); rowOf(STD_COLORS);
    sep();
    opt(opts.noneLabel, opts.onNone);
    opt('More Colors…', () => pickMore(opts.apply));
    if (window.EyeDropper) opt(opts.sampleLabel || 'Sample colour…', () => sampleColor(opts.apply));
    if (opts.weights) {
      sep(); sec('Weight');
      const r = document.createElement('div'); r.className = 'color-row wt-row';
      [['Thin', 0.75], ['Med', 1.5], ['Bold', 3]].forEach(([l, w]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rdrop-item wt-btn'; b.textContent = l; b.addEventListener('click', () => opts.weight(w)); r.appendChild(b); });
      host.appendChild(r);
    }
  }
  function pickMore(apply) {
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = '#333333'; inp.style.cssText = 'position:fixed;opacity:0;pointer-events:none;'; document.body.appendChild(inp);
    inp.addEventListener('input', () => apply(inp.value));
    inp.addEventListener('change', () => setTimeout(() => inp.remove(), 200));
    inp.click();
  }
  async function sampleColor(apply) { try { const r = await new window.EyeDropper().open(); if (r && r.sRGBHex) apply(r.sRGBHex); } catch (_) { /* cancelled */ } }
  function clearOutline() { const o = selText(); if (!o) return; pushUndo(); delete o.textStroke; delete o.textStrokeW; o._node.innerHTML = elHtml(o); drawSel(); }
  function buildFillOutlineMenus() {
    buildColorMenu(document.getElementById('tbFillMenu'), { apply: (c) => applyTextPropU('color', c), noneLabel: '✕ No Fill', onNone: () => applyTextPropU('color', 'none') });
    buildColorMenu(document.getElementById('tbOutlineMenu'), {
      apply: (c) => setTextOutline(c), noneLabel: '✕ No Outline', onNone: clearOutline, sampleLabel: 'Sample line colour…',
      weights: true, weight: (w) => { const o = selText(); if (o) { pushUndo(); if (!o.textStroke) o.textStroke = '#222222'; o.textStrokeW = w; o._node.innerHTML = elHtml(o); drawSel(); } },
    });
  }
  // Text Fit: grow the box to the text's natural width, or shrink the font to fit.
  function applyTextFit(mode) {
    const o = selText(); if (!o || !o._node) return; const inner = o._node.firstElementChild; if (!inner) return;
    if (mode === 'none') { o._fit = 'none'; return; }
    pushUndo();
    const prev = inner.style.whiteSpace; inner.style.whiteSpace = 'nowrap';
    if (mode === 'shrink') {
      let fs = num(o.fontSize, 24);
      for (let i = 0; i < 60 && inner.scrollWidth > num(o.w, 240) && fs > 6; i++) { fs -= 1; inner.style.fontSize = fs + 'px'; }
      inner.style.whiteSpace = prev; o.fontSize = fs; o._node.innerHTML = elHtml(o); drawSel(); syncFontUI(o);
    } else {
      const nat = Math.min(dims.usableWidth, Math.ceil(inner.scrollWidth) + 6);
      inner.style.whiteSpace = prev; o.w = Math.max(40, nat); o._node.innerHTML = elHtml(o); drawSel(); syncSelUI();
    }
  }
  function setTextMargins(preset) {
    const o = selText(); if (!o) return;
    const map = { none: 0, narrow: 0.04, moderate: 0.06, wide: 0.1 };
    let inch = map[preset];
    if (preset === 'custom') { const v = parseFloat(window.prompt('Text box inset margin (inches):', String(num(o.pad, 0) / 96))); if (!isFinite(v)) return; inch = Math.max(0, Math.min(0.6, v)); }
    if (inch == null) return;
    pushUndo(); o.pad = Math.round(inch * 96); o._node.innerHTML = elHtml(o); drawSel();
  }
  // --- Shape Format tab (2nd contextual ribbon: frame fill/outline + shapes) ---
  const sfSel = () => (sels.length === 1 ? sels[0] : null);
  const sfApplicable = () => { const o = sfSel(); return !!(o && (o.kind === 'text' || o.kind === 'shape')); };
  const sfRerender = (o) => { o._node.innerHTML = elHtml(o); drawSel(); };
  // Fill / outline route to the text-box frame (boxFill/boxStroke) or the shape.
  function shapeFill(c) { const o = sfSel(); if (!o) return; pushUndo(); if (o.kind === 'text') o.boxFill = c; else o.fill = c; sfRerender(o); syncSelUI(); }
  function shapeFillNone() { const o = sfSel(); if (!o) return; pushUndo(); if (o.kind === 'text') o.boxFill = 'none'; else o.fill = 'none'; sfRerender(o); syncSelUI(); }
  function shapeOutline(c) { const o = sfSel(); if (!o) return; pushUndo(); if (o.kind === 'text') { o.boxStroke = c; if (!num(o.boxStrokeW, 0)) o.boxStrokeW = 1.5; } else { o.stroke = c; if (!num(o.strokeW, 0)) o.strokeW = 2; } sfRerender(o); syncSelUI(); }
  function shapeOutlineNone() { const o = sfSel(); if (!o) return; pushUndo(); if (o.kind === 'text') { delete o.boxStroke; delete o.boxStrokeW; } else o.stroke = 'none'; sfRerender(o); syncSelUI(); }
  function shapeOutlineWeight(w) { const o = sfSel(); if (!o) return; pushUndo(); if (o.kind === 'text') { if (!o.boxStroke) o.boxStroke = '#333333'; o.boxStrokeW = w; } else { if (!o.stroke || o.stroke === 'none') o.stroke = '#333333'; o.strokeW = w; } sfRerender(o); }
  function shapeEffects(act) { const o = sfSel(); if (!o) return; pushUndo(); if (act === 'shadow') { if (o.kind === 'text') { if (o.boxShadow) delete o.boxShadow; else o.boxShadow = '#00000033'; } else { o.shadow = !o.shadow; } } else { delete o.boxShadow; o.shadow = false; } sfRerender(o); }
  function buildShapeStyleMenus() {
    buildColorMenu(document.getElementById('sfFillMenu'), { apply: shapeFill, noneLabel: '✕ No Fill', onNone: shapeFillNone });
    buildColorMenu(document.getElementById('sfOutlineMenu'), { apply: shapeOutline, noneLabel: '✕ No Outline', onNone: shapeOutlineNone, weights: true, weight: shapeOutlineWeight, sampleLabel: 'Sample line colour…' });
  }
  const SHAPE_STYLES = [
    { fill: 'none', stroke: '#222222', w: 1.5 }, { fill: 'none', stroke: '#1c7ed6', w: 1.5 }, { fill: 'none', stroke: '#e8590c', w: 1.5 },
    { fill: '#f1f3f5', stroke: '#adb5bd', w: 1 }, { fill: '#fff3bf', stroke: '#f59f00', w: 1.5 }, { fill: '#d0ebff', stroke: '#1c7ed6', w: 1.5 },
  ];
  function applyShapeStyle(st) {
    const o = sfSel(); if (!o) return; pushUndo();
    if (o.kind === 'text') { o.boxFill = st.fill; o.boxStroke = st.stroke; o.boxStrokeW = st.w; if (!num(o.pad, 0)) o.pad = 6; }
    else { o.fill = st.fill; o.stroke = st.stroke; o.strokeW = st.w; }
    sfRerender(o); syncSelUI();
  }
  function buildShapeStyleGallery() {
    const host = document.getElementById('sfStyleGallery'); if (!host) return; host.innerHTML = '';
    SHAPE_STYLES.forEach((st) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sf-style-sw'; b.title = 'Apply this style'; b.style.background = st.fill === 'none' ? '#ffffff' : st.fill; b.style.border = `2px solid ${st.stroke}`; b.addEventListener('click', () => applyShapeStyle(st)); host.appendChild(b); });
  }
  function buildSfShapeGallery() {
    const host = document.getElementById('sfShapeGallery'); if (!host) return; host.innerHTML = '';
    const flat = []; SHAPE_GALLERY.forEach((c) => c.shapes.forEach((s) => flat.push(s)));
    flat.slice(0, 6).forEach(([shape, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'iconbtn shape-btn'; b.title = 'Insert ' + label; b.innerHTML = shapeIcon(shape); b.addEventListener('click', () => addShape(shape)); host.appendChild(b); });
  }
  function buildSfChangeMenu() {
    const host = document.getElementById('sfChangeMenu'); if (!host) return; host.innerHTML = '';
    [['rect', '▭ Rectangle'], ['round', '▢ Rounded Rectangle'], ['ellipse', '◯ Ellipse']].forEach(([act, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rdrop-item'; b.textContent = label; b.addEventListener('click', () => changeShape(act)); host.appendChild(b); });
  }
  function changeShape(act) {
    const o = sfSel(); if (!o) return; pushUndo();
    if (o.kind === 'text') { o.boxRadius = act === 'round' ? 16 : act === 'ellipse' ? 999 : 0; if (!o.boxStroke && (!o.boxFill || o.boxFill === 'none')) { o.boxStroke = '#333333'; o.boxStrokeW = 1.5; o.pad = o.pad || 6; } }
    else { o.shape = act === 'round' ? 'roundrect' : act === 'ellipse' ? 'ellipse' : 'rect'; }
    sfRerender(o);
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
    buildFillOutlineMenus(); buildShapeStyleMenus(); buildTableMenus(); buildPicBorderMenu(); // refresh scheme swatches
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
      const inset = marginInset; // set by the Margins dropdown
      g.style.cssText = `position:absolute;left:${inset}px;top:${inset}px;right:${inset}px;bottom:${inset}px;border:1px dashed #ff2d9b;pointer-events:none;z-index:5;`;
    } else if (g) { g.remove(); }
  }
  // Page Design → Layout: guide dropdown actions and margin presets.
  function addGuide(axis) {
    const g = ensureGuides(curModel()); if (!g) return;
    pushUndo();
    if (axis === 'v') g.v.push(Math.round(dims.usableWidth / 2)); else g.h.push(Math.round(dims.usableHeight / 2));
    renderUserGuides();
    setStatus('Guide added — drag it to position, double-click to remove.', 'ok');
  }
  function clearGuides() {
    const g = ensureGuides(curModel()); if (!g || (!g.v.length && !g.h.length)) return;
    pushUndo(); g.v = []; g.h = []; renderUserGuides();
    setStatus('Guides cleared.', 'ok');
  }
  function setMargins(preset) {
    const map = { wide: 96, moderate: 48, narrow: 24, none: 0 };
    if (preset === 'custom') {
      const v = window.prompt('Margin (inches):', (marginInset / PX_PER_IN).toFixed(2));
      if (v == null) return; const n = Number(v); if (!Number.isFinite(n)) return;
      marginInset = Math.max(0, Math.round(n * PX_PER_IN));
    } else if (map[preset] != null) marginInset = map[preset];
    if (el.marginGuide) el.marginGuide.checked = true;
    applyMarginGuide();
    setStatus(`Margin guide set to ${(marginInset / PX_PER_IN).toFixed(2)}″.`, 'ok');
  }
  // Reposition (and, if needed, scale) items so they sit inside the current
  // margin box — the pink guide when it's on, else the whole usable page. The
  // group's relative layout and aspect ratio are preserved; it's re-centred in
  // the box. `selOnly` fits just the current selection; otherwise the whole
  // page. Pinned pieces (grid) and free objects move together.
  function fitToMargins(selOnly) {
    const inset = (el.marginGuide && el.marginGuide.checked) ? marginInset : 0;
    const tx = inset, ty = inset, tw = dims.usableWidth - inset * 2, th = dims.usableHeight - inset * 2;
    if (tw <= 4 || th <= 4) { setStatus('Margins leave no room to fit into.', 'err'); return; }
    let refs = (selOnly && sels.length ? sels.slice() : allRefs())
      .filter((r) => r._node && !r.locked && !(r.group === 'piece' && r.hidden));
    if (!refs.length) { setStatus(selOnly ? 'Select objects to fit.' : 'Nothing on this page to fit.', ''); return; }
    // Combined bounding box in page coordinates.
    const bs = refs.map((r) => ({ r, b: box(r) }));
    const gx = Math.min(...bs.map((o) => o.b.x)), gy = Math.min(...bs.map((o) => o.b.y));
    const gw = Math.max(...bs.map((o) => o.b.x + o.b.w)) - gx;
    const gh = Math.max(...bs.map((o) => o.b.y + o.b.h)) - gy;
    if (gw <= 0 || gh <= 0) return;
    const s = Math.min(tw / gw, th / gh);        // scale to fit (shrinks or grows)
    const ox = tx + (tw - gw * s) / 2, oy = ty + (th - gh * s) / 2; // centre in box
    pushUndo();
    bs.forEach(({ r, b }) => {
      setScale(r, num(r.scale, 1) * s);
      moveTo(r, Math.round(ox + (b.x - gx) * s), Math.round(oy + (b.y - gy) * s));
    });
    drawSel();
    const pct = Math.round(s * 100);
    setStatus(`Fit ${selOnly ? 'selection' : 'page'} within the margins${pct !== 100 ? ` (scaled to ${pct}%)` : ''}.`, 'ok');
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
  function startMarquee(ev, additive, clickRef) {
    hideCtx();
    const base = additive ? sels.slice() : []; // shift-drag adds to the selection
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
          if (rf.group !== 'el' || rf.locked || !rf._node) return false; // free objects only, not protected puzzle pieces
          const b = box(rf);
          return b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y;
        });
        const merged = base.slice();
        expandGroups(hit).forEach((rf) => { if (!merged.includes(rf)) merged.push(rf); });
        setSel(merged);
      } else if (clickRef) {
        // A plain click (no drag) where we suppressed the object's own handler.
        // Additive: toggle it in/out of the current selection; plain: select it.
        if (additive) setSel(base.includes(clickRef) ? base.filter((r) => r !== clickRef) : expandGroups(base.concat([clickRef])));
        else setSel(expandGroups([clickRef]));
      } else setSel(base); // click on empty stage: clear (or keep, if additive)
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
    if (canBreakApart()) { if (items.length && items[items.length - 1] !== '-') items.push('-'); items.push({ label: '✂ Break apart puzzle', fn: breakApartPuzzle }); }
    // Fit-to-margins: pull the page's items (or just the selection) inside the
    // current margin box. Available whenever the page has something to arrange.
    if (!masterMode && allRefs().some((r) => r._node && !r.locked)) {
      if (items.length && items[items.length - 1] !== '-') items.push('-');
      if (sels.length) items.push({ label: '⤢ Fit selection to margins', fn: () => fitToMargins(true) });
      items.push({ label: '⤢ Fit page to margins', fn: () => fitToMargins(false) });
    }
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
  function editText(ref) {
    // A linked text box edits the whole chain's text through its head box.
    if (ref.chainId && chainBoxes(ref.chainId).length > 1) { editFlow(ref.chainId); return; }
    const bx = ref._node.querySelector('.pf-textbox'); bx.setAttribute('contenteditable', 'true'); bx.focus(); pushUndo();
    const done = () => { bx.removeAttribute('contenteditable'); ref.text = bx.innerText; bx.removeEventListener('blur', done); };
    bx.addEventListener('blur', done);
  }

  // --- linked text boxes (Publisher-style flow) -----------------------------
  // A chain is a set of text boxes sharing a `chainId`, ordered by `chainOrder`.
  // The head (order 0) holds the authoritative full text in `flowText`; every
  // box's `.text` is the visible slice, recomputed by reflow. Non-tail boxes
  // carry a fixed `flowH` so overflow spills into the next box; the tail is
  // auto-height. Chains are keyed by scalars (no element-id pointers) so they
  // survive the recipe round-trip. `.text` + `flowH` per box give the exported
  // PDF identical flow with no server-side measurement.
  let flowSeq = 1;
  let linkPickMode = null; // source box while picking a link target
  const chainBoxes = (cid) => curModel().elements
    .filter((e) => e.kind === 'text' && e.chainId === cid)
    .sort((a, b) => num(a.chainOrder, 0) - num(b.chainOrder, 0));
  function splitToFit(b, text) {
    const bx = b._node && b._node.querySelector('.pf-textbox');
    const cap = num(b.flowH, 0);
    if (!bx || !cap) return { head: text, tail: '' };
    const measure = (s) => { bx.textContent = s; return bx.scrollHeight; };
    if (measure(text) <= cap + 1) return { head: text, tail: '' };
    const toks = text.split(/(\s+)/); // keep whitespace so slices rejoin exactly
    let lo = 1, hi = toks.length, best = 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (measure(toks.slice(0, mid).join('')) <= cap + 1) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    return { head: toks.slice(0, best).join(''), tail: toks.slice(best).join('') };
  }
  function reflowChain(cid) {
    const boxes = chainBoxes(cid); if (!boxes.length) return;
    let rest = boxes[0].flowText || '';
    boxes.forEach((b, i) => {
      if (i === boxes.length - 1) { b.text = rest; rest = ''; }
      else { const s = splitToFit(b, rest); b.text = s.head; rest = s.tail; }
      b._node.innerHTML = elHtml(b);
    });
    // Overflow indicator: text beyond the (auto-height) tail is rare, but a
    // non-tail with too-small flowH could still clip — flag the tail if content
    // exceeds its box.
    const tail = boxes[boxes.length - 1];
    boxes.forEach((b) => b._node.classList.remove('pf-overflow'));
    const tb = tail._node.querySelector('.pf-textbox');
    if (num(tail.flowH, 0) && tb && tb.scrollHeight > tb.clientHeight + 1) tail._node.classList.add('pf-overflow');
    requestAnimationFrame(drawSel);
  }
  // Freeze non-tail heights (so they can overflow) and collapse a 1-box chain
  // back to a plain auto box, then reflow.
  function normalizeAndReflow(cid) {
    const boxes = chainBoxes(cid);
    if (boxes.length < 2) {
      const b = boxes[0];
      if (b) { delete b.chainId; delete b.chainOrder; delete b.flowText; delete b.flowH; b._node.innerHTML = elHtml(b); requestAnimationFrame(drawSel); }
      return;
    }
    boxes.forEach((b, i) => { b.chainOrder = i; if (i < boxes.length - 1) { if (!num(b.flowH, 0)) b.flowH = Math.max(24, Math.round(b._node.offsetHeight / num(b.scale, 1))); } else delete b.flowH; });
    reflowChain(cid);
  }
  function editFlow(cid) {
    const boxes = chainBoxes(cid); const head = boxes[0]; if (!head) return;
    const bx = head._node.querySelector('.pf-textbox'); if (!bx) return;
    pushUndo();
    bx.style.height = 'auto'; bx.style.overflow = 'visible'; // unclip while editing
    bx.textContent = head.flowText || '';
    bx.setAttribute('contenteditable', 'true'); bx.focus();
    const done = () => { bx.removeAttribute('contenteditable'); head.flowText = bx.innerText; bx.removeEventListener('blur', done); reflowChain(cid); };
    bx.addEventListener('blur', done);
  }
  function startCreateLink() {
    const o = selText(); if (!o) { setStatus('Select a text box first, then Create Link.', ''); return; }
    if (linkPickMode) { cancelLink(); return; }
    linkPickMode = o; document.body.classList.add('pf-linking');
    setStatus('Click another text box to flow the overflow into (Esc to cancel).', '');
  }
  function cancelLink() { linkPickMode = null; document.body.classList.remove('pf-linking'); }
  function finishLink(tgt) {
    const src = linkPickMode; cancelLink(); if (!src || tgt === src) return;
    if (tgt.kind !== 'text') { setStatus('Links can only flow into another text box.', ''); return; }
    if (tgt.chainId) { setStatus('That text box is already part of a link chain.', ''); return; }
    pushUndo();
    let cid = src.chainId;
    if (!cid) { cid = 'flow' + (flowSeq++); src.chainId = cid; src.chainOrder = 0; src.flowText = src.text || ''; }
    const boxes = chainBoxes(cid);
    const maxOrd = boxes.reduce((m, b) => Math.max(m, num(b.chainOrder, 0)), 0);
    tgt.chainId = cid; tgt.chainOrder = maxOrd + 1;
    const head = chainBoxes(cid)[0];
    if (tgt.text) head.flowText = (head.flowText || '') + (head.flowText ? '\n' : '') + tgt.text;
    normalizeAndReflow(cid); setSel([src]); setStatus('Text boxes linked — drag the bottom edge to size the flow region.', 'ok');
  }
  function breakLink() {
    const o = selText(); if (!o || !o.chainId) { setStatus('This text box isn’t linked.', ''); return; }
    pushUndo();
    const cid = o.chainId; const boxes = chainBoxes(cid); const idx = boxes.indexOf(o);
    const before = boxes.slice(0, idx + 1), after = boxes.slice(idx + 1);
    // Downstream boxes become a fresh chain (slices rejoin exactly, join('')).
    if (after.length) { const ncid = 'flow' + (flowSeq++); after.forEach((b, i) => { b.chainId = ncid; b.chainOrder = i; }); after[0].flowText = after.map((b) => b.text).join(''); normalizeAndReflow(ncid); }
    before[0].flowText = before.map((b) => b.text).join(''); normalizeAndReflow(cid);
    syncSelUI(); setStatus('Link broken.', 'ok');
  }
  function flowNav(dir) {
    const o = selText(); if (!o || !o.chainId) return;
    const boxes = chainBoxes(o.chainId); const t = boxes[boxes.indexOf(o) + (dir > 0 ? 1 : -1)];
    if (t) setSel([t]);
  }
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
  function duplicate() { const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'el') return; pushUndo(); const { _node, ...c } = o; c.id = uid++; c.x = num(o.x, 0) + 16; c.y = num(o.y, 0) + 16; c.z = num(o.z, 100) + 1; delete c.chainId; delete c.chainOrder; delete c.flowText; delete c.flowH; curModel().elements.push(c); el.stageInner.insertBefore(makeEl(c), selLayer); setSel([c]); }
  function copySel() { clipboard = sels.filter((r) => r.group === 'el').map((r) => { const { _node, ...c } = r; return c; }); }
  function paste() { if (!clipboard.length) return; pushUndo(); const made = []; clipboard.forEach((c) => { const e = { ...c, group: 'el', id: uid++, x: num(c.x, 0) + 16, y: num(c.y, 0) + 16, z: num(c.z, 100) + 1 }; curModel().elements.push(e); el.stageInner.insertBefore(makeEl(e), selLayer); made.push(e); }); setSel(made); }
  function deleteSel() {
    const els = sels.filter((r) => r.group === 'el'); if (!els.length) return; pushUndo();
    const arr = curModel().elements;
    const affected = new Set(els.map((r) => r.chainId).filter(Boolean));
    els.forEach((r) => { const i = arr.indexOf(r); if (i >= 0) arr.splice(i, 1); if (r._node) r._node.remove(); });
    setSel([]);
    affected.forEach((cid) => normalizeAndReflow(cid)); // heal / collapse broken chains
  }
  function hideComp() {
    const o = sels.length === 1 && sels[0]; if (!o || o.group !== 'piece') return;
    pushUndo(); o.hidden = true; setSel([]);
    // On content pages pieces sit in document flow, so hiding one reflows the
    // rest (matching the PDF, which drops hidden pieces). Re-render so the
    // remaining pieces' measured bases — and thus their selection boxes — track
    // their new positions instead of pointing at where they used to be.
    renderPage();
  }
  function resetSize() { if (!sels.length) return; pushUndo(); sels.forEach((r) => { setScale(r, 1); setRot(r, 0); }); drawSel(); syncSelUI(); }
  function nudge(dx, dy) { if (!sels.length) return; sels.forEach((r) => { if (!r.locked) { const b = box(r); moveTo(r, b.x + dx, b.y + dy); } }); drawSel(); syncSelUI(); }
  function setMeasure(prop, val) { const o = sels.length === 1 && sels[0]; if (!o) return; pushUndo(); const b = box(o); if (prop === 'x') moveTo(o, val, b.y); else if (prop === 'y') moveTo(o, b.x, val); else if (prop === 'scale') setScale(o, val); else if (prop === 'rot') setRot(o, val); drawSel(); syncSelUI(); }

  function resetLayout() { pushUndo(); const pm = pageModels[cur]; pm.comps.forEach((c) => { c.hidden = false; c.dx = 0; c.dy = 0; c.scale = 1; c.rot = 0; c.locked = false; }); pm.elements = []; renderPage(); }
  function setBorder() { pushUndo(); pageModels[cur]._border = el.border.value; renderPage(); }
  // Draw the page border as a live SVG overlay using the engine's shared
  // renderer (window.PFDecor), so what's on screen matches the printed frame.
  // CSS `background` value for a page's background spec (mirrors backgroundCss
  // in engine/export.js so the editor and PDF match).
  function pageBgCss(bg) {
    if (!bg || !bg.type || bg.type === 'none') return '';
    const hex = (c, d) => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : d);
    if (bg.type === 'solid') return hex(bg.color, '#ffffff');
    if (bg.type === 'gradient') { const a = Number.isFinite(Number(bg.angle)) ? Math.round(Number(bg.angle)) % 360 : 180; return `linear-gradient(${a}deg, ${hex(bg.color, '#ffffff')}, ${hex(bg.color2, '#dddddd')})`; }
    return '';
  }
  function curBg() { const pm = curModel(); if (!pm) return null; if (!pm._bg) pm._bg = { type: 'none', color: '#ffffff', color2: '#dddddd', angle: 180 }; return pm._bg; }
  function setBgType(type) { const pm = curModel(); if (!pm) return; pushUndo(); curBg().type = type; renderPage(); syncBgUI(); setStatus(type === 'none' ? 'Page background cleared.' : `Page background: ${type}.`, 'ok'); }
  function setBgProp(k, v) { const pm = curModel(); if (!pm || !pm._bg) return; pushUndo(); pm._bg[k] = v; el.stageInner.style.background = pageBgCss(pm._bg); }
  function syncBgUI() {
    const bg = curModel() && curModel()._bg; const type = (bg && bg.type) || 'none';
    if (el.bgColors) el.bgColors.style.display = type === 'none' ? 'none' : 'grid';
    if (el.bgColor2Field) el.bgColor2Field.style.display = type === 'gradient' ? '' : 'none';
    if (el.bgAngleField) el.bgAngleField.style.display = type === 'gradient' ? '' : 'none';
    if (bg) { if (el.bgColor) el.bgColor.value = bg.color || '#ffffff'; if (el.bgColor2) el.bgColor2.value = bg.color2 || '#dddddd'; if (el.bgAngle) el.bgAngle.value = bg.angle != null ? bg.angle : 180; }
    // Reflect the active fill on the menu's type buttons.
    document.querySelectorAll('#bgDrop .bg-type').forEach((b) => b.classList.toggle('on', b.dataset.bg === type));
  }
  function renderBorderFrame(pm) {
    const style = pm && pm._border;
    if (!style || style === 'none' || !(window.PFDecor && window.PFDecor.frameSvg)) return;
    const color = pm._borderColor || (bookConfig && bookConfig.borderColor) || '#333333';
    const svg = window.PFDecor.frameSvg(style, dims.usableWidth, dims.usableHeight, { color });
    if (!svg) return;
    const fr = document.createElement('div'); fr.className = 'pf-frame'; fr.innerHTML = svg;
    el.stageInner.appendChild(fr);
  }
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
  function selectPage(i) { if (masterMode) exitMaster(); if (i === cur) return; cur = i; renderPage(); }

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
        columns: e.columns, pad: e.pad, numStyle: e.numStyle, ligatures: e.ligatures, dropCap: e.dropCap, hyphens: e.hyphens,
        stySet: e.stySet, swash: e.swash, styAlt: e.styAlt, contextual: e.contextual,
        chainId: e.chainId, chainOrder: e.chainOrder, flowText: e.flowText, flowH: e.flowH,
        boxFill: e.boxFill, boxStroke: e.boxStroke, boxStrokeW: e.boxStrokeW, boxRadius: e.boxRadius, boxShadow: e.boxShadow,
        src: e.src, width: e.width, flipH: e.flipH, flipV: e.flipV, placeholder: e.placeholder || undefined,
        brightness: e.brightness, contrast: e.contrast, recolor: e.recolor, picBorder: e.picBorder, picBorderW: e.picBorderW, picRadius: e.picRadius, picShadow: e.picShadow, caption: e.caption, captionStyle: e.captionStyle,
        crop: e.crop, natW: e.natW, natH: e.natH,
        link: e.link || undefined, bookmark: e.bookmark || undefined,
        shape: e.shape, h: e.h, fill: e.fill, stroke: e.stroke, strokeW: e.strokeW,
        rows: e.rows, cols: e.cols, cells: e.cells, colW: e.colW, header: e.header,
        borderColor: e.borderColor, borderW: e.borderW, headerFill: e.headerFill, cellPad: e.cellPad, cellFill: e.cellFill,
        spans: e.spans, diags: e.diags,
        url: e.url, ecl: e.ecl, fg: e.fg, bg: e.bg, modules: e.modules,
        behind: e.behind || undefined, field: e.field || undefined,
        gid: e.gid,
      }));
      st.layout = { comp, elements };
    }
    if (pm._border) st.border = pm._border;
    if (pm._borderColor) st.borderColor = pm._borderColor;
    if (pm._bg && pm._bg.type && pm._bg.type !== 'none') st.bg = pm._bg;
    if (pm.guides && (pm.guides.v.length || pm.guides.h.length)) st.guides = { v: pm.guides.v.slice(), h: pm.guides.h.slice() };
    return st;
  }
  // Per-page arrangement for export/recipe: keeps the final page order, marks
  // inserted blanks, and references each real page's original book index (src).
  const buildPagePlan = () => pageModels.map((pm) => {
    const state = pageStateOf(pm);
    if (pm.blank) return { role: 'blank', state };
    if (pm.role === 'content') {
      // Editor-inserted puzzle: the plan carries the puzzle object (the server
      // re-splits it for export) plus a render cache (type/title/style/pieces)
      // so a saved recipe can rebuild the page offline without a src.
      if (pm.puzzle) return { role: 'content', puzzle: pm.puzzle, state,
        page: { type: pm.type, title: pm.title, style: pm.style, components: pm.comps.map((c) => ({ kind: c.kind, html: c.html })) } };
      return { role: 'content', src: pm.src, state };
    }
    if (pm.role === 'frontmatter' || pm.role === 'backmatter') return { role: pm.role, matterKind: pm.matterKind, state };
    if (pm.role === 'answerkey') return { role: 'answerkey', akIndex: pm.akIndex || 0, state };
    return { role: pm.role, state }; // title
  });
  function buildRecipe() { const book = { ...(bookConfig || {}) }; delete book.seed; delete book.pageState; delete book.puzzleforgeBook; const m = masterForSend(); if (m) book.master = m; else delete book.master; return { recipeVersion: 2, kind: 'book', book, seed, pagePlan: buildPagePlan() }; }
  function save() { downloadBlob(new Blob([JSON.stringify(buildRecipe(), null, 2)], { type: 'application/json' }), slug((bookConfig && bookConfig.title) || 'book') + '-book.json'); setStatus('Recipe saved (with layout).', 'ok'); }

  // --- Autosave ---------------------------------------------------------
  // A book opened from the Team library is a TEAM book: it lives in the
  // workspace and its edits save back there (no personal copy is made). A book
  // from My Books (currentLibId) saves locally. A brand-new book seeds a local
  // copy. "Save to my library" forks a team book into a personal one.
  const isTeamBook = () => !currentLibId && !!workspaceId;
  const setSaveState = (txt, cls) => { if (el.saveState) { el.saveState.textContent = txt || ''; el.saveState.className = 'save-state' + (cls ? ' ' + cls : ''); } };
  async function persistLibrary(recipe, json) {
    if (!window.PFLibrary) return;
    if (!currentLibId) currentLibId = PFLibrary.newId();
    const meta = PFLibrary.metaFromRecipe(recipe);
    try { await PFLibrary.put({ id: currentLibId, ...meta, recipe }); lastSavedJson = json; setSaveState('All changes saved', 'ok'); }
    catch (_) { setSaveState('Autosave failed (storage full?)', 'err'); }
  }
  async function persistTeam(recipe, json) {
    try { await PFWorkspace.shareBook(workspaceId, recipe, me.name); lastSavedJson = json; setSaveState('Saved to team', 'ok'); }
    catch (_) { setSaveState('Team autosave failed — is the workspace up?', 'err'); }
  }
  // Cheap change detection: rebuild the recipe and compare to the last saved
  // JSON, so ANY edit is captured without wiring every mutation.
  function autosaveTick() {
    if (!bookOpen || el.main.hidden || detached) return;
    let recipe, json;
    try { recipe = buildRecipe(); json = JSON.stringify(recipe); } catch (_) { return; }
    if (json === lastSavedJson) return;
    setSaveState('Saving…', 'busy');
    if (isTeamBook() && wsEnabled) persistTeam(recipe, json);
    else if (window.PFLibrary) persistLibrary(recipe, json);
  }
  function startAutosave() {
    bookOpen = true;
    let recipe = null, json = null;
    try { recipe = buildRecipe(); json = JSON.stringify(recipe); } catch (_) { /* */ }
    lastSavedJson = json;
    if (currentLibId) setSaveState('All changes saved', 'ok');
    else if (isTeamBook()) setSaveState('Team book — edits save to the team', 'ok');
    else if (recipe && window.PFLibrary) persistLibrary(recipe, json);   // brand-new book → seed My Books
    else setSaveState('Autosaves as you edit', '');
    if (!startAutosave._timer) startAutosave._timer = setInterval(autosaveTick, 4000);
  }
  // Fork the current (team) book into a personal copy in My Books.
  async function saveToMyLibrary() {
    if (!bookOpen || !window.PFLibrary) return;
    let recipe, json;
    try { recipe = buildRecipe(); json = JSON.stringify(recipe); } catch (_) { return; }
    const wasTeam = !!workspaceId;
    currentLibId = PFLibrary.newId();
    try { await PFLibrary.put({ id: currentLibId, ...PFLibrary.metaFromRecipe(recipe), recipe }); }
    catch (_) { currentLibId = null; setStatus('Could not save to My Books (browser storage full?).', 'err'); return; }
    if (wasTeam && wsEnabled) { try { await PFWorkspace.addComment(workspaceId, { author: me.name, role: me.role, text: `📋 ${me.name} saved a personal copy of this book.` }); } catch (_) { /* */ } }
    workspaceId = null; detached = false; lastSavedJson = json;
    setSaveState('All changes saved', 'ok'); setWsStatus();
    setStatus(wasTeam ? 'Saved a personal copy to My Books — you’re now editing your own copy; the team copy is unchanged.' : 'Saved to My Books.', 'ok');
  }
  async function exportPdf() {
    setStatus('Rendering PDF…', 'busy'); el.exportPdf.disabled = true;
    try { const body = { ...(bookId ? { bookId } : { config: bookConfig }), pagePlan: buildPagePlan(), master: masterForSend(), fonts: usedCustomFontsForSend() };
      const res = await fetch('/api/book/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Export failed'); }
      downloadBlob(await res.blob(), slug((bookConfig && bookConfig.title) || 'book') + '.pdf'); setStatus('PDF exported.', 'ok');
    } catch (err) { setStatus(err.message, 'err'); } finally { el.exportPdf.disabled = false; }
  }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  // --- Publish flow (pre-flight + KDP package) ------------------------------
  const bookBody = () => ({ ...(bookId ? { bookId } : { config: bookConfig }), pagePlan: buildPagePlan(), master: masterForSend(), fonts: usedCustomFontsForSend() });
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
    if (!curModel() || curModel().elements.indexOf(ref) < 0) { setStatus('That text box is no longer on the current page.', 'err'); return; }
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

    { cat: 'Team', q: 'How does the team workspace work?',
      a: 'PuzzleForge includes a self-hosted <b>workspace server</b> — no accounts host, no monthly bill. Run the app on one machine and have teammates on the same network open <code>http://&lt;that-machine’s-IP&gt;:&lt;port&gt;</code> in their browser. Everyone then shares one <b>team roster</b>, a <b>Team library</b> of books, and <b>live comments</b>.' },
    { cat: 'Team', q: 'How do I share a book with my team?',
      a: 'Open the book, go to the <b>Mailings</b> tab, and click <b>☁ Share to team</b>. It appears under <b>My Books → Team library</b> for everyone on the workspace, who can open it. Re-sharing updates the same team copy.' },
    { cat: 'Team', q: 'Where are team comments and the roster stored?',
      a: 'On the machine running the server, in a local <code>data/</code> folder (plain files — easy to back up). Add a <code>PUZZLEFORGE_WORKSPACE_TOKEN</code> environment variable to require a shared token; leave it unset to trust your local network.' },

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
  function openTeam(focusAdd) { if (!el.teamModal) return; renderTeamList(); if (wsEnabled) syncTeamFromServer(); el.teamModal.hidden = false; if (focusAdd) setTimeout(() => el.teamName.focus(), 30); }
  function closeTeam() { if (el.teamModal) el.teamModal.hidden = true; }
  // When a workspace is running, the roster is shared: read/write the server.
  async function syncTeamFromServer() {
    if (!wsEnabled || !window.PFWorkspace) return;
    try { const members = await PFWorkspace.members(); team = members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role })); renderTeamList(); renderRecipients(); } catch (_) { /* */ }
  }
  async function addMember() {
    const name = el.teamName.value.trim(); const email = el.teamEmail.value.trim(); const role = el.teamRole.value;
    if (!name) { setStatus('Give the team member a name.', 'err'); el.teamName.focus(); return; }
    if (wsEnabled && window.PFWorkspace) {
      try { const m = await PFWorkspace.addMember({ name, email, role }); team.push({ id: m.id, name: m.name, email: m.email, role: m.role }); }
      catch (_) { setStatus('Could not add to the shared roster — is the workspace running?', 'err'); return; }
    } else {
      team.push({ id: 't' + Date.now().toString(36), name, email, role });
      saveTeam();
    }
    el.teamName.value = ''; el.teamEmail.value = '';
    renderTeamList(); renderRecipients();
    setStatus(`Added ${name} (${role}) to the team${wsEnabled ? ' — shared with everyone' : ''}.`, 'ok');
  }
  async function removeMember(id) {
    if (wsEnabled && window.PFWorkspace) { try { await PFWorkspace.removeMember(id); } catch (_) { /* */ } }
    team = team.filter((m) => m.id !== id);
    if (teamState.assigneeId === id) { teamState.assigneeId = null; saveTeamState(); }
    if (!wsEnabled) saveTeam();
    renderTeamList(); renderRecipients();
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
  const usingWorkspaceNotes = () => wsEnabled && !!workspaceId;
  function openNotes() {
    if (!el.notesModal) return;
    if (el.notesSub) el.notesSub.textContent = usingWorkspaceNotes()
      ? 'Live team comments — everyone on your workspace sees these and updates appear in real time.'
      : 'Notes travel with this book so the next person has context. Saved with your recipe on Save. Share to team to make them live.';
    renderNotes(); el.notesModal.hidden = false; setTimeout(() => el.noteText.focus(), 30);
  }
  function closeNotes() { if (el.notesModal) el.notesModal.hidden = true; }
  function renderNoteList(notes) {
    if (!el.notesList) return;
    if (!notes.length) { el.notesList.innerHTML = '<p class="pf-modal-sub">No notes yet. Post the first handoff note below.</p>'; return; }
    el.notesList.innerHTML = notes.map((n) => {
      const when = n.when || (n.createdAt ? new Date(n.createdAt).toLocaleString() : '');
      const badge = `<span class="pf-role" style="background:${ROLE_COLORS[n.role] || '#868e96'}">${escHtml(n.role)}</span>`;
      return `<div class="pf-note"><div class="pf-note-head">${badge} <b>${escHtml(n.author)}</b> <span class="pf-dim">${escHtml(when)}</span></div><div class="pf-note-body">${escHtml(n.text)}</div></div>`;
    }).join('');
  }
  async function renderNotes() {
    if (!el.notesList) return;
    if (!usingWorkspaceNotes()) { renderNoteList(teamState.notes); return; }
    try { renderNoteList(await PFWorkspace.comments(workspaceId)); }
    catch (_) { el.notesList.innerHTML = '<p class="rep-note err">Could not load team comments — is the workspace server running?</p>'; }
  }
  async function addNote() {
    const text = el.noteText.value.trim(); if (!text) return;
    if (usingWorkspaceNotes()) {
      try { await PFWorkspace.addComment(workspaceId, { author: me.name, role: me.role, text }); el.noteText.value = ''; renderNotes(); }
      catch (_) { setStatus('Could not post the comment to the workspace.', 'err'); }
      return;
    }
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

  // --- Team workspace (self-hosted LAN server) --------------------------
  function setWsStatus() {
    if (!el.wsStatus) return;
    if (detached) el.wsStatus.textContent = '⚠ Removed from team — save to keep';
    else if (!wsEnabled) el.wsStatus.textContent = 'Workspace off';
    else if (workspaceId && !currentLibId) el.wsStatus.textContent = '☁ Team book (live)';
    else if (workspaceId) el.wsStatus.textContent = '✓ Shared with team';
    else el.wsStatus.textContent = 'Not shared yet';
    if (el.saveMineBtn) el.saveMineBtn.style.display = (isTeamBook() || detached) ? '' : 'none';
  }
  async function initWorkspace() {
    if (!window.PFWorkspace) return;
    const st = await PFWorkspace.status();
    wsEnabled = !!st.enabled;
    setWsStatus();
    if (wsEnabled) subscribeWorkspace();
  }
  function subscribeWorkspace() {
    if (wsSub || !window.PFWorkspace) return;
    try {
      wsSub = PFWorkspace.subscribe((evt) => {
        // Live-refresh shared comments when someone else posts on this book.
        if (evt.type === 'comment' && evt.bookId === workspaceId && el.notesModal && !el.notesModal.hidden) renderNotes();
        // Keep the shared roster fresh when a teammate adds/removes someone.
        if (evt.type === 'member' && el.teamModal && !el.teamModal.hidden) syncTeamFromServer();
        // The owner removed this team book from the library while we have it open:
        // stop pushing edits (a PUT would resurrect it) and prompt to keep a copy.
        if (evt.type === 'book' && evt.removed && evt.id === workspaceId && isTeamBook()) {
          detached = true; setWsStatus();
          setStatus('⚠ This book was removed from the team library by the owner. Click “Save to my library” to keep your copy — otherwise your edits won’t be saved.', 'err');
        }
      });
    } catch (_) { /* */ }
  }
  async function shareToTeam() {
    if (!wsEnabled) { setStatus('No team workspace is running. Start the PuzzleForge server on your LAN to share.', 'err'); return; }
    if (!bookOpen) return;
    const id = workspaceId || currentLibId || (window.PFLibrary && PFLibrary.newId()) || ('bk_' + Date.now().toString(36));
    setStatus('Sharing to the team workspace…', 'busy');
    try {
      await PFWorkspace.shareBook(id, buildRecipe(), me.name);
      workspaceId = id; setWsStatus();
      setStatus('Shared with the team — everyone on the workspace can now open it from My Books → Team library.', 'ok');
    } catch (err) {
      if (err.needsToken) setStatus('This workspace needs a token. Add it in My Books, then try again.', 'err');
      else setStatus('Could not reach the workspace server: ' + err.message, 'err');
    }
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
  // Contextual tab (Publisher-style): the Format tab is hidden from the strip
  // until an object is selected, then it appears and relabels itself for the
  // object type — Picture Format (image), Table, Text Box, or Drawing Tools
  // (shape). It auto-activates on selection and returns to the previous tab when
  // the selection clears. The align/order/arrange tools live on this Format tab
  // (Publisher has no standalone Arrange tab).
  // A text box also carries the object-specific tab (Text Box); other kinds get
  // their own single tab. Plain shapes use only Shape Format.
  const CTX_LABELS = { text: 'Text Box' };
  function updateContextTab() {
    if (!ribbonActivate || !el.ctxTab) return;
    const one = sels.length === 1 ? sels[0] : null;
    const kind = one && one.kind;
    const isTable = kind === 'table';
    const isImg = kind === 'image';
    const isQr = kind === 'qr';
    // Primary object tab (Text Box) — not for shapes, tables, pictures, or QR.
    const hasPrimary = !!(kind && CTX_LABELS[kind]);
    // Shape Format (frame) tab — text boxes and shapes.
    const hasShapeFmt = kind === 'text' || kind === 'shape';
    if (hasPrimary) { el.ctxTab.textContent = CTX_LABELS[kind]; el.ctxTab.classList.add('avail'); }
    else el.ctxTab.classList.remove('avail');
    if (el.ctxTab2) el.ctxTab2.classList.toggle('avail', hasShapeFmt);
    if (el.ctxTabTD) el.ctxTabTD.classList.toggle('avail', isTable);
    if (el.ctxTabTL) el.ctxTabTL.classList.toggle('avail', isTable);
    if (el.ctxTabPic) el.ctxTabPic.classList.toggle('avail', isImg);
    if (el.ctxTabQr) el.ctxTabQr.classList.toggle('avail', isQr);
    // If we're on a contextual tab that no longer applies, fall back gracefully.
    const active = document.querySelector('.rtab.active');
    const cur = active ? active.dataset.tab : 'home';
    const ok = { format: hasPrimary, shapeformat: hasShapeFmt, tabledesign: isTable, tablelayout: isTable, pictureformat: isImg, qrformat: isQr };
    if (cur in ok && !ok[cur]) {
      ribbonActivate(isTable ? 'tabledesign' : isImg ? 'pictureformat' : isQr ? 'qrformat' : hasPrimary ? 'format' : hasShapeFmt ? 'shapeformat' : (ribbonPrevTab || 'home'));
    }
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
    setupRibbon(); setupTheme(); buildObjectMenus();
    injectCustomFontFaces(); refreshFontSelects();
    if (el.fontUpload) el.fontUpload.addEventListener('change', () => onFontUpload(el.fontUpload));
    document.querySelectorAll('#bgDrop .bg-type').forEach((b) => b.addEventListener('click', () => setBgType(b.dataset.bg)));
    if (el.bgColor) el.bgColor.addEventListener('change', () => setBgProp('color', el.bgColor.value));
    if (el.bgColor2) el.bgColor2.addEventListener('change', () => setBgProp('color2', el.bgColor2.value));
    if (el.bgAngle) el.bgAngle.addEventListener('change', () => setBgProp('angle', Number(el.bgAngle.value) || 0));
    el.addText.addEventListener('click', addText);
    el.addImage.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });
    if (el.addPicPlaceholder) el.addPicPlaceholder.addEventListener('click', addPicturePlaceholder);
    if (el.insHeader) el.insHeader.addEventListener('click', () => addMasterText('header'));
    if (el.insFooter) el.insFooter.addEventListener('click', () => addMasterText('footer'));
    if (el.addCalendarBtn) el.addCalendarBtn.addEventListener('click', addCalendar);
    if (el.insLinkBtn) el.insLinkBtn.addEventListener('click', linkSel);
    if (el.insBookmarkBtn) el.insBookmarkBtn.addEventListener('click', bookmarkSel);
    document.querySelectorAll('.shape-btn').forEach((b) => b.addEventListener('click', () => addShape(b.dataset.shape)));
    // Font: live update on input, commit an undo entry on change.
    // Font controls live on BOTH the Home tab and the contextual Text Box
    // Format tab, so wire every matching control by class (shared behaviour).
    const each = (sel, fn) => document.querySelectorAll(sel).forEach(fn);
    each('.js-font-size', (i) => { i.addEventListener('input', () => applyTextProp('fontSize', Number(i.value) || 24)); i.addEventListener('change', () => { if (selText()) pushUndo(); }); });
    each('.js-font-color', (c) => { c.addEventListener('input', () => applyTextProp('color', c.value)); c.addEventListener('change', () => { if (selText()) pushUndo(); }); });
    each('.js-font-family', (s) => s.addEventListener('change', () => applyTextPropU('fontFamily', s.value)));
    each('.js-font-grow', (b) => b.addEventListener('click', () => fontStep(2)));
    each('.js-font-shrink', (b) => b.addEventListener('click', () => fontStep(-2)));
    each('.js-font-case', (b) => b.addEventListener('click', changeCase));
    each('.js-font-clear', (b) => b.addEventListener('click', clearTextFmt));
    each('.js-line-spacing', (s) => s.addEventListener('change', () => applyTextPropU('lineHeight', Number(s.value) || 1.25)));
    each('.palign', (b) => b.addEventListener('click', () => applyTextPropU('align', b.dataset.align)));
    const tstyle = (prop) => { const o = selText(); if (o) applyTextPropU(prop, !o[prop]); };
    each('.js-bold', (b) => b.addEventListener('click', () => tstyle('bold')));
    each('.js-italic', (b) => b.addEventListener('click', () => tstyle('italic')));
    each('.js-underline', (b) => b.addEventListener('click', () => tstyle('underline')));
    // Text Box tab: outline colour + WordArt gallery + effects
    if (el.tbHyphenBtn) el.tbHyphenBtn.addEventListener('click', () => { const o = selText(); if (o) applyTextPropU('hyphens', !o.hyphens); });
    if (el.tbLinkCreate) el.tbLinkCreate.addEventListener('click', startCreateLink);
    if (el.tbLinkBreak) el.tbLinkBreak.addEventListener('click', breakLink);
    if (el.tbLinkPrev) el.tbLinkPrev.addEventListener('click', () => flowNav(-1));
    if (el.tbLinkNext) el.tbLinkNext.addEventListener('click', () => flowNav(1));
    buildWordArtGallery(); buildFillOutlineMenus();
    buildShapeStyleMenus(); buildShapeStyleGallery(); buildSfShapeGallery(); buildSfChangeMenu();
    if (el.sfEditText) el.sfEditText.addEventListener('click', () => { const o = sfSel(); if (o && o.kind === 'text') editText(o); });
    if (el.sfForward) el.sfForward.addEventListener('click', () => reorder('forward'));
    if (el.sfBackward) el.sfBackward.addEventListener('click', () => reorder('backward'));
    if (el.sfGroup) el.sfGroup.addEventListener('click', groupSel);
    if (el.sfUngroup) el.sfUngroup.addEventListener('click', ungroupSel);
    if (el.sfW) el.sfW.addEventListener('change', () => { const o = sfSel(); if (o) { pushUndo(); o.w = Math.max(8, Number(el.sfW.value) || num(o.w, 160)); sfRerender(o); syncSelUI(); } });
    if (el.sfH) el.sfH.addEventListener('change', () => { const o = sfSel(); if (o && o.kind === 'shape') { pushUndo(); o.h = Math.max(4, Number(el.sfH.value) || num(o.h, 120)); sfRerender(o); syncSelUI(); } });
    // Table Design / Table Layout tabs
    buildTableFormatGallery(); buildTableMenus();
    if (el.tlInsAbove) el.tlInsAbove.addEventListener('click', () => tblInsRow('above'));
    if (el.tlInsBelow) el.tlInsBelow.addEventListener('click', () => tblInsRow('below'));
    if (el.tlInsLeft) el.tlInsLeft.addEventListener('click', () => tblInsCol('left'));
    if (el.tlInsRight) el.tlInsRight.addEventListener('click', () => tblInsCol('right'));
    if (el.tlForward) el.tlForward.addEventListener('click', () => reorder('forward'));
    if (el.tlBackward) el.tlBackward.addEventListener('click', () => reorder('backward'));
    if (el.tlEditText) el.tlEditText.addEventListener('click', () => setStatus('Double-click a cell to edit its text.', ''));
    if (el.tdBorderW) el.tdBorderW.addEventListener('change', () => tblSet('borderW', Math.max(0, Math.min(8, Number(el.tdBorderW.value) || 0))));
    if (el.tdHeader) el.tdHeader.addEventListener('change', () => tblSet('header', el.tdHeader.checked));
    document.querySelectorAll('.tbl-align').forEach((b) => b.addEventListener('click', () => tblSet('align', b.dataset.talign)));
    if (el.tlMerge) el.tlMerge.addEventListener('click', mergeTableCells);
    if (el.tlSplit) el.tlSplit.addEventListener('click', splitTableCells);
    if (el.tlDiagonal) el.tlDiagonal.addEventListener('click', toggleTableDiagonal);
    // Picture Format tab
    buildPicMenus(); buildPicStyleGallery(); buildPicBorderMenu();
    if (el.picChange) el.picChange.addEventListener('change', () => { const o = selImage(); const f = el.picChange.files && el.picChange.files[0]; if (o && f) { const r = new FileReader(); r.onload = () => { pushUndo(); o.src = r.result; o.placeholder = false; delete o.crop; captureNatSize(o); picRerender(o); }; r.readAsDataURL(f); } el.picChange.value = ''; });
    if (el.picCropBtn) el.picCropBtn.addEventListener('click', startCrop);
    if (el.picSwap) el.picSwap.addEventListener('click', swapPictures);
    if (el.picCropReset) el.picCropReset.addEventListener('click', resetCrop);
    if (el.picCropFill) el.picCropFill.addEventListener('click', cropToSquare);
    if (el.picReset) el.picReset.addEventListener('click', picResetAdjust);
    if (el.picForward) el.picForward.addEventListener('click', () => reorder('forward'));
    if (el.picBackward) el.picBackward.addEventListener('click', () => reorder('backward'));
    if (el.picFlipH) el.picFlipH.addEventListener('click', () => flip('h'));
    if (el.picFlipV) el.picFlipV.addEventListener('click', () => flip('v'));
    if (el.picW) el.picW.addEventListener('change', () => { const o = selImage(); if (o) { pushUndo(); o.width = Math.max(16, Number(el.picW.value) || num(o.width, 160)); picRerender(o); syncSelUI(); } });
    if (el.picCaptionText) el.picCaptionText.addEventListener('input', () => { const o = selImage(); if (o) { o.caption = el.picCaptionText.value; if (!o.captionStyle || o.captionStyle === 'none') o.captionStyle = 'below'; picRerender(o); } });
    // Home Clipboard / Objects / Arrange / Editing
    el.cutBtn.addEventListener('click', cutSel); el.copyBtn.addEventListener('click', copySel); el.pasteBtn.addEventListener('click', paste);
    el.fmtPainter.addEventListener('click', togglePainter);
    el.hAddText.addEventListener('click', addText);
    el.hAddImage.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) addImageFile(f); e.target.value = ''; });
    el.hForward.addEventListener('click', () => reorder('forward')); el.hBackward.addEventListener('click', () => reorder('backward'));
    el.hGroup.addEventListener('click', groupSel); el.hUngroup.addEventListener('click', ungroupSel);
    el.findReplaceBtn.addEventListener('click', openFindReplace); el.selectAllBtn.addEventListener('click', selectAll);
    if (el.breakApartBtn) el.breakApartBtn.addEventListener('click', breakApartPuzzle);
    el.frClose.addEventListener('click', closeFindReplace);
    el.frModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeFindReplace(); });
    el.frReplaceAll.addEventListener('click', doReplaceAll);
    el.fillColor.addEventListener('input', () => { el.noFill.checked = false; applyShapeProp('fill', el.fillColor.value); });
    el.strokeColor.addEventListener('input', () => applyShapeProp('stroke', el.strokeColor.value));
    el.strokeW.addEventListener('input', () => applyShapeProp('strokeW', Math.max(0, Number(el.strokeW.value) || 0)));
    el.noFill.addEventListener('change', () => applyShapeProp('fill', el.noFill.checked ? 'none' : el.fillColor.value));
    // Tables
    if (el.addTable) el.addTable.addEventListener('click', () => addTable(3, 3));
    if (el.tblAddRow) el.tblAddRow.addEventListener('click', () => tableOp((t) => { t.rows++; }));
    if (el.tblDelRow) el.tblDelRow.addEventListener('click', () => tableOp((t) => { if (t.rows > 1) { t.rows--; t.cells.pop(); } }));
    if (el.tblAddCol) el.tblAddCol.addEventListener('click', () => tableOp((t) => { t.cols++; t.colW.push(90); }));
    if (el.tblDelCol) el.tblDelCol.addEventListener('click', () => tableOp((t) => { if (t.cols > 1) { t.cols--; t.colW.pop(); t.cells.forEach((row) => row.pop()); } }));
    if (el.tblBorder) el.tblBorder.addEventListener('input', () => { const t = selTable(); if (t) { t.borderColor = el.tblBorder.value; redrawTable(t); } });
    if (el.tblHeaderFill) el.tblHeaderFill.addEventListener('input', () => { const t = selTable(); if (t) { t.headerFill = el.tblHeaderFill.value; redrawTable(t); } });
    if (el.tblHeader) el.tblHeader.addEventListener('change', () => { const t = selTable(); if (t) { pushUndo(); t.header = el.tblHeader.checked; redrawTable(t); } });
    // QR codes — Insert button + QR Code contextual tab
    if (el.addQr) el.addQr.addEventListener('click', addQr);
    buildQrStyleGallery();
    if (el.qrUrl) el.qrUrl.addEventListener('change', () => { const q = selQr(); if (q) { pushUndo(); q.url = el.qrUrl.value.trim(); reencodeQr(q); } });
    if (el.qrFg) el.qrFg.addEventListener('input', () => { const q = selQr(); if (q) { q.fg = el.qrFg.value; qrRender(q); } });
    if (el.qrFg) el.qrFg.addEventListener('change', () => { if (selQr()) pushUndo(); });
    if (el.qrBg) el.qrBg.addEventListener('input', () => { const q = selQr(); if (q) { q.bg = el.qrBg.value; qrRender(q); } });
    if (el.qrBg) el.qrBg.addEventListener('change', () => { if (selQr()) pushUndo(); });
    if (el.qrTransparent) el.qrTransparent.addEventListener('change', () => { const q = selQr(); if (q) { pushUndo(); q.bg = el.qrTransparent.checked ? 'none' : (/^#/.test(el.qrBg.value) ? el.qrBg.value : '#ffffff'); qrRender(q); syncQrUI(q); } });
    if (el.qrTest) el.qrTest.addEventListener('click', () => { const q = selQr(); if (q && q.url) window.open(q.url, '_blank', 'noopener'); else setStatus('This QR code has no link yet.', ''); });
    if (el.qrW) el.qrW.addEventListener('change', () => { const q = selQr(); if (q) { pushUndo(); q.w = Math.max(24, Number(el.qrW.value) || num(q.w, 140)); qrRender(q); syncSelUI(); } });
    if (el.qrForward) el.qrForward.addEventListener('click', () => reorder('forward'));
    if (el.qrBackward) el.qrBackward.addEventListener('click', () => reorder('backward'));
    if (el.qrDup) el.qrDup.addEventListener('click', duplicate);
    if (el.qrReset) el.qrReset.addEventListener('click', resetSize);
    if (el.qrHide) el.qrHide.addEventListener('click', hideComp);
    el.groupBtn.addEventListener('click', groupSel); el.ungroupBtn.addEventListener('click', ungroupSel);
    el.borderAll.addEventListener('click', () => { pageModels.forEach((pm) => { pm._border = el.border.value; }); renderPage(); setStatus(el.border.value ? 'Border applied to all pages.' : 'Border override cleared on all pages.', 'ok'); });
    el.mX.addEventListener('change', () => setMeasure('x', Number(el.mX.value) || 0));
    el.mY.addEventListener('change', () => setMeasure('y', Number(el.mY.value) || 0));
    el.mW.addEventListener('change', () => setElSize('w', Number(el.mW.value) || 0));
    el.mH.addEventListener('change', () => setElSize('h', Number(el.mH.value) || 0));
    el.mScale.addEventListener('change', () => setMeasure('scale', Math.max(0.15, (Number(el.mScale.value) || 100) / 100)));
    el.mRot.addEventListener('change', () => setMeasure('rot', Number(el.mRot.value) || 0));
    document.querySelectorAll('.align-grid .iconbtn').forEach((b) => b.addEventListener('click', () => alignSel(b.dataset.align)));
    el.lockObj.addEventListener('click', toggleLock);
    el.dupObj.addEventListener('click', duplicate); el.resetPos.addEventListener('click', resetSize); el.hideObj.addEventListener('click', hideComp); el.deleteObj.addEventListener('click', deleteSel);
    el.border.addEventListener('change', setBorder);
    el.gridToggle.addEventListener('change', () => { if (gridEl) gridEl.style.display = el.gridToggle.checked ? '' : 'none'; });
    el.reroll.addEventListener('click', reroll); el.resetLayout.addEventListener('click', resetLayout);
    if (el.addBlank) el.addBlank.addEventListener('click', insertBlankAfterCurrent);
    if (el.addBlankSide) el.addBlankSide.addEventListener('click', insertBlankAfterCurrent);
    initDropdowns();
    if (el.insertTpl) el.insertTpl.addEventListener('click', openTplPicker);
    if (el.insertTplSide) el.insertTplSide.addEventListener('click', openTplPicker);
    if (el.savePageTpl) el.savePageTpl.addEventListener('click', savePageAsTemplate);
    if (el.changeTplBtn) el.changeTplBtn.addEventListener('click', openChangeTpl);
    if (el.changeTplModal) el.changeTplModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeChangeTpl(); });
    if (el.dupPage) el.dupPage.addEventListener('click', () => { if (cur >= 0) duplicatePage(cur); });
    if (el.aiArtBtn) el.aiArtBtn.addEventListener('click', openAiArt);
    if (el.insertDate) el.insertDate.addEventListener('click', insertDate);
    // Page Design tab
    if (el.renamePage) el.renamePage.addEventListener('click', renamePagePrompt);
    if (el.delPage) el.delPage.addEventListener('click', () => { if (cur >= 0) deletePage(cur); });
    if (el.movePageUp) el.movePageUp.addEventListener('click', () => { if (cur >= 0) movePage(cur, -1); });
    if (el.movePageDown) el.movePageDown.addEventListener('click', () => { if (cur >= 0) movePage(cur, 1); });
    if (el.marginGuide) el.marginGuide.addEventListener('change', applyMarginGuide);
    if (el.alignGuidesChk) el.alignGuidesChk.addEventListener('change', () => { alignGuides = el.alignGuidesChk.checked; });
    if (el.alignObjectsChk) el.alignObjectsChk.addEventListener('change', () => { alignObjects = el.alignObjectsChk.checked; });
    // Drag off a ruler to place a guide: down from the top ruler → horizontal;
    // right from the left ruler → vertical.
    el.rulerTop.addEventListener('pointerdown', (ev) => startRulerCreate(ev, 'h'));
    el.rulerLeft.addEventListener('pointerdown', (ev) => startRulerCreate(ev, 'v'));
    // Master pages
    if (el.editMasterBtn) el.editMasterBtn.addEventListener('click', toggleMaster);
    if (el.exitMasterBtn) el.exitMasterBtn.addEventListener('click', exitMaster);
    if (el.insertPageNo) el.insertPageNo.addEventListener('click', insertPageNumber);
    if (el.masterEnabled) el.masterEnabled.addEventListener('change', () => { master.enabled = el.masterEnabled.checked; if (!masterMode) renderPage(); setStatus(master.enabled ? 'Master overlay shown on pages.' : 'Master overlay hidden.', 'ok'); });
    if (el.masterApplyTo) el.masterApplyTo.addEventListener('change', () => { master.applyTo = el.masterApplyTo.value; if (!masterMode) renderPage(); });
    if (el.masterSkip) el.masterSkip.addEventListener('change', () => { master.skipFirst = Math.max(0, Number(el.masterSkip.value) || 0); if (!masterMode) renderPage(); });
    if (el.masterStart) el.masterStart.addEventListener('change', () => { master.startAt = Number(el.masterStart.value) || 1; if (!masterMode) renderPage(); });
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
    if (el.shareTeamBtn) el.shareTeamBtn.addEventListener('click', shareToTeam);
    if (el.saveMineBtn) el.saveMineBtn.addEventListener('click', saveToMyLibrary);
    renderRecipients();
    parseInvite();
    initWorkspace();
    populateInsertMenus();
    if (el.wordArt) el.wordArt.addEventListener('change', () => { const i = Number(el.wordArt.value); if (WORDART[i]) addWordArt(WORDART[i]); el.wordArt.value = ''; });
    if (el.symbolPick) el.symbolPick.addEventListener('change', () => { addSymbol(el.symbolPick.value); el.symbolPick.value = ''; });
    if (el.tplClose) el.tplClose.addEventListener('click', closeTplPicker);
    if (el.changeTplClose) el.changeTplClose.addEventListener('click', closeChangeTpl);
    if (el.tplModal) el.tplModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeTplPicker(); });
    if (el.puzClose) el.puzClose.addEventListener('click', closePuzzleInsert);
    if (el.puzModal) el.puzModal.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closePuzzleInsert(); });
    if (el.puzInsert) el.puzInsert.addEventListener('click', insertPuzzlePages);
    if (el.puzAudience) el.puzAudience.addEventListener('change', fillPuzDiffOptions);
    if (el.puzType) el.puzType.addEventListener('change', syncPuzTypeUI);
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
    if (el.spreadToggle) el.spreadToggle.addEventListener('change', toggleSpread);
    if (el.viewSingle) el.viewSingle.addEventListener('click', () => setSpreadMode(false));
    if (el.viewSpread) el.viewSpread.addEventListener('click', () => setSpreadMode(true));
    if (el.viewNormal) el.viewNormal.addEventListener('click', exitMaster);
    if (el.viewMaster) el.viewMaster.addEventListener('click', enterMaster);
    el.save.addEventListener('click', save); el.exportPdf.addEventListener('click', exportPdf); el.loadRecipe.addEventListener('change', onLoadRecipe);
    el.stageScroll.addEventListener('scroll', syncRulers);
    // Marquee (rubber-band) select. Capture phase, so we decide BEFORE a piece
    // grabs the press: free elements keep their own click+drag; pressing on the
    // stage background or a puzzle/matter piece starts a rubber-band. A real
    // drag selects the enclosed objects; a plain click just selects the object
    // under the pointer (or clears). An already-selected piece still drags.
    el.stageInner.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || linkPickMode || swapPickMode) return;
      const t = e.target;
      if (!t.closest) return;
      // Interactive chrome handles its own press: resize/rotate handles &
      // selection boxes (sel layer) and draggable ruler guides.
      if (t.closest('.pf-sel-layer') || t.closest('.pf-user-guide') || t.closest('.pf-guide')) return;
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const nodeEl = t.closest('.pf-node');
      if (nodeEl) {
        // Plain press on a free object drags it (its own handler). A modifier
        // press instead starts an additive rubber-band — so you can lasso more
        // objects even when the press lands on top of one — and a modifier click
        // with no drag adds that object to the selection.
        if (!additive) return;
        e.stopPropagation();
        startMarquee(e, true, nodeEl._ref);
        return;
      }
      const pieceNode = t.closest('.pf-piece');
      const pieceRef = pieceNode ? pieceNode._ref : null;
      if (pieceRef && isSel(pieceRef) && !additive) return; // already selected → let it drag
      e.stopPropagation(); // suppress the piece's own select/drag
      startMarquee(e, additive, pieceRef);
    }, true);
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
    if (handoff && handoff.recipe) { currentLibId = handoff.libId || null; workspaceId = handoff.workspaceId || null; loadRecipeObject(handoff.recipe); }
    else if (handoff && (handoff.config || handoff.bookId)) { autoBreak = true; bookConfig = handoff.config || null; openBook(handoff.bookId ? { bookId: handoff.bookId, config: handoff.config } : { config: handoff.config }); }
    else { el.empty.hidden = false; setStatus('Open a book from the Book Builder, or load a recipe.', ''); }
    // Best-effort flush of pending changes when leaving the page.
    window.addEventListener('beforeunload', () => { try { autosaveTick(); } catch (_) { /* */ } });
  }
  // Open a full recipe object (from the library handoff or an imported file).
  function loadRecipeObject(raw) {
    const v2 = raw && raw.recipeVersion === 2 ? raw : { book: raw, seed: raw && raw.seed };
    bookConfig = { ...(v2.book || {}) };
    if (v2.seed != null) bookConfig.seed = v2.seed;
    if (Array.isArray(v2.pagePlan) && v2.pagePlan.length) pendingPlan = v2.pagePlan;
    else if (Array.isArray(v2.pageState) && v2.pageState.length) bookConfig.pageState = v2.pageState;
    return openBook({ config: bookConfig });
  }
  function onKey(e) {
    if (linkPickMode && e.key === 'Escape') { e.preventDefault(); cancelLink(); setStatus('Link cancelled.', ''); return; }
    if (swapPickMode && e.key === 'Escape') { e.preventDefault(); cancelSwap(); setStatus('Swap cancelled.', ''); return; }
    if (cropTarget) { if (e.key === 'Enter') { e.preventDefault(); endCrop(true); } else if (e.key === 'Escape') { e.preventDefault(); endCrop(false); } return; }
    if (el.tplModal && !el.tplModal.hidden) { if (e.key === 'Escape') closeTplPicker(); return; }
    if (el.changeTplModal && !el.changeTplModal.hidden) { if (e.key === 'Escape') closeChangeTpl(); return; }
    if (el.puzModal && !el.puzModal.hidden) { if (e.key === 'Escape') closePuzzleInsert(); return; }
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
        currentLibId = null;           // an imported file becomes a new library book
        loadRecipeObject(raw);
      } catch (_) { setStatus('That file is not a valid book recipe.', 'err'); }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }
  init();
})();
