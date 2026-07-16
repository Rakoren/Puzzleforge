/* PuzzleForge — Worksheets & lesson packets (vanilla JS, no build step). */
(function () {
  const $ = (id) => document.getElementById(id);
  let meta = null;

  const TYPE_LABELS = {
    wordsearch: 'Word Search', numbersearch: 'Number Search', crossword: 'Crossword',
    krisskross: 'Kriss-Kross', wordscramble: 'Word Scramble', sudoku: 'Sudoku', maze: 'Maze',
    cryptogram: 'Cryptogram', nonogram: 'Nonogram', trivia: 'Trivia', logicgrid: 'Logic Grid',
    wordladder: 'Word Ladder', wordwheel: 'Word Wheel', cipher: 'Cipher',
  };
  const typeLabel = (t) => TYPE_LABELS[t] || String(t).replace(/\b\w/g, (c) => c.toUpperCase());
  const TRIM_LABELS = {
    '8.5x11': '8.5 × 11 in — US Letter', '8x10': '8 × 10 in', '8.5x8.5': '8.5 × 8.5 in — Square', '6x9': '6 × 9 in',
  };
  const trimLabel = (t) => TRIM_LABELS[t] || t;

  function setStatus(node, msg, kind) {
    node.textContent = msg || '';
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  // Fill a <select> with the theme list, grouped by category (+ "All <cat>").
  function fillThemeSelect(sel) {
    sel.innerHTML = '';
    const themes = (meta && meta.themes) || [];
    const byCat = {};
    for (const t of themes) (byCat[t.category] = byCat[t.category] || []).push(t);
    Object.keys(byCat).sort().forEach((cat) => {
      const g = document.createElement('optgroup');
      g.label = cat;
      const list = byCat[cat];
      if (list.length > 1) {
        const words = list.reduce((s, t) => s + t.wordCount, 0);
        const o = document.createElement('option');
        o.value = `cat:${cat}`;
        o.textContent = `★ All ${cat} (${list.length} themes, ${words} words)`;
        g.appendChild(o);
      }
      list.forEach((t) => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = `${t.label} (${t.wordCount})`;
        g.appendChild(o);
      });
      sel.appendChild(g);
    });
  }

  function fillTypeSelect(sel) {
    sel.innerHTML = '';
    ((meta && meta.types) || []).forEach((t) => {
      const o = document.createElement('option'); o.value = t; o.textContent = typeLabel(t); sel.appendChild(o);
    });
  }
  function fillTrimSelect(sel) {
    sel.innerHTML = '';
    ((meta && meta.trimSizes) || ['8.5x11']).forEach((t) => {
      const o = document.createElement('option'); o.value = t; o.textContent = trimLabel(t); sel.appendChild(o);
    });
    sel.value = '8.5x11';
  }
  function fillDiffSelect(sel, audience, keep) {
    const kids = String(audience).toLowerCase() === 'kids';
    const opts = (meta && meta.difficulty && (kids ? meta.difficulty.kids : meta.difficulty.adult)) || [];
    const prev = keep != null ? keep : sel.value;
    sel.innerHTML = '';
    (opts.length ? opts : [{ value: 1, label: 'Easy' }, { value: 2, label: 'Medium' }, { value: 3, label: 'Hard' }, { value: 4, label: 'Expert' }])
      .forEach((o) => { const el = document.createElement('option'); el.value = o.value; el.textContent = o.label; sel.appendChild(el); });
    if (prev != null && [...sel.options].some((o) => o.value === String(prev))) sel.value = prev;
  }

  // ---------------- Single worksheet ----------------
  const sheet = {
    type: $('wsType'), diff: $('wsDiff'), theme: $('wsTheme'), audience: $('wsAudience'), trim: $('wsTrim'),
    classField: $('wsClass'), footer: $('wsFooter'), answer: $('wsAnswer'),
    pdf: $('wsPdf'), refresh: $('wsRefresh'), status: $('wsStatus'), preview: $('wsPreview'),
  };
  function sheetRecipe() {
    return {
      type: sheet.type.value, difficulty: Number(sheet.diff.value) || 1,
      theme: sheet.theme.value, audience: sheet.audience.value, trimSize: sheet.trim.value,
    };
  }
  function sheetHeader() {
    return { classField: sheet.classField.checked, footer: sheet.footer.value.trim() };
  }
  let sheetSeq = 0;
  async function refreshPreview() {
    const seq = ++sheetSeq;
    clearTimeout(refreshPreview._t);
    refreshPreview._t = setTimeout(async () => {
      setStatus(sheet.status, 'Building preview…', 'busy');
      try {
        const res = await fetch('/api/worksheet/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe: sheetRecipe(), header: sheetHeader() }),
        });
        const data = await res.json();
        if (seq !== sheetSeq) return;
        if (!res.ok) throw new Error(data.error || 'Preview failed');
        sheet.preview.srcdoc = data.html; // fitPreview runs on load
        setStatus(sheet.status, '', '');
      } catch (err) {
        if (seq === sheetSeq) setStatus(sheet.status, err.message, 'err');
      }
    }, 250);
  }
  async function downloadWorksheet() {
    sheet.pdf.disabled = true;
    setStatus(sheet.status, 'Building PDF…', 'busy');
    try {
      const res = await fetch('/api/worksheet/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe: sheetRecipe(), header: sheetHeader(), answerKey: sheet.answer.checked }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
      await saveBlob(res, 'worksheet.pdf');
      setStatus(sheet.status, 'Downloaded.', 'ok');
    } catch (err) {
      setStatus(sheet.status, err.message, 'err');
    } finally {
      sheet.pdf.disabled = false;
    }
  }

  // ---------------- Lesson packet ----------------
  const pk = {
    cover: $('pkCover'), contents: $('pkContents'), title: $('pkTitle'), kicker: $('pkKicker'), subtitle: $('pkSubtitle'),
    teacher: $('pkTeacher'), className: $('pkClass'), objective: $('pkObjective'), standards: $('pkStandards'),
    theme: $('pkTheme'), audience: $('pkAudience'), trim: $('pkTrim'), rows: $('pkRows'), addRow: $('pkAddRow'),
    summary: $('pkSummary'), answers: $('pkAnswers'), headerClass: $('pkHeaderClass'), footer: $('pkFooter'),
    pdf: $('pkPdf'), status: $('pkStatus'),
  };
  let packetRows = [];
  function renderPacketRows() {
    pk.rows.innerHTML = '';
    packetRows.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'ws-row';
      const type = document.createElement('select');
      fillTypeSelect(type); type.value = r.type; type.title = 'Puzzle type';
      type.addEventListener('change', () => { r.type = type.value; updatePacketSummary(); });
      const diff = document.createElement('select');
      fillDiffSelect(diff, pk.audience.value, r.difficulty); diff.title = 'Difficulty';
      diff.addEventListener('change', () => { r.difficulty = Number(diff.value) || 1; updatePacketSummary(); });
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'iconbtn del'; del.textContent = '✕'; del.title = 'Remove';
      del.addEventListener('click', () => { packetRows.splice(i, 1); renderPacketRows(); updatePacketSummary(); });
      div.appendChild(type); div.appendChild(diff); div.appendChild(del);
      pk.rows.appendChild(div);
    });
  }
  function updatePacketSummary() {
    const n = packetRows.length;
    const key = pk.answers.checked ? ' + answer key' : '';
    pk.summary.textContent = n ? `${n} worksheet${n === 1 ? '' : 's'}${pk.cover.checked ? ' + cover' : ''}${key}.` : 'Add at least one puzzle.';
  }
  async function downloadPacket() {
    if (!packetRows.length) { setStatus(pk.status, 'Add at least one puzzle to the packet.', 'err'); return; }
    pk.pdf.disabled = true;
    setStatus(pk.status, 'Building packet… this can take a few seconds.', 'busy');
    try {
      const body = {
        trimSize: pk.trim.value, audience: pk.audience.value, theme: pk.theme.value,
        answers: pk.answers.checked ? 'end' : 'none',
        header: { classField: pk.headerClass.checked, footer: pk.footer.value.trim() },
        cover: {
          enabled: pk.cover.checked, showContents: pk.contents.checked,
          title: pk.title.value.trim() || 'Lesson Packet', subtitle: pk.subtitle.value.trim(),
          kicker: pk.kicker.value.trim() || 'Lesson Packet', teacher: pk.teacher.value.trim(),
          className: pk.className.value.trim(), objective: pk.objective.value.trim(), standards: pk.standards.value.trim(),
        },
        pages: packetRows.map((r) => ({ type: r.type, difficulty: r.difficulty, label: `${typeLabel(r.type)} — ${diffText(r.difficulty)}` })),
      };
      const res = await fetch('/api/packet/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
      await saveBlob(res, 'lesson-packet.pdf');
      setStatus(pk.status, 'Downloaded.', 'ok');
    } catch (err) {
      setStatus(pk.status, err.message, 'err');
    } finally {
      pk.pdf.disabled = false;
    }
  }
  function diffText(d) {
    const kids = String(pk.audience.value).toLowerCase() === 'kids';
    const opts = (meta && meta.difficulty && (kids ? meta.difficulty.kids : meta.difficulty.adult)) || [];
    const o = opts.find((x) => String(x.value) === String(d));
    return o ? o.label : `L${d}`;
  }

  // Scale the fixed-width worksheet page down to fit the preview panel.
  function fitPreview() {
    try {
      const doc = sheet.preview.contentDocument;
      if (!doc || !doc.body) return;
      const w = Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth) || 640;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) || 900;
      const frame = sheet.preview.parentElement;
      const scale = Math.min(1, (frame.clientWidth - 2) / w);
      sheet.preview.classList.add('ws-preview-scale');
      sheet.preview.style.width = w + 'px';
      sheet.preview.style.height = h + 'px';
      sheet.preview.style.transform = `scale(${scale})`;
      frame.style.height = Math.ceil(h * scale) + 'px';
    } catch (_) { /* cross-origin can't happen with srcdoc */ }
  }

  async function saveBlob(res, fallbackName) {
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="([^"]+)"/.exec(cd);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = (m && m[1]) || fallbackName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---------------- mode switch ----------------
  function setMode(packet) {
    $('sheetView').classList.toggle('hidden', packet);
    $('packetView').classList.toggle('hidden', !packet);
    $('modeSheet').classList.toggle('active', !packet);
    $('modePacket').classList.toggle('active', packet);
    document.querySelector('.ws-preview-frame').classList.toggle('hidden', packet);
    $('packetPreview').classList.toggle('hidden', !packet);
    $('previewNote').textContent = packet ? 'Lesson packet — structure' : 'Single worksheet — front page';
    if (!packet) refreshPreview();
  }

  async function init() {
    try { meta = await (await fetch('/api/meta')).json(); }
    catch (_) { setStatus(sheet.status, 'Could not load puzzle options.', 'err'); return; }

    // Single worksheet
    fillTypeSelect(sheet.type); fillThemeSelect(sheet.theme); fillTrimSelect(sheet.trim);
    fillDiffSelect(sheet.diff, sheet.audience.value, 1);
    [sheet.type, sheet.diff, sheet.theme, sheet.trim, sheet.classField, sheet.footer]
      .forEach((n) => n.addEventListener(n.tagName === 'INPUT' && n.type === 'text' ? 'input' : 'change', refreshPreview));
    sheet.audience.addEventListener('change', () => { fillDiffSelect(sheet.diff, sheet.audience.value); refreshPreview(); });
    sheet.refresh.addEventListener('click', refreshPreview);
    sheet.pdf.addEventListener('click', downloadWorksheet);
    sheet.preview.addEventListener('load', fitPreview);
    window.addEventListener('resize', fitPreview);

    // Packet
    fillThemeSelect(pk.theme); fillTrimSelect(pk.trim);
    packetRows = [{ type: (meta.types || ['wordsearch'])[0], difficulty: 1 }, { type: 'wordscramble', difficulty: 2 }];
    renderPacketRows(); updatePacketSummary();
    pk.audience.addEventListener('change', () => { renderPacketRows(); });
    pk.addRow.addEventListener('click', () => { packetRows.push({ type: (meta.types || ['wordsearch'])[0], difficulty: 1 }); renderPacketRows(); updatePacketSummary(); });
    [pk.cover, pk.contents, pk.answers].forEach((n) => n.addEventListener('change', updatePacketSummary));
    pk.pdf.addEventListener('click', downloadPacket);

    $('modeSheet').addEventListener('click', () => setMode(false));
    $('modePacket').addEventListener('click', () => setMode(true));

    refreshPreview();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
