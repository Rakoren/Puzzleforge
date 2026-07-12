/* PuzzleForge Web — AI Theme Generator (vanilla JS). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    unavailable: $('unavailable'),
    topic: $('topic'),
    perTier: $('perTier'),
    audience: $('audience'),
    catAudience: $('catAudience'),
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
    genProgress: $('genProgress'),
    catProgress: $('catProgress'),
    catResult: $('catResult'),
    catList: $('catList'),
    catSave: $('catSave'),
    catDiscard: $('catDiscard'),
    catSaveStatus: $('catSaveStatus'),
    modeAi: $('modeAi'), modeManual: $('modeManual'), aiView: $('aiView'), manualView: $('manualView'),
    mName: $('mName'), mCategory: $('mCategory'), mCatList: $('mCatList'), mTags: $('mTags'),
    mTier1: $('mTier1'), mTier2: $('mTier2'), mTier3: $('mTier3'), mTier4: $('mTier4'), mCount: $('mCount'),
    mAudience: $('mAudience'),
    mFacts: $('mFacts'), mSave: $('mSave'), mClear: $('mClear'), mStatus: $('mStatus'),
  };

  let current = null; // the generated theme object awaiting save

  function setStatus(node, text, kind) {
    node.textContent = text || '';
    node.className = 'status' + (kind ? ' ' + kind : '');
  }

  const TIER_NAMES = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Expert' };
  const AUD_LABEL = { kids: 'Kids', adult: 'Adults' };
  const audienceText = (a) => (Array.isArray(a) && a.length === 1 ? AUD_LABEL[a[0]] || 'Everyone' : 'Kids & Adults');

  function wordsOf(tier) {
    return (current.tiers[tier] || []).map((e) => (typeof e === 'string' ? e : e.word));
  }

  function renderResult(data) {
    current = data.theme;
    const counts = data.report.counts;
    el.rLabel.textContent = current.label;
    const total = data.report.total;
    let meta = `${current.category} · ${audienceText(current.audiences)} · ${total} words (${counts['1']} easy, ${counts['2']} medium, ${counts['3']} hard, ${counts['4'] || 0} expert)`;
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
    for (const t of ['1', '2', '3', '4']) {
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
    if (el.genProgress) el.genProgress.hidden = false;
    el.result.classList.add('hidden');
    current = null;
    try {
      const res = await fetch('/api/theme/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, wordsPerTier: Number(el.perTier.value) || undefined, audience: el.audience ? el.audience.value : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      renderResult(data);
      setStatus(el.status, `Generated “${data.theme.label}”. Review the words, then save.`, 'ok');
    } catch (err) {
      setStatus(el.status, err.message, 'err');
    } finally {
      el.generate.disabled = false;
      if (el.genProgress) el.genProgress.hidden = true;
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
    fillCategoryList(themes);
    el.manageList.innerHTML = '';
    const byCat = {};
    for (const th of themes) (byCat[th.category] = byCat[th.category] || []).push(th);
    for (const cat of Object.keys(byCat).sort()) {
      const head = document.createElement('div');
      head.className = 'manage-cat';
      head.textContent = cat;
      el.manageList.appendChild(head);
      // Within a category, group by audience (Kids, then Both, then Adult) so the
    // list reads [Kids] … / [Adult] … together, then alphabetical by label.
    byCat[cat].sort((a, b) => audienceRank(a.audiences) - audienceRank(b.audiences) || a.label.localeCompare(b.label));
    for (const th of byCat[cat]) el.manageList.appendChild(themeRow(th));
    }
  }

  // Audience → short badge text + a sort rank (kids first, both, adult last).
  function audienceInfo(audiences) {
    const a = Array.isArray(audiences) ? audiences : [];
    const kids = a.includes('kids'), adult = a.includes('adult');
    if (kids && !adult) return { text: 'Kids', cls: 'aud-kids' };
    if (adult && !kids) return { text: 'Adult', cls: 'aud-adult' };
    return { text: 'Both', cls: 'aud-both' };
  }
  function audienceRank(audiences) {
    const t = audienceInfo(audiences).text;
    return t === 'Kids' ? 0 : t === 'Both' ? 1 : 2;
  }

  function themeRow(th) {
    const row = document.createElement('div');
    row.className = 'manage-row';

    const name = document.createElement('span');
    name.className = 'manage-name';
    const aud = audienceInfo(th.audiences);
    const badge = document.createElement('span');
    badge.className = 'aud-badge ' + aud.cls;
    badge.textContent = aud.text;
    name.appendChild(badge);
    name.appendChild(document.createTextNode(` ${th.label} (${th.wordCount})`));

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
    // Only a "Both" theme can be split into Kids + Adult variants.
    if (aud.text === 'Both') {
      const split = document.createElement('button');
      split.className = 'iconbtn';
      split.type = 'button';
      split.textContent = 'Split K/A';
      split.title = 'Create Kids and Adult variants (keeps this one)';
      split.addEventListener('click', () => splitTheme(th, split));
      actions.appendChild(split);
    }
    actions.appendChild(del);
    row.appendChild(name);
    row.appendChild(actions);
    return row;
  }

  async function splitTheme(th, btn) {
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = '…';
    try {
      const res = await fetch('/api/theme/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: th.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Split failed');
      const kn = data.kidsReport && data.kidsReport.total;
      const an = data.adultReport && data.adultReport.total;
      setStatus(el.saveStatus, `Split “${th.label}” into “${th.label} (Kids)” (${kn} words) and “${th.label} (Adult)” (${an} words). The original stays.`, 'ok');
      loadThemeList();
    } catch (err) {
      setStatus(el.saveStatus, err.message, 'err');
      btn.disabled = false;
      btn.textContent = prev;
    }
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
      const upgraded = data.tier4Added ? `, added a ${data.tier4Added}-word Expert tier` : '';
      setStatus(
        el.saveStatus,
        `Cleaned “${th.label}” — ${r.total} words${data.removed ? `, removed ${data.removed}` : ''}${upgraded}${!data.removed && !data.tier4Added ? ', nothing to change' : ''}.`,
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
    if (el.catProgress) el.catProgress.hidden = false;
    el.catResult.classList.add('hidden');
    categoryData = null;
    try {
      const res = await fetch('/api/category/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: Number(el.catCount.value) || 4, audience: el.catAudience ? el.catAudience.value : undefined }),
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
      if (el.catProgress) el.catProgress.hidden = true;
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

  const TIER_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Expert' };

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
    for (const t of ['1', '2', '3', '4']) {
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

  // --- Manual (non-AI) theme builder ---------------------------------------
  function setMode(mode) {
    const manual = mode === 'manual';
    el.aiView.classList.toggle('hidden', manual);
    el.manualView.classList.toggle('hidden', !manual);
    el.modeAi.classList.toggle('active', !manual);
    el.modeManual.classList.toggle('active', manual);
  }
  // Parse a tier textarea: one entry per line, "WORD" or "WORD | clue".
  function parseTier(text) {
    return String(text || '').split('\n').map((line) => {
      const raw = line.trim(); if (!raw) return null;
      const bar = raw.indexOf('|');
      const word = (bar >= 0 ? raw.slice(0, bar) : raw).trim();
      const clue = bar >= 0 ? raw.slice(bar + 1).trim() : '';
      if (!word) return null;
      return clue ? { word, clue } : { word };
    }).filter(Boolean);
  }
  function manualTiers() { return { 1: parseTier(el.mTier1.value), 2: parseTier(el.mTier2.value), 3: parseTier(el.mTier3.value), 4: parseTier(el.mTier4.value) }; }
  function updateManualCount() {
    const t = manualTiers();
    const n = t[1].length + t[2].length + t[3].length + t[4].length;
    el.mCount.textContent = `${n} word${n === 1 ? '' : 's'} (${t[1].length} easy · ${t[2].length} medium · ${t[3].length} hard · ${t[4].length} expert)`;
  }
  function clearManual() {
    ['mName', 'mCategory', 'mTags', 'mTier1', 'mTier2', 'mTier3', 'mTier4', 'mFacts'].forEach((k) => { el[k].value = ''; });
    if (el.mAudience) el.mAudience.value = 'both';
    updateManualCount(); setStatus(el.mStatus, '');
  }
  const AUDIENCES_FOR = (v) => (v === 'kids' ? ['kids'] : v === 'adult' ? ['adult'] : ['kids', 'adult']);
  async function saveManual() {
    const label = el.mName.value.trim();
    if (!label) { setStatus(el.mStatus, 'Give the theme a name.', 'err'); el.mName.focus(); return; }
    const tiers = manualTiers();
    if (!(tiers[1].length + tiers[2].length + tiers[3].length + tiers[4].length)) { setStatus(el.mStatus, 'Add at least one word.', 'err'); return; }
    const theme = {
      label,
      category: el.mCategory.value.trim() || 'Other',
      tags: el.mTags.value.split(',').map((s) => s.trim()).filter(Boolean),
      audiences: AUDIENCES_FOR(el.mAudience ? el.mAudience.value : 'both'),
      tiers,
      facts: el.mFacts.value.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    el.mSave.disabled = true; setStatus(el.mStatus, 'Saving…', 'busy');
    try {
      const res = await fetch('/api/theme/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the theme.');
      const r = data.report || {};
      const kept = r.total != null ? r.total : '?';
      const extra = r.dropped ? ` (${r.dropped} dropped — duplicates, too short/long, or filtered)` : '';
      loadThemeList();
      clearManual();   // clears the form (and the status) …
      setStatus(el.mStatus, `Saved “${label}” with ${kept} word${kept === 1 ? '' : 's'}${extra}. It's now in the pickers.`, 'ok');   // … so set the message last
    } catch (err) { setStatus(el.mStatus, err.message, 'err'); }
    finally { el.mSave.disabled = false; }
  }
  // Offer existing categories as suggestions in the manual builder.
  function fillCategoryList(themes) {
    if (!el.mCatList) return;
    const cats = [...new Set((themes || []).map((t) => t.category).filter(Boolean))].sort();
    el.mCatList.innerHTML = cats.map((c) => `<option value="${c.replace(/"/g, '&quot;')}"></option>`).join('');
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
    // Manual builder (works with or without an API key)
    el.modeAi.addEventListener('click', () => setMode('ai'));
    el.modeManual.addEventListener('click', () => setMode('manual'));
    el.mSave.addEventListener('click', saveManual);
    el.mClear.addEventListener('click', clearManual);
    [el.mTier1, el.mTier2, el.mTier3, el.mTier4].forEach((t) => t.addEventListener('input', updateManualCount));
    loadThemeList();
  }

  init();
})();
