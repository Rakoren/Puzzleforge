/* PuzzleForge Web — AI Art via local ComfyUI (vanilla JS). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    offlineBanner: $('offlineBanner'),
    prompt: $('prompt'),
    style: $('style'),
    negative: $('negative'),
    ckpt: $('ckpt'),
    width: $('width'),
    height: $('height'),
    steps: $('steps'),
    cfg: $('cfg'),
    seed: $('seed'),
    generate: $('generate'),
    reroll: $('reroll'),
    status: $('status'),
    download: $('download'),
    toCbn: $('toCbn'),
    toColoring: $('toColoring'),
    previewImg: $('previewImg'),
    emptyState: $('emptyState'),
  };

  let currentImage = null; // last generated PNG data URL

  function setStatus(text, kind) {
    el.status.textContent = text || '';
    el.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function setOnline(online) {
    el.generate.disabled = !online;
    el.reroll.disabled = !online;
    el.offlineBanner.classList.toggle('hidden', online);
  }

  async function refreshStatus() {
    try {
      const st = await (await fetch('/api/comfy/status')).json();
      setOnline(Boolean(st.available));
      if (!st.available) setStatus('ComfyUI offline — start it and reload.', 'err');
      return Boolean(st.available);
    } catch (_) {
      setOnline(false);
      return false;
    }
  }

  async function generate(newSeed) {
    const prompt = el.prompt.value.trim();
    if (!prompt) { setStatus('Enter a prompt.', 'err'); return; }
    if (newSeed) el.seed.value = '';

    setStatus('Generating… this can take a minute on the first run.', 'busy');
    el.generate.disabled = true;
    el.reroll.disabled = true;
    try {
      const body = {
        prompt,
        style: el.style.value,
        negative: el.negative.value.trim() || undefined,
        ckpt: el.ckpt.value || undefined,
        width: Number(el.width.value),
        height: Number(el.height.value),
        steps: Number(el.steps.value),
        cfg: Number(el.cfg.value),
      };
      if (el.seed.value.trim() !== '') body.seed = Number(el.seed.value);

      const res = await fetch('/api/comfy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed.');

      currentImage = data.image;
      el.previewImg.src = data.image;
      el.previewImg.hidden = false;
      el.emptyState.classList.add('hidden');
      el.download.disabled = false;
      el.toCbn.disabled = false;
      el.toColoring.disabled = false;
      if (data.seed != null) el.seed.value = data.seed;
      setStatus('Done. Seed ' + (data.seed != null ? data.seed : '') + '.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.generate.disabled = false;
      el.reroll.disabled = false;
    }
  }

  function download() {
    if (!currentImage) return;
    const slug = (el.prompt.value.trim() || 'ai-art')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .slice(0, 40)
      .replace(/^-+|-+$/g, '');
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = (slug || 'ai-art') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Hand off the generated image to an Image Tools tab (Color by Number /
  // Coloring Page), which picks it up from localStorage on load.
  function handoff(tool) {
    if (!currentImage) return;
    try {
      localStorage.setItem('pf_handoff', JSON.stringify({ tool, image: currentImage }));
    } catch (_) {
      setStatus('Could not pass the image (storage blocked).', 'err');
      return;
    }
    window.location.href = 'imagetools.html';
  }

  async function loadWorkflows() {
    try {
      const data = await (await fetch('/api/comfy/checkpoints')).json();
      for (const c of data.checkpoints || []) {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        el.ckpt.appendChild(o);
      }
      const workflows = (data.workflows && data.workflows.length)
        ? data.workflows
        : [{ id: 'coloring', label: 'Coloring page (clean line art)' }];
      for (const wf of workflows) {
        const o = document.createElement('option');
        o.value = wf.id;
        o.textContent = wf.label;
        el.style.appendChild(o);
      }
    } catch (_) {
      const o = document.createElement('option');
      o.value = 'coloring';
      o.textContent = 'Coloring page (clean line art)';
      el.style.appendChild(o);
    }
  }

  async function init() {
    const online = await refreshStatus();
    await loadWorkflows();
    if (online) setStatus('ComfyUI ready.', 'ok');
    el.generate.addEventListener('click', () => generate(false));
    el.reroll.addEventListener('click', () => generate(true));
    el.download.addEventListener('click', download);
    el.toCbn.addEventListener('click', () => handoff('cbn'));
    el.toColoring.addEventListener('click', () => handoff('coloring'));
  }

  init();
})();
