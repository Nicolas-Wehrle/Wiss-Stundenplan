(() => {
// WISS Stundenplan – background sync
// Talks directly to Tocco's REST API using your existing login cookies.
// If the session has expired it re-logs in silently via Microsoft SSO in a
// minimized window, fetches, and closes the window again.

if (typeof importScripts === 'function') importScripts('demo.js', 'sync-core.js', 'sync-engine.js', 'sync-background.js');

const BASE = 'https://wiss.tocco.ch';
const EXTRANET = BASE + '/extranet/';
const EXTRANET_LOGIN = EXTRANET + '#wiss-login';   // content.js presses "WISS Office 365" on this page
const STUNDENPLAN = BASE + '/extranet/Meine-Bildung/Stundenplan-f%C3%BCr-Studierende';
const KEEPALIVE_MIN = 20;          // Tocco session times out after 30 min
const MIN_GAP_MS = 60 * 1000;      // don't refetch more than once a minute
const LOGIN_TIMEOUT_MS = 30 * 1000;   // give up on a silent re-login after this
const NEEDS_USER_MS = 12 * 1000;     // …or earlier if Microsoft's page just sits there waiting for input

// ---------- self-contained helpers (also injected into a Tocco tab) ----------
// These must not reference anything outside their own body.

async function toccoWhoAmI() {
  const r = await fetch('https://wiss.tocco.ch/nice2/username?_dc=' + Date.now(), {
    credentials: 'include', cache: 'no-store', signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined)
  });
  const j = await r.json();
  if (!j || !j.username || j.username === 'anonymous' || !j.userEntityPk) return null;
  return { userPk: j.userEntityPk, username: j.username };
}

// Lessons + grades + room list in one go.
async function toccoFetchAll(userPk, fromStr, toStr) {
  const API = 'https://wiss.tocco.ch/nice2/rest/entities/2.0/';
  const pk = parseInt(userPk, 10);
  if (!pk) throw new Error('bad user pk');

  const val = (p) => (p && p.value != null ? p.value : null);
  const list = (p) => { const v = val(p); return !v ? [] : Array.isArray(v) ? v : [v]; };
  const labels = (p) => list(p).map((e) => (e && e.paths && e.paths.label ? e.paths.label.value : '')).filter(Boolean).join(', ');
  const sub = (e, k) => (e && e.paths && e.paths[k] ? e.paths[k].value : null);

  async function getAll(model, paths, where, sort) {
    let url = API + model + '?_limit=200' + (sort ? '&_sort=' + encodeURIComponent(sort) : '') +
      '&_paths=' + encodeURIComponent(paths.join(',')) + (where ? '&_where=' + encodeURIComponent(where) : '');
    const out = [];
    for (let page = 0; url && page < 30; page++) {
      const r = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }, signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined) });
      if (!r.ok) throw new Error(model + ' ' + r.status);
      const j = await r.json();
      out.push(...(j.data || []));
      url = j._links && j._links.next ? j._links.next.href : null;
    }
    return out;
  }

  // 1) lessons
  const resv = await getAll('Reservation',
    ['date_from', 'date_till', 'comment', 'relEvent.label', 'relEvent.class_label', 'relRoom.label', 'relType_of_execution.label'],
    'relReservation_registration.relRegistration.relUser.pk == ' + pk +
      ' and date_from >= datetime:"' + fromStr + '" and date_from < datetime:"' + toStr + '"',
    'date_from');
  const lessons = resv.map((d) => {
    const p = d.paths || {};
    const ev = val(p.relEvent);
    return {
      id: d.key,
      event: ev ? ev.key : null,
      start: val(p.date_from),
      end: val(p.date_till),
      label: (sub(ev, 'label') || '').replace(/\s+/g, ' ').trim(),
      cls: sub(ev, 'class_label') || '',
      room: labels(p.relRoom),
      type: labels(p.relType_of_execution),
      comment: (val(p.comment) || '').trim()
    };
  });

  // 2) grades (per module: exam structure, weights, grades) – optional
  let grades = null;
  try {
    const gd = await getAll('Input_data',
      ['grade', 'relInput.relEvent.label', 'relInput.relInput_status.label', 'relInput.relInput_node.label',
        'relRating.value', 'relRating.relExam.label', 'relRating.relExam.nr', 'relRating.relExam.weight'],
      'relUser.pk == ' + pk);
    grades = gd.map((d) => {
      const p = d.paths || {};
      const inp = val(p.relInput);
      const ev = sub(inp, 'relEvent');
      const exams = list(p.relRating).map((r) => {
        const ex = sub(r, 'relExam');
        return { nr: sub(ex, 'nr'), label: (sub(ex, 'label') || '').trim(), weight: sub(ex, 'weight'), grade: sub(r, 'value') };
      }).sort((a, b) => (a.nr || 0) - (b.nr || 0));
      const st = sub(inp, 'relInput_status');
      const node = sub(inp, 'relInput_node');
      return {
        event: ev ? ev.key : null,
        label: ((ev && sub(ev, 'label')) || '').replace(/\s+/g, ' ').trim(),
        part: (node && sub(node, 'label')) || '',
        status: (st && sub(st, 'label')) || '',
        grade: val(p.grade),
        exams
      };
    });
  } catch (e) { grades = null; }

  // 3) rooms (metadata) – optional
  let rooms = null;
  try {
    const rd = await getAll('Room', ['label', 'floor', 'seats', 'surface', 'comment', 'active', 'relBuilding.label'], null, 'label');
    rooms = rd.map((d) => {
      const p = d.paths || {};
      return {
        label: (val(p.label) || '').trim(), floor: (val(p.floor) || '').replace(/\s+/g, ''),
        seats: val(p.seats), surface: val(p.surface), comment: val(p.comment) || '',
        active: val(p.active) !== false, building: labels(p.relBuilding)
      };
    });
  } catch (e) { rooms = null; }

  // 4) attendance: per-lesson status + per-module totals – optional
  let absences = null, attendance = null;
  try {
    const rr = await getAll('Reservation_registration',
      ['comment', 'missed_lessons', 'presence_rate', 'relRegistration_accomplishment_status.unique_id',
        'relRegistration_accomplishment_status.label', 'relReservation.date_from', 'relReservation.date_till', 'relReservation.relEvent.label'],
      'relRegistration.relUser.pk == ' + pk);
    const counts = {};
    absences = [];
    for (const d of rr) {
      const p = d.paths || {};
      const st = val(p.relRegistration_accomplishment_status);
      const code = (st && sub(st, 'unique_id')) || '';
      counts[code || 'none'] = (counts[code || 'none'] || 0) + 1;
      if (!code || code === 'attended' || code === 'open') continue;
      const res = val(p.relReservation);
      const ev = sub(res, 'relEvent');
      absences.push({
        lesson: res ? res.key : null, status: code, statusLabel: (st && sub(st, 'label')) || code,
        start: sub(res, 'date_from'), end: sub(res, 'date_till'),
        label: ((ev && sub(ev, 'label')) || '').replace(/\s+/g, ' ').trim(),
        missed: val(p.missed_lessons), rate: val(p.presence_rate), comment: (val(p.comment) || '').trim()
      });
    }
    absences.sort((a, b) => String(b.start).localeCompare(String(a.start)));
    const regs = await getAll('Registration',
      ['duration_hour_total', 'duration_hour_actual', 'presence_rate', 'duration_hour_excused', 'duration_hour_unexcused',
        'lessons_total_desired', 'lessons_total_actual', 'presence_rate_total',
        'relEvent.label', 'relEvent.abbreviation', 'relEvent.minimal_presence', 'relEvent.relEvent_type.label'],
      'relUser.pk == ' + pk);
    attendance = { counts, modules: regs.map((d) => {
      const p = d.paths || {};
      const ev = val(p.relEvent);
      const t = ev && sub(ev, 'relEvent_type');
      return {
        event: ev ? ev.key : null, label: ((ev && sub(ev, 'label')) || '').replace(/\s+/g, ' ').trim(),
        abbr: (ev && sub(ev, 'abbreviation')) || '', type: (t && sub(t, 'label')) || '', min: ev ? sub(ev, 'minimal_presence') : null,
        total: val(p.duration_hour_total), actual: val(p.duration_hour_actual), rate: val(p.presence_rate),
        excused: val(p.duration_hour_excused), unexcused: val(p.duration_hour_unexcused),
        semTotal: val(p.lessons_total_desired), semActual: val(p.lessons_total_actual), semRate: val(p.presence_rate_total)
      };
    }) };
  } catch (e) { absences = null; attendance = null; }

  return { lessons, grades, rooms, absences, attendance };
}

