/* PuzzleForge Web — teacher tool frontend (vanilla JS, no build step). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    type: $('type'),
    theme: $('theme'),
    themeField: $('themeField'),
    customField: $('customField'),
    customWords: $('customWords'),
    difficulty: $('difficulty'),
    trimSize: $('trimSize'),
    audience: $('audience'),
    size: $('size'),
    title: $('title'),
    generate: $('generate'),
    regenerate: $('regenerate'),
    status: $('status'),
    downloadPdf: $('downloadPdf'),
    withAnswers: $('withAnswers'),
    downloadRecipe: $('downloadRecipe'),
    uploadRecipe: $('uploadRecipe'),
    previewFrame: $('previewFrame'),
    emptyState: $('emptyState'),
    tabs: document.querySelectorAll('.tab'),
  };

  let meta = null;
  let wordTypes = new Set();
  let last = null; // { puzzleId, previewHtml, answerHtml, recipe }
  let view = 'puzzle';

  function setStatus(text, kind) {
    el.status.textContent = text || '';
    el.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function source() {
    const checked = document.querySelector('input[name="source"]:checked');
    return checked ? checked.value : 'theme';
  }

  function isWordType(type) {
    return wordTypes.has(type);
  }

  // Show/hide the word-source controls based on the selected puzzle type.
  function syncWordControls() {
    const wordy = isWordType(el.type.value);
    $('wordsSource').classList.toggle('hidden', !wordy);
    if (!wordy) return;
    const custom = source() === 'custom';
    el.themeField.classList.toggle('hidden', custom);
    el.customField.classList.toggle('hidden', !custom);
  }

  function parseWords(text) {
    return text
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter(Boolean);
  }

  // Build a recipe object from the current form state.
  function recipeFromForm() {
    const type = el.type.value;
    const recipe = {
      puzzleforgeRecipe: meta ? meta.recipeVersion : 1,
      type,
      difficulty: Number(el.difficulty.value),
      trimSize: el.trimSize.value,
      audience: el.audience.value,
      title: el.title.value.trim() || null,
      size: el.size.value ? Number(el.size.value) : null,
      theme: null,
      words: null,
    };
    if (isWordType(type)) {
      if (source() === 'custom') {
        recipe.words = parseWords(el.customWords.value);
      } else {
        recipe.theme = el.theme.value;
      }
    }
    return recipe;
  }

  function applyRecipe(recipe) {
    if (!recipe) return;
    if (recipe.type) el.type.value = recipe.type;
    if (recipe.difficulty) el.difficulty.value = String(recipe.difficulty);
    if (recipe.trimSize) el.trimSize.value = recipe.trimSize;
    if (recipe.audience) el.audience.value = recipe.audience;
    el.title.value = recipe.title || '';
    el.size.value = recipe.size || '';
    if (Array.isArray(recipe.words) && recipe.words.length) {
      document.querySelector('input[name="source"][value="custom"]').checked = true;
      el.customWords.value = recipe.words.join(', ');
    } else if (recipe.theme) {
      document.querySelector('input[name="source"][value="theme"]').checked = true;
      el.theme.value = recipe.theme;
    }
    syncWordControls();
  }

  function showPreview() {
    if (!last) return;
    const html = view === 'answer' ? last.answerHtml : last.previewHtml;
    el.previewFrame.srcdoc = html;
    el.emptyState.classList.add('hidden');
  }

  async function generate() {
    const recipe = recipeFromForm();
    if (isWordType(recipe.type) && source() === 'custom' && (!recipe.words || !recipe.words.length)) {
      setStatus('Add at least one word, or switch to a theme.', 'err');
      return;
    }
    setStatus('Generating…', 'busy');
    el.generate.disabled = true;
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      last = {
        puzzleId: data.puzzleId,
        previewHtml: data.previewHtml,
        answerHtml: data.answerHtml,
        recipe,
      };
      showPreview();

      const m = data.meta;
      let msg = `Made “${m.title}”`;
      if (m.size) msg += ` · ${m.size}×${m.size}`;
      if (m.wordCount) msg += ` · ${m.wordCount} words`;
      if (m.droppedCount) msg += ` · ${m.droppedCount} didn’t fit`;
      setStatus(msg, 'ok');

      el.regenerate.disabled = false;
      el.downloadPdf.disabled = false;
      el.downloadRecipe.disabled = false;
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.generate.disabled = false;
    }
  }

  async function downloadPdf() {
    if (!last) return;
    setStatus('Building PDF…', 'busy');
    el.downloadPdf.disabled = true;
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: last.puzzleId,
          recipe: last.recipe,
          answerKey: el.withAnswers.checked,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'PDF export failed');
      }
      const blob = await res.blob();
      triggerDownload(blob, filename(last.recipe, 'pdf'));
      setStatus('PDF downloaded.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.downloadPdf.disabled = false;
    }
  }

  function downloadRecipe() {
    if (!last) return;
    const blob = new Blob([JSON.stringify(last.recipe, null, 2)], { type: 'application/json' });
    triggerDownload(blob, filename(last.recipe, 'json'));
    setStatus('Recipe saved.', 'ok');
  }

  function filename(recipe, ext) {
    const base = (recipe.title || recipe.theme || recipe.type || 'puzzle')
      .toString()
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '');
    return `${base || 'puzzle'}.${ext}`;
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onUpload(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const recipe = JSON.parse(reader.result);
        applyRecipe(recipe);
        setStatus('Recipe loaded — press Generate to build it.', 'ok');
      } catch (_) {
        setStatus('That file is not a valid recipe.', 'err');
      }
      ev.target.value = '';
    };
    reader.readAsText(file);
  }

  async function init() {
    try {
      const res = await fetch('/api/meta');
      meta = await res.json();
    } catch (_) {
      setStatus('Could not reach the server.', 'err');
      return;
    }
    wordTypes = new Set(meta.wordTypes);

    const label = (t) => t.replace(/(^|\s)\S/g, (s) => s.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2');
    for (const t of meta.types) {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = prettyType(t);
      el.type.appendChild(o);
    }
    for (const th of meta.themes) {
      const o = document.createElement('option');
      o.value = th.id;
      o.textContent = `${th.label} (${th.wordCount} words)`;
      el.theme.appendChild(o);
    }
    for (const ts of meta.trimSizes) {
      const o = document.createElement('option');
      o.value = ts;
      o.textContent = ts.replace('x', '" × ') + '"';
      el.trimSize.appendChild(o);
    }
    el.trimSize.value = meta.trimSizes.includes('8x10') ? '8x10' : meta.trimSizes[0];

    syncWordControls();
  }

  function prettyType(t) {
    const names = {
      wordsearch: 'Word Search',
      sudoku: 'Sudoku',
      maze: 'Maze',
      cryptogram: 'Cryptogram',
      wordscramble: 'Word Scramble',
      crossword: 'Crossword',
      krisskross: 'Kriss-Kross',
      nonogram: 'Nonogram',
    };
    return names[t] || t;
  }

  // events
  el.type.addEventListener('change', syncWordControls);
  document.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener('change', syncWordControls));
  el.generate.addEventListener('click', generate);
  el.regenerate.addEventListener('click', generate);
  el.downloadPdf.addEventListener('click', downloadPdf);
  el.downloadRecipe.addEventListener('click', downloadRecipe);
  el.uploadRecipe.addEventListener('change', onUpload);
  el.tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      el.tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      view = tab.dataset.view;
      showPreview();
    })
  );

  init();
})();
