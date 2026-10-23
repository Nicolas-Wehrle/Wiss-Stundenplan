// ---------- entry: which page is this? ----------
// https://wiss.tocco.ch/extranet/?stundenplan  → becomes the app
// any other wiss.tocco.ch page                 → small "Stundenplan" button; after a sign-in
//                                                  started by the app, jump back automatically
const APP_PATH = '/extranet/?stundenplan';
const isApp = /[?&]stundenplan\b/.test(location.search) || location.hash === '#stundenplan';

// Sign-in started by the app/add-on: the extranet shows its own page with a red "WISS Office 365"
// button instead of going to Microsoft. Press it for the user (only that button, never any password).
// At most twice in 2 minutes, so a failing sign-in can't loop.
function wissPressSso(maxWait) {
  const KEY = 'wiss:ssoClicks';
  let clicks = [];
  try { clicks = JSON.parse(sessionStorage.getItem(KEY) || '[]').filter((t) => Date.now() - t < 120000); } catch (e) {}
  if (clicks.length >= 2) return;
  const find = () => [...document.querySelectorAll('a, button, [role=button], input[type=submit], input[type=button]')]
    .find((el) => /office\s*365|microsoft/i.test(el.textContent || el.value || '') && el.getClientRects().length);
  let done = false, mo = null;
  const tryClick = () => {
    if (done) return true;
    const el = find();
    if (!el) return false;
    done = true; if (mo) mo.disconnect();
    try { clicks.push(Date.now()); sessionStorage.setItem(KEY, JSON.stringify(clicks)); } catch (e) {}
    el.click();
    return true;
  };
  if (tryClick()) return;
  mo = new MutationObserver(tryClick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => { if (mo) mo.disconnect(); }, maxWait || 20000);
}

if (!isApp) {
  let back = false;
  try { back = sessionStorage.getItem('wiss:return') === '1'; } catch (e) {}
  const onReady = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
  onReady(() => {
    const b = document.createElement('a');
    b.href = APP_PATH;
    b.textContent = back ? 'Anmelden, danach gehts zurück zum Stundenplan' : 'Stundenplan';
    b.style.cssText = 'position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483647;background:#b52a33;color:#fff;' +
      'font:600 14px/1 -apple-system,system-ui,sans-serif;padding:12px 16px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.25)';
    document.body.appendChild(b);
  });
  if (back) {
    onReady(() => wissPressSso());
    // signed in? → back to the app (checks the session every 1.5 s for up to 3 min)
    const t0 = Date.now();
    const check = async () => {
      try {
        const r = await fetch('/nice2/username?_dc=' + Date.now(), { credentials: 'include', cache: 'no-store' });
        const j = await r.json();
        if (j && j.username && j.username !== 'anonymous') {
          try { sessionStorage.removeItem('wiss:return'); } catch (e) {}
          location.replace(APP_PATH);
          return;
        }
      } catch (e) { /* not ready yet */ }
      if (Date.now() - t0 < 180000) setTimeout(check, 1500);
    };
    setTimeout(check, 800);
  }
  return;
}

// ---------- the app: replace the school page with our own ----------
try { window.stop(); } catch (e) {}                  // Tocco's own scripts never load
if (!/Mobile/i.test(navigator.userAgent) && !/[?&]full\b/.test(location.search)) {
  history.replaceState(null, '', location.pathname + '?stundenplan&full');   // iPad: big layout
}
function takeOver() {
  if (!document.documentElement) document.appendChild(document.createElement('html'));
  document.documentElement.className = 'ios';
  document.documentElement.innerHTML = '<head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<meta name="theme-color" content="#b52a33"><title>Stundenplan</title></head><body>' + BODY + '</body>';
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  // if Tocco still manages to add something, keep only our own nodes
  new MutationObserver(() => {
    for (const n of [...document.body.children]) if (!n.id && !n.matches('header.top, nav.tabs, main, .cpop, iframe')) n.remove();
  }).observe(document.body, { childList: true });
}