// All room bookings of the whole school for one day (other classes are anonymised by Tocco).
async function toccoFetchRoomDay(fromStr, toStr) {
  const API = 'https://wiss.tocco.ch/nice2/rest/entities/2.0/Reservation';
  const paths = ['date_from', 'date_till', 'relRoom.label', 'relEvent.label', 'relEvent.class_label'];
  let url = API + '?_limit=300&_sort=date_from&_paths=' + encodeURIComponent(paths.join(',')) +
    '&_where=' + encodeURIComponent('date_from < datetime:"' + toStr + '" and date_till > datetime:"' + fromStr + '"');
  const val = (p) => (p && p.value != null ? p.value : null);
  const out = [];
  for (let page = 0; url && page < 10; page++) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }, signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined) });
    if (!r.ok) throw new Error('Räume ' + r.status);
    const j = await r.json();
    for (const d of j.data || []) {
      const p = d.paths || {};
      const ev = val(p.relEvent);
      const rooms = val(p.relRoom);
      const rl = (Array.isArray(rooms) ? rooms : rooms ? [rooms] : []).map((x) => (x.paths && x.paths.label ? x.paths.label.value : '').trim()).filter(Boolean);
      for (const room of rl) {
        out.push({
          id: d.key, room, start: val(p.date_from), end: val(p.date_till),
          label: ev && ev.paths && ev.paths.label ? (ev.paths.label.value || '').replace(/\s+/g, ' ').trim() : '',
          cls: ev && ev.paths && ev.paths.class_label ? ev.paths.class_label.value || '' : ''
        });
      }
    }
    url = j._links && j._links.next ? j._links.next.href : null;
  }
  return out;
}

// ---------- utils ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00`;

function range() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 200);   // back to semester start → lesson counting per module
  const to = new Date();
  to.setDate(to.getDate() + 300);
  return [fmt(from), fmt(to)];
}

async function getState() {
  return chrome.storage.local.get(['lessons', 'lastSync', 'status', 'error', 'lastAttempt', 'demoMode']);
}
async function setStatus(status, extra = {}) {
  await chrome.storage.local.set({ status, ...extra });
}
async function runInTab(tabId, func, args = [], ms = 60000) {
  let timer;
  const to = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Tab antwortet nicht')), ms); });
  try {
    const [res] = await Promise.race([chrome.scripting.executeScript({ target: { tabId }, func, args }), to]);
    return res ? res.result : undefined;
  } finally { clearTimeout(timer); }
}

// small diagnose log of the last refresh (shown under Einstellungen → Diagnose)
let syncLog = [], syncT0 = 0;
function slog(msg) {
  const s = ((Date.now() - syncT0) / 1000).toFixed(1);
  syncLog.push(`+${s}s ${msg}`);
  if (syncLog.length > 40) syncLog.shift();
  chrome.storage.local.set({ syncLog: { at: syncT0, lines: syncLog } }).catch(() => {});
}

async function waitForTeachersDone(prevStamp, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const { teachersDone } = await chrome.storage.local.get('teachersDone');
    if (teachersDone && teachersDone !== prevStamp) return true;
    await sleep(700);
  }
  return false;
}

// Teacher names are only visible in the extranet's Stundenplan table. When needed (first run,
// once a week, or a module without a known teacher), open that page in a minimized window;
// content.js clicks through all table pages and reports back, then the window closes.
let teacherJob = null;
async function teachersNeeded() {
  const { teachers = {}, teachersDone = 0, lessons = [] } = await chrome.storage.local.get(['teachers', 'teachersDone', 'lessons']);
  if (!teachersDone || Date.now() - teachersDone > 7 * 86400000) return true;
  const now = Date.now();
  const future = new Set(lessons.filter((l) => new Date(l.end) > now && !/^Sport/i.test(l.label)).map((l) => l.label));
  const missing = [...future].filter((lab) => !teachers['l:' + lab]);
  // a new module appeared → look again (at most once a day)
  return missing.length > 0 && now - teachersDone > 86400000;
}
function learnTeachers(tabId = null) {
  if (teacherJob) return teacherJob;
  teacherJob = (async () => {
    if ((await chrome.storage.local.get('demoMode')).demoMode) return;
    const { teachersDone: prev = 0 } = await chrome.storage.local.get('teachersDone');
    let hidden = null;
    try {
      if (tabId) await chrome.tabs.update(tabId, { url: STUNDENPLAN + '#wiss-auto' });
      else hidden = await openHidden(STUNDENPLAN + '#wiss-auto');
      const ok = await waitForTeachersDone(prev, 120000);
      if (!ok) await chrome.storage.local.set({ teachersDone: Date.now() - 6 * 86400000 }); // retry tomorrow, not every open
    } finally {
      if (hidden) await hidden.close();
    }
  })().finally(() => { teacherJob = null; });
  return teacherJob;
}

