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
  }

  init();
})();
