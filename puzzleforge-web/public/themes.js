/* PuzzleForge Web — AI Theme Generator (vanilla JS). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    unavailable: $('unavailable'),
    topic: $('topic'),
    perTier: $('perTier'),
    generate: $('generate'),
    status: $('status'),
    result: $('result'),
    rLabel: $('rLabel'),
    rMeta: $('rMeta'),
    rTags: $('rTags'),
    tierSamples: $('tierSamples'),
    save: $('save'),
    discard: $('discard'),
    saveStatus: $('saveStatus'),
    manageList: $('manageList'),
    themeEditor: $('themeEditor'),
    editorTitle: $('editorTitle'),
    editorClose: $('editorClose'),
    editorBody: $('editorBody'),
    catTopic: $('catTopic'),
    catCount: $('catCount'),
    catGenerate: $('catGenerate'),
    catStatus: $('catStatus'),
    catResult: $('catResult'),
    catList: $('catList'),
    catSave: $('catSave'),
    catDiscard: $('catDiscard'),
    catSaveStatus: $('catSaveStatus'),
  };

  let current = null; // the generated theme object awaiting save

  function setStatus(node, text, kind) {
    node.textContent = text || '';
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  const TIER_NAMES = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

  function wordsOf(tier) {
    return (current.tiers[tier] || []).map((e) => (typeof e === 'string' ? e : e.word));
  }

  function renderResult(data) {
    current = data.theme;
    const counts = data.report.counts;
    el.rLabel.textContent = current.label;
    const total = data.report.total;
    let meta = `${current.category} · ${total} words (${counts['1']} easy, ${counts['2']} medium, ${counts['3']} hard)`;
    if (data.report.factCount) meta += ` · ${data.report.factCount} fun facts`;
    if (data.report.blocked) meta += ` · ${data.report.blocked} removed by filter`;
    el.rMeta.textContent = meta;

    el.rTags.innerHTML = '';
    for (const tag of current.tags) {
      const chip = document.createElement('span');
      chip.className = 'tag';
      chip.textContent = tag;
      el.rTags.appendChild(chip);
    }

    el.tierSamples.innerHTML = '';
    for (const t of ['1', '2', '3']) {
      const block = document.createElement('div');
      block.className = 'tier-block';
      const h = document.createElement('strong');
      h.textContent = `${TIER_NAMES[t]} (${wordsOf(t).length})`;
      const p = document.createElement('p');
      p.className = 'tier-words';
      p.textContent = wordsOf(t).join(', ');
      block.appendChild(h);
      block.appendChild(p);
      el.tierSamples.appendChild(block);
    }

    el.result.classList.remove('hidden');
    setStatus(el.saveStatus, '');
  }

  async function generate() {
    const topic = el.topic.value.trim();
    if (!topic) {
      setStatus(el.status, 'Enter a topic first.', 'err');
      return;
    }
    setStatus(el.status, 'Generating theme… this can take 20–40 seconds.', 'busy');
    el.generate.disabled = true;
    el.result.classList.add('hidden');
    current = null;
    try {
      const res = await fetch('/api/theme/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, wordsPerTier: Number(el.perTier.value) || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      renderResult(data);
      setStatus(el.status, `Generated “${data.theme.label}”. Review the words, then save.`, 'ok');
    } catch (err) {
      setStatus(el.status, err.message, 'err');
    } finally {
      el.generate.disabled = false;
    }
  }

  async function save() {
    if (!current) return;
    setStatus(el.saveStatus, 'Saving…', 'busy');
    el.save.disabled = true;
    try {
      const res = await fetch('/api/theme/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setStatus(
        el.saveStatus,
        `Saved as “${current.label}”. It’s now available in the Puzzle Maker and Book Builder.`,
        'ok'
      );
      el.save.disabled = true;
      el.discard.textContent = 'Make another theme';
      loadThemeList();
    } catch (err) {
      setStatus(el.saveStatus, err.message, 'err');
      el.save.disabled = false;
    }
  }

  function discard() {
    current = null;
    el.result.classList.add('hidden');
    el.save.disabled = false;
    el.discard.textContent = 'Discard & start over';
    el.topic.value = '';
    el.topic.focus();
    setStatus(el.status, '');
  }

  // --- Manage existing themes ---

  async function loadThemeList() {
    let themes = [];
    try {
      const meta = await (await fetch('/api/meta')).json();
      themes = meta.themes || [];
    } catch (_) {
      el.manageList.textContent = 'Could not load themes.';
      return;
    }
    el.manageList.innerHTML = '';
    const byCat = {};
    for (const th of themes) (byCat[th.category] = byCat[th.category] || []).push(th);
    for (const cat of Object.keys(byCat).sort()) {
      const head = document.createElement('div');
      head.className = 'manage-cat';
      head.textContent = cat;
      el.manageList.appendChild(head);
      for (const th of byCat[cat]) el.manageList.appendChild(themeRow(th));
    }
  }

  function themeRow(th) {
    const row = document.createElement('div');
    row.className = 'manage-row';

    const name = document.createElement('span');
    name.className = 'manage-name';
    name.textContent = `${th.label} (${th.wordCount})`;

    const edit = document.createElement('button');
    edit.className = 'iconbtn';
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openEditor(th));

    const clean = document.createElement('button');
    clean.className = 'iconbtn';
    clean.type = 'button';
    clean.textContent = 'Clean';
    clean.addEventListener('click', () => cleanTheme(th, clean));

    const del = document.createElement('button');
    del.className = 'iconbtn del';
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteTheme(th, row));

    const actions = document.createElement('span');
    actions.className = 'manage-actions';
    actions.appendChild(edit);
    actions.appendChild(clean);
    actions.appendChild(del);
    row.appendChild(name);
    row.appendChild(actions);
    return row;
  }

  async function cleanTheme(th, btn) {
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = '…';
    try {
      const res = await fetch('/api/theme/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: th.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clean failed');
      const r = data.report || {};
      setStatus(
        el.saveStatus,
        `Cleaned “${th.label}” — ${r.total} words${data.removed ? `, removed ${data.removed}` : ', nothing to remove'}.`,
        'ok'
      );
      loadThemeList();
    } catch (err) {
      setStatus(el.saveStatus, err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  }

  async function deleteTheme(th, row) {
    if (!window.confirm(`Delete the theme “${th.label}”? This can't be undone.`)) return;
    try {
      const res = await fetch('/api/theme/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: th.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      row.remove();
      setStatus(el.saveStatus, `Deleted “${th.label}”.`, 'ok');
    } catch (err) {
      setStatus(el.saveStatus, err.message, 'err');
    }
  }

  // --- Category generator ---

  let categoryData = null; // { category, themes:[{theme,report,sample}] } awaiting save

  async function categoryGenerate() {
    const topic = el.catTopic.value.trim();
    if (!topic) { setStatus(el.catStatus, 'Enter a broad topic.', 'err'); return; }
    setStatus(el.catStatus, 'Generating a category… this can take a minute or two.', 'busy');
    el.catGenerate.disabled = true;
    el.catResult.classList.add('hidden');
    categoryData = null;
    try {
      const res = await fetch('/api/category/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: Number(el.catCount.value) || 4 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      categoryData = data;
      renderCategory(data);
      setStatus(el.catStatus, `Generated “${data.category}” — ${data.themes.length} themes. Review, then save.`, 'ok');
    } catch (err) {
      setStatus(el.catStatus, err.message, 'err');
    } finally {
      el.catGenerate.disabled = false;
    }
  }

  function renderCategory(data) {
    el.catList.innerHTML = '';
    const head = document.createElement('p');
    head.className = 'hint';
    head.innerHTML = `Category: <strong>${data.category}</strong>`;
    el.catList.appendChild(head);
    for (const item of data.themes) {
      const t = item.theme;
      const c = item.report.counts;
      const row = document.createElement('div');
      row.className = 'tool';
      const total = item.report.total;
      row.innerHTML =
        `<div class="tool-head"><strong>${t.label}</strong>` +
        `<span class="tool-desc">${total} words (${c['1']}/${c['2']}/${c['3']})` +
        `${item.report.factCount ? ` · ${item.report.factCount} facts` : ''}</span></div>`;
      el.catList.appendChild(row);
    }
    el.catResult.classList.remove('hidden');
    setStatus(el.catSaveStatus, '');
  }

  async function categorySaveAll() {
    if (!categoryData) return;
    setStatus(el.catSaveStatus, 'Saving…', 'busy');
    el.catSave.disabled = true;
    try {
      const res = await fetch('/api/category/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: categoryData.category, themes: categoryData.themes.map((x) => x.theme) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setStatus(el.catSaveStatus, `Saved ${data.saved.length} themes under “${categoryData.category}”.`, 'ok');
      el.catSave.disabled = true;
      el.catDiscard.textContent = 'Make another category';
      loadThemeList();
    } catch (err) {
      setStatus(el.catSaveStatus, err.message, 'err');
      el.catSave.disabled = false;
    }
  }

  function categoryDiscard() {
    categoryData = null;
    el.catResult.classList.add('hidden');
    el.catSave.disabled = false;
    el.catDiscard.textContent = 'Discard';
    el.catTopic.value = '';
    setStatus(el.catStatus, '');
  }

  // --- Theme word/fact editor ---

  let editing = null; // current theme id being edited

  const TIER_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

  async function openEditor(th) {
    editing = th.id;
    el.editorTitle.textContent = `Edit: ${th.label}`;
    el.editorBody.innerHTML = 'Loading…';
    el.themeEditor.classList.remove('hidden');
    el.themeEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
      const res = await fetch('/api/theme/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: th.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load theme');
      renderEditor(data);
    } catch (err) {
      el.editorBody.textContent = err.message;
    }
  }

  function renderEditor(theme) {
    el.editorBody.innerHTML = '';
    for (const t of ['1', '2', '3']) {
      const entries = theme.tiers[t] || [];
      const block = document.createElement('div');
      block.className = 'editor-block';
      const h = document.createElement('strong');
      h.textContent = `${TIER_LABEL[t]} (${entries.length})`;
      block.appendChild(h);
      const chips = document.createElement('div');
      chips.className = 'chips';
      for (const e of entries) {
        const word = typeof e === 'string' ? e : e.word;
        chips.appendChild(chip(word, () => removeItems({ words: [word] }, () => openEditor({ id: editing, label: theme.label }))));
      }
      block.appendChild(chips);
      el.editorBody.appendChild(block);
    }
    if (Array.isArray(theme.facts) && theme.facts.length) {
      const block = document.createElement('div');
      block.className = 'editor-block';
      const h = document.createElement('strong');
      h.textContent = `Fun facts (${theme.facts.length})`;
      block.appendChild(h);
      const list = document.createElement('div');
      list.className = 'fact-edit-list';
      for (const f of theme.facts) {
        list.appendChild(chip(f, () => removeItems({ facts: [f] }, () => openEditor({ id: editing, label: theme.label })), true));
      }
      block.appendChild(list);
      el.editorBody.appendChild(block);
    }
  }

  function chip(text, onRemove, wide) {
    const span = document.createElement('span');
    span.className = 'chip' + (wide ? ' chip-wide' : '');
    const label = document.createElement('span');
    label.textContent = text;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'chip-x';
    x.textContent = '✕';
    x.title = 'Remove';
    x.addEventListener('click', onRemove);
    span.appendChild(label);
    span.appendChild(x);
    return span;
  }

  async function removeItems(payload, refresh) {
    try {
      const res = await fetch('/api/theme/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Remove failed');
      setStatus(el.saveStatus, 'Removed.', 'ok');
      refresh();
      loadThemeList();
    } catch (err) {
      setStatus(el.saveStatus, err.message, 'err');
    }
  }

  function closeEditor() {
    editing = null;
    el.themeEditor.classList.add('hidden');
    el.editorBody.innerHTML = '';
  }

  async function init() {
    try {
      const res = await fetch('/api/theme/status');
      const data = await res.json();
      if (!data.available) {
        el.unavailable.classList.remove('hidden');
        el.generate.disabled = true;
        el.topic.disabled = true;
        el.perTier.disabled = true;
        el.catGenerate.disabled = true;
        el.catTopic.disabled = true;
        el.catCount.disabled = true;
      }
    } catch (_) {
      /* leave the form enabled; the generate call will surface any error */
    }
    el.generate.addEventListener('click', generate);
    el.topic.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !el.generate.disabled) generate();
    });
    el.save.addEventListener('click', save);
    el.discard.addEventListener('click', discard);
    el.editorClose.addEventListener('click', closeEditor);
    el.catGenerate.addEventListener('click', categoryGenerate);
    el.catSave.addEventListener('click', categorySaveAll);
    el.catDiscard.addEventListener('click', categoryDiscard);
    loadThemeList();
  }

  init();
})();
