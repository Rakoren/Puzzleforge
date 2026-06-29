/* PuzzleForge Web — Image Tools (vanilla JS): Coloring Page + Color by Number. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let trimSizes = [];
  let defaultTrim = '8x10';

  function fillTrim(sel) {
    for (const ts of trimSizes) {
      const o = document.createElement('option');
      o.value = ts;
      o.textContent = ts.replace('x', '" × ') + '"';
      sel.appendChild(o);
    }
    sel.value = defaultTrim;
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const slug = (s, fallback) =>
    (s || fallback).replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || fallback;

  // --- shared preview surface ---
  const previewImg = $('previewImg');
  const cbnPreview = $('cbnPreview');
  const emptyState = $('emptyState');

  function showImg() {
    cbnPreview.classList.add('hidden');
    previewImg.hidden = false;
    emptyState.classList.add('hidden');
  }
  function showCbn() {
    previewImg.hidden = true;
    cbnPreview.classList.remove('hidden');
    emptyState.classList.add('hidden');
  }

  // --- Coloring Page tool ---
  const coloring = (function () {
    const el = {
      image: $('image'), detail: $('detail'), detailVal: $('detailVal'),
      thickness: $('thickness'), thickVal: $('thickVal'),
      trimSize: $('trimSize'), title: $('title'),
      apply: $('apply'), status: $('status'), downloadPdf: $('downloadPdf'),
    };
    let source = null;

    const setStatus = (t, k) => { el.status.textContent = t || ''; el.status.className = 'status' + (k ? ' ' + k : ''); };

    function onUpload(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { source = reader.result; el.apply.disabled = false; preview(); };
      reader.readAsDataURL(file);
    }

    async function preview() {
      if (!source) return;
      setStatus('Tracing lines…', 'busy');
      el.apply.disabled = true;
      try {
        const res = await fetch('/api/image/coloring/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: source, detail: Number(el.detail.value), thickness: Number(el.thickness.value) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not process image');
        previewImg.src = data.image;
        showImg();
        el.downloadPdf.disabled = false;
        setStatus('Coloring page ready.', 'ok');
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        el.apply.disabled = false;
      }
    }

    async function download() {
      if (!source) return;
      setStatus('Building PDF…', 'busy');
      el.downloadPdf.disabled = true;
      try {
        const res = await fetch('/api/image/coloring/pdf', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: source, detail: Number(el.detail.value), thickness: Number(el.thickness.value),
            trimSize: el.trimSize.value, title: el.title.value.trim() || null,
          }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'PDF export failed'); }
        downloadBlob(await res.blob(), slug(el.title.value.trim(), 'coloring-page') + '.pdf');
        setStatus('PDF downloaded.', 'ok');
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        el.downloadPdf.disabled = false;
      }
    }

    return {
      init() {
        fillTrim(el.trimSize);
        el.image.addEventListener('change', onUpload);
        el.apply.addEventListener('click', preview);
        el.downloadPdf.addEventListener('click', download);
        el.detail.addEventListener('input', () => { el.detailVal.textContent = el.detail.value; });
        el.thickness.addEventListener('input', () => { el.thickVal.textContent = el.thickness.value; });
      },
      onShow() { if (source) showImg(); else emptyState.classList.remove('hidden'); },
    };
  })();

  // --- Color by Number tool ---
  const cbn = (function () {
    const el = {
      image: $('cbnImage'), colors: $('colors'), colorsVal: $('colorsVal'),
      smoothing: $('smoothing'), smoothVal: $('smoothVal'),
      trim: $('cbnTrim'), title: $('cbnTitle'), reference: $('cbnReference'),
      apply: $('cbnApply'), status: $('cbnStatus'), download: $('cbnDownload'),
    };
    let source = null;
    let last = null;

    const setStatus = (t, k) => { el.status.textContent = t || ''; el.status.className = 'status' + (k ? ' ' + k : ''); };

    function render(data) {
      const numbers = data.regions
        .map((r) => `<span class="n" style="left:${(r.x * 100).toFixed(2)}%;top:${(r.y * 100).toFixed(2)}%">${r.n}</span>`)
        .join('');
      const keys = data.palette
        .map((p) => `<div class="key"><span class="sw" style="background:${p.hex}"></span><span class="kn">${p.n}</span></div>`)
        .join('');
      const ref = el.reference.checked
        ? `<div class="ref"><img src="${data.reference}" alt="Color guide"><div class="ref-cap">Color guide</div></div>`
        : '';
      cbnPreview.innerHTML =
        `<div class="artwrap"><img src="${data.outline}" alt="Color by number">${numbers}</div>` +
        `<div class="keyrow">${keys}</div>${ref}`;
    }

    function onUpload(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { source = reader.result; el.apply.disabled = false; preview(); };
      reader.readAsDataURL(file);
    }

    async function preview() {
      if (!source) return;
      setStatus('Reducing colors and numbering regions…', 'busy');
      el.apply.disabled = true;
      try {
        const res = await fetch('/api/image/cbn/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: source, colors: Number(el.colors.value), smoothing: Number(el.smoothing.value) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not process image');
        last = data;
        render(data);
        showCbn();
        el.download.disabled = false;
        setStatus(`${data.palette.length} colors, ${data.regions.length} numbered regions.`, 'ok');
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        el.apply.disabled = false;
      }
    }

    async function download() {
      if (!source) return;
      setStatus('Building PDF…', 'busy');
      el.download.disabled = true;
      try {
        const res = await fetch('/api/image/cbn/pdf', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: source, colors: Number(el.colors.value), smoothing: Number(el.smoothing.value),
            trimSize: el.trim.value, title: el.title.value.trim() || null, showReference: el.reference.checked,
          }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'PDF export failed'); }
        downloadBlob(await res.blob(), slug(el.title.value.trim(), 'color-by-number') + '.pdf');
        setStatus('PDF downloaded.', 'ok');
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        el.download.disabled = false;
      }
    }

    return {
      init() {
        fillTrim(el.trim);
        el.image.addEventListener('change', onUpload);
        el.apply.addEventListener('click', preview);
        el.download.addEventListener('click', download);
        el.reference.addEventListener('change', () => { if (last) render(last); });
        el.colors.addEventListener('input', () => { el.colorsVal.textContent = el.colors.value; });
        el.smoothing.addEventListener('input', () => { el.smoothVal.textContent = el.smoothing.value; });
      },
      onShow() { if (last) showCbn(); else emptyState.classList.remove('hidden'); },
    };
  })();

  // --- Dot to Dot tool ---
  const dotsPreview = $('dotsPreview');
  function showDots() {
    previewImg.hidden = true;
    cbnPreview.classList.add('hidden');
    dotsPreview.classList.remove('hidden');
    emptyState.classList.add('hidden');
  }

  const dots = (function () {
    const el = {
      image: $('dotsImage'), dots: $('dots'), dotsVal: $('dotsVal'),
      trim: $('dotsTrim'), title: $('dotsTitle'), reference: $('dotsReference'),
      apply: $('dotsApply'), status: $('dotsStatus'), download: $('dotsDownload'),
    };
    let source = null;
    let last = null;

    const setStatus = (t, k) => { el.status.textContent = t || ''; el.status.className = 'status' + (k ? ' ' + k : ''); };

    function render(data) {
      const refVis = el.reference.checked ? 'opacity:.5' : 'visibility:hidden';
      const markers = data.dots
        .map(
          (d) =>
            `<span class="dot" style="left:${(d.x * 100).toFixed(2)}%;top:${(d.y * 100).toFixed(2)}%"></span>` +
            `<span class="dn" style="left:${(d.x * 100).toFixed(2)}%;top:${(d.y * 100).toFixed(2)}%">${d.n}</span>`
        )
        .join('');
      dotsPreview.innerHTML =
        `<div class="dots-instr">Connect the dots from 1 to ${data.dots.length}!</div>` +
        `<div class="artwrap"><img src="${data.reference}" alt="guide" style="${refVis}">${markers}</div>`;
    }

    function onUpload(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { source = reader.result; el.apply.disabled = false; preview(); };
      reader.readAsDataURL(file);
    }

    async function preview() {
      if (!source) return;
      setStatus('Tracing the subject…', 'busy');
      el.apply.disabled = true;
      try {
        const res = await fetch('/api/image/dots/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: source, dots: Number(el.dots.value) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not process image');
        last = data;
        render(data);
        showDots();
        el.download.disabled = false;
        setStatus(`${data.dots.length} dots.`, 'ok');
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        el.apply.disabled = false;
      }
    }

    async function download() {
      if (!source) return;
      setStatus('Building PDF…', 'busy');
      el.download.disabled = true;
      try {
        const res = await fetch('/api/image/dots/pdf', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: source, dots: Number(el.dots.value),
            trimSize: el.trim.value, title: el.title.value.trim() || null, showReference: el.reference.checked,
          }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'PDF export failed'); }
        downloadBlob(await res.blob(), slug(el.title.value.trim(), 'dot-to-dot') + '.pdf');
        setStatus('PDF downloaded.', 'ok');
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        el.download.disabled = false;
      }
    }

    return {
      init() {
        fillTrim(el.trim);
        el.image.addEventListener('change', onUpload);
        el.apply.addEventListener('click', preview);
        el.download.addEventListener('click', download);
        el.reference.addEventListener('change', () => { if (last) render(last); });
        el.dots.addEventListener('input', () => { el.dotsVal.textContent = el.dots.value; });
      },
      onShow() { if (last) showDots(); else emptyState.classList.remove('hidden'); },
    };
  })();

  const tools = { coloring, cbn, dots };

  function activate(name) {
    document.querySelectorAll('#toolTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    $('tool-coloring').classList.toggle('hidden', name !== 'coloring');
    $('tool-cbn').classList.toggle('hidden', name !== 'cbn');
    $('tool-dots').classList.toggle('hidden', name !== 'dots');
    previewImg.hidden = true;
    cbnPreview.classList.add('hidden');
    dotsPreview.classList.add('hidden');
    emptyState.classList.add('hidden');
    tools[name].onShow();
  }

  async function init() {
    try {
      const meta = await (await fetch('/api/meta')).json();
      trimSizes = meta.trimSizes || [];
      defaultTrim = trimSizes.includes('8x10') ? '8x10' : trimSizes[0];
    } catch (_) { /* leave selectors empty; uploads will still error clearly */ }
    coloring.init();
    cbn.init();
    dots.init();
    document.querySelectorAll('#toolTabs .tab').forEach((b) => b.addEventListener('click', () => activate(b.dataset.tool)));
    activate('coloring');
  }

  init();
})();