// Opens a page out of the way: a minimized window on desktop, a background tab where
// windows aren't available (Firefox for Android). Returns { tabId, close() }.
// Out of sight: Chrome uses a minimized window. Firefox can't minimize a new window (on Linux it pops
// up in front), so there it is a tab that is hidden from the tab bar (tabHide permission).
// reveal() brings it to the front, but only when you tap "Anmelden".
const IS_FIREFOX = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || '');
async function openHidden(url) {
  if (chrome.windows && chrome.windows.create && !IS_FIREFOX) {
    for (const opts of [{ url, focused: false, state: 'minimized' }, { url, focused: false }]) {
      try {
        const win = await chrome.windows.create(opts);
        return {
          tabId: win.tabs[0].id, close: () => chrome.windows.remove(win.id).catch(() => {}),
          reveal: async () => { try { await chrome.windows.update(win.id, { state: 'normal', focused: true }); } catch (e) {} },
        };
      } catch (e) { /* try next */ }
    }
  }
  const tab = await chrome.tabs.create({ url, active: false });
  const api = typeof browser !== 'undefined' ? browser : chrome;
  if (IS_FIREFOX && api.tabs && api.tabs.hide) { try { await api.tabs.hide(tab.id); } catch (e) {} }
  return {
    tabId: tab.id, close: () => chrome.tabs.remove(tab.id).catch(() => {}),
    reveal: async () => {
      try { if (IS_FIREFOX && api.tabs && api.tabs.show) await api.tabs.show(tab.id); } catch (e) {}
      try { await chrome.tabs.update(tab.id, { active: true }); } catch (e) {}
      try { if (tab.windowId != null && chrome.windows) await chrome.windows.update(tab.windowId, { focused: true }); } catch (e) {}
    },
  };
}

// A sign-in that needs you (Microsoft asks for something) stays open but hidden. Nothing pops up by
// itself: the top of the app says "Anmeldung nötig", and ↻ (or "Anmelden") shows the waiting page.
let pendingLogin = null;   // { tabId, reveal, close, at }
const shownTabs = new Set();   // sign-in pages you can see; closing one of them loads again
let loginWanted = 0;           // you pressed ↻: a sign-in that needs you may show itself for a minute
const loginInteractive = () => Date.now() - loginWanted < 60000;
async function revealLogin() {
  if (!pendingLogin) return false;
  const p = pendingLogin;
  try { await chrome.tabs.get(p.tabId); } catch (e) { pendingLogin = null; return false; }
  p.shown = true; shownTabs.add(p.tabId); slog('Anmeldefenster wird angezeigt');
  await p.reveal();
  return true;
}
async function openLoginPage() {
  if (await revealLogin()) return;
  try { const t = await chrome.tabs.create({ url: EXTRANET_LOGIN }); if (t && t.id != null) shownTabs.add(t.id); } catch (e) {}
}
function parkLogin(h) {
  if (pendingLogin && pendingLogin.tabId !== h.tabId) pendingLogin.close();
  pendingLogin = { ...h, at: Date.now() };
  setTimeout(() => { if (pendingLogin && pendingLogin.tabId === h.tabId && !pendingLogin.shown) { pendingLogin.close(); pendingLogin = null; } }, 10 * 60000);
}

// ---------- silent login in a minimized window ----------

// The sign-in runs out of sight (a minimized window; in the apps a page behind the app).
// If Microsoft really needs you (password, new device …) the page waits hidden until you press ↻.
const IS_APP = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id === 'wiss-stundenplan-app';

// runs inside the sign-in page (self-contained: no outside variables)
function pressSsoInPage() {
  const el = [...document.querySelectorAll('a, button, [role=button], input[type=submit], input[type=button]')]
    .find((x) => /office\s*365|microsoft/i.test(x.textContent || x.value || '') && x.getClientRects().length);
  if (!el) return false;
  el.click();
  return true;
}

async function silentLogin() {
  const hidden = await openHidden(EXTRANET_LOGIN);
  let shown = false, needsYou = false;
  const show = async (why) => { if (shown) return; shown = true; shownTabs.add(hidden.tabId); slog(why); try { await hidden.reveal(); } catch (e) {} };
  let keepOpen = false;
  let beat = Date.now();
  const tabId = hidden.tabId;
  const end = Date.now() + LOGIN_TIMEOUT_MS;
  let foreignSince = 0, lastSeen = '', baseSince = 0, reloads = 0, pressed = false;
  try {
    while (Date.now() < end) {
      await sleep(800);
      let tab;
      try { tab = await chrome.tabs.get(tabId); } catch (e) {
        slog('Anmeldefenster weg');
        try { const me = await toccoWhoAmI(); if (me) { slog('Doch angemeldet'); return { me, tabId: null, close: async () => {} }; } } catch (e2) {}
        return null;
      }
      const host = (() => { try { return new URL(tab.url).host; } catch (e) { return '?'; } })();
      const seen = host + ' ' + tab.status;
      if (seen !== lastSeen) { slog('Anmeldung: ' + seen); lastSeen = seen; beat = Date.now(); }
      else if (Date.now() - beat > 5000) { slog('… warte (' + seen + ')'); beat = Date.now(); }
      if (tab.url && tab.url.startsWith(BASE) && tab.status === 'complete') {
        foreignSince = 0;
        // The hidden page shares the cookie jar with us → ask the server directly first
        // (an injected check can hang on some phones), then via the page as a fallback.
        let me = null;
        try { me = await toccoWhoAmI(); } catch (e) { slog('Sitzung direkt: ' + (e && e.message)); }
        if (!me) { try { me = await runInTab(tabId, toccoWhoAmI, [], 10000); } catch (e) { slog('Sitzung im Fenster: ' + (e && e.message)); } }
        if (me) return { me, tabId, close: hidden.close };
        // Back on the extranet but not signed in: the extranet shows its own page with a
        // "WISS Office 365" button. content.js presses it; this is the fallback from here.
        if (!baseSince) baseSince = Date.now();
        if (!pressed && Date.now() - baseSince > 1500) {
          pressed = true;
          try { const r = await runInTab(tabId, pressSsoInPage, [], 5000); if (r) { slog('Knopf "WISS Office 365" gedrückt'); baseSince = Date.now(); } } catch (e) {}
        }
        // still nothing: load the page again (an expired session cookie can also block the way)
        else if (pressed && Date.now() - baseSince > 4000 && reloads < 2) {
          reloads++; baseSince = 0; pressed = false;
          slog('Extranet ohne Anmeldung, lade neu');
          // a fresh address, so it really loads again (only changing the #part would not)
          try { await chrome.tabs.update(tabId, { url: EXTRANET + '?wl=' + Date.now() + '#wiss-login' }); } catch (e) {}
        }
      } else if (tab.url && !tab.url.startsWith(BASE) && tab.status === 'complete') {
        // e.g. Microsoft's sign-in page asking for a password / account choice → needs the user
        baseSince = 0;
        if (!foreignSince) foreignSince = Date.now();
        else if (Date.now() - foreignSince > NEEDS_USER_MS) {
          slog('Microsoft wartet auf Eingabe');
          needsYou = true;
          break;
        }
      }
    }
    if (!needsYou) slog('Anmeldung: Zeit abgelaufen');
    // last check before asking you: maybe the sign-in went through after all
    try { const me = await toccoWhoAmI(); if (me) { slog('Doch angemeldet'); return { me, tabId, close: hidden.close }; } } catch (e) {}
    // still not signed in: you pressed ↻ → show the page now; otherwise it waits hidden for ↻
    // (also after a timeout: the page may finish once it's in front)
    if (loginInteractive()) await show('Anmeldefenster wird angezeigt');
    else { parkLogin(hidden); keepOpen = true; slog('Anmeldung wartet versteckt, bis du auf ↻ tippst'); }
    if (shown) keepOpen = true;   // you can see it (and may be typing in it) → never pull it away
    if (keepOpen) slog('Anmeldefenster bleibt offen, bitte dort anmelden');
    else await hidden.close();
    return null;
  } catch (e) {
    slog('Anmeldung Fehler: ' + (e && e.message));
    await hidden.close();
    return null;
  }
}

