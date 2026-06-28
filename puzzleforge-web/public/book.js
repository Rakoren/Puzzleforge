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
  }

  function config() {
    return {
      title: el.title.value.trim() || 'My Activity Book',
      subtitle: el.subtitle.value.trim() || null,
      author: el.author.value.trim() || null,
      audience: el.audience.value,
      trimSize: el.trimSize.value,
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
        body: JSON.stringify({ config: config(), cover: coverConfig() }),
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
      el.previewFrame.srcdoc = data.html;
      el.emptyState.classList.add('hidden');
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

  function saveRecipe() {
    const blob = new Blob([JSON.stringify(config(), null, 2)], { type: 'application/json' });
    download(blob, fileBase() + '-book.json');
    setStatus('Book recipe saved.', 'ok');
  }

  function onLoad(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cfg = JSON.parse(reader.result);
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
    el.kdpBundle.addEventListener('click', buildBundle);
    el.saveRecipe.addEventListener('click', saveRecipe);
    el.loadRecipe.addEventListener('change', onLoad);
    el.answerKey.addEventListener('change', () => { invalidate(); updateSummary(); });
    el.uniqueWords.addEventListener('change', invalidate);
    el.shuffle.addEventListener('change', invalidate);
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
    [el.title, el.subtitle, el.author, el.audience, el.trimSize, el.theme].forEach((node) =>
      node.addEventListener('change', invalidate)
    );
  }

  init();
})();
