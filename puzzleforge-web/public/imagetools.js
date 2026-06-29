/* PuzzleForge Web — Photo to Coloring Page (vanilla JS). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    image: $('image'),
    detail: $('detail'),
    detailVal: $('detailVal'),
    thickness: $('thickness'),
    thickVal: $('thickVal'),
    trimSize: $('trimSize'),
    title: $('title'),
    apply: $('apply'),
    status: $('status'),
    downloadPdf: $('downloadPdf'),
    previewImg: $('previewImg'),
    emptyState: $('emptyState'),
  };

  let sourceImage = null; // uploaded photo as a data URL

  function setStatus(text, kind) {
    el.status.textContent = text || '';
    el.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function onUpload(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      sourceImage = reader.result;
      el.apply.disabled = false;
      preview();
    };
    reader.readAsDataURL(file);
  }

  async function preview() {
    if (!sourceImage) return;
    setStatus('Tracing lines…', 'busy');
    el.apply.disabled = true;
    try {
      const res = await fetch('/api/image/coloring/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: sourceImage,
          detail: Number(el.detail.value),
          thickness: Number(el.thickness.value),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not process image');
      el.previewImg.src = data.image;
      el.previewImg.hidden = false;
      el.emptyState.classList.add('hidden');
      el.downloadPdf.disabled = false;
      setStatus('Coloring page ready.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.apply.disabled = false;
    }
  }

  async function downloadPdf() {
    if (!sourceImage) return;
    setStatus('Building PDF…', 'busy');
    el.downloadPdf.disabled = true;
    try {
      const res = await fetch('/api/image/coloring/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: sourceImage,
          detail: Number(el.detail.value),
          thickness: Number(el.thickness.value),
          trimSize: el.trimSize.value,
          title: el.title.value.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'PDF export failed');
      }
      const blob = await res.blob();
      const name = (el.title.value.trim() || 'coloring-page').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'coloring-page'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('PDF downloaded.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.downloadPdf.disabled = false;
    }
  }

  async function init() {
    try {
      const meta = await (await fetch('/api/meta')).json();
      for (const ts of meta.trimSizes) {
        const o = document.createElement('option');
        o.value = ts;
        o.textContent = ts.replace('x', '" × ') + '"';
        el.trimSize.appendChild(o);
      }
      el.trimSize.value = meta.trimSizes.includes('8x10') ? '8x10' : meta.trimSizes[0];
    } catch (_) {
      setStatus('Could not reach the server.', 'err');
    }
    el.image.addEventListener('change', onUpload);
    el.apply.addEventListener('click', preview);
    el.downloadPdf.addEventListener('click', downloadPdf);
    el.detail.addEventListener('input', () => { el.detailVal.textContent = el.detail.value; });
    el.thickness.addEventListener('input', () => { el.thickVal.textContent = el.thickness.value; });
  }

  init();
})();