// ---------- main refresh ----------

// One refresh at a time. A refresh can never hang forever: after REFRESH_MAX_MS it is
// abandoned (status → error) and the next call starts a fresh one. A manual refresh
// also replaces one that has been running suspiciously long (e.g. the phone paused the app).
const REFRESH_MAX_MS = 90000;
let inflight = null, inflightAt = 0;
function refresh(opts = {}) {
  const age = Date.now() - inflightAt;
  if (inflight && (age > REFRESH_MAX_MS || ((opts.force || opts.resume) && age > 25000))) { slog('vorherige Aktualisierung hängt, starte neu'); inflight = null; }
  if (!inflight) {
    inflightAt = Date.now();
    syncT0 = inflightAt; syncLog = [];
    let timer;
    const watchdog = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Zeitüberschreitung, bitte nochmals aktualisieren')), REFRESH_MAX_MS); });
    const p = Promise.race([doRefresh(opts), watchdog])
      .catch(async (e) => { slog('Fehler: ' + ((e && e.message) || e)); await setStatus('error', { error: String((e && e.message) || e) }); })
      .finally(() => { clearTimeout(timer); if (inflight === p) inflight = null; });
    inflight = p;
  }
  return inflight;
}

async function doRefresh({ force = false, allowLogin = true, viaTab = null } = {}) {
  const st = await getState();
  if (st.demoMode) {
    const data = WissDemo.data();
    await chrome.storage.local.set({ ...data, lastSync: Date.now(), status: 'ok', error: null });
    return;
  }
  if (!force && st.lastSync && Date.now() - st.lastSync < MIN_GAP_MS && st.status === 'ok') return;

  // Quiet mode (default in browsers, always on iPhone, where a sign-in means leaving the page):
  // never open a window or tab by itself. The top of the app says "Anmeldung nötig" and ↻ signs in.
  const quiet = !!globalThis.__wissIOS || (!IS_APP && !((await chrome.storage.local.get('prefs')).prefs || {}).bgLogin);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { slog('Kein Internet'); await setStatus('offline', { error: null, lastAttempt: Date.now() }); return; }
  await setStatus('syncing', { lastAttempt: Date.now() });
  slog('Start' + (force ? ' (manuell)' : ''));
  const [from, to] = range();

  try {
    // 1) Session still valid → straight API call from here.
    let me = null;
    try { me = await toccoWhoAmI(); } catch (e) {
      slog('Sitzung prüfen fehlgeschlagen: ' + (e && e.message));
      // no connection (or far too slow): that's not a sign-in problem, so don't try to sign in
      const net = netProblem(e);
      if (net && !viaTab) { await setStatus('offline', { error: net === 'slow' ? 'slow' : null }); return; }
    }
    slog(me ? 'Sitzung gültig' : 'Keine Sitzung');
    if (me) {
      const data = await toccoFetchAll(me.userPk, from, to);
      slog(`Daten: ${data.lessons.length} Lektionen`);
      await save(data, me);
      slog('Fertig');
      if (allowLogin && !quiet && await teachersNeeded()) learnTeachers();   // runs in the background, not awaited
      return;
    }

    // 1b) A logged-in extranet tab is open → fetch through it.
    if (viaTab) {
      try {
        const tabMe = await runInTab(viaTab, toccoWhoAmI);
        if (tabMe) {
          const data = await runInTab(viaTab, toccoFetchAll, [tabMe.userPk, from, to]);
          if (data && Array.isArray(data.lessons)) { await save(data, tabMe); return; }
        }
      } catch (e) {}
    }

    // 2) Session expired → silent SSO in a minimized window (background tab on Android).
    if (!allowLogin) { await setStatus(st.lessons ? 'stale' : 'needsLogin'); return; }
    // a sign-in already waits for you and you pressed ↻ → show it
    if (loginInteractive() && await revealLogin()) { await setStatus('needsLogin', { error: null }); return; }
    // Never signed in on this device, or quiet mode → no hidden attempt. ↻ opens the sign-in page.
    const { user: knownUser } = await chrome.storage.local.get('user');
    if (quiet || !knownUser) {
      slog('Sitzung abgelaufen, wartet auf ↻');
      await setStatus('needsLogin', { error: null });
      if (loginInteractive()) await openLoginPage();
      return;
    }
    slog('Automatische Anmeldung…');
    const login = await silentLogin();
    if (!login) { slog('Anmeldung braucht dich'); await setStatus('needsLogin', { error: null }); return; }
    slog('Angemeldet');

    try {
      // session cookie is now set → load directly; through the login window only as a fallback
      let data = null;
      try { data = await toccoFetchAll(login.me.userPk, from, to); } catch (e) {
        slog('Direkt laden: ' + (e && e.message));
        // the server isn't answering at all → trying again through the window only doubles the wait
        if (e && (e.name === 'TimeoutError' || /timed out|aborted/i.test(e.message || ''))) throw e;
      }
      if ((!data || !Array.isArray(data.lessons)) && login.tabId != null) data = await runInTab(login.tabId, toccoFetchAll, [login.me.userPk, from, to], 45000);
      if (!data || !Array.isArray(data.lessons)) throw new Error('Keine Daten erhalten');
      slog(`Daten: ${data.lessons.length} Lektionen`);
      await save(data, login.me);
      slog('Fertig');

      if (await teachersNeeded()) await learnTeachers(login.tabId != null ? login.tabId : null);   // reuse the login window
    } finally {
      await login.close();
    }
  } catch (e) {
    slog('Fehler: ' + ((e && e.message) || e));
    const net = netProblem(e);
    if (net) { await setStatus('offline', { error: net === 'slow' ? 'slow' : null }); return; }
    await setStatus('error', { error: String((e && e.message) || e) });
  }
}

