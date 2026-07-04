/* PuzzleForge Web — Cover Builder (vanilla JS). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    trimSize: $('trimSize'),
    pageCount: $('pageCount'),
    paper: $('paper'),
    title: $('title'),
    subtitle: $('subtitle'),
    difficulty: $('difficulty'),
    author: $('author'),
    frontBg: $('frontBg'),
    frontText: $('frontText'),
    titlePosition: $('titlePosition'),
    frontImage: $('frontImage'),
    clearImage: $('clearImage'),
    backBg: $('backBg'),
    backText: $('backText'),
    blurb: $('blurb'),
    spineBg: $('spineBg'),
    spineText: $('spineText'),
    dimsInfo: $('dimsInfo'),
    spineInfo: $('spineInfo'),
    sizeInfo: $('sizeInfo'),
    preview: $('preview'),
    downloadPdf: $('downloadPdf'),
    status: $('status'),
    coverScale: $('coverScale'),
    coverFrame: $('coverFrame'),
    emptyState: $('emptyState'),
    useForBook: $('useForBook'),
  };

  let imageData = null; // data URL of the uploaded front image
  let built = false;

  function setStatus(text, kind) {
    el.status.textContent = text || '';
    el.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function config() {
    return {
      trimSize: el.trimSize.value,
      pageCount: Number(el.pageCount.value) || 0,
      paper: el.paper.value,
      title: el.title.value.trim() || null,
      subtitle: el.subtitle.value.trim() || null,
      difficulty: el.difficulty.value.trim() || null,
      author: el.author.value.trim() || null,
      front: {
        bgColor: el.frontBg.value,
        textColor: el.frontText.value,
        titlePosition: el.titlePosition.value,
        image: imageData || null,
      },
      back: { bgColor: el.backBg.value, textColor: el.backText.value, blurb: el.blurb.value.trim() || null },
      spine: { bgColor: el.spineBg.value, textColor: el.spineText.value },
    };
  }

  function invalidate() {
    built = false;
    el.downloadPdf.disabled = true;
  }

  function showDims(dims) {
    el.sizeInfo.textContent = `${dims.fullWidthIn}" × ${dims.fullHeightIn}" · spine ${dims.spineIn}"`;
    el.dimsInfo.textContent = `Full wrap: ${dims.fullWidthIn}" × ${dims.fullHeightIn}" (incl. 0.125" bleed). Spine ${dims.spineIn}" for ${dims.pageCount} pages on ${dims.paper} paper.`;
    el.spineInfo.textContent = dims.spineTextAllowed
      ? 'Spine is wide enough for text (title · author).'
      : 'Spine text is hidden — KDP needs ≥ 79 pages before printing spine text.';
  }

  function scaleCover(dims) {
    // The cover renders at 96px/in; scale it to fit the preview width.
    const wPx = dims.fullWidthIn * 96;
    const hPx = dims.fullHeightIn * 96;
    el.coverFrame.style.width = wPx + 'px';
    el.coverFrame.style.height = hPx + 'px';
    const avail = el.coverScale.parentElement.clientWidth - 24;
    const scale = Math.min(1, avail / wPx);
    el.coverScale.style.transform = `scale(${scale})`;
    el.coverScale.style.width = wPx + 'px';
    el.coverScale.style.height = hPx + 'px';
    el.coverScale.parentElement.style.height = hPx * scale + 24 + 'px';
  }

  async function preview() {
    setStatus('Building cover…', 'busy');
    el.preview.disabled = true;
    try {
      const res = await fetch('/api/cover/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: config() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build cover');
      el.coverFrame.srcdoc = data.html;
      el.emptyState.classList.add('hidden');
      showDims(data.dims);
      scaleCover(data.dims);
      built = true;
      el.downloadPdf.disabled = false;
      setStatus('Cover ready — review, then download.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.preview.disabled = false;
    }
  }

  async function downloadPdf() {
    setStatus('Rendering cover PDF…', 'busy');
    el.downloadPdf.disabled = true;
    try {
      const res = await fetch('/api/cover/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: config() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Cover export failed');
      }
      const blob = await res.blob();
      const name = (el.title.value.trim() || 'book').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'book'}-cover.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Cover PDF downloaded.', 'ok');
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      el.downloadPdf.disabled = false;
    }
  }

  function onImage(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      imageData = reader.result;
      el.clearImage.hidden = false;
      invalidate();
      setStatus('Image loaded — press Preview cover.', 'ok');
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    imageData = null;
    el.frontImage.value = '';
    el.clearImage.hidden = true;
    invalidate();
  }

  // Hand this cover off to the editor's Publish → KDP package.
  function useForBook() {
    try {
      localStorage.setItem('pf_cover', JSON.stringify(config()));
      setStatus('Saved. It will be used in the editor under Publish → Export KDP package.', 'ok');
    } catch (_) {
      setStatus('Could not save the cover (browser storage full?).', 'err');
    }
  }

  // Prefill from the editor when it sent us here (title/author/trim/page count).
  function applySeed() {
    let seed = null;
    try { const raw = localStorage.getItem('pf_cover_seed'); if (raw) { seed = JSON.parse(raw); localStorage.removeItem('pf_cover_seed'); } } catch (_) { /* */ }
    if (!seed) return;
    if (seed.title) el.title.value = seed.title;
    if (seed.subtitle) el.subtitle.value = seed.subtitle;
    if (seed.author) el.author.value = seed.author;
    if (seed.trimSize && [...el.trimSize.options].some((o) => o.value === seed.trimSize)) el.trimSize.value = seed.trimSize;
    if (seed.pageCount) el.pageCount.value = seed.pageCount;
    if (seed.blurb) el.blurb.value = seed.blurb;
    setStatus('Loaded your book’s details. Design the cover, then “Use for this book”.', 'ok');
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
    applySeed();

    el.preview.addEventListener('click', preview);
    el.downloadPdf.addEventListener('click', downloadPdf);
    if (el.useForBook) el.useForBook.addEventListener('click', useForBook);
    el.frontImage.addEventListener('change', onImage);
    el.clearImage.addEventListener('click', clearImage);
    [
      el.trimSize, el.pageCount, el.paper, el.title, el.subtitle, el.author,
      el.frontBg, el.frontText, el.titlePosition, el.backBg, el.backText, el.blurb,
      el.spineBg, el.spineText,
    ].forEach((node) => node.addEventListener('input', invalidate));
  }

  init();
})();
