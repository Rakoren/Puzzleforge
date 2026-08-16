/**
 * Digital layer — QR "scan for answers" pages for a printed book.
 *
 * Each real (non-activity) puzzle in a book gets a static landing page that
 * reveals its answer, and a QR code on the printed puzzle page that links to
 * that landing page. The landing pages are self-contained HTML (inline CSS +
 * the puzzle's own answer-key render), meant to be dropped onto any static
 * host; the QR encodes `<baseUrl>/<book-slug>/p<n>.html`.
 *
 * Split across two responsibilities so `export.js` can draw the printed QR
 * without pulling in the (heavier) landing-page renderer:
 *   - planDigital / qrSvg  — pure, no dependency on the PDF pipeline
 *   - renderLandingPages   — lazily requires export.js for the answer render
 */
const { encode } = require('./qr');
const { isActivityType } = require('../generators/registry');

// Puzzle types whose answer page is an interactive letter/number grid with a
// per-token "escalating hint" (3×3 box → start cell → full word). Everything
// else falls back to the static answer-reveal page.
const GRID_SEARCH_TYPES = new Set(['wordsearch', 'numbersearch']);
function isGridSearch(p) {
  return !!(p && GRID_SEARCH_TYPES.has(p.type)
    && p.data && Array.isArray(p.data.grid) && p.data.grid.length
    && p.solution && Array.isArray(p.solution.placements) && p.solution.placements.length);
}