// Was this a connection problem? 'offline' = no internet, 'slow' = it took far too long.
function netProblem(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (!e) return null;
  if (e.name === 'TimeoutError' || e.name === 'AbortError' || /timed out|timeout|aborted/i.test(e.message || '')) return 'slow';
  if (e.name === 'TypeError' && /fetch|network|load failed|internet/i.test(e.message || '')) return 'offline';
  return null;
}

async function save(data, me) {
  if (data.grades) { try { await notifyNewGrades(data.grades); } catch (e) {} }
  const patch = { lessons: data.lessons, lastSync: Date.now(), status: 'ok', error: null, user: { username: me.username } };
  if (data.grades) patch.grades = data.grades;
  if (data.rooms) patch.rooms = data.rooms;
  if (data.absences) patch.absences = data.absences;
  if (data.attendance) patch.attendance = data.attendance;
  await chrome.storage.local.set(patch);
  scheduleNotifications().catch(() => {});
  checkUpdate(false).catch(() => {});
}

// Room occupancy for one day (on demand from the Räume view).
async function roomDay(fromStr, toStr) {
  const state = await chrome.storage.local.get(['demoMode', 'lessons']);
  if (state.demoMode) return { bookings: (state.lessons || []).filter(l => l.start < toStr && l.end > fromStr).map(l => ({ id: l.id, room: l.room, start: l.start, end: l.end, label: l.label, cls: l.cls })) };
  let me = null;
  try { me = await toccoWhoAmI(); } catch (e) {}
  if (!me) {
    await refresh({ force: true, allowLogin: true });
    try { me = await toccoWhoAmI(); } catch (e) {}
  }
  if (!me) return { error: 'needsLogin' };
  return { bookings: await toccoFetchRoomDay(fromStr, toStr) };
}

// ---------- modulbaukasten.ch (official module catalog, public) ----------
// Same public API the modulbaukasten.ch website itself uses (anonymous token from auth.php).

const MBK_API = 'https://ictbb.crm17.dynamics.com/api/data/v9.1/';
let mbkTok = null;
async function mbkToken() {
  if (mbkTok && mbkTok.exp > Date.now() + 60000) return mbkTok.t;
  const raw = await (await fetch('https://www.modulbaukasten.ch/assets/auth.php', { cache: 'no-store' })).text();
  let j = JSON.parse(raw);
  if (typeof j === 'string') j = JSON.parse(j);
  mbkTok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
  return mbkTok.t;
}
async function mbk(path) {
  const t = await mbkToken();
  const r = await fetch(MBK_API + path, {
    headers: { Authorization: 'Bearer ' + t, Accept: 'application/json', 'OData-Version': '4.0',
      Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"' }
  });
  if (!r.ok) throw new Error('Modulbaukasten ' + r.status);
  return r.json();
}
const FV = '@OData.Community.Display.V1.FormattedValue';
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// List of all apprenticeships + the module numbers in each (for auto-detection).
async function mbkCatalog() {
  const { mbkCatalog: c } = await chrome.storage.local.get('mbkCatalog');
  if (c && Date.now() - c.ts < 7 * 86400000) return c;
  let a;
  try {
    a = await mbk("beembk_abschlusses?$filter=statecode eq 0&$select=beembk_abschlussid,beembk_abschlussname,beembk_abschlusstyp");
  } catch (e) {
    if (c) return c;                    // site down → keep using the older saved list
    throw e;
  }
  const m = await mbk("beembk_modulmappings?$filter=statecode eq 0 and beembk_Modul/statecode eq 0&$select=_beembk_abschluss_value&$expand=beembk_Modul($select=beembk_modulnummer)");
  const nums = {};
  for (const x of m.value) if (x.beembk_Modul) (nums[x._beembk_abschluss_value] = nums[x._beembk_abschluss_value] || []).push(String(x.beembk_Modul.beembk_modulnummer));
  const list = a.value.map((x) => ({
    id: x.beembk_abschlussid, name: x.beembk_abschlussname,
    typ: x['beembk_abschlusstyp' + FV] || '', nums: [...new Set(nums[x.beembk_abschlussid] || [])]
  })).sort((p, q) => (p.typ === q.typ ? p.name.localeCompare(q.name, 'de') : p.typ === 'Grundbildung' ? -1 : 1));
  const cat = { ts: Date.now(), list };
  await chrome.storage.local.set({ mbkCatalog: cat });
  return cat;
}

async function mbkModuleDetails(modul, mapping) {
  const hz = await mbk(`beembk_handlungsziels?$filter=_beembk_modul_value eq ${modul.beembk_modulid} and statecode eq 0&$select=beembk_handlungszielnr,beembk_handlungsziel`);
  const key = (x) => String(x.beembk_handlungszielnr || '');
  const z = hz.value.sort((a, b) => key(a).localeCompare(key(b), 'de', { numeric: true })).map((x) => clean(x.beembk_handlungsziel));
  return {
    t: modul.beembk_modultitel, k: clean(modul.beembk_kompetenz), o: clean(modul.beembk_objektbeschreibung), z,
    typ: mapping ? mapping['_beembk_modultyp_value' + FV] || '' : '', lj: mapping ? mapping['_beembk_level_value' + FV] || '' : '',
    ort: mapping ? mapping['_beembk_lernort_value' + FV] || '' : '',
    feld: (modul.beembk_Kompetenzfeld && modul.beembk_Kompetenzfeld.beembk_bezeichnung) || '',
    v: modul.beembk_version, pdf: modul.beembk_pdfname_de || ''
  };
}

// Loads all modules of one apprenticeship (+ extra module numbers seen in the timetable).
async function mbkLoad(id, extraNums = []) {
  const sel = 'beembk_modulid,beembk_modulnummer,beembk_modultitel,beembk_kompetenz,beembk_objektbeschreibung,beembk_version,beembk_pdfname_de';
  const mm = await mbk(`beembk_modulmappings?$filter=beembk_Abschluss/beembk_abschlussid eq '${id}' and statecode eq 0 and beembk_Modul/statecode eq 0` +
    `&$expand=beembk_Modul($select=${sel};$expand=beembk_Kompetenzfeld($select=beembk_bezeichnung))`);
  const out = {};
  const jobs = mm.value.filter((x) => x.beembk_Modul).map((x) => async () => {
    out[String(x.beembk_Modul.beembk_modulnummer)] = await mbkModuleDetails(x.beembk_Modul, x);
  });
  for (const n of extraNums) {
    if (mm.value.some((x) => x.beembk_Modul && String(x.beembk_Modul.beembk_modulnummer) === n)) continue;
    jobs.push(async () => {
      const r = await mbk(`beembk_moduls?$filter=beembk_modulnummer eq '${n}' and statecode eq 0&$select=${sel}`);
      if (r.value[0]) out[n] = { ...(await mbkModuleDetails(r.value[0], null)), extra: true };
    });
  }
  for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map((j) => j().catch(() => {})));
  const cat = await mbkCatalog().catch(() => null);
  const name = cat ? (cat.list.find((x) => x.id === id) || {}).name : '';
  // Selection is a user edit owned by sync. Slow cache loads must not restore an old choice.
  const { abschluss: selected } = await chrome.storage.local.get('abschluss');
  if (selected && selected.id === id) await chrome.storage.local.set({ modules: out });
  return { count: Object.keys(out).length, name };
}

