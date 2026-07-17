/**
 * PuzzleForge identity (shared across every page).
 *
 * Talks to the workspace identity API (/api/workspace) to sign a person in by
 * picking their profile (+ optional PIN), remembers the session token in this
 * browser, and self-mounts a "Signed in as …" chip in the top-right with a menu
 * (Profile settings, Switch user, Sign out). Also handles ?invite=<token> links
 * so a new teammate can join. No build step, no dependencies.
 *
 * window.PFIdentity: { me(), onReady(cb), refresh(), signOut(), openSignIn(),
 *                      token(), authHeaders() }
 */
(function () {
  const WS = '/api/workspace';
  const KEY = 'pf_session';
  let me = null;            // current profile (or null)
  let ready = false;
  const readyCbs = [];

  const token = () => { try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; } };
  const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (_) {} };
  const wsToken = () => { try { return localStorage.getItem('pf_ws_token') || ''; } catch (_) { return ''; } };

  function authHeaders(json) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    const t = token(); if (t) h['x-pf-session'] = t;
    const w = wsToken(); if (w) h['x-pf-workspace'] = w;
    return h;
  }
  async function api(method, path, body) {
    const r = await fetch(WS + path, { method, headers: authHeaders(!!body), body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || (r.status + ' error'));
    return data;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const initials = (n) => String(n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  // --- chip -------------------------------------------------------------
  let chip;
  function mountChip() {
    chip = document.createElement('div');
    chip.id = 'pf-identity';
    // Prefer sitting inside the page's nav (grouped with the links on the right);
    // fall back to a floating top-right chip on pages without a topbar.
    const nav = document.querySelector('.topbar .nav');
    if (nav) nav.appendChild(chip);
    else { chip.classList.add('floating'); document.body.appendChild(chip); }
    renderChip();
    document.addEventListener('click', (e) => { if (chip && !chip.contains(e.target)) chip.classList.remove('open'); });
  }
  function renderChip() {
    if (!chip) return;
    if (!me) {
      chip.className = 'pf-id-chip signed-out';
      chip.innerHTML = `<button class="pf-id-btn" type="button">Sign in</button>`;
      chip.querySelector('.pf-id-btn').addEventListener('click', openSignIn);
      return;
    }
    chip.className = 'pf-id-chip';
    const avatarBg = me.color || '#3b6fd4';
    chip.innerHTML = `
      <button class="pf-id-btn" type="button" aria-haspopup="true">
        <span class="pf-id-av" style="background:${esc(avatarBg)}">${esc(initials(me.name))}</span>
        <span class="pf-id-name">${esc(me.name)}</span>
        <span class="pf-id-role">${esc(me.role)}</span>
        <span class="pf-id-caret">▾</span>
      </button>
      <div class="pf-id-menu" role="menu">
        <a href="profile.html" role="menuitem">Profile settings</a>
        <button type="button" role="menuitem" data-act="switch">Switch user</button>
        <button type="button" role="menuitem" data-act="signout">Sign out</button>
      </div>`;
    chip.querySelector('.pf-id-btn').addEventListener('click', (e) => { e.stopPropagation(); chip.classList.toggle('open'); });
    chip.querySelector('[data-act="switch"]').addEventListener('click', () => { chip.classList.remove('open'); openSignIn(); });
    chip.querySelector('[data-act="signout"]').addEventListener('click', signOut);
  }

  // --- modal ------------------------------------------------------------
  let modal;
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  function openModal(html) {
    closeModal();
    modal = document.createElement('div');
    modal.className = 'pf-id-overlay';
    modal.innerHTML = `<div class="pf-id-modal">${html}</div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.body.appendChild(modal);
    return modal;
  }
  const field = (label, id, attrs = '') => `<label class="pf-id-field"><span>${esc(label)}</span><input id="${id}" ${attrs}></label>`;

  async function openSignIn() {
    let profiles = [];
    try { profiles = await api('GET', '/profiles'); } catch (_) { /* workspace off? */ }
    if (!profiles.length) return openCreateFirst();

    const rows = profiles.map((p) => `
      <button class="pf-id-pick" type="button" data-id="${p.id}" data-pin="${p.hasPin ? 1 : 0}">
        <span class="pf-id-av" style="background:${esc(p.color || '#3b6fd4')}">${esc(initials(p.name))}</span>
        <span class="pf-id-pick-main"><b>${esc(p.name)}</b><small>${esc(p.role)}${p.hasPin ? ' · PIN' : ''}</small></span>
      </button>`).join('');
    const m = openModal(`
      <h2>Who's using PuzzleForge?</h2>
      <div class="pf-id-picklist">${rows}</div>
      <div class="pf-id-pinrow hidden"><label class="pf-id-field"><span>PIN</span><input id="pf-id-pin" type="password" inputmode="numeric" autocomplete="off"></label><button id="pf-id-pinok" class="primary" type="button">Sign in</button></div>
      <p class="pf-id-err" id="pf-id-err"></p>
      <div class="pf-id-modal-foot"><button id="pf-id-add" class="ghost" type="button">+ Add someone</button><button id="pf-id-cancel" class="ghost" type="button">Cancel</button></div>`);
    let pending = null;
    const pinRow = m.querySelector('.pf-id-pinrow');
    const doPick = async (id, pin) => {
      try { const r = await api('POST', '/session', { profileId: id, pin }); finishSignIn(r); }
      catch (err) { m.querySelector('#pf-id-err').textContent = err.message; }
    };
    m.querySelectorAll('.pf-id-pick').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (b.dataset.pin === '1') { pending = id; pinRow.classList.remove('hidden'); m.querySelector('#pf-id-pin').focus(); }
      else doPick(id);
    }));
    m.querySelector('#pf-id-pinok').addEventListener('click', () => pending && doPick(pending, m.querySelector('#pf-id-pin').value));
    m.querySelector('#pf-id-pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') m.querySelector('#pf-id-pinok').click(); });
    m.querySelector('#pf-id-add').addEventListener('click', () => (me && me.role === 'Owner') ? openInvite() : openCreateFirst(true));
    m.querySelector('#pf-id-cancel').addEventListener('click', closeModal);
  }

  function openCreateFirst(asTeammate) {
    const m = openModal(`
      <h2>${asTeammate ? 'Create your profile' : 'Welcome to PuzzleForge'}</h2>
      <p class="pf-id-sub">${asTeammate ? 'Add yourself to the team.' : "Let's set up your profile. The first person is the Owner."}</p>
      ${field('Your name', 'pf-id-name', 'placeholder="e.g. Lyle" maxlength="80"')}
      ${field('Email (optional)', 'pf-id-email', 'type="email" maxlength="160"')}
      ${field('Pen name / author name (optional)', 'pf-id-pen', 'placeholder="Shown on your books" maxlength="120"')}
      ${field('PIN (optional)', 'pf-id-pin2', 'type="password" inputmode="numeric" placeholder="Leave blank for none"')}
      <p class="pf-id-err" id="pf-id-err"></p>
      <div class="pf-id-modal-foot"><button id="pf-id-create" class="primary" type="button">Create profile</button><button id="pf-id-cancel" class="ghost" type="button">Cancel</button></div>`);
    m.querySelector('#pf-id-create').addEventListener('click', async () => {
      const body = { name: m.querySelector('#pf-id-name').value, email: m.querySelector('#pf-id-email').value, penName: m.querySelector('#pf-id-pen').value, pin: m.querySelector('#pf-id-pin2').value };
      try { finishSignIn(await api('POST', '/profiles', body)); }
      catch (err) { m.querySelector('#pf-id-err').textContent = err.message; }
    });
    m.querySelector('#pf-id-cancel').addEventListener('click', closeModal);
    m.querySelector('#pf-id-name').focus();
  }

  async function openInvite() {
    const m = openModal(`
      <h2>Invite someone to the team</h2>
      <p class="pf-id-sub">Create a link they open once to join. It works on your network and can only be used a single time.</p>
      <label class="pf-id-field"><span>Their role</span><select id="pf-id-role">
        <option>Editor</option><option>Writer</option><option>Illustrator</option><option>Reviewer</option><option>Contributor</option><option>Owner</option>
      </select></label>
      ${field('Their name (optional)', 'pf-id-iname', 'maxlength="80"')}
      <label class="pf-id-field"><span>Invite link</span><input id="pf-id-link" readonly placeholder="Click Generate"></label>
      <p class="pf-id-err" id="pf-id-err"></p>
      <div class="pf-id-modal-foot"><button id="pf-id-gen" class="primary" type="button">Generate link</button><button id="pf-id-copy" class="ghost" type="button" disabled>Copy</button><button id="pf-id-cancel" class="ghost" type="button">Close</button></div>`);
    m.querySelector('#pf-id-gen').addEventListener('click', async () => {
      try {
        const r = await api('POST', '/invites', { role: m.querySelector('#pf-id-role').value, name: m.querySelector('#pf-id-iname').value });
        const url = `${location.origin}/profile.html?invite=${encodeURIComponent(r.token)}`;
        m.querySelector('#pf-id-link').value = url;
        m.querySelector('#pf-id-copy').disabled = false;
      } catch (err) { m.querySelector('#pf-id-err').textContent = err.message; }
    });
    m.querySelector('#pf-id-copy').addEventListener('click', () => { const i = m.querySelector('#pf-id-link'); i.select(); try { navigator.clipboard.writeText(i.value); } catch (_) { document.execCommand('copy'); } m.querySelector('#pf-id-copy').textContent = 'Copied!'; });
    m.querySelector('#pf-id-cancel').addEventListener('click', closeModal);
  }

  async function openJoin(inviteToken) {
    let inv = null;
    try { inv = await api('GET', '/invites/' + encodeURIComponent(inviteToken)); } catch (_) {}
    if (!inv) return openModal(`<h2>Invite not valid</h2><p class="pf-id-sub">This invite link is invalid or has already been used. Ask the owner for a new one.</p><div class="pf-id-modal-foot"><button id="pf-id-cancel" class="primary" type="button">OK</button></div>`).querySelector('#pf-id-cancel').addEventListener('click', closeModal);
    const m = openModal(`
      <h2>Join the team${inv.by ? ` — invited by ${esc(inv.by)}` : ''}</h2>
      <p class="pf-id-sub">You'll join as <b>${esc(inv.role)}</b>. Set up your profile:</p>
      ${field('Your name', 'pf-id-name', `value="${esc(inv.name || '')}" maxlength="80"`)}
      ${field('Email (optional)', 'pf-id-email', 'type="email" maxlength="160"')}
      ${field('Pen name / author name (optional)', 'pf-id-pen', 'maxlength="120"')}
      ${field('PIN (optional)', 'pf-id-pin2', 'type="password" inputmode="numeric" placeholder="Leave blank for none"')}
      <p class="pf-id-err" id="pf-id-err"></p>
      <div class="pf-id-modal-foot"><button id="pf-id-join" class="primary" type="button">Join &amp; sign in</button></div>`);
    m.querySelector('#pf-id-join').addEventListener('click', async () => {
      const body = { name: m.querySelector('#pf-id-name').value, email: m.querySelector('#pf-id-email').value, penName: m.querySelector('#pf-id-pen').value, pin: m.querySelector('#pf-id-pin2').value };
      try {
        finishSignIn(await api('POST', '/invites/' + encodeURIComponent(inviteToken) + '/accept', body));
        // Drop the ?invite= from the URL so a refresh doesn't re-trigger it.
        history.replaceState(null, '', location.pathname);
      } catch (err) { m.querySelector('#pf-id-err').textContent = err.message; }
    });
    m.querySelector('#pf-id-name').focus();
  }

  function finishSignIn(res) {
    if (res && res.token) setToken(res.token);
    me = (res && res.profile) || null;
    closeModal(); renderChip();
    document.dispatchEvent(new CustomEvent('pf-identity', { detail: me }));
  }
  async function signOut() {
    try { await api('DELETE', '/session'); } catch (_) {}
    setToken(''); me = null; renderChip();
    document.dispatchEvent(new CustomEvent('pf-identity', { detail: null }));
    if (chip) chip.classList.remove('open');
  }

  async function refresh() {
    try { const r = await api('GET', '/me'); me = r.profile || null; if (!me) setToken(''); }
    catch (_) { me = null; }
    renderChip();
    if (!ready) { ready = true; readyCbs.splice(0).forEach((cb) => { try { cb(me); } catch (_) {} }); }
    document.dispatchEvent(new CustomEvent('pf-identity', { detail: me }));
    return me;
  }

  window.PFIdentity = {
    me: () => me,
    token,
    authHeaders,
    onReady: (cb) => { ready ? cb(me) : readyCbs.push(cb); },
    refresh,
    signOut,
    openSignIn,
  };

  function boot() {
    mountChip();
    // Only auto-open the join flow for a real workspace invite token (48 hex
    // chars). The Page Editor has its own legacy base64 ?invite= links — leave
    // those to it so the two don't collide.
    const inv = new URLSearchParams(location.search).get('invite');
    refresh().then(() => { if (inv && /^[a-f0-9]{48}$/i.test(inv)) openJoin(inv); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
