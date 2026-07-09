/* Profile & Team page — edit your own profile; owners manage the roster + invites. */
(function () {
  const WS = '/api/workspace';
  const $ = (id) => document.getElementById(id);
  const show = (el, on) => el.classList.toggle('hidden', !on);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const initials = (n) => String(n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  async function api(method, path, body) {
    const r = await fetch(WS + path, { method, headers: PFIdentity.authHeaders(!!body), body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || (r.status + ' error'));
    return data;
  }
  const setStatus = (el, t, k) => { el.textContent = t || ''; el.className = 'status' + (k ? ' ' + k : ''); };

  function renderProfile(me) {
    $('pName').value = me.name || '';
    $('pEmail').value = me.email || '';
    $('pPen').value = me.penName || '';
    $('pColor').value = me.color || '#3b6fd4';
    $('pRole').value = me.role;
    const owner = me.role === 'Owner';
    $('pRole').disabled = !owner;
    $('roleHint').textContent = owner ? 'As an owner you can set your own role and others\'.' : 'Only an owner can change roles.';
    $('pinState').textContent = me.hasPin
      ? 'A PIN is set. Enter a new one below to change it, or tick “Remove my PIN”.'
      : 'No PIN set — anyone on the workspace can pick your profile.';
  }

  async function saveProfile(me) {
    const patch = {
      name: $('pName').value, email: $('pEmail').value, penName: $('pPen').value, color: $('pColor').value,
    };
    if (me.role === 'Owner') patch.role = $('pRole').value;
    if ($('pClearPin').checked) patch.pin = '';
    else if ($('pPin').value) patch.pin = $('pPin').value;
    try {
      await api('PATCH', '/profiles/' + me.id, patch);
      setStatus($('pStatus'), 'Saved.', 'ok');
      $('pPin').value = ''; $('pClearPin').checked = false;
      PFIdentity.refresh(); // update the chip + cached profile
    } catch (err) { setStatus($('pStatus'), err.message, 'err'); }
  }

  async function renderTeam(me) {
    let list = [];
    try { list = await api('GET', '/profiles'); } catch (_) { return; }
    const box = $('teamList');
    box.innerHTML = '';
    for (const p of list) {
      const row = document.createElement('div');
      row.className = 'prow';
      row.style.gridTemplateColumns = '28px 1fr auto auto';
      row.innerHTML = `
        <span class="pf-id-av" style="background:${esc(p.color || '#3b6fd4')}">${esc(initials(p.name))}</span>
        <span><b>${esc(p.name)}</b>${p.id === me.id ? ' <small>(you)</small>' : ''}${p.hasPin ? ' 🔒' : ''}<br><small style="color:var(--muted)">${esc(p.email || '')}</small></span>
        <span class="aud-badge aud-adult" style="text-transform:none">${esc(p.role)}</span>`;
      const del = document.createElement('button');
      del.className = 'iconbtn del'; del.type = 'button'; del.textContent = 'Remove';
      del.disabled = p.id === me.id; // don't remove yourself here
      del.title = p.id === me.id ? "Use another owner's account to remove yourself" : 'Remove from team';
      del.addEventListener('click', async () => {
        if (!window.confirm(`Remove ${p.name} from the team?`)) return;
        try { await api('DELETE', '/profiles/' + p.id); renderTeam(me); } catch (err) { setStatus($('teamStatus'), err.message, 'err'); }
      });
      row.appendChild(del);
      box.appendChild(row);
    }
  }

  function wireInvite() {
    $('invite').addEventListener('click', () => show($('inviteBox'), true));
    $('iGen').addEventListener('click', async () => {
      try {
        const r = await api('POST', '/invites', { role: $('iRole').value, name: $('iName').value });
        $('iLink').value = `${location.origin}/profile.html?invite=${encodeURIComponent(r.token)}`;
        $('iCopy').disabled = false;
        setStatus($('teamStatus'), 'Link ready — send it to them.', 'ok');
      } catch (err) { setStatus($('teamStatus'), err.message, 'err'); }
    });
    $('iCopy').addEventListener('click', () => {
      const i = $('iLink'); i.select();
      try { navigator.clipboard.writeText(i.value); } catch (_) { document.execCommand('copy'); }
      $('iCopy').textContent = 'Copied!';
    });
  }

  function render(me) {
    show($('signedOut'), !me);
    show($('profilePanel'), !!me);
    show($('teamPanel'), !!me && me.role === 'Owner');
    if (me) { renderProfile(me); if (me.role === 'Owner') renderTeam(me); }
  }

  $('doSignIn').addEventListener('click', () => PFIdentity.openSignIn());
  $('pSave').addEventListener('click', () => saveProfile(PFIdentity.me()));
  wireInvite();

  // Re-render whenever identity changes (sign in/out, save).
  document.addEventListener('pf-identity', (e) => render(e.detail));
  PFIdentity.onReady(render);
})();