// ---------- updates (GitHub releases) ----------
// Checks the newest release at most every 12 h and stores what's there; the popup shows a banner.
const UPDATE_REPO = 'Nicolas-Wehrle/Wiss-Stundenplan';
async function checkUpdate(force) {
  const { updateInfo } = await chrome.storage.local.get('updateInfo');
  if (!force && updateInfo && Date.now() - updateInfo.checked < 12 * 3600e3) return updateInfo;
  const r = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store',
    signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined)
  });
  if (r.status === 404) { const info = { checked: Date.now(), latest: null }; await chrome.storage.local.set({ updateInfo: info }); return info; }   // no release yet
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const j = await r.json();
  const asset = (re) => ((j.assets || []).find((a) => re.test(a.name)) || {}).browser_download_url || null;
  const info = {
    checked: Date.now(), latest: String(j.tag_name || '').replace(/^v/i, ''), page: j.html_url,
    apk: asset(/\.apk$/i), chrome: asset(/chrome.*\.zip$/i), firefox: asset(/\.xpi$/i) || asset(/firefox.*\.zip$/i), ios: asset(/\.user\.js$/i)
  };
  await chrome.storage.local.set({ updateInfo: info });
  return info;
}

// ---------- notifications ----------
// lesson reminders (X min before), absence deadline (day 5 of 7), new grades after a sync.
// Chrome/Firefox: chrome.notifications + chrome.alarms. Android app: handed to the native side,
// which schedules them with AlarmManager so they also arrive when the app is closed.
const NTXT = {
  de: { in: '{L} in {R}, {T}', inNoRoom: '{L} um {T}', abs: 'Absenz vom {D} noch nicht entschuldigt', absBody: '{L} · noch {N} Tage zum Entschuldigen',
        absBody1: '{L} · noch 1 Tag zum Entschuldigen', grade: 'Neue Note: {G}', gradeBody: '{L} · {X}', test: 'Benachrichtigungen funktionieren', testBody: 'So sehen Erinnerungen aus.' },
  en: { in: '{L} in {R}, {T}', inNoRoom: '{L} at {T}', abs: 'Absence on {D} not excused yet', absBody: '{L} · {N} days left to excuse it',
        absBody1: '{L} · 1 day left to excuse it', grade: 'New grade: {G}', gradeBody: '{L} · {X}', test: 'Notifications work', testBody: 'This is what reminders look like.' }
};
const NDEF = { notifyLessons: false, notifyLessonMin: 15, notifyAbsences: true, notifyGrades: true, lang: 'de', syncMinutes: 20 };
async function prefs() { const { prefs: p = {} } = await chrome.storage.local.get('prefs'); return { ...NDEF, ...p }; }
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
const zh = (iso, o) => new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', ...o }).format(new Date(iso));
const hhmm = (iso) => zh(iso, { hour: '2-digit', minute: '2-digit' });
const ddmm = (iso) => zh(iso, { day: 'numeric', month: 'numeric' }).replace(/\.?$/, '.');
const cleanLabel = (l) => String(l || '').replace(/^[\d-]+\s*-\s*/, '').replace(/\s+Semester\s+\d+$/i, '').trim();

function notify(id, title, message) {
  if (IS_APP && globalThis.__wissApp) { globalThis.__wissApp.notify(id, title, message); return; }
  if (!chrome.notifications) return;
  chrome.notifications.create(id, { type: 'basic', iconUrl: chrome.runtime.getURL('icons/128.png'), title, message, priority: 1 }).catch(() => {});
}

async function notifyNewGrades(fresh) {
  const pr = await prefs();
  const { grades: old } = await chrome.storage.local.get('grades');
  if (!pr.notifyGrades || !Array.isArray(old) || !old.length) return;          // first sync: nothing is "new"
  const key = (g, x) => `${g.event}|${g.part}|${x ? x.label : '*'}`;
  const before = new Map();
  for (const g of old) { before.set(key(g), g.grade); for (const x of g.exams || []) before.set(key(g, x), x.grade); }
  const T = NTXT[pr.lang] || NTXT.de;
  let n = 0;
  for (const g of fresh) {
    for (const x of g.exams || []) {
      if (x.grade != null && before.get(key(g, x)) == null && n < 5) {
        n++; notify('grade-' + key(g, x), fill(T.grade, { G: String(x.grade) }), fill(T.gradeBody, { L: cleanLabel(g.label), X: x.label }));
      }
    }
    if (g.grade != null && before.get(key(g)) == null && before.has(key(g)) && n < 5) {
      n++; notify('grade-' + key(g), fill(T.grade, { G: String(g.grade) }), fill(T.gradeBody, { L: cleanLabel(g.label), X: pr.lang === 'en' ? 'module grade' : 'Modulnote' }));
    }
  }
}

