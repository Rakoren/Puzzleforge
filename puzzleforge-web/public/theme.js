/* Nova Form light/dark theme for the teacher web app.
   Sets data-theme on <html> from the saved choice; if none, CSS follows the OS
   (prefers-color-scheme). A toggle button is injected into the top bar. Kept
   separate from the Page Editor, which has its own theme handling. */
(function () {
  var KEY = 'pf_web_theme';
  var root = document.documentElement;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(t) {
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme'); // fall back to OS preference
  }
  function osDark() { return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }
  function current() { var s = saved(); return s || (osDark() ? 'dark' : 'light'); }

  apply(saved()); // run at parse time to avoid a flash

  function inject() {
    var bar = document.querySelector('.topbar');
    if (!bar || document.getElementById('themeToggle')) return;
    var btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle light or dark theme');
    btn.title = 'Toggle light / dark';
    function label() { btn.textContent = current() === 'dark' ? '☀' : '☾'; }
    label();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) { /* */ }
      apply(next);
      label();
    });
    bar.appendChild(btn);
  }
  if (document.readyState !== 'loading') inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