function slugify(s) {
  return String(s || 'book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'book';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plan the digital layer for a book: assign each real puzzle a stable page
 * number, filename, and full URL.
 * @param {object} book  assembled book (needs `.puzzles`, `.title`)
 * @param {object} [opts] { baseUrl, mode }
 * @returns {{ baseUrl, slug, mode, caption, entries, byPuzzle }}
 */
function planDigital(book, opts = {}) {
  const slug = slugify(book && book.title);
  const baseUrl = String(opts.baseUrl || '').trim().replace(/\/+$/, '');
  const mode = opts.mode === 'hint' || opts.mode === 'both' ? opts.mode : 'answer';
  const reals = (book && Array.isArray(book.puzzles) ? book.puzzles : []).filter((p) => p && !isActivityType(p.type));
  const entries = reals.map((puzzle, i) => {
    const n = i + 1;
    const filename = `p${n}.html`;
    const url = `${baseUrl}/${slug}/${filename}`;
    return { puzzle, n, filename, url, title: puzzle.title || `Puzzle ${n}` };
  });
  const byPuzzle = new Map(entries.map((e) => [e.puzzle, e]));
  return { baseUrl, slug, mode, caption: opts.caption || 'Scan for the answer', entries, byPuzzle };
}

/**
 * A crisp, self-contained QR as an inline SVG string (renders in the PDF and
 * on screen identically — Chromium draws inline SVG in both).
 */
function qrSvg(text, opts = {}) {
  const { modules, count } = encode(text, { ecl: opts.ecl || 'M' });
  const quiet = opts.margin != null ? opts.margin : 4;
  const dim = count + quiet * 2;
  const size = opts.size || 120;
  const fg = /^#[0-9a-fA-F]{3,8}$/.test(opts.fg || '') ? opts.fg : '#000000';
  let rects = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (modules[r][c]) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`
    + `<rect width="${dim}" height="${dim}" fill="#ffffff"/><g fill="${fg}">${rects}</g></svg>`;
}

// Pull the <style> blocks and <body> contents out of a rendered puzzle doc.
function extractParts(doc) {
  const styles = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(doc)) !== null) styles.push(m[1]);
  const body = (doc.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [null, doc])[1];
  // Drop the print @page rule — these pages are viewed on a phone, not printed.
  const style = styles.join('\n').replace(/@page[^{]*\{[^}]*\}/gi, '');
  return { style, body };
}

const SHELL_CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f5f6f8; color: #1a1a1a; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 20px 16px 60px; }
  .card { background: #fff; border-radius: 14px; box-shadow: 0 2px 14px rgba(0,0,0,.08); padding: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 14px; margin: 0 0 18px; }
  button.reveal { appearance: none; border: 0; background: #3b5bdb; color: #fff; font-size: 16px; font-weight: 600; padding: 12px 20px; border-radius: 10px; cursor: pointer; width: 100%; }
  button.reveal:hover { background: #364fc7; }
  .answer { margin-top: 18px; }
  .answer[hidden] { display: none; }
  .answer-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e6e6e6; border-radius: 10px; padding: 10px; background: #fff; }
  .foot { text-align: center; color: #999; font-size: 12px; margin-top: 26px; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181d; color: #e8e8e8; }
    .card { background: #22252c; box-shadow: none; }
    .sub { color: #a9adb5; }
    .answer-scroll { background: #fff; }
  }
`;

function landingHtml(book, entry, ansStyle, ansBody, opts = {}) {
  const bookTitle = esc(book.title || 'Puzzle Book');
  const pTitle = esc(entry.title);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pTitle} — Answer</title>
<style>${SHELL_CSS}</style>
<style>${ansStyle}</style>
</head><body>
<div class="wrap"><div class="card">
  <h1>${bookTitle}</h1>
  <p class="sub">Puzzle ${entry.n}: ${pTitle}</p>
  <button class="reveal" id="revealBtn" onclick="var a=document.getElementById('ans');a.hidden=false;this.style.display='none';">Show the answer</button>
  <div class="answer" id="ans" hidden><div class="answer-scroll">${ansBody}</div></div>
</div>
<p class="foot">Powered by PuzzleForge · <a href="index.html">All puzzles</a> · <a href="finish.html">🎉 Finished?</a></p>
</div>
</body></html>`;
}

function indexHtml(book, plan) {
  const items = plan.entries.map((e) => `<li><a href="${esc(e.filename)}">Puzzle ${e.n}: ${esc(e.title)}</a></li>`).join('\n');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(book.title || 'Puzzle Book')} — Answers</title>
<style>${SHELL_CSS} ul{list-style:none;padding:0;margin:0} li{margin:0 0 2px} li a{display:block;padding:12px 14px;background:#fff;border-radius:10px;text-decoration:none;color:#1a1a1a;border:1px solid #eee} @media(prefers-color-scheme:dark){li a{background:#22252c;color:#e8e8e8;border-color:#2c2f37}}</style>
</head><body>
<div class="wrap">
  <h1>${esc(book.title || 'Puzzle Book')}</h1>
  <p class="sub">Scan a puzzle's QR code, or tap a puzzle below to see its answer.</p>
  <ul>${items}</ul>
  <p style="text-align:center;margin:18px 0 0"><a href="finish.html" style="display:inline-block;background:#f76707;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:10px">🎉 Finished the book? Celebrate!</a></p>
  <p class="foot">Powered by PuzzleForge</p>
</div>
</body></html>`;
}

// End-of-book celebration: a confetti burst + congratulations. Self-contained
// (inline canvas confetti, no deps) so it runs as a static file.
function finishPage(book) {
  const title = esc(book.title || 'the book');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>You did it! — ${title}</title>
<style>${SHELL_CSS}
  html,body{height:100%}
  #cc{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}
  .wrap{position:relative;z-index:1;display:flex;min-height:100vh;align-items:center}
  .finish{text-align:center}
  .finish .big{font-size:clamp(40px,16vw,96px);line-height:1;margin:0 0 6px}
  .finish h1{font-size:clamp(24px,7vw,40px);margin:0 0 8px}
  .finish p{color:#555;font-size:16px;margin:0 0 20px}
  .again{appearance:none;border:0;background:#f76707;color:#fff;font-weight:700;font-size:16px;padding:12px 22px;border-radius:11px;cursor:pointer}
  .again:hover{background:#e8590c}
  .home{display:block;margin-top:16px;color:#888;font-size:14px}
  @media(prefers-color-scheme:dark){.finish p{color:#a9adb5}}
</style>
</head><body>
<canvas id="cc"></canvas>
<div class="wrap"><div class="card finish">
  <div class="big">🎉</div>
  <h1>You did it!</h1>
  <p>You finished <strong>${title}</strong>. Amazing work — every puzzle solved!</p>
  <button class="again" id="again" type="button">More confetti! 🎊</button>
  <a class="home" href="index.html">Back to all puzzles</a>
</div></div>
<script>
(function(){
  var c=document.getElementById('cc'),x=c.getContext('2d'),W,H,parts=[];
  function size(){W=c.width=innerWidth;H=c.height=innerHeight;}
  size(); addEventListener('resize',size);
  var COL=['#ff6b6b','#feca57','#48dbfb','#1dd1a1','#5f27cd','#ff9ff3','#f76707'];
  function burst(n){ for(var i=0;i<n;i++) parts.push({x:W*(0.2+Math.random()*0.6),y:H*0.28,vx:(Math.random()-0.5)*15,vy:Math.random()*-15-4,g:0.3,s:6+Math.random()*7,c:COL[(Math.random()*COL.length)|0],r:Math.random()*6,vr:(Math.random()-0.5)*0.4,life:1}); }
  function tick(){ x.clearRect(0,0,W,H); for(var i=parts.length-1;i>=0;i--){ var p=parts[i]; p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.life-=0.006; if(p.y>H+24||p.life<=0){parts.splice(i,1);continue;} x.save(); x.globalAlpha=Math.max(0,p.life); x.translate(p.x,p.y); x.rotate(p.r); x.fillStyle=p.c; x.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.62); x.restore(); } requestAnimationFrame(tick); }
  burst(170); setTimeout(function(){burst(120);},550); setTimeout(function(){burst(120);},1200); tick();
  document.getElementById('again').addEventListener('click',function(){burst(200);});
})();
</script>
</body></html>`;
}

// Extra CSS + markup for the interactive grid-search hint page.
const GRID_CSS = `
  .legend { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; font-size:12px; color:#555; margin:0 0 12px; }
  .legend span { display:inline-flex; align-items:center; gap:5px; }
  .swatch { width:14px; height:14px; border-radius:3px; border:1px solid rgba(0,0,0,.15); display:inline-block; }
  .sw-box { background:#fff3bf; } .sw-start { background:#ffa94d; } .sw-rev { background:#b2f2bb; }
  table.g { border-collapse:collapse; table-layout:fixed; width:100%; max-width:520px; margin:0 auto 16px; }
  table.g td { border:1px solid #dfe1e5; text-align:center; vertical-align:middle; font-weight:700; padding:0; aspect-ratio:1/1; font-size:clamp(9px,3.4vw,18px); color:#1a1a1a; transition:background .12s; }
  table.g td.box { background:#fff3bf; } table.g td.start { background:#ffa94d; } table.g td.rev { background:#b2f2bb; }
  .cap { text-align:center; min-height:2.6em; font-size:14px; color:#444; margin:0 0 12px; }
  .words { display:flex; flex-wrap:wrap; gap:7px; justify-content:center; }
  .wbtn { appearance:none; border:1px solid #cfd4dc; background:#fff; border-radius:9px; padding:7px 11px; font-size:14px; font-weight:600; cursor:pointer; letter-spacing:1px; color:#1a1a1a; }
  .wbtn:hover { border-color:#94a0b3; }
  .wbtn[data-lvl="1"] { background:#fff3bf; border-color:#f0c000; }
  .wbtn[data-lvl="2"] { background:#ffd8a8; border-color:#f76707; }
  .wbtn.found { background:#b2f2bb; border-color:#37b24d; color:#2b8a3e; text-decoration:line-through; }
  @media (prefers-color-scheme: dark) {
    table.g td { color:#e8e8e8; border-color:#3a3f49; }
    table.g td.box { color:#111; } table.g td.start { color:#111; } table.g td.rev { color:#111; }
    .wbtn { background:#2b2f37; color:#e8e8e8; border-color:#3a3f49; }
    .cap, .legend { color:#a9adb5; }
  }`;

// A tappable grid where each word gives an escalating hint. Self-contained
// (inline CSS + JS) so it works as a static file on any host.
function gridHintPage(book, entry) {
  const p = entry.puzzle;
  const grid = p.data.grid;
  const n = grid.length;
  // Tokens sorted for a tidy list; keep each token's start + all cells.
  const toks = p.solution.placements
    .map((pl) => ({ w: String(pl.word), s: [pl.row, pl.col], cells: pl.cells.map(([r, c]) => [r, c]) }))
    .sort((a, b) => (a.w.length - b.w.length) || a.w.localeCompare(b.w));
  const rows = grid.map((row, r) =>
    `<tr>${row.map((ch, c) => `<td data-k="${r},${c}">${esc(ch)}</td>`).join('')}</tr>`).join('');
  const buttons = toks.map((t, i) => `<button type="button" class="wbtn" data-i="${i}" data-lvl="0">${esc(t.w)}</button>`).join('');
  const data = JSON.stringify(toks).replace(/</g, '\\u003c'); // safe inside <script>
  const bookTitle = esc(book.title || 'Puzzle Book');
  const pTitle = esc(entry.title);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pTitle} — Hints</title>
<style>${SHELL_CSS}${GRID_CSS}</style>
</head><body>
<div class="wrap"><div class="card">
  <h1>${bookTitle}</h1>
  <p class="sub">Puzzle ${entry.n}: ${pTitle} — tap a word for a hint</p>
  <table class="g">${rows}</table>
  <div class="cap" id="cap">Tap a word below for a hint.</div>
  <div class="legend"><span><i class="swatch sw-box"></i>hint area</span><span><i class="swatch sw-start"></i>first letter</span><span><i class="swatch sw-rev"></i>revealed</span></div>
  <div class="words">${buttons}</div>
</div>
<p class="foot">Powered by PuzzleForge · <a href="index.html">All puzzles</a> · <a href="finish.html">🎉 Finished?</a></p>
</div>
<script>
(function(){
  var P=${data}, N=${n}, lvl=P.map(function(){return 0;}), active=-1;
  function cell(r,c){return document.querySelector('td[data-k="'+r+','+c+'"]');}
  function clearCells(){document.querySelectorAll('td.box,td.start,td.rev').forEach(function(td){td.classList.remove('box','start','rev');});}
  function render(){
    clearCells();
    P.forEach(function(p,i){ if(lvl[i]>=3){ p.cells.forEach(function(rc){ var e=cell(rc[0],rc[1]); if(e)e.classList.add('rev'); }); } });
    if(active>=0 && lvl[active]>0 && lvl[active]<3){
      var p=P[active], sr=p.s[0], sc=p.s[1];
      if(lvl[active]===1){ for(var dr=-1;dr<=1;dr++)for(var dc=-1;dc<=1;dc++){ var r=sr+dr,c=sc+dc; if(r>=0&&r<N&&c>=0&&c<N){var e=cell(r,c); if(e)e.classList.add('box');} } }
      else { var e2=cell(sr,sc); if(e2)e2.classList.add('start'); }
    }
    document.querySelectorAll('.wbtn').forEach(function(b,i){ b.dataset.lvl=lvl[i]; b.classList.toggle('found', lvl[i]>=3); });
    var cap=document.getElementById('cap');
    if(P.every(function(_,i){return lvl[i]>=3;})){ cap.textContent='🎉 Every word revealed — nice work!'; return; }
    if(active>=0 && lvl[active]===1) cap.textContent='Your first letter is somewhere in the highlighted box. Tap again to narrow it down.';
    else if(active>=0 && lvl[active]===2) cap.textContent='The orange cell is where the word starts. Tap again to reveal the whole word.';
    else cap.textContent='Tap a word below for a hint.';
  }
  function tap(i){
    lvl[i]=(lvl[i]+1)%4;
    if(lvl[i]===1||lvl[i]===2){ P.forEach(function(_,j){ if(j!==i && lvl[j]>0 && lvl[j]<3) lvl[j]=0; }); active=i; }
    else if(active===i){ active=-1; }
    render();
  }
  document.querySelectorAll('.wbtn').forEach(function(b){ b.addEventListener('click', function(){ tap(+b.dataset.i); }); });
  render();
})();
</script>
</body></html>`;
}

/**
 * Render the landing-page files for a book's digital plan.
 * @returns {Array<{ filename, html }>}  files to write under the book slug folder
 */
function renderLandingPages(book, plan) {
  // Lazy require: export.js requires this module for qrSvg, so importing it at
  // top would create a cycle. By call time export.js is fully loaded.
  const { renderPuzzleHtml } = require('./export');
  const files = plan.entries.map((e) => {
    // Grid-search puzzles get the interactive tap-for-hint page; everything
    // else keeps the static answer-reveal page.
    if (isGridSearch(e.puzzle)) return { filename: e.filename, html: gridHintPage(book, e) };
    const ak = renderPuzzleHtml(e.puzzle, { trimSize: book.trimSize, audience: book.audience, answerKey: true });
    const { style, body } = extractParts(ak);
    return { filename: e.filename, html: landingHtml(book, e, style, body, { mode: plan.mode }) };
  });
  files.push({ filename: 'index.html', html: indexHtml(book, plan) });
  files.push({ filename: 'finish.html', html: finishPage(book) });
  return files;
}

module.exports = { planDigital, qrSvg, renderLandingPages, slugify };
