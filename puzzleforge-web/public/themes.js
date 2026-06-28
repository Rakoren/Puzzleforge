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

  async function init() {
    try {
      const res = await fetch('/api/theme/status');
      const data = await res.json();
      if (!data.available) {
        el.unavailable.classList.remove('hidden');
        el.generate.disabled = true;
        el.topic.disabled = true;
        el.perTier.disabled = true;
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
    loadThemeList();
  }

  init();
})();