// builds the list of upcoming reminders (next 7 days) from the stored data
async function reminderPlan() {
  const pr = await prefs();
  const T = NTXT[pr.lang] || NTXT.de;
  const { lessons = [], teachers = {}, absences = [], notifiedAbs = {} } = await chrome.storage.local.get(['lessons', 'teachers', 'absences', 'notifiedAbs']);
  const now = Date.now(), until = now + 7 * 86400000, out = [];
  if (pr.notifyLessons) {
    for (const l of lessons) {
      const at = new Date(l.start).getTime() - pr.notifyLessonMin * 60000;
      if (at <= now || at > until) continue;
      const L = cleanLabel(l.label), R = (l.room || '').split(',')[0].trim(), tch = teachers['l:' + l.label] || '';
      out.push({ id: 'lesson-' + l.id, at, kind: 'lesson', title: fill(R ? T.in : T.inNoRoom, { L, R, T: hhmm(l.start) }), body: tch });
    }
  }
  if (pr.notifyAbsences) {
    for (const a of absences) {
      if (!(a.status === 'absent_unexcused' || /^abwesend/.test(a.status)) || notifiedAbs[a.lesson]) continue;
      const start = new Date(a.start).getTime();
      let at = start + 5 * 86400000;                                 // day 5 of the 7-day window
      if (start + 7 * 86400000 <= now) continue;                     // deadline already over
      if (at <= now) at = now + 60000;                               // missed the moment → soon
      if (at > until) continue;
      const left = Math.max(1, Math.ceil((start + 7 * 86400000 - at) / 86400000));
      out.push({ id: 'abs-' + a.lesson, at, kind: 'absence', title: fill(T.abs, { D: ddmm(a.start) }), body: fill(left === 1 ? T.absBody1 : T.absBody, { L: cleanLabel(a.label), N: left }), abs: a.lesson });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 60);
}

async function scheduleNotifications() {
  if ((await chrome.storage.local.get('demoMode')).demoMode) return;
  const plan = await reminderPlan();
  if (IS_APP && globalThis.__wissApp) {
    const pr = await prefs();
    globalThis.__wissApp.setLang(pr.lang);
    globalThis.__wissApp.schedule(plan);
    await pushWidget(pr);
    return;
  }
  if (!chrome.alarms || !chrome.alarms.getAll) return;
  for (const a of await chrome.alarms.getAll()) if (a.name.startsWith('n:')) await chrome.alarms.clear(a.name);
  await chrome.storage.local.set({ notifyPlan: plan });
  for (const r of plan) chrome.alarms.create('n:' + r.id, { when: r.at });
}

// Android home-screen widget: the next lessons with room + teacher
async function pushWidget(pr) {
  const { lessons = [], teachers = {} } = await chrome.storage.local.get(['lessons', 'teachers']);
  const now = Date.now();
  const next = lessons.filter((l) => new Date(l.end).getTime() > now).slice(0, 25).map((l) => ({
    s: l.start, e: l.end, t: cleanLabel(l.label), r: (l.room || '').split(',')[0].trim(), p: teachers['l:' + l.label] || ''
  }));
  const th = await widgetTheme(pr);
  globalThis.__wissApp.widget({ lang: pr.lang, accent: th.accent || pr.accent || '', style: th.base || pr.style || 'standard', mode: th.mode || '', lessons: next });
}
// The widget is native, so a custom theme only gives it what it can use: base style, accent, light/dark.
// The accent is the first `--accent: #hex` in a plain `:root { }` block of the theme's CSS.
async function widgetTheme(pr) {
  let t = pr.customTheme;
  if (!t || !t.id) return {};
  if (typeof t.source !== 'string') {
    const { themeLibrary = [] } = await chrome.storage.local.get('themeLibrary');
    t = themeLibrary.find((x) => x.id === t.id);
    if (!t) return {};
  }
  let accent = '';
  const css = String(t.source || '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(?:^|[}\s,])(?:html|:root)\s*\{([^}]*)\}/g)) {
    const a = m[1].match(/--accent\s*:\s*#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
    if (a) { accent = '#' + (a[1].length === 3 ? a[1].replace(/./g, '$&$&') : a[1]); break; }
  }
  return { base: t.base || '', mode: t.mode || '', accent };
}

async function fireReminder(name) {
  const id = name.slice(2);
  const { notifyPlan = [], notifiedAbs = {} } = await chrome.storage.local.get(['notifyPlan', 'notifiedAbs']);
  const r = notifyPlan.find((x) => x.id === id);
  if (!r) return;
  notify(r.id, r.title, r.body);
  if (r.abs) { notifiedAbs[r.abs] = Date.now(); await chrome.storage.local.set({ notifiedAbs }); }
}

async function resetKeepalive() {
  const pr = await prefs();
  if (!pr.syncMinutes) { chrome.alarms.clear && chrome.alarms.clear('keepalive'); return; }
  chrome.alarms.create('keepalive', { periodInMinutes: Math.max(5, +pr.syncMinutes || KEEPALIVE_MIN) });
}

// ---------- events ----------

chrome.runtime.onInstalled.addListener(async (details) => {
  resetKeepalive();
  if (details.reason === 'update') {
    // Existing installs from before the setup screen: keep working without asking again.
    const s = await chrome.storage.local.get(['setupDone', 'lessons', 'abschluss']);
    if (!s.setupDone && s.lessons && s.lessons.length) {
      await chrome.storage.local.set({
        setupDone: true,
        abschluss: s.abschluss || { id: '13d8d40b-6d82-eb11-a812-0022486f6f83', name: 'Informatiker/in EFZ Applikationsentwicklung (2021)' }
      });
    }
  }
  refresh({ force: true, allowLogin: details.reason !== 'install' });   // fresh install: wait for the setup screen
});
chrome.runtime.onStartup.addListener(() => {
  resetKeepalive();
  scheduleNotifications().catch(() => {});
  refresh({ force: true, allowLogin: true });
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'keepalive') refresh({ force: true, allowLogin: false });
  else if (a.name.startsWith('n:')) fireReminder(a.name);
});
// ---- toolbar icon in the colours of the chosen style ----
const TOOLBAR_LOGOS = {
  standard: { bg: ['#ff6478', '#d81f3c'], c: '#ffffff', o: 0.3, t: '#ffffff', g: '#ffc857', r: 4.5, R: 27 },
  apple: { bg: ['#5ab0ff', '#0a6cff'], c: '#ffffff', o: 0.32, t: '#ffffff', g: '#ffd60a', r: 4.5, R: 27 },
  samsung: { bg: ['#2c2c31', '#0d0d0f'], c: '#6e9cff', o: 0.35, t: '#6e9cff', g: '#ffffff', r: 7.5, R: 34 },
  nothing: { bg: ['#1c1c1c', '#000000'], c: '#ffffff', o: 0.3, t: '#e8222b', g: '#ffffff', r: 7.5, R: 27, edge: '#3a3a3a' },
  github: { bg: ['#1b222c', '#0d1117'], cs: ['#0e4429', '#006d32', '#39d353', '#006d32', '#39d353', '#26a641', '#26a641', '#0e4429', '#006d32'], r: 3, R: 22, edge: '#30363d' },
  pastel: { bg: ['#a78bfa', '#f490b5'], c: '#ffffff', o: 0.4, t: '#ffffff', g: '#ffe08a', r: 6, R: 32 },
  neon: { bg: ['#22174a', '#0b0918'], c: '#ff3cac', o: 0.4, t: '#2de2e6', g: '#ff3cac', r: 4.5, R: 27, edge: '#ff3cac' },
  paper: { bg: ['#f8f3e8', '#e9e1cf'], c: '#2b2620', o: 0.16, t: '#8e3523', g: '#c9a227', r: 3, R: 24, edge: '#cdbfa3' },
  terminal: { bg: ['#0b140b', '#030603'], c: '#39ff6a', o: 0.22, t: '#39ff6a', g: '#b6ffc8', r: 0, R: 14, edge: '#1d4d27' }
};
async function paintToolbarIcon() {
  if (!chrome.action || !chrome.action.setIcon || typeof OffscreenCanvas === 'undefined') return;
  const { prefs } = await chrome.storage.local.get('prefs');
  const red = prefs && prefs.themeLogo === false;
  const L = TOOLBAR_LOGOS[(!red && prefs && prefs.style) || 'standard'] || TOOLBAR_LOGOS.standard;
  const imageData = {};
  for (const size of [16, 32, 48]) {
    const cv = new OffscreenCanvas(size, size), g = cv.getContext('2d'), k = size / 100;
    const grad = g.createLinearGradient(0, 0, 35 * k, 100 * k); grad.addColorStop(0, L.bg[0]); grad.addColorStop(1, L.bg[1]);
    g.fillStyle = grad; g.beginPath(); g.roundRect(0, 0, size, size, L.R * k); g.fill();
    if (L.edge) { g.strokeStyle = L.edge; g.lineWidth = Math.max(1, 2 * k); g.beginPath(); g.roundRect(k, k, size - 2 * k, size - 2 * k, (L.R - 1) * k); g.stroke(); }
    for (let i = 0; i < 9; i++) {
      const x = (23 + (i % 3) * 19) * k, y = (23 + Math.floor(i / 3) * 19) * k;
      g.fillStyle = L.cs ? L.cs[i] : i === 4 ? L.t : i === 2 ? L.g : L.c;
      g.globalAlpha = L.cs || i === 4 || i === 2 ? 1 : L.o;
      g.beginPath(); g.roundRect(x, y, 15 * k, 15 * k, L.r * k); g.fill(); g.globalAlpha = 1;
    }
    imageData[size] = g.getImageData(0, 0, size, size);
  }
  try { await chrome.action.setIcon({ imageData }); } catch (e) {}
}
paintToolbarIcon().catch(() => {});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && ch.prefs && ['style', 'themeLogo'].some((k) => (ch.prefs.oldValue || {})[k] !== (ch.prefs.newValue || {})[k])) paintToolbarIcon().catch(() => {});
});
// settings changed in the popup → re-plan reminders / sync interval
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local' || !(ch.prefs || ch.teachers)) return;
  if (ch.prefs) { const o = ch.prefs.oldValue || {}, n = ch.prefs.newValue || {}; if (o.syncMinutes !== n.syncMinutes) resetKeepalive(); }
  scheduleNotifications().catch(() => {});
});
if (chrome.notifications && chrome.notifications.onClicked) {
  chrome.notifications.onClicked.addListener((id) => {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') + '?full' + (id.startsWith('grade') ? '#grades' : id.startsWith('abs') ? '#absences' : '') });
    chrome.notifications.clear(id);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'demoStart' || msg.type === 'demoExit') {
    if (!sender.url || !sender.url.startsWith(chrome.runtime.getURL('popup.html'))) return false;
    (async () => {
      if (inflight) await inflight;
      const st = await chrome.storage.local.get(['user', 'lessons', 'demoMode', 'deviceSync', 'notes', 'examOverrides']);
      if (msg.type === 'demoExit') {
        if (st.demoMode) await chrome.storage.local.remove(WissDemo.keys);
        return { ok: true };
      }
      if (st.demoMode) return { ok: true };
      if (st.user || st.lessons?.length || st.deviceSync?.enabled || Object.keys(st.notes || {}).length || Object.keys(st.examOverrides || {}).length) return { error: 'Bitte für die Demo ein separates Browserprofil verwenden.' };
      await chrome.storage.local.set({ ...WissDemo.data(), demoMode: true, user: { username: 'demo@example.invalid' }, setupDone: true, status: 'ok', error: null, lastSync: Date.now(), teachersDone: Date.now(), notes: {}, examOverrides: {} });
      return { ok: true };
    })().then(sendResponse, e => sendResponse({ error: String(e.message || e) }));
    return true;
  }
  if (msg.type === 'refresh') {
    if (msg.interactive) { loginWanted = Date.now(); revealLogin(); }   // ↻: a waiting sign-in shows itself
    refresh({ force: !!msg.force, resume: !!msg.resume, allowLogin: true }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'tabClosed') {
    // apps: you closed a sign-in page you could see → try again. Pages we closed ourselves don't count.
    if (pendingLogin && pendingLogin.tabId === msg.id) pendingLogin = null;
    if (shownTabs.delete(msg.id)) refresh({ force: true, allowLogin: true });
    return false;
  }
  if (msg.type === 'checkUpdate') {
    checkUpdate(true).then((info) => sendResponse({ info }), (e) => sendResponse({ error: String((e && e.message) || e) }));
    return true;
  }
  if (msg.type === 'testNotify') {
    prefs().then((pr) => { const T = NTXT[pr.lang] || NTXT.de; notify('test-' + Date.now(), T.test, T.testBody); });
    return false;
  }
  if (msg.type === 'notifPermission') {
    if (IS_APP && globalThis.__wissApp) globalThis.__wissApp.requestPermission();
    return false;
  }
  if (msg.type === 'mbkCatalog') {
    mbkCatalog().then((c) => sendResponse({ list: c.list }), (e) => sendResponse({ error: String(e.message || e) }));
    return true;
  }
  if (msg.type === 'mbkLoad') {
    mbkLoad(msg.id, msg.extraNums || []).then(sendResponse, (e) => sendResponse({ error: String(e.message || e) }));
    return true;
  }
  if (msg.type === 'resetAll') {
    chrome.storage.local.clear().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'roomDay') {
    roomDay(msg.from, msg.to).then(sendResponse, (e) => sendResponse({ error: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === 'teachers' && msg.rows) {
    (async () => {
      if ((await chrome.storage.local.get('demoMode')).demoMode) return;
      const { teachers = {} } = await chrome.storage.local.get('teachers');
      for (const r of msg.rows) {
        if (!r.teacher) continue;
        if (r.key) teachers['k:' + r.key] = r.teacher;
        if (r.label) teachers['l:' + r.label] = r.teacher;
      }
      const patch = { teachers, teachersUpdated: Date.now() };
      if (msg.done) patch.teachersDone = Date.now();
      await chrome.storage.local.set(patch);
    })();
  }
  if (msg.type === 'learnTeachers') { learnTeachers(); }
  if (msg.type === 'extranetLoaded') {
    getState().then((st) => {
      if (st.status !== 'ok' || !st.lastSync || Date.now() - st.lastSync > MIN_GAP_MS) {
        const done = refresh({ force: true, allowLogin: false, viaTab: sender.tab && sender.tab.id });
        if (pendingLogin && sender.tab && sender.tab.id === pendingLogin.tabId) {
          const p = pendingLogin;
          done.then(async () => { const { status } = await chrome.storage.local.get('status'); if (status === 'ok') { pendingLogin = null; p.close(); } });
        }
      }
    });
  }
  if (msg.type === 'openLogin') {
    // show the sign-in that is already waiting in the background, or open a new one
    loginWanted = Date.now();
    openLoginPage();
  }
});

})();
