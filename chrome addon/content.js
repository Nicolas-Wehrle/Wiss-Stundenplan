// Runs on wiss.tocco.ch/extranet pages.
// 1) Tells the background that an extranet page loaded (so it can sync right after a manual login).
// 2) On the Stundenplan page, reads the table and learns teacher names (the REST API hides them
//    from students). When opened by the add-on itself (#wiss-auto), it also clicks through all
//    pages of the table, then reports back so the hidden window can close.

chrome.runtime.sendMessage({ type: 'extranetLoaded' }).catch?.(() => {});

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

(function autoSignIn() {
  let started = location.hash.includes('wiss-login');
  try {
    if (started) sessionStorage.setItem('wiss:login', String(Date.now()));
    else started = Date.now() - (+sessionStorage.getItem('wiss:login') || 0) < 120000;
  } catch (e) {}
  if (!started) return;
  fetch('/nice2/username?_dc=' + Date.now(), { credentials: 'include', cache: 'no-store' })
    .then((r) => r.json()).then((j) => { if (!j || !j.username || j.username === 'anonymous') wissPressSso(); }).catch(() => wissPressSso());
})();


(function learnTeachers() {
  if (!/Stundenplan/i.test(decodeURIComponent(location.pathname))) return;
  const AUTO = location.hash.includes('wiss-auto');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function scrapePage() {
    const heads = [...document.querySelectorAll('.x-grid3-hd-inner')];
    const idx = (re) => {
      const h = heads.find((x) => re.test(x.textContent.trim()));
      const m = h && h.className.match(/x-grid3-hd-(\d+)/);
      return m ? m[1] : null;
    };
    const cDate = idx(/^Von-Bis/i), cTeacher = idx(/^Dozent/i), cEvent = idx(/^Veranstaltung/i);
    if (cDate == null || cTeacher == null || cEvent == null) return null;
    const cell = (row, i) => {
      const td = row.querySelector('.x-grid3-td-' + i);
      return td ? td.textContent.replace(/\s+/g, ' ').trim() : '';
    };
    const rows = [];
    for (const row of document.querySelectorAll('.x-grid3-row')) {
      const date = cell(row, cDate), teacher = cell(row, cTeacher), label = cell(row, cEvent);
      if (!date || !label) continue;
      rows.push({ key: date.split(' - ')[0] + '|' + label, label, teacher });
    }
    return rows;
  }
  const signature = () => [...document.querySelectorAll('.x-grid3-row')].map((r) => r.textContent).join('|').slice(0, 300);

  async function waitForGrid(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const r = scrapePage();
      if (r && r.length) return true;
      await sleep(500);
    }
    return false;
  }

  async function auto() {
    const all = [];
    if (await waitForGrid(90000)) {
      for (let page = 0; page < 20; page++) {
        all.push(...(scrapePage() || []));
        const btn = document.querySelector('.x-tbar-page-next');
        const tbl = btn && btn.closest('table');
        if (!btn || (tbl && tbl.classList.contains('x-item-disabled'))) break;
        const before = signature();
        btn.click();
        for (let i = 0; i < 60 && signature() === before; i++) await sleep(250);
        await sleep(300);
      }
    }
    chrome.runtime.sendMessage({ type: 'teachers', rows: all, done: true }).catch?.(() => {});
  }

  if (AUTO) { auto(); return; }

  // Normal visit: just learn from whatever is visible, never click anything.
  let lastSent = '';
  const passive = () => {
    const rows = scrapePage();
    const sig = JSON.stringify(rows);
    if (rows && rows.length && sig !== lastSent) {
      lastSent = sig;
      chrome.runtime.sendMessage({ type: 'teachers', rows }).catch?.(() => {});
    }
  };
  const obs = new MutationObserver(() => { clearTimeout(passive.t); passive.t = setTimeout(passive, 600); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(passive, 1500);
})();
