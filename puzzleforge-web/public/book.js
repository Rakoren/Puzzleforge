/* PuzzleForge Web — Book Builder (vanilla JS). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    title: $('title'),
    subtitle: $('subtitle'),
    author: $('author'),
    audience: $('audience'),
    trimSize: $('trimSize'),
    fontScale: $('fontScale'),
    fontFamily: $('fontFamily'),
    border: $('border'),
    borderColor: $('borderColor'),
    difficultyCurve: $('difficultyCurve'),
    runChecklist: $('runChecklist'),
    checklist: $('checklist'),
    openEditor: $('openEditor'),
    theme: $('theme'),
    themeFilter: $('themeFilter'),
    answerKey: $('answerKey'),
    uniqueWords: $('uniqueWords'),
    shuffle: $('shuffle'),
    copyrightPage: $('copyrightPage'),
    belongsToPage: $('belongsToPage'),
    intro: $('intro'),
    pageNumbers: $('pageNumbers'),
    footerText: $('footerText'),
    about: $('about'),
    moreBooks: $('moreBooks'),
    betweenColoring: $('betweenColoring'),
    betweenDrawing: $('betweenDrawing'),
    betweenBlank: $('betweenBlank'),
    coloringStyle: $('coloringStyle'),
    afterLast: $('afterLast'),
    bleedGuard: $('bleedGuard'),
    breatherFact: $('breatherFact'),
    breatherQuote: $('breatherQuote'),
    breatherDivider: $('breatherDivider'),
    breatherBlank: $('breatherBlank'),
    breatherThemed: $('breatherThemed'),
    coverBg: $('coverBg'),
    coverText: $('coverText'),
    coverPaper: $('coverPaper'),
    coverBlurb: $('coverBlurb'),
    mdSeriesName: $('mdSeriesName'),
    mdSeriesNumber: $('mdSeriesNumber'),
    mdDescription: $('mdDescription'),
    mdKeywords: $('mdKeywords'),
    mdCategories: $('mdCategories'),
    mdReadingAge: $('mdReadingAge'),
    mdAiText: $('mdAiText'),
    mdAiImages: $('mdAiImages'),
    mdListPrice: $('mdListPrice'),
    estimateRoyalty: $('estimateRoyalty'),
    royaltyOut: $('royaltyOut'),
    kdpBundle: $('kdpBundle'),
    kdpStatus: $('kdpStatus'),
    rows: $('rows'),
    addRow: $('addRow'),
    summary: $('summary'),
    preview: $('preview'),
    buildPdf: $('buildPdf'),
    saveRecipe: $('saveRecipe'),
    loadRecipe: $('loadRecipe'),
    status: $('status'),
    previewFrame: $('previewFrame'),
    emptyState: $('emptyState'),
    pageInfo: $('pageInfo'),
    editPanel: $('editPanel'),
    editList: $('editList'),
  };

  const TYPE_NAMES = {
    wordsearch: 'Word Search', numbersearch: 'Number Search', sudoku: 'Sudoku',
    maze: 'Maze', cryptogram: 'Cryptogram', wordscramble: 'Word Scramble',
    crossword: 'Crossword', krisskross: 'Kriss-Kross', nonogram: 'Nonogram', trivia: 'Trivia Quiz',
    coloring: 'Coloring Page', drawing: 'Drawing Page', bleedguard: 'Blank (bleed guard)',
  };
  const DIFFICULTIES = [
    ['1', 'Easy'], ['2', 'Medium'], ['3', 'Hard'],
    ['1-2', 'Easy–Med'], ['2-3', 'Med–Hard'], ['1-3', 'Mixed'],
  ];

  let meta = null;
  let rows = []; // [{ type, count, difficulty }]
  let lastBookId = null;
  let currentSeed = null; // locked seed from a loaded recipe (reproduces structure)
  let lastSeed = null; // seed of the most recent preview (saved into the recipe)
  let pageState = []; // recipe v2 per-page overrides / canvasState (by page index)
  const RECIPE_V = 2;

  function setStatus(text, kind) {
    el.status.textContent = text || '';
    el.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function addRow(row) {
    rows.push(row || { type: meta.types[0], count: 4, difficulty: '1' });
    renderRows();
    invalidate();
  }

  function renderRows() {
    el.rows.innerHTML = '';
    rows.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'prow';

      const type = document.createElement('select');
      for (const t of meta.types) {
        const o = document.createElement('option');
        o.value = t;
        o.textContent = TYPE_NAMES[t] || t;
        if (t === row.type) o.selected = true;
        type.appendChild(o);
      }
      type.addEventListener('change', () => { row.type = type.value; invalidate(); });

      const count = document.createElement('input');
      count.type = 'number';
      count.min = '1';
      count.max = '40';
      count.value = row.count;
      count.title = 'How many';
      count.addEventListener('input', () => { row.count = Number(count.value) || 1; invalidate(); updateSummary(); });

      const diff = document.createElement('select');
      for (const [v, label] of DIFFICULTIES) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = label;
        if (v === String(row.difficulty)) o.selected = true;
        diff.appendChild(o);
      }
      diff.addEventListener('change', () => { row.difficulty = diff.value; invalidate(); });

      const move = document.createElement('div');
      move.className = 'move';
      const up = iconBtn('▲', 'Move up', () => reorder(i, i - 1));
      const down = iconBtn('▼', 'Move down', () => reorder(i, i + 1));
      move.appendChild(up);
      move.appendChild(down);

      const del = iconBtn('✕', 'Remove', () => { rows.splice(i, 1); renderRows(); invalidate(); updateSummary(); });
      del.classList.add('del');

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '4px';
      controls.appendChild(move);
      controls.appendChild(del);

      div.appendChild(type);
      div.appendChild(count);
      div.appendChild(diff);
      div.appendChild(controls);
      el.rows.appendChild(div);
    });
    updateSummary();
  }

  function iconBtn(text, title, onClick) {
    const b = document.createElement('button');
    b.className = 'iconbtn';
    b.type = 'button';
    b.textContent = text;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  function reorder(from, to) {
    if (to < 0 || to >= rows.length) return;
    const [r] = rows.splice(from, 1);
    rows.splice(to, 0, r);
    renderRows();
    invalidate();
  }

  function totalPuzzles() {
    return rows.reduce((n, r) => n + (Number(r.count) || 0), 0);
  }

  function updateSummary() {
    const total = totalPuzzles();
    if (!total) { el.summary.textContent = 'No puzzles yet.'; return; }
    const gaps = el.afterLast.checked ? total : Math.max(0, total - 1);
    const fillers = gaps * interleaveKinds().length;
    const breathers = Math.max(0, rows.length - 1) * breatherKinds().length;
    // Rough estimate of blank guards: one behind each coloring/drawing page.
    const drawableFillers = (el.betweenColoring.checked ? 1 : 0) + (el.betweenDrawing.checked ? 1 : 0);
    const drawableRows = rows.reduce(
      (n, r) => n + (r.type === 'coloring' || r.type === 'drawing' ? Number(r.count) || 0 : 0),
      0
    );
    const guards = el.bleedGuard.checked ? gaps * drawableFillers + drawableRows : 0;
    const front = (el.copyrightPage.checked ? 1 : 0) + (el.belongsToPage.checked ? 1 : 0) + (el.intro.value.trim() ? 1 : 0);
    const back = (el.about.value.trim() ? 1 : 0) + (el.moreBooks.value.trim() ? 1 : 0);
    const pages = 1 + front + total + fillers + guards + breathers + (el.answerKey.checked ? 1 : 0) + back;
    const fillerNote = fillers ? ` + ${fillers} insert pages` : '';
    el.summary.textContent = `${total} puzzles${fillerNote} · ~${pages} pages (title + puzzles + answer key)`;
  }

  // Invalidate the cached/built book when settings change.
  function invalidate() {
    lastBookId = null;
    el.buildPdf.disabled = true;
    el.editPanel.classList.add('hidden');
    el.editList.innerHTML = '';
  }

  // List drawing/coloring pages with an editable subject (datalist of choices).
  function renderEditable(editable) {
    el.editList.innerHTML = '';
    if (!editable.length) { el.editPanel.classList.add('hidden'); return; }
    el.editPanel.classList.remove('hidden');
    editable.forEach((ep, i) => {
      const row = document.createElement('div');
      row.className = 'edit-row';

      const label = document.createElement('span');
      label.className = 'edit-label';
      label.textContent = `${ep.type === 'drawing' ? '✎' : '🎨'} ${ep.label || ep.current}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.value = ep.current || '';
      input.setAttribute('list', `choices-${i}`);
      input.title = 'Pick or type a subject';

      const list = document.createElement('datalist');
      list.id = `choices-${i}`;
      for (const w of ep.choices || []) {
        const o = document.createElement('option');
        o.value = w;
        list.appendChild(o);
      }

      input.addEventListener('change', () => {
        const word = input.value.trim();
        if (word && word.toUpperCase() !== String(ep.current).toUpperCase()) applyEdit(ep.index, word);
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(list);
      el.editList.appendChild(row);
    });
  }

  async function applyEdit(index, word) {
    if (!lastBookId) { setStatus('Preview the book again before editing.', 'err'); return; }
    setStatus('Updating page…', 'busy');
    try {
      const res = await fetch('/api/book/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: lastBookId, index, word }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update page');
      el.previewFrame.srcdoc = data.html;
      renderEditable(data.editable || []);
      setStatus('Page updated.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    }
  }

  function config() {
    return {
      title: el.title.value.trim() || 'My Activity Book',
      subtitle: el.subtitle.value.trim() || null,
      author: el.author.value.trim() || null,
      audience: el.audience.value,
      trimSize: el.trimSize.value,
      fontScale: Number(el.fontScale.value) || 1,
      fontFamily: el.fontFamily.value,
      border: el.border.value,
      borderColor: el.borderColor.value,
      difficultyCurve: el.difficultyCurve.value || undefined,
      theme: el.theme.value,
      answerKey: el.answerKey.checked,
      uniqueWords: el.uniqueWords.checked,
      shuffle: el.shuffle.checked,
      copyright: el.copyrightPage.checked,
      belongsTo: el.belongsToPage.checked,
      intro: el.intro.value.trim() || null,
      pageNumbers: el.pageNumbers.checked,
      footerText: el.footerText.value.trim() || null,
      about: el.about.value.trim() || null,
      moreBooks: el.moreBooks.value.trim() || null,
      interleave: interleaveKinds(),
      interleaveAfterLast: el.afterLast.checked,
      coloringStyle: el.coloringStyle.value,
      bleedGuard: el.bleedGuard.checked,
      breathers: breatherKinds(),
      breatherThemeMatched: el.breatherThemed.checked,
      metadata: metadata(),
      coverBg: el.coverBg.value,
      coverText: el.coverText.value,
      // Locked seed (from a loaded recipe) reproduces the page structure; omitted
      // for a fresh book so each preview re-rolls.
      ...(currentSeed != null ? { seed: currentSeed } : {}),
      ...(pageState.length ? { pageState } : {}),
      puzzleforgeBook: 1,
      puzzles: rows.map((r) => ({ type: r.type, count: Number(r.count) || 1, difficulty: r.difficulty })),
    };
  }

  function interleaveKinds() {
    const kinds = [];
    if (el.betweenColoring.checked) kinds.push('coloring');
    if (el.betweenDrawing.checked) kinds.push('drawing');
    if (el.betweenBlank.checked) kinds.push('blank');
    return kinds;
  }

  function breatherKinds() {
    const kinds = [];
    if (el.breatherFact.checked) kinds.push('fact');
    if (el.breatherQuote.checked) kinds.push('quote');
    if (el.breatherDivider.checked) kinds.push('divider');
    if (el.breatherBlank.checked) kinds.push('blank');
    return kinds;
  }

  function coverConfig() {
    return {
      bgColor: el.coverBg.value,
      backColor: el.coverBg.value,
      textColor: el.coverText.value,
      paper: el.coverPaper.value,
      blurb: el.coverBlurb.value.trim() || null,
    };
  }

  function metadata() {
    return {
      seriesName: el.mdSeriesName.value.trim(),
      seriesNumber: el.mdSeriesNumber.value.trim(),
      description: el.mdDescription.value.trim() || el.coverBlurb.value.trim(),
      keywords: el.mdKeywords.value,
      categories: el.mdCategories.value,
      readingAge: el.mdReadingAge.value.trim(),
      paper: el.coverPaper.value,
      listPrice: el.mdListPrice.value || null,
      aiText: el.mdAiText.checked,
      aiImages: el.mdAiImages.checked,
    };
  }

  async function estimateRoyalty() {
    el.royaltyOut.classList.remove('hidden');
    el.royaltyOut.innerHTML = '<p class="chk-busy">Rendering the book and estimating…</p>';
    el.estimateRoyalty.disabled = true;
    try {
      const res = await fetch('/api/book/royalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          lastBookId
            ? { bookId: lastBookId, listPrice: el.mdListPrice.value || null }
            : { config: config(), listPrice: el.mdListPrice.value || null }
        ),
      });
      const e = await res.json();
      if (!res.ok) throw new Error(e.error || 'Estimate failed');
      const usd = (n) => (n == null ? '—' : '$' + Number(n).toFixed(2));
      const royaltyLine =
        e.royalty != null
          ? `<div class="roy-row"><span>Royalty at ${usd(e.listPrice)}</span><strong class="${e.belowMinimum ? 'roy-bad' : 'roy-good'}">${usd(e.royalty)}/sale${e.belowMinimum ? ' (below breakeven!)' : ''}</strong></div>`
          : '<div class="roy-row"><span>Royalty</span><span>enter a list price</span></div>';
      el.royaltyOut.innerHTML =
        `<div class="roy-row"><span>${e.pageCount} pages, B&W</span><span>print cost ${usd(e.printCost)}</span></div>` +
        `<div class="roy-row"><span>Breakeven (min price)</span><strong>${usd(e.breakeven)}</strong></div>` +
        `<div class="roy-row"><span>Suggested range</span><strong>${usd(e.suggestedLow)} – ${usd(e.suggestedHigh)}</strong></div>` +
        royaltyLine;
    } catch (err) {
      el.royaltyOut.innerHTML = `<p class="chk-busy">${err.message}</p>`;
    } finally {
      el.estimateRoyalty.disabled = false;
    }
  }

  function setKdpStatus(text, kind) {
    el.kdpStatus.textContent = text || '';
    el.kdpStatus.className = 'status' + (kind ? ' ' + kind : '');
  }

  async function buildBundle() {
    if (!rows.length) { setKdpStatus('Add at least one puzzle first.', 'err'); return; }
    setKdpStatus('Building interior + cover… (this can take a while)', 'busy');
    el.kdpBundle.disabled = true;
    try {
      const res = await fetch('/api/book/kdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: config(), cover: coverConfig(), metadata: metadata() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'KDP export failed');
      }
      const blob = await res.blob();
      download(blob, fileBase() + '-kdp.zip');
      setKdpStatus('KDP bundle downloaded — interior.pdf, cover.pdf, build-info.txt.', 'ok');
    } catch (err) {
      setKdpStatus(err.message, 'err');
    } finally {
      el.kdpBundle.disabled = false;
    }
  }

  async function preview() {
    if (!rows.length) { setStatus('Add at least one puzzle first.', 'err'); return; }
    setStatus('Building book… (this can take a few seconds)', 'busy');
    el.preview.disabled = true;
    try {
      const res = await fetch('/api/book/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: config() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build book');
      lastBookId = data.bookId;
      if (data.seed != null) lastSeed = data.seed; // saved into the recipe
      el.previewFrame.srcdoc = data.html;
      el.emptyState.classList.add('hidden');
      renderEditable(data.editable || []);
      const m = data.meta;
      const types = Object.entries(m.byType).map(([t, n]) => `${n} ${TYPE_NAMES[t] || t}`).join(', ');
      setStatus(`Built “${m.title}” — ${m.puzzleCount} puzzles (${types}).`, 'ok');
      el.pageInfo.textContent = `~${m.pages} pages · ${m.trimSize}"`;
      el.buildPdf.disabled = false;
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.preview.disabled = false;
    }
  }

  async function buildPdf() {
    setStatus('Rendering PDF…', 'busy');
    el.buildPdf.disabled = true;
    try {
      const res = await fetch('/api/book/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lastBookId ? { bookId: lastBookId } : { config: config() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'PDF export failed');
      }
      const blob = await res.blob();
      download(blob, fileBase() + '.pdf');
      setStatus('PDF downloaded.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.buildPdf.disabled = false;
    }
  }

  async function runChecklist() {
    el.checklist.classList.remove('hidden');
    el.checklist.innerHTML = '<p class="chk-busy">Rendering the book and running checks…</p>';
    el.runChecklist.disabled = true;
    try {
      const res = await fetch('/api/book/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lastBookId ? { bookId: lastBookId, config: config() } : { config: config() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checklist failed');
      renderChecklist(data);
    } catch (err) {
      el.checklist.innerHTML = `<p class="chk-busy">${err.message}</p>`;
    } finally {
      el.runChecklist.disabled = false;
    }
  }

  function renderChecklist(data) {
    const icon = (it) => (it.status === 'pass' ? '🟢' : it.severity === 'blocker' ? '🔴' : '🟡');
    const s = data.summary;
    const head =
      `<div class="chk-summary">${data.pageCount} pages · ` +
      `<strong>${s.blockers}</strong> blocker${s.blockers === 1 ? '' : 's'}, ` +
      `<strong>${s.warnings}</strong> warning${s.warnings === 1 ? '' : 's'}, ` +
      `${s.passes} passed</div>`;
    const rows = data.items
      .map(
        (it) =>
          `<div class="chk-row chk-${it.status}"><span class="chk-ic">${icon(it)}</span>` +
          `<span class="chk-label">${it.label}${it.message ? ` — <span class="chk-msg">${it.message}</span>` : ''}</span></div>`
      )
      .join('');
    el.checklist.innerHTML = head + rows;
  }

  function fileBase() {
    return (el.title.value.trim() || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'book';
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openEditor() {
    if (!rows.length) { setStatus('Add at least one puzzle first.', 'err'); return; }
    try {
      localStorage.setItem('pf_editor', JSON.stringify({ config: config(), bookId: lastBookId }));
    } catch (_) {
      setStatus('Could not open the editor (storage blocked).', 'err');
      return;
    }
    window.location.href = 'editor.html';
  }

  function saveRecipe() {
    // v2 recipe: book config + the previewed seed + per-page state layer.
    const book = config();
    const seed = currentSeed != null ? currentSeed : lastSeed;
    delete book.seed;
    delete book.pageState;
    delete book.puzzleforgeBook;
    const recipe = { recipeVersion: RECIPE_V, kind: 'book', book, seed: seed != null ? seed : null, pageState };
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' });
    download(blob, fileBase() + '-book.json');
    setStatus('Book recipe saved.', 'ok');
  }

  // Normalize a loaded recipe (v1 bare config or v2 wrapper) to { cfg, seed, pageState }.
  function migrateRecipe(raw) {
    if (raw && raw.recipeVersion === 2) {
      return {
        cfg: raw.book || {},
        seed: Number.isFinite(raw.seed) ? raw.seed : null,
        pageState: Array.isArray(raw.pageState) ? raw.pageState : [],
      };
    }
    // v1: the file *is* the book config.
    return { cfg: raw || {}, seed: null, pageState: [] };
  }

  function onLoad(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        const { cfg, seed, pageState: ps } = migrateRecipe(raw);
        currentSeed = seed; // reproduce the saved structure
        lastSeed = seed;
        pageState = ps;
        applyConfig(cfg);
        setStatus('Recipe loaded — press Preview book.', 'ok');
      } catch (_) {
        setStatus('That file is not a valid book recipe.', 'err');
      }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }

  function applyConfig(cfg) {
    el.title.value = cfg.title || '';
    el.subtitle.value = cfg.subtitle || '';
    el.author.value = cfg.author || '';
    if (cfg.audience) el.audience.value = cfg.audience;
    if (cfg.trimSize) el.trimSize.value = cfg.trimSize;
    if (cfg.border) el.border.value = cfg.border;
    if (cfg.borderColor) el.borderColor.value = cfg.borderColor;
    if (cfg.difficultyCurve) el.difficultyCurve.value = cfg.difficultyCurve;
    if (cfg.coverBg) el.coverBg.value = cfg.coverBg;
    if (cfg.coverText) el.coverText.value = cfg.coverText;
    const md = cfg.metadata || {};
    el.mdSeriesName.value = md.seriesName || '';
    el.mdSeriesNumber.value = md.seriesNumber || '';
    el.mdDescription.value = md.description || '';
    el.mdKeywords.value = Array.isArray(md.keywords) ? md.keywords.join('\n') : (md.keywords || '');
    el.mdCategories.value = Array.isArray(md.categories) ? md.categories.join('\n') : (md.categories || '');
    el.mdReadingAge.value = md.readingAge || '';
    el.mdListPrice.value = md.listPrice != null ? md.listPrice : '';
    el.mdAiText.checked = Boolean(md.aiText);
    el.mdAiImages.checked = Boolean(md.aiImages);
    if (md.paper) el.coverPaper.value = md.paper;
    if (cfg.fontScale) el.fontScale.value = String(cfg.fontScale);
    if (cfg.fontFamily) el.fontFamily.value = cfg.fontFamily;
    if (cfg.theme) el.theme.value = cfg.theme;
    el.answerKey.checked = cfg.answerKey !== false;
    el.uniqueWords.checked = cfg.uniqueWords === true;
    el.shuffle.checked = cfg.shuffle === true;
    el.copyrightPage.checked = cfg.copyright !== false;
    el.belongsToPage.checked = cfg.belongsTo === true;
    el.intro.value = cfg.intro || '';
    el.pageNumbers.checked = cfg.pageNumbers === true;
    el.footerText.value = cfg.footerText || '';
    el.about.value = cfg.about || '';
    el.moreBooks.value = cfg.moreBooks || '';
    const inter = Array.isArray(cfg.interleave) ? cfg.interleave : [];
    el.betweenColoring.checked = inter.includes('coloring');
    el.betweenDrawing.checked = inter.includes('drawing');
    el.betweenBlank.checked = inter.includes('blank');
    el.afterLast.checked = cfg.interleaveAfterLast === true;
    el.bleedGuard.checked = cfg.bleedGuard !== false;
    if (cfg.coloringStyle) el.coloringStyle.value = cfg.coloringStyle;
    const br = Array.isArray(cfg.breathers) ? cfg.breathers : [];
    el.breatherFact.checked = br.includes('fact');
    el.breatherQuote.checked = br.includes('quote');
    el.breatherDivider.checked = br.includes('divider');
    el.breatherBlank.checked = br.includes('blank');
    el.breatherThemed.checked = cfg.breatherThemeMatched !== false;
    rows = (cfg.puzzles || []).map((p) => ({
      type: p.type,
      count: p.count || 1,
      difficulty: String(p.difficulty || '1'),
    }));
    renderRows();
    invalidate();
  }

  // Build the theme <select> grouped by category from a (possibly filtered) list.
  function populateThemes(themes) {
    el.theme.innerHTML = '';
    const byCat = {};
    for (const th of themes) (byCat[th.category] = byCat[th.category] || []).push(th);
    const cats = Object.keys(byCat).sort();

    // Whole-category bundles: pick a category to use every theme in it, merged.
    if (cats.length) {
      const bundles = document.createElement('optgroup');
      bundles.label = 'Whole categories';
      for (const cat of cats) {
        const list = byCat[cat];
        const words = list.reduce((s, t) => s + t.wordCount, 0);
        const o = document.createElement('option');
        o.value = `cat:${cat}`;
        o.textContent = `★ All ${cat} (${list.length} themes, ${words} words)`;
        bundles.appendChild(o);
      }
      el.theme.appendChild(bundles);
    }

    for (const cat of cats) {
      const group = document.createElement('optgroup');
      group.label = cat;
      for (const th of byCat[cat]) {
        const o = document.createElement('option');
        o.value = th.id;
        o.textContent = `${th.label} (${th.wordCount})`;
        group.appendChild(o);
      }
      el.theme.appendChild(group);
    }
  }

  function themeMatches(theme, q) {
    if (!q) return true;
    const hay = [theme.label, theme.category, theme.id, ...(theme.tags || [])]
      .join(' ')
      .toLowerCase();
    return q.split(/\s+/).every((term) => hay.includes(term));
  }

  function applyThemeFilter() {
    if (!meta) return;
    const q = el.themeFilter.value.trim().toLowerCase();
    const prev = el.theme.value;
    const filtered = meta.themes.filter((t) => themeMatches(t, q));
    populateThemes(filtered);
    if (filtered.some((t) => t.id === prev)) el.theme.value = prev;
    invalidate();
  }

  async function init() {
    try {
      meta = await (await fetch('/api/meta')).json();
    } catch (_) {
      setStatus('Could not reach the server.', 'err');
      return;
    }
    populateThemes(meta.themes);
    el.themeFilter.addEventListener('input', applyThemeFilter);
    for (const ts of meta.trimSizes) {
      const o = document.createElement('option');
      o.value = ts;
      o.textContent = ts.replace('x', '" × ') + '"';
      el.trimSize.appendChild(o);
    }
    el.trimSize.value = meta.trimSizes.includes('8x10') ? '8x10' : meta.trimSizes[0];
    for (const b of meta.borderStyles || []) {
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.label;
      el.border.appendChild(o);
    }

    // Seed with a sensible starter book.
    rows = [
      { type: 'wordsearch', count: 4, difficulty: '1' },
      { type: 'maze', count: 3, difficulty: '1-2' },
      { type: 'sudoku', count: 3, difficulty: '2' },
    ];
    el.title.value = 'My Activity Book';
    renderRows();

    el.addRow.addEventListener('click', () => addRow());
    el.preview.addEventListener('click', preview);
    el.buildPdf.addEventListener('click', buildPdf);
    el.openEditor.addEventListener('click', openEditor);
    el.runChecklist.addEventListener('click', runChecklist);
    el.kdpBundle.addEventListener('click', buildBundle);
    el.estimateRoyalty.addEventListener('click', estimateRoyalty);
    el.saveRecipe.addEventListener('click', saveRecipe);
    el.loadRecipe.addEventListener('change', onLoad);
    el.answerKey.addEventListener('change', () => { invalidate(); updateSummary(); });
    el.uniqueWords.addEventListener('change', invalidate);
    el.shuffle.addEventListener('change', invalidate);
    el.border.addEventListener('change', invalidate);
    el.borderColor.addEventListener('change', invalidate);
    el.difficultyCurve.addEventListener('change', invalidate);
    el.betweenColoring.addEventListener('change', () => { invalidate(); updateSummary(); });
    el.betweenDrawing.addEventListener('change', () => { invalidate(); updateSummary(); });
    el.betweenBlank.addEventListener('change', () => { invalidate(); updateSummary(); });
    el.afterLast.addEventListener('change', () => { invalidate(); updateSummary(); });
    el.bleedGuard.addEventListener('change', () => { invalidate(); updateSummary(); });
    el.coloringStyle.addEventListener('change', invalidate);
    [el.breatherFact, el.breatherQuote, el.breatherDivider, el.breatherBlank].forEach((n) =>
      n.addEventListener('change', () => { invalidate(); updateSummary(); })
    );
    el.breatherThemed.addEventListener('change', invalidate);
    [el.copyrightPage, el.belongsToPage].forEach((n) => n.addEventListener('change', () => { invalidate(); updateSummary(); }));
    el.intro.addEventListener('input', () => { invalidate(); updateSummary(); });
    el.pageNumbers.addEventListener('change', invalidate);
    el.footerText.addEventListener('input', invalidate);
    el.about.addEventListener('input', () => { invalidate(); updateSummary(); });
    el.moreBooks.addEventListener('input', () => { invalidate(); updateSummary(); });
    [el.title, el.subtitle, el.author, el.audience, el.trimSize, el.fontScale, el.fontFamily, el.theme].forEach((node) =>
      node.addEventListener('change', invalidate)
    );
  }

  init();
})();
