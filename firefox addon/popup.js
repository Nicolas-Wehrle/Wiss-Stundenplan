// WISS Stundenplan – popup + full-page view
'use strict';
const TZ = 'Europe/Zurich';
const FULL = new URLSearchParams(location.search).has('full');
if (FULL) document.body.classList.add('full');
// Firefox for Android shows the popup as a full-screen page → fluid, touch-friendly layout
const MOBILE = /Android|Mobile/i.test(navigator.userAgent);
if (MOBILE) document.body.classList.add('mobile');
const $ = (id) => document.getElementById(id);
// Renders an HTML string (all dynamic values are escaped with esc()) via DOMParser instead of
// assigning it to the element directly. Parsed nodes never run scripts.
const parser = new DOMParser();
function setHTML(el, html) {
  const doc = parser.parseFromString('<!doctype html><body>' + html, 'text/html');
  el.replaceChildren(...doc.body.childNodes);
  if (window.translateDom) translateDom(el);
}

const hasChrome = typeof browser !== 'undefined' && !!(browser.storage && browser.runtime && browser.runtime.id);

let S = {
  lessons: [], teachers: {}, grades: [], rooms: [], notes: {}, examOverrides: {}, absences: [], attendance: null,
  status: null, lastSync: null, error: null, tab: 'week'
};
// user settings (Einstellungen) – stored as one object under 'prefs'
const PREF_DEFAULTS = {
  lang: 'de', theme: 'system', style: 'standard', accent: '', mono: false, corners: 'round', size: 'm', startTab: 'last', foldPast: true,
  notifyLessons: false, notifyLessonMin: 15, notifyAbsences: true, notifyGrades: true,
  targetGrade: 5, gradeStep: 0.5, syncMinutes: 20
};
const P = (k) => (S.prefs && S.prefs[k] !== undefined ? S.prefs[k] : PREF_DEFAULTS[k]);
function setPref(k, v) {
  S.prefs = { ...(S.prefs || {}), [k]: v };
  persist({ prefs: S.prefs });
}
let D = null;            // derived data (modules, exams, vacations…)
let weekOffset = null;   // set after first load
let roomState = { date: null, minute: null, building: null, sel: null, cache: {}, loading: false, err: null };

// =====================================================================
// Dates (everything shown in Zurich time)
// =====================================================================
const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
function zp(d) {
  const o = {};
  for (const p of partsFmt.formatToParts(d)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, hh: o.hour === '24' ? '00' : o.hour, mm: o.minute };
}
const p2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => { const p = zp(d); return `${p.y}-${p2(p.m)}-${p2(p.d)}`; };
const hm = (d) => { const p = zp(d); return `${p.hh}:${p.mm}`; };
const mod = (d) => { const p = zp(d); return +p.hh * 60 + +p.mm; };
const keyDate = (k) => new Date(k + 'T12:00:00Z');            // noon UTC of a day key
const keyAdd = (k, n) => { const d = keyDate(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (k) => (keyDate(k).getUTCDay() + 6) % 7;            // 0 = Monday
const mondayKey = (k) => keyAdd(k, -dow(k));
const todayKey = () => dayKey(new Date());
const daysBetween = (a, b) => Math.round((keyDate(b) - keyDate(a)) / 86400000);
const WD = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WDS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const fmtDay = (k, long) => { const d = keyDate(k); return `${(long ? WD : WDS)[dow(k)]}, ${d.getUTCDate()}. ${MON[d.getUTCMonth()]}`; };
const fmtShort = (k) => { const d = keyDate(k); return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`; };
function isoWeek(k) {
  const t = keyDate(k); t.setUTCDate(t.getUTCDate() + 3 - dow(k));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - y0) / 86400000 - 3 + ((y0.getUTCDay() + 6) % 7)) / 7);
}
function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'gerade eben';
  const m = Math.round(s / 60); if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60); if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} T.`;
}
function inDays(k) {
  const n = daysBetween(todayKey(), k);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  if (n < 0) return `vor ${-n} Tagen`;
  if (n < 14) return `in ${n} Tagen`;
  return `in ${Math.round(n / 7)} Wochen`;
}

// =====================================================================
// Holidays (Kanton Zürich) – computed
// =====================================================================
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${p2(month)}-${p2(day)}`;
}
function nthWeekday(y, month, weekday, n) { // weekday 0=Mon
  let k = `${y}-${p2(month)}-01`;
  while (dow(k) !== weekday) k = keyAdd(k, 1);
  return keyAdd(k, 7 * (n - 1));
}
const holidayCache = {};
function holidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const e = easter(y);
  const sundaySep = keyAdd(nthWeekday(y, 9, 6, 2), 1); // Knabenschiessen-Montag
  const h = {
    [`${y}-01-01`]: 'Neujahr', [`${y}-01-02`]: 'Berchtoldstag',
    [keyAdd(e, -2)]: 'Karfreitag', [keyAdd(e, 1)]: 'Ostermontag',
    [`${y}-05-01`]: 'Tag der Arbeit', [keyAdd(e, 39)]: 'Auffahrt', [keyAdd(e, 50)]: 'Pfingstmontag',
    [`${y}-08-01`]: 'Bundesfeier', [`${y}-12-25`]: 'Weihnachten', [`${y}-12-26`]: 'Stephanstag',
    [nthWeekday(y, 4, 0, 3)]: 'Sechseläuten (½)', [sundaySep]: 'Knabenschiessen (½)'
  };
  return (holidayCache[y] = h);
}
const holidayOf = (k) => holidays(+k.slice(0, 4))[k] || null;

// =====================================================================
// Lessons, modules, exams
// =====================================================================
function hue(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
function splitLabel(label) {
  const m = label.match(/^(\d[\d-]*)\s*-\s*(.+)$/);
  if (m) return { num: m[1], name: m[2] };
  return { num: '', name: label.replace(/\s*Semester\s*\d+\s*$/i, '').trim() || label };
}
const BUNDLED_ABSCHLUSS = '13d8d40b-6d82-eb11-a812-0022486f6f83'; // modules.js = Applikationsentwicklung (2021), offline fallback
let MODS = (typeof window !== 'undefined' && window.MODULES) || {};
const MBK_PDF = 'https://modulbaukasten.ch/Module/';
// "169-347" → [info169, info347]
function modInfos(label) {
  const { num } = splitLabel(label || '');
  return num ? num.split('-').map((n) => (MODS[n] ? { num: n, ...MODS[n] } : null)).filter(Boolean) : [];
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sv = (label) => { const h = hue(label); return `--h:${h};--c:hsl(${h} var(--s) var(--l));`; };
function teacherFor(l) {
  const p = zp(new Date(l.start));
  const key = `${p2(p.d)}.${p2(p.m)}.${String(p.y).slice(2)} ${p.hh}:${p.mm}|${l.label}`;
  return S.teachers['k:' + key] || S.teachers['l:' + l.label] || '';
}
function examKind(label) {
  if (/^ZP/i.test(label)) return 'zp';
  if (/^LB/i.test(label)) return 'lb';
  return 'pj';
}
const atEnd = (label) => /^(LB|Projekt|Pr(ae|ä)sentation|LB Projekt)\b/i.test(label) && !/^LB\s*\d/i.test(label);

function derive() {
  const lessons = S.lessons.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  for (const l of lessons) { l._day = dayKey(new Date(l.start)); l._ev = l.event || l.label; }

  // --- modules (by event) ---
  const mods = new Map();
  for (const l of lessons) {
    if (!mods.has(l._ev)) mods.set(l._ev, { ev: l._ev, label: l.label, lessons: [], days: [], structure: [], grades: [] });
    const m = mods.get(l._ev);
    m.lessons.push(l);
    if (m.days[m.days.length - 1] !== l._day) m.days.push(l._day);
  }
  for (const g of S.grades || []) {
    const key = g.event && mods.has(g.event) ? g.event : [...mods.values()].find((m) => m.label === g.label)?.ev;
    if (!key) continue;
    const m = mods.get(key);
    m.grades.push(g);
    for (const x of g.exams || []) if (x.label && !m.structure.some((s) => s.label === x.label)) m.structure.push({ ...x });
  }
  for (const m of mods.values()) {
    for (const s of m.structure) {
      const vals = m.grades.map((g) => (g.exams || []).find((x) => x.label === s.label)).filter((x) => x && x.grade != null).map((x) => +x.grade);
      s.grade = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
  }

  // --- exam placement ---
  const examsByLesson = {};      // lessonId -> [{label, kind, est, weight, grade, module}]
  const add = (lid, x) => (examsByLesson[lid] = examsByLesson[lid] || []).push(x);
  const firstOfDay = (m, day) => m.lessons.find((l) => l._day === day);

  for (const m of mods.values()) {
    const N = m.days.length;
    if (!N || !m.structure.length) continue;
    const manualLabels = new Set();
    for (const l of m.lessons) for (const lab of S.examOverrides[l.id] || []) manualLabels.add(lab);

    const placements = []; // {day, label}
    const zps = m.structure.filter((s) => examKind(s.label) === 'zp');
    const lbN = m.structure.filter((s) => /^LB\s*\d/i.test(s.label));
    const end = m.structure.filter((s) => atEnd(s.label));

    const rule = S.zpRule || 'every3';
    if (rule === 'none') { /* no ZP estimates */ }
    else if (zps.length === 1 && !/\d/.test(zps[0].label)) {
      if (rule === 'every3') for (let i = 2; i < N - 1; i += 3) placements.push({ day: m.days[i], label: zps[0].label });   // every 3rd lesson day
      else if (N > 3) placements.push({ day: m.days[2], label: zps[0].label });                                             // once, at the 3rd lesson day
      if (N <= 3 && N >= 2) placements.push({ day: m.days[N - 2], label: zps[0].label });
    } else {
      zps.forEach((s, i) => { const idx = Math.min(N - 2, 3 * (i + 1) - 1); if (idx >= 0) placements.push({ day: m.days[idx], label: s.label }); });
    }
    lbN.forEach((s, i) => { const idx = Math.max(0, Math.round((N * (i + 1)) / lbN.length) - 1); placements.push({ day: m.days[idx], label: s.label }); });
    end.forEach((s) => placements.push({ day: m.days[N - 1], label: s.label }));

    for (const p of placements) {
      if (examKind(p.label) !== 'zp' && manualLabels.has(p.label)) continue;
      const l = firstOfDay(m, p.day);
      if (!l || S.examOverrides[l.id]) continue;
      const st = m.structure.find((s) => s.label === p.label) || {};
      add(l.id, { label: p.label, kind: examKind(p.label), est: true, weight: st.weight, grade: st.grade, module: m });
    }
    for (const l of m.lessons) {
      for (const lab of S.examOverrides[l.id] || []) {
        const st = m.structure.find((s) => s.label === lab) || {};
        add(l.id, { label: lab, kind: examKind(lab), est: false, weight: st.weight, grade: st.grade, module: m });
      }
    }
  }
  // Tocco comments mentioning tests → confirmed
  for (const l of lessons) {
    if (S.examOverrides[l.id]) continue;
    const mm = (l.comment || '').match(/\b(LB\s*\d?|ZP\s*\d?|Prüfung|Test)\b/i);
    if (mm) {
      const lab = mm[1].replace(/\s+/g, ' ').toUpperCase().replace('PRÜFUNG', 'Prüfung').replace('TEST', 'Test');
      const list = (examsByLesson[l.id] || []).filter((x) => !x.est || x.label !== lab);
      examsByLesson[l.id] = [...list, { label: lab, kind: examKind(lab), est: false, module: mods.get(l._ev) }];
    }
  }

  // --- vacations: whole weeks without lessons between lessons ---
  const vacations = [];
  if (lessons.length) {
    const daysWith = new Set(lessons.map((l) => l._day));
    const first = mondayKey(lessons[0]._day), last = mondayKey(lessons[lessons.length - 1]._day);
    let cur = null;
    for (let w = first; w <= last; w = keyAdd(w, 7)) {
      let empty = true;
      for (let i = 0; i < 5; i++) if (daysWith.has(keyAdd(w, i))) { empty = false; break; }
      if (empty) { if (cur) cur.end = keyAdd(w, 4); else cur = { start: w, end: keyAdd(w, 4) }; }
      else if (cur) { vacations.push(cur); cur = null; }
    }
    for (const v of vacations) {
      const mth = keyDate(v.start).getUTCMonth() + 1;
      v.name = mth === 12 || mth === 1 ? 'Weihnachtsferien' : mth === 2 ? 'Sportferien' : mth >= 3 && mth <= 5 ? 'Frühlingsferien'
        : mth >= 6 && mth <= 8 ? 'Sommerferien' : mth >= 9 && mth <= 10 ? 'Herbstferien' : 'Unterrichtsfrei';
      v.icon = { Weihnachtsferien: '🎄', Sportferien: '⛷️', Frühlingsferien: '🌷', Sommerferien: '☀️', Herbstferien: '🍂' }[v.name] || '🌿';
    }
  }
  const lastDay = lessons.length ? lessons[lessons.length - 1]._day : null;

  // --- flat exam list ---
  const examList = [];
  for (const l of lessons) for (const x of examsByLesson[l.id] || []) examList.push({ ...x, lesson: l, day: l._day });

  // --- lesson position within module ---
  for (const m of mods.values()) m.days.forEach((d, i) => m.lessons.filter((l) => l._day === d).forEach((l) => { l._dayIdx = i; l._dayN = m.days.length; }));

  D = { lessons, mods, examsByLesson, vacations, lastDay, examList };
}
const vacationOf = (k) => (D ? D.vacations.find((v) => k >= v.start && k <= keyAdd(v.end, 2)) : null);

// =====================================================================
// Small renderers
// =====================================================================
const ICON = {
  room: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/></svg>',
  user: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  note: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 4h10l4 4v12H5z M14 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
};
const gradeCls = (g) => (g == null ? '' : g >= 5 ? 'good' : g >= 4 ? 'mid' : 'bad');
const fmtG = (g) => (g == null ? '–' : (Math.round(g * 100) / 100).toString());
function xtag(x, withGrade) {
  const g = withGrade && x.grade != null ? ` <span class="g">${fmtG(x.grade)}</span>` : '';
  return `<span class="xtag ${x.kind} ${x.est ? 'est' : ''}" title="${x.est ? 'Geschätzt' : 'Bestätigt'}">${esc(x.label)}${g}</span>`;
}
const examsOf = (l) => (D.examsByLesson[l.id] || []);

// ---------- updates ----------
const PLATFORM = window.__wissIOS ? 'ios' : (globalThis.__wissApp ? 'android' : (/Firefox\//.test(navigator.userAgent) ? 'firefox' : 'chrome'));
function newerVersion(a, b) {          // is a newer than b?
  const pa = String(a || '').split('.').map((x) => +x || 0), pb = String(b || '').split('.').map((x) => +x || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}
const APP_VERSION = hasChrome && browser.runtime.getManifest ? browser.runtime.getManifest().version : '';
function updateAvailable() {
  const u = S.updateInfo;
  return !!(u && u.latest && APP_VERSION && newerVersion(u.latest, APP_VERSION));
}
function updateBanner() {
  if (!updateAvailable() || (S.prefs && S.prefs.updateDismissed === S.updateInfo.latest)) return '';
  const v = esc(S.updateInfo.latest);
  const label = PLATFORM === 'android' ? tr('Installieren') : PLATFORM === 'chrome' ? tr('Herunterladen') : tr('Update laden');
  return `<div class="banner upd"><p><b>${tr('Version {V} ist da.', { V: v })}</b>${PLATFORM === 'chrome' ? `<br><span class="muted" style="font-size:11.5px">${tr('ZIP entpacken, alten Ordner ersetzen, dann in chrome://extensions neu laden.')}</span>` : ''}</p>
    <div class="bbtns"><button class="btn ghost" data-act="update-later">${tr('Später')}</button><button class="btn" data-act="update-go">${label}</button></div></div>`;
}
function openUrl(url) {
  if (!url) return;
  if (globalThis.__wissApp && globalThis.__wissApp.openExternal) globalThis.__wissApp.openExternal(url);
  else if (hasChrome && browser.tabs && browser.tabs.create && !window.__wissIOS) browser.tabs.create({ url });
  else window.open(url, '_blank');
}
function startUpdate() {
  const u = S.updateInfo || {};
  if (PLATFORM === 'android' && u.apk && globalThis.__wissApp.installUpdate) globalThis.__wissApp.installUpdate(u.apk);
  else if (PLATFORM === 'firefox') openUrl(u.firefox || u.page);
  else if (PLATFORM === 'ios') openUrl(u.ios || u.page);
  else openUrl(u.chrome || u.page);
}

function renderStatus() {
  const el = $('status');
  const syncing = S.status === 'syncing';
  $('btnRefresh').classList.toggle('spinning', syncing);
  let cls = '', html = '';
  if (syncing) html = `<span class="spin"></span>Aktualisiere…${S.lastAttempt && Date.now() - S.lastAttempt > 30000 ? ' (dauert länger, tippe ↻ zum Neustarten)' : ''}`;
  else if (S.status === 'needsLogin') { cls = 'warn'; html = `<span class="dot"></span>Anmeldung nötig`; }
  else if (S.status === 'error') { cls = 'err'; html = `<span class="dot"></span>Fehler${S.lastSync ? ' · Stand ' + ago(S.lastSync) : ''}`; }
  else if (S.lastSync) { cls = S.status === 'stale' ? 'warn' : ''; html = `<span class="dot"></span>Aktualisiert ${ago(S.lastSync)}`; }
  else html = 'Noch keine Daten';
  el.className = 'status ' + cls; setHTML(el, html);

  const b = $('banner');
  if (S.status === 'needsLogin') {
    setHTML(b, `<div class="banner"><p>Du musst dich kurz neu anmelden.</p><button class="btn" data-act="login">Anmelden</button></div>`);
  } else if (S.status === 'error' && S.error) {
    setHTML(b, `<div class="banner"><p>Konnte nicht aktualisieren: ${esc(S.error)}</p></div>`);
  } else setHTML(b, updateBanner());

  const upcoming = D ? D.examList.filter((x) => x.day >= todayKey() && daysBetween(todayKey(), x.day) <= 14).length : 0;
  $('examCount').textContent = upcoming || '';
  const ab = openActionCount();
  $('absCount').textContent = ab || '';
}

// =====================================================================
// WEEK view
// =====================================================================
function nowCard() {
  const now = Date.now();
  const cur = D.lessons.find((l) => new Date(l.start) <= now && new Date(l.end) > now);
  const nxt = D.lessons.find((l) => new Date(l.start) > now);
  const l = cur || nxt;
  if (!l) return '';
  const s = new Date(l.start), e = new Date(l.end);
  const { num, name } = splitLabel(l.label);
  let kicker, bar = '';
  if (cur) {
    const pct = Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100));
    const left = Math.round((e - now) / 60000);
    kicker = `<div class="kicker">Jetzt · noch ${left >= 60 ? Math.floor(left / 60) + ' h ' + (left % 60) + ' min' : left + ' min'}</div>`;
    bar = `<div class="bar"><i style="width:${pct}%"></i></div>`;
  } else {
    const n = daysBetween(todayKey(), l._day);
    kicker = `<div class="kicker next">Als Nächstes · ${n === 0 ? 'Heute' : n === 1 ? 'Morgen' : fmtDay(l._day, true)}</div>`;
  }
  const t = teacherFor(l);
  const nextExam = D.examList.find((x) => new Date(x.lesson.end) > now);
  const foot = nextExam ? `<div class="foot">Nächste Prüfung: ${xtag(nextExam)} <b>${esc(splitLabel(nextExam.module.label).name)}</b> · ${fmtDay(nextExam.day)} (${inDays(nextExam.day)})</div>` : '';
  return `<div class="card nowcard" style="${sv(l.label)}" data-lid="${l.id}">${kicker}
    <div class="title">${esc(name)} ${examsOf(l).map((x) => xtag(x)).join(' ')}</div>
    <div class="meta">${hm(s)}–${hm(e)}${l.room ? ' · ' + esc(l.room) : ''}${t ? ' · ' + esc(t) : ''}${num ? ' · Modul ' + esc(num) : ''}</div>${bar}${foot}</div>`;
}

function weekDays() {
  const mon = keyAdd(mondayKey(todayKey()), weekOffset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const k = keyAdd(mon, i);
    days.push({ key: k, lessons: D.lessons.filter((l) => l._day === k), hol: holidayOf(k) });
  }
  return { mon, days: days.filter((d, i) => i < 5 || d.lessons.length) };
}

function weekNav(mon) {
  const sun = keyAdd(mon, 6);
  const a = keyDate(mon), b = keyDate(sun);
  const range = a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}.–${b.getUTCDate()}. ${MON[b.getUTCMonth()]}` : `${a.getUTCDate()}. ${MON[a.getUTCMonth()]}–${b.getUTCDate()}. ${MON[b.getUTCMonth()]}`;
  return `<nav class="weeknav"><button class="icon sm" data-act="prev" aria-label="Vorherige Woche">${ICON.prev}</button>
    <div class="weeklabel">KW ${isoWeek(mon)} · ${range}${weekOffset ? '<button class="chip" data-act="today">Heute</button>' : ''}</div>
    <button class="icon sm" data-act="next" aria-label="Nächste Woche">${ICON.next}</button></nav>`;
}

function vacCard(mon) {
  const v = vacationOf(mon) || vacationOf(keyAdd(mon, 4));
  if (v) {
    const back = keyAdd(v.end, 3);
    return `<div class="vac"><span class="big">${v.icon}</span><div><b>${v.name}</b><span>${fmtShort(v.start)}–${fmtShort(v.end)} · Schule wieder ab ${fmtDay(back, true)}</span></div></div>`;
  }
  if (D.lastDay && mon > D.lastDay) return `<div class="vac"><span class="big">📭</span><div><b>Noch kein Stundenplan</b><span>Letzter bekannter Schultag: ${fmtDay(D.lastDay, true)}</span></div></div>`;
  return '';
}

function lessonCard(l) {
  const s = new Date(l.start), e = new Date(l.end), now = Date.now();
  const { num, name } = splitLabel(l.label);
  const cls = e < now ? 'past' : s <= now ? 'current' : '';
  const xs = examsOf(l);
  const t = teacherFor(l);
  const note = S.notes[l.id];
  return `<div class="card lesson ${cls} ${xs.length ? 'exam' : ''}" style="${sv(l.label)}" data-lid="${l.id}">
    <div class="time">${hm(s)}<small>${hm(e)}</small></div>
    <div><div class="ltitle">${num ? `<span class="badge">${esc(num)}</span>` : ''}<span>${esc(name)}</span>${xs.map((x) => xtag(x)).join('')}${absTag(absenceOf(l.id))}</div>
    <div class="lmeta">${l.room ? `<span>${ICON.room}${esc(l.room)}</span>` : ''}${t ? `<span>${ICON.user}${esc(t)}</span>` : ''}${l._dayN ? `<span class="prog">Tag ${l._dayIdx + 1}/${l._dayN}</span>` : ''}</div>
    ${l.comment ? `<div class="tnote" data-raw>${esc(l.comment)}</div>` : ''}
    ${note ? `<div class="note">${ICON.note}<span data-raw>${esc(note.length > 90 ? note.slice(0, 90) + '…' : note)}</span></div>` : ''}</div></div>`;
}

function renderWeekList(days) {
  const tk = todayKey();
  return days.map((d) => {
    const isToday = d.key === tk;
    const vac = vacationOf(d.key);
    if (vac && !d.lessons.length && !d.hol) return '';
    const head = `<div class="dayhead">${WD[dow(d.key)]} <span style="font-weight:500">${fmtShort(d.key)}</span>${isToday ? '<span class="pill">HEUTE</span>' : ''}${d.hol ? `<span class="hpill">${esc(d.hol)}</span>` : ''}</div>`;
    const body = d.lessons.length ? d.lessons.map(lessonCard).join('') : `<div class="free">${d.hol ? 'Feiertag' : d.doneCount ? 'Für heute fertig' : 'Kein Unterricht'}</div>`;
    return `<section class="day ${isToday ? 'today' : ''}">${head}${body}</section>`;
  }).join('');
}

function renderWeekGrid(days) {
  const tk = todayKey(), now = new Date();
  let minM = 8 * 60, maxM = 17 * 60;
  for (const d of days) for (const l of d.lessons) {
    minM = Math.min(minM, Math.floor(mod(new Date(l.start)) / 60) * 60);
    maxM = Math.max(maxM, Math.ceil(mod(new Date(l.end)) / 60) * 60);
  }
  const PX = 1.15, H = (maxM - minM) * PX + 12, top = (m) => (m - minM) * PX;
  let h = `<div class="card grid" style="--days:${days.length}"><div class="ghead"></div>`;
  for (const d of days) h += `<div class="ghead ${d.key === tk ? 'today' : ''}">${WD[dow(d.key)]}<small>${keyDate(d.key).getUTCDate()}. ${MON[keyDate(d.key).getUTCMonth()]}</small>${d.hol ? `<span class="hpill">${esc(d.hol)}</span>` : ''}</div>`;
  h += `<div class="gaxis" style="height:${H}px">`;
  for (let m = minM; m <= maxM; m += 60) h += `<span style="top:${top(m)}px">${p2(m / 60)}:00</span>`;
  h += `</div>`;
  for (const d of days) {
    const isHol = (d.hol && !/½/.test(d.hol)) || (vacationOf(d.key) && !d.lessons.length);
    h += `<div class="gcol ${d.key === tk ? 'today' : ''} ${isHol ? 'hol' : ''}" style="height:${H}px">`;
    for (let m = minM + 60; m < maxM; m += 60) h += `<div class="hline" style="top:${top(m)}px"></div>`;
    if (isHol && !d.lessons.length) h += `<div class="holname">${esc(d.hol || vacationOf(d.key).name)}</div>`;
    for (const l of d.lessons) {
      const s = new Date(l.start), e = new Date(l.end);
      const { num, name } = splitLabel(l.label);
      const t = teacherFor(l), xs = examsOf(l);
      h += `<div class="gev ${e < now ? 'past' : ''} ${xs.length ? 'exam' : ''}" data-lid="${l.id}" style="${sv(l.label)}top:${top(mod(s)) + 2}px;height:${(mod(e) - mod(s)) * PX - 4}px">
        <div class="t">${hm(s)}–${hm(e)}${num ? ' · ' + esc(num) : ''} ${xs.map((x) => xtag(x)).join('')} ${S.notes[l.id] ? ICON.note : ''}</div><b>${esc(name)}</b>
        <div class="m">${[l.room, t].filter(Boolean).map(esc).join(' · ')}</div>
        ${l.comment ? `<div class="m" style="color:var(--accent)" data-raw>${esc(l.comment)}</div>` : ''}</div>`;
    }
    if (d.key === tk) { const nm = mod(now); if (nm >= minM && nm <= maxM) h += `<div class="nowline" style="top:${top(nm)}px"></div>`; }
    h += `</div>`;
  }
  return h + `</div>`;
}

// in the current week, things that are already over are folded away (one tap brings them back)
let showPast = false;
function pastToggle(n, label) {
  if (!n) return '';
  return `<button class="pastbar ${showPast ? 'open' : ''}" data-act="togglepast"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span>${showPast ? 'Vergangenes ausblenden' : `${n} vergangene Lektion${n === 1 ? '' : 'en'} anzeigen`}</span><small>${esc(label)}</small></button>`;
}
function foldPast(days, grid) {
  if (weekOffset !== 0 || grid) return { days, bar: '' };   // big screen: always the full week
  const tk = todayKey(), now = Date.now();
  const pastDays = days.filter((d) => d.key < tk);
  const todayDone = grid ? [] : (days.find((d) => d.key === tk)?.lessons || []).filter((l) => new Date(l.end) < now);
  const n = pastDays.reduce((x, d) => x + d.lessons.length, 0) + todayDone.length;
  const shownPastDays = pastDays.filter((d) => d.lessons.length || d.hol);
  if (!n && !shownPastDays.length) return { days, bar: '' };
  const label = pastDays.length ? (pastDays.length === 1 ? WD[dow(pastDays[0].key)] : `${WDS[dow(pastDays[0].key)]}–${WDS[dow(pastDays[pastDays.length - 1].key)]}`) + (todayDone.length ? ' + heute' : '') : 'heute';
  const bar = pastToggle(n, label);
  if (showPast) return { days, bar };
  const left = days.filter((d) => d.key >= tk).map((d) => d.key === tk && !grid ? { ...d, lessons: d.lessons.filter((l) => new Date(l.end) >= now), doneCount: todayDone.length } : d);
  return { days: left, bar };
}

function renderWeek() {
  if (!D.lessons.length) return `<div class="empty">${S.status === 'syncing' ? 'Lade deinen Stundenplan…' : 'Noch keine Daten. Tippe oben auf ↻.'}</div>`;
  const { mon, days } = weekDays();
  const grid = FULL && window.innerWidth > 760;
  const f = foldPast(days, grid);
  let body;
  if (!f.days.length || (!grid && !f.days.some((d) => d.lessons.length || d.hol))) body = `<div class="free" style="margin:4px 2px 0">Diese Woche ist vorbei. Mit dem Pfeil oben gehts zur nächsten.</div>`;
  else body = grid ? renderWeekGrid(f.days) : renderWeekList(f.days);
  return (weekOffset === 0 && !grid ? nowCard() : '') + weekNav(mon) + vacCard(mon) + f.bar + body;
}

// =====================================================================
// EXAMS view
// =====================================================================
function examRow(x) {
  const k = x.day, d = keyDate(k);
  const soon = k >= todayKey() && daysBetween(todayKey(), k) <= 7;
  const done = x.grade != null;
  const { num, name } = splitLabel(x.module.label);
  return `<div class="card xrow ${soon ? 'soon' : ''} ${k < todayKey() ? 'done' : ''}" data-lid="${x.lesson.id}" style="${sv(x.module.label)}">
    <div class="xdate"><small>${WDS[dow(k)]}</small><b>${d.getUTCDate()}</b><small>${MON[d.getUTCMonth()]}</small></div>
    <div class="xmain"><div class="t">${esc(name)}</div>
      <div class="m">${xtag(x)}${num ? `<span class="badge">${esc(num)}</span>` : ''}<span>${hm(new Date(x.lesson.start))}</span>${x.lesson.room ? `<span>${esc(x.lesson.room)}</span>` : ''}${x.est ? '<span>· geschätzt</span>' : ''}</div></div>
    <div class="xright">${done ? `<b class="gval ${gradeCls(x.grade)}">${fmtG(x.grade)}</b>Note` : `<b>${inDays(k)}</b>${x.weight != null ? x.weight + ' %' : ''}`}</div></div>`;
}
function renderExams() {
  const tk = todayKey();
  const up = D.examList.filter((x) => x.day >= tk);
  const past = D.examList.filter((x) => x.day < tk).reverse();
  const wk = up.filter((x) => daysBetween(tk, x.day) <= 7), later = up.filter((x) => daysBetween(tk, x.day) > 7);
  let h = `<div class="legend"><span class="xtag zp">ZP</span> Zwischenprüfung <span class="xtag lb">LB</span> Leistungsbeurteilung <span class="xtag pj">Projekt</span>
    <span class="xtag est" style="color:var(--muted)">gestrichelt</span> = geschätzt, Klick zum Korrigieren</div>`;
  if (!D.examList.length) return h + `<div class="empty">Keine Prüfungen gefunden.</div>`;
  if (wk.length) h += `<div class="section-title">Nächste 7 Tage <small>${wk.length}</small></div>` + wk.map(examRow).join('');
  if (later.length) h += `<div class="section-title">Später <small>${later.length}</small></div>` + later.map(examRow).join('');
  if (past.length) h += `<div class="section-title">Vergangen <small>${past.length}</small></div>` + past.slice(0, 20).map(examRow).join('');
  return h;
}

// =====================================================================
// GRADES view
// =====================================================================
// What is still needed in a module: weights of the missing exams and the grade required
// there to reach a target (taking the rounding of the final module grade into account).
function gradeCalc(g) {
  const W = g.exams.reduce((a, x) => a + (+x.weight || 0), 0) || 100;
  const got = g.exams.filter((x) => x.grade != null);
  const missing = g.exams.filter((x) => x.grade == null);
  const wGot = got.reduce((a, x) => a + (+x.weight || 0), 0);
  const sum = got.reduce((a, x) => a + +x.grade * (+x.weight || 0), 0);
  const part = wGot ? sum / wGot : null;
  const rest = W - wGot;
  const step = +P('gradeStep') || 0;
  const needFor = (T) => {
    if (rest <= 0) return null;
    const thr = step ? T - step / 2 : T;                 // e.g. 4.75 rounds to 5 with 0.5 steps
    const n = (thr * W - sum) / rest;
    if (n > 6 + 1e-9) return null;                        // not reachable any more
    return Math.max(1, Math.ceil(n * 10 - 1e-9) / 10);
  };
  const max = rest > 0 ? (sum + 6 * rest) / W : part;
  return { W, wGot, rest, part, missing, needFor, max: Math.round(max * 100) / 100 };
}

// Average over the school year: every finished module at its last lesson day, plus the running average.
function gradeTrend() {
  const pts = [];
  for (const g of S.grades || []) {
    if (g.grade == null || /offen/i.test(g.status)) continue;
    const m = D.mods.get(g.event);
    const day = m ? m.days[m.days.length - 1] : null;
    pts.push({ day, g: +g.grade, label: g.label });
  }
  if (pts.length < 2) return '';
  const known = pts.filter((p) => p.day).sort((a, b) => a.day.localeCompare(b.day));
  const early = pts.filter((p) => !p.day);
  let s = early.reduce((a, p) => a + p.g, 0), n = early.length;
  const series = [];
  if (n) series.push({ day: null, avg: s / n, g: null, label: tr('frühere Module') + ' (' + n + ')' });
  for (const p of known) { s += p.g; n++; series.push({ day: p.day, avg: s / n, g: p.g, label: p.label }); }
  if (series.length < 2) return '';
  const Wd = 640, Hd = 150, padL = 28, padR = 10, padT = 10, padB = 22;
  const ys = series.flatMap((p) => [p.avg, p.g]).filter((v) => v != null);
  const lo = Math.max(1, Math.floor(Math.min(...ys, 4) * 2) / 2 - 0.5), hi = Math.min(6, Math.ceil(Math.max(...ys) * 2) / 2 + 0.25);
  const X = (i) => padL + (i / (series.length - 1)) * (Wd - padL - padR);
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (Hd - padT - padB);
  let grid = '';
  for (let v = Math.ceil(lo); v <= hi; v += 0.5) grid += `<line x1="${padL}" x2="${Wd - padR}" y1="${Y(v)}" y2="${Y(v)}" class="tg ${v === 4 ? 'four' : ''}"/><text x="${padL - 6}" y="${Y(v) + 3.5}" class="tl">${fmtG(v)}</text>`;
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.avg).toFixed(1)}`).join(' ');
  const dots = series.map((p, i) => p.g == null ? '' : `<circle cx="${X(i)}" cy="${Y(p.g)}" r="3.2" class="td ${gradeCls(p.g)}"><title>${esc(splitLabel(p.label).name)}: ${fmtG(p.g)}</title></circle>`).join('');
  let months = '', lastM = '';
  series.forEach((p, i) => { if (!p.day) return; const m = MON[keyDate(p.day).getUTCMonth()]; if (m !== lastM) { months += `<text x="${X(i)}" y="${Hd - 6}" class="tm">${m}</text>`; lastM = m; } });
  const first = series[0].avg, last = series[series.length - 1].avg, diff = last - first;
  return `<div class="card trend"><div class="trend-h"><b>${tr('Schnitt im Verlauf')}</b><small>${tr('aktuell')} <b class="gval ${gradeCls(last)}">${fmtG(Math.round(last * 100) / 100)}</b> · <span class="${diff >= 0 ? 'gval good' : 'gval bad'}">${diff >= 0 ? '▲' : '▼'} ${fmtG(Math.abs(Math.round(diff * 100) / 100))}</span></small></div>
    <svg viewBox="0 0 ${Wd} ${Hd}" class="tsvg" role="img" aria-label="${esc(tr('Schnitt im Verlauf'))}">${grid}<path d="${line}" class="tline"/>${dots}${months}</svg>
    <div class="trend-l"><span><i class="tli"></i>${tr('Schnitt')}</span><span><i class="tdi"></i>${tr('Modulnote')}</span></div></div>`;
}

function renderGrades() {
  const G = S.grades || [];
  if (!G.length) return `<div class="empty">Noch keine Noten geladen.</div>`;
  const done = G.filter((g) => g.grade != null);
  const avg = done.length ? done.reduce((a, g) => a + +g.grade, 0) / done.length : null;
  const insuff = done.filter((g) => g.grade < 4).length;
  // group open entries per module (ABU has 2 parts)
  const open = G.filter((g) => g.grade == null || /offen/i.test(g.status));
  const seen = new Set();
  let h = `<div class="avg"><div class="card"><div class="k">Schnitt</div><div class="v gval ${gradeCls(avg)}">${fmtG(avg && Math.round(avg * 100) / 100)}</div></div>
    <div class="card"><div class="k">Abgeschlossen</div><div class="v">${done.length}</div></div>
    <div class="card"><div class="k">Ungenügend</div><div class="v ${insuff ? 'gval bad' : ''}">${insuff}</div></div></div>`;
  h += gradeTrend();

  const card = (g) => {
    const c = gradeCalc(g);
    let need = '';
    if (g.grade == null && c.rest > 0 && g.exams.length) {
      const tgt = P('targetGrade');
      const row = [4, 4.5, 5, 5.5, 6].map((T) => {
        const n = c.needFor(T);
        const txt = n == null ? '–' : n <= 1 ? '1' : fmtG(n);
        return `<span class="nt ${T === tgt ? 'on' : ''} ${n == null ? 'no' : n > 5.5 ? 'hard' : ''}" title="${esc(tr('für eine {T} im Modul', { T: fmtG(T) }))}"><small>${fmtG(T)}</small><b>${txt}</b></span>`;
      }).join('');
      const nT = c.needFor(tgt);
      const restLab = c.missing.map((x) => x.label).join(' + ') || tr('Rest');
      need = `<div class="calc"><div class="need">${nT == null
        ? tr('Eine {T} geht nicht mehr, höchstens noch eine {M}.', { T: fmtG(tgt), M: fmtG(c.max) })
        : tr(c.missing.length > 1 ? 'Für eine {T} brauchst du in {R} ({W} %) im Schnitt mindestens eine {N}.' : 'Für eine {T} brauchst du in {R} ({W} %) mindestens eine {N}.', { T: `<b>${fmtG(tgt)}</b>`, R: esc(restLab), W: c.rest, N: `<b class="gval ${nT > 5.5 ? 'bad' : ''}">${nT <= 1 ? '1' : fmtG(nT)}</b>` })}
        ${c.part != null ? `<span class="muted"> · ${tr('bisher')} ${fmtG(Math.round(c.part * 100) / 100)}</span>` : ''}</div>
        <div class="ntrow"><span class="ntl">${tr('Nötig für')}</span>${row}</div></div>`;
    }
    const { num, name } = splitLabel(g.label);
    const lid = (D.mods.get(g.event)?.lessons.find((l) => new Date(l.end) > Date.now()) || D.mods.get(g.event)?.lessons.slice(-1)[0])?.id;
    return `<div class="card gmod" style="${sv(g.label)}" ${lid ? `data-lid="${lid}"` : ''}>
      <div class="h"><div><div class="t">${num ? `<span class="badge">${esc(num)}</span> ` : ''}${esc(name)}</div>${g.part && g.part !== name ? `<div class="muted" style="font-size:12px">${esc(g.part)}</div>` : ''}</div>
      <div class="gbig ${gradeCls(g.grade)}">${g.grade != null ? fmtG(+g.grade) : c.part != null ? `<span class="muted" style="font-size:13px">~${fmtG(Math.round(c.part * 10) / 10)}</span>` : `<span class="muted" style="font-size:13px">${tr('offen')}</span>`}</div></div>
      <div class="gparts">${g.exams.map((x) => `<span class="gpart"><span class="xtag ${examKind(x.label)}">${esc(x.label)}</span><span class="w">${x.weight ?? ''}%</span><span class="gval ${gradeCls(x.grade)}">${fmtG(x.grade)}</span></span>`).join('')}</div>${need}</div>`;
  };
  const openList = open.filter((g) => { const k = g.event + g.part; if (seen.has(k)) return false; seen.add(k); return true; });
  if (openList.length) h += `<div class="section-title">Laufend <small>${openList.length}</small></div>` + openList.map(card).join('');
  const closed = done.filter((g) => !/offen/i.test(g.status)).sort((a, b) => +b.grade - +a.grade);
  if (closed.length) h += `<div class="section-title">Abgeschlossen <small>${closed.length}</small></div>` + closed.map(card).join('');
  return h + renderAllModules();
}

// All modules of the apprenticeship (modulbaukasten) with status from Tocco
function renderAllModules() {
  const nums = Object.keys(MODS);
  if (!nums.length) return '';
  const tk = todayKey();
  const info = {};
  const touch = (n) => (info[n] = info[n] || { grade: null, first: null, last: null, label: '' });
  for (const g of S.grades || []) for (const n of (splitLabel(g.label).num || '').split('-').filter(Boolean)) {
    const i = touch(n); i.label = g.label;
    if (g.grade != null && !/offen/i.test(g.status)) i.grade = i.grade == null ? +g.grade : Math.min(i.grade, +g.grade);
    else if (g.grade != null && i.grade == null) i.grade = +g.grade;
    i.open = i.open || /offen/i.test(g.status);
  }
  for (const m of D.mods.values()) for (const n of (splitLabel(m.label).num || '').split('-').filter(Boolean)) {
    const i = touch(n); i.label = m.label; i.first = m.days[0]; i.last = m.days[m.days.length - 1]; i.ev = m.ev;
  }
  const statusOf = (n) => {
    const i = info[n];
    if (!i) return { s: 'todo', t: 'noch nicht geplant' };
    if (i.grade != null && !i.open) return { s: 'done', t: 'abgeschlossen', g: i.grade };
    if (i.first && i.first > tk) return { s: 'plan', t: `ab ${fmtShort(i.first)}` };
    if (i.last && i.last >= tk) return { s: 'run', t: `läuft bis ${fmtShort(i.last)}` };
    if (i.grade != null) return { s: 'done', t: 'benotet', g: i.grade };
    return { s: 'wait', t: 'Note ausstehend' };
  };
  const school = nums.filter((n) => /Berufsfachschule/i.test(MODS[n].ort));
  const schoolDone = school.filter((n) => statusOf(n).s === 'done').length;
  const years = {};
  for (const n of nums) (years[MODS[n].lj || 'Weitere'] = years[MODS[n].lj || 'Weitere'] || []).push(n);
  let h = `<div class="section-title">Alle Module der Ausbildung <small>${schoolDone}/${school.length} Schulmodule abgeschlossen</small></div>
    <div class="bar" style="height:6px;margin:0 2px 8px"><i style="width:${(schoolDone / Math.max(1, school.length)) * 100}%;background:var(--ok)"></i></div>
    <div class="legend" style="margin:0 2px 6px"><span class="mst done">✓</span> abgeschlossen <span class="mst run">●</span> läuft <span class="mst plan">◷</span> geplant <span class="mst todo">○</span> offen · üK = überbetrieblicher Kurs</div>`;
  for (const y of Object.keys(years).sort()) {
    h += `<div class="mgroup"><div class="mgh">${esc(y)}</div>`;
    for (const n of years[y].sort((a, b) => a - b)) {
      const mi = MODS[n], st = statusOf(n);
      const uk = /üK/.test(mi.ort), wahl = /Wahl/i.test(mi.typ);
      const lid = info[n] && info[n].ev ? (D.mods.get(info[n].ev)?.lessons.find((l) => l._day >= tk) || D.mods.get(info[n].ev)?.lessons.slice(-1)[0])?.id : null;
      h += `<div class="mrow ${st.s}" ${lid ? `data-lid="${lid}"` : `data-mod="${n}"`} style="${sv(info[n]?.label || n)}">
        <span class="mst ${st.s}">${{ done: '✓', run: '●', plan: '◷', wait: '…', todo: '○' }[st.s]}</span>
        <span class="badge">${esc(n)}</span><span class="mt">${esc(mi.t)}${uk ? ' <span class="mini">üK</span>' : ''}${wahl ? ' <span class="mini">Wahl</span>' : ''}</span>
        <span class="mr">${st.g != null ? `<b class="gval ${gradeCls(st.g)}">${fmtG(st.g)}</b>` : `<span class="muted">${esc(st.t)}</span>`}</span></div>`;
    }
    h += `</div>`;
  }
  return h + `<div class="muted" style="font-size:11px;margin-top:8px">Modulbeschreibungen: modulbaukasten.ch (ICT-Berufsbildung Schweiz)</div>`;
}

function openModuleSheet(n) {
  const mi = MODS[n];
  if (!mi) return;
  setHTML($('sheet'), `<div class="sh" style="${sv(n)}"><div><div class="stripe"></div><h2>${esc(mi.t)}</h2><div class="muted">Modul ${esc(n)}</div></div>
      <button class="icon" data-act="close" aria-label="Schliessen">${ICON.close}</button></div>
    <div class="minfo"><div class="mtags">${[mi.typ, mi.lj, mi.ort, mi.feld].filter(Boolean).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
      <p><b>Kompetenz:</b> <span data-raw>${esc(mi.k)}</span></p>${mi.o ? `<p class="muted"><b>Objekt:</b> <span data-raw>${esc(mi.o)}</span></p>` : ''}
      ${mi.z && mi.z.length ? `<h4>Handlungsziele</h4><ol>${mi.z.map((z) => `<li data-raw>${esc(z)}</li>`).join('')}</ol>` : ''}
      ${mi.pdf ? `<a class="mlink" href="${MBK_PDF + mi.pdf}" target="_blank" rel="noopener">Modulbeschreibung (PDF) ↗</a>` : ''}
      <p class="muted" style="font-size:12px">Dieses Modul ist (noch) nicht in deinem Stundenplan.</p></div>`);
  delete $('sheet').dataset.sheetLid;
  $('sheetWrap').hidden = false;
}


// =====================================================================
// ABSENCES view
// =====================================================================
const EXCUSE_DAYS = 7;   // absences must be excused within one week
const ABS = {
  absent_unexcused: { cls: 'bad', short: 'unentschuldigt' },
  absent_excused: { cls: 'ok', short: 'entschuldigt' },
  dispensed: { cls: 'muted', short: 'dispensiert' },
  abwesend: { cls: 'warn', short: 'abwesend' }, abwesend_25: { cls: 'warn', short: 'abwesend 25 %' },
  abwesend_50: { cls: 'warn', short: 'abwesend 50 %' }, abwesend_75: { cls: 'warn', short: 'abwesend 75 %' }
};
const absInfo = (code) => ABS[code] || { cls: 'warn', short: code };
const needsAction = (a) => a.status === 'absent_unexcused' || /^abwesend/.test(a.status);
function deadline(a) {
  const end = new Date(a.start).getTime() + EXCUSE_DAYS * 86400000;
  const left = Math.ceil((end - Date.now()) / 86400000);
  return { end, left, open: left > 0 };
}
function absenceOf(lessonId) { return (S.absences || []).find((a) => a.lesson === lessonId) || null; }
function absTag(a) {
  if (!a) return '';
  const i = absInfo(a.status);
  return `<span class="atag ${i.cls}">${esc(i.short)}</span>`;
}
const lessonsOf = (minutes) => Math.floor(minutes / 45);   // 45-min Lektionen
function openActionCount() { return (S.absences || []).filter((a) => needsAction(a) && deadline(a).open).length; }

// ---- attendance per lesson / day (shared by the heat map and the lesson sheet) ----
const AST = { ok: 'anwesend', exc: 'entschuldigt', part: 'teilweise abwesend', bad: 'unentschuldigt', disp: 'dispensiert', fut: 'geplant' };
const AST_RANK = { ok: 0, disp: 1, exc: 2, part: 3, bad: 4 };
let _absIdx = null, _absIdxSrc = null;
function absIndex() {
  if (_absIdx && _absIdxSrc === S.absences) return _absIdx;
  const byLesson = new Map(), byDay = new Map();
  for (const a of S.absences || []) {
    if (a.lesson) byLesson.set(String(a.lesson), a);
    const k = dayKey(new Date(a.start));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(a);
  }
  _absIdxSrc = S.absences;
  return (_absIdx = { byLesson, byDay });
}
const absSt = (a) => ({ bad: 'bad', ok: 'exc', warn: 'part', muted: 'disp' })[absInfo(a.status).cls] || 'part';
function lessonSt(l) {
  const a = absIndex().byLesson.get(String(l.id));
  if (a) return absSt(a);
  return new Date(l.start) > Date.now() ? 'fut' : 'ok';
}
function worstSt(list) {
  let w = '';
  for (const s of list) if (s !== 'fut' && (w === '' || AST_RANK[s] > AST_RANK[w])) w = s;
  return w || (list.includes('fut') ? 'fut' : '');
}
let heatSel = null;     // selected day in the heat map
let heatScrollX = null; // keep the horizontal scroll position across re-renders

function renderHeat(A) {
  const byDay = new Map();
  for (const l of D.lessons) { if (!byDay.has(l._day)) byDay.set(l._day, []); byDay.get(l._day).push(l); }
  const idx = absIndex();
  const keys = [...byDay.keys(), ...idx.byDay.keys()].sort();
  if (!keys.length) return '';
  const today = todayKey();
  let start = keys[0];
  start = keyAdd(start, -dow(start));                       // Monday of the first week
  const end = keyAdd(today, 6 - dow(today));                 // Sunday of this week
  const dayInfo = (k) => {
    const ls = byDay.get(k) || [];
    const st = ls.map(lessonSt);
    const ids = new Set(ls.map((l) => String(l.id)));
    for (const a of idx.byDay.get(k) || []) if (!ids.has(String(a.lesson))) st.push(absSt(a));
    return { ls, st: worstSt(st) };
  };
  if (!heatSel || heatSel > end) heatSel = A.length ? dayKey(new Date(A[0].start)) : today;

  const rows = keys.some((k) => dow(k) === 5) ? 6 : 5;   // Mo–Fr (Sa only if there ever was Saturday class)
  const lk = D.lessons.map((l) => l._day).sort();
  const firstL = lk[0] || today, lastL = lk[lk.length - 1] || today;
  const vacOf = (k) => (D.vacations || []).find((v) => k >= v.start && k <= v.end) || null;
  // what a day without lessons is: weekend, holiday, vacation, free (no school that weekday) or simply no data
  const offDay = (k) => {
    if (dow(k) >= 5) return { c: 'h-free', t: 'Wochenende' };
    const hol = holidayOf(k); if (hol) return { c: 'h-hol', t: hol };
    const v = vacOf(k); if (v) return { c: 'h-vac', t: v.name };
    if (k < firstL) return { c: 'h-nod', t: 'Keine Daten (vor deinem Stundenplan-Zeitraum)' };
    if (k > lastL) return { c: 'h-nod', t: 'Noch kein Stundenplan' };
    return { c: 'h-free', t: 'Kein Unterricht' };
  };
  let cols = '', lastMon = -1, weeks = 0, lastLab = -9;
  const tally = { ok: 0, exc: 0, part: 0, bad: 0, disp: 0 };
  for (let w = start; w <= end; w = keyAdd(w, 7)) {
    weeks++;
    const m = keyDate(w).getUTCMonth();
    let lab = '';
    if (m !== lastMon) { if (weeks - lastLab >= 3) { lab = MON[m]; lastLab = weeks; } lastMon = m; }
    let cells = '';
    for (let i = 0; i < rows; i++) {        // Mo–Fr (Sa only if there ever was Saturday class)
      const k = keyAdd(w, i);
      const { ls, st } = dayInfo(k);
      if (st && tally[st] != null) tally[st]++;
      const off = st ? null : offDay(k);
      const tip = `${fmtDay(k)} ${keyDate(k).getUTCFullYear()} · ${st ? tr(AST[st]) + (ls.length ? ' · ' + tr(ls.length === 1 ? '1 Block' : '{N} Blöcke', { N: ls.length }) : '') : tr(off.t)}`;
      cells += `<i class="hc ${st || off.c} ${k === today ? 'today' : ''} ${k === heatSel ? 'sel' : ''}" data-act="hday" data-k="${k}" title="${esc(tip)}"></i>`;
    }
    cols += `<div class="hw"><span class="hm">${lab}</span>${cells}</div>`;
  }
  const sel = dayInfo(heatSel);
  const selAbs = (idx.byDay.get(heatSel) || []);
  const selRows = sel.ls.length
    ? sel.ls.map((l) => {
      const s = lessonSt(l), a = idx.byLesson.get(String(l.id));
      const { num, name } = splitLabel(l.label);
      return `<div class="hrow" data-lid="${l.id}" style="${sv(l.label)}"><i class="hc ${s}"></i><span class="ht">${hm(new Date(l.start))}–${hm(new Date(l.end))}</span>
        <span class="hn">${num ? `<span class="badge">${esc(num)}</span> ` : ''}${esc(name)}</span><span class="hs">${a ? absTag(a) : `<span class="muted">${AST[s]}</span>`}</span></div>`;
    }).join('')
    : selAbs.length ? selAbs.map((a) => `<div class="hrow"><i class="hc ${absSt(a)}"></i><span class="ht">${hm(new Date(a.start))}</span><span class="hn">${esc(splitLabel(a.label).name)}</span><span class="hs">${absTag(a)}</span></div>`).join('')
      : `<div class="muted" style="padding:4px 2px">${esc(offDay(heatSel).t)}${offDay(heatSel).c === 'h-free' ? ' an diesem Tag.' : ''}</div>`;

  return `<div class="card heat-card">
    <div class="heat-top"><b>Anwesenheit</b><small>${tally.ok} Tage anwesend · ${tally.exc + tally.disp} entschuldigt · <span class="${tally.bad ? 'gval bad' : ''}">${tally.bad + tally.part} unentschuldigt</span></small></div>
    <div class="heat-scroll" id="heatScroll"><div class="heat" style="--rows:${rows}"><div class="hw hd"><span class="hm"></span><span>Mo</span><span></span><span>Mi</span><span></span><span>Fr</span>${rows > 5 ? '<span></span>' : ''}</div>${cols}</div></div>
    <div class="heat-legend"><span><i class="hc ok"></i>anwesend</span><span><i class="hc exc"></i>entschuldigt</span><span><i class="hc part"></i>teilweise</span><span><i class="hc bad"></i>unentschuldigt</span><span><i class="hc fut"></i>geplant</span></div>
    <div class="heat-legend sub"><span><i class="hc h-free"></i>kein Unterricht</span><span><i class="hc h-vac"></i>Ferien</span><span><i class="hc h-hol"></i>Feiertag</span><span><i class="hc h-nod"></i>keine Daten</span></div>
    <div class="heat-day"><div class="hdh">${esc(fmtDay(heatSel, true))} ${keyDate(heatSel).getUTCFullYear()}</div>${selRows}</div>
  </div>`;
}

// GitHub-style history: grouped by month, a line with dots on the left
function renderAbsTimeline(A) {
  if (!A.length) return '';
  const MONL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const groups = new Map();
  for (const a of A) {
    const k = dayKey(new Date(a.start)).slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  let h = '<div class="ahist">';
  for (const [ym, list] of groups) {
    const lekt = list.reduce((x, a) => x + (+a.missed || 0), 0);
    h += `<div class="ah-month"><span class="ah-dot"></span><b>${MONL[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</b><small>${list.length} Absenz${list.length === 1 ? '' : 'en'}${lekt ? ' · ' + fmtG(lekt) + ' Lekt.' : ''}</small></div>
      <div class="ah-box">`;
    for (const a of list) {
      const k = dayKey(new Date(a.start));
      const { num, name } = splitLabel(a.label);
      const inTT = D.lessons.some((l) => String(l.id) === String(a.lesson));
      const late = needsAction(a) && !deadline(a).open;
      h += `<div class="ah-row" ${inTT ? `data-lid="${a.lesson}"` : `data-act="hday" data-k="${k}"`} style="${sv(a.label)}">
        <i class="hc ${absSt(a)}"></i>
        <div class="ah-main"><div class="ah-t">${esc(name)}</div>
          <div class="ah-m">${num ? `<span class="badge">${esc(num)}</span>` : ''}<span class="ah-d">${esc(fmtDay(k))} · ${hm(new Date(a.start))}–${hm(new Date(a.end))}${a.missed ? ` · ${fmtG(a.missed)} Lekt.` : ''}</span></div>${a.comment ? `<div class="ah-c" data-raw>${esc(a.comment)}</div>` : ''}</div>
        <div class="ah-r">${absTag(a)}${late ? '<small>Frist vorbei</small>' : ''}</div></div>`;
    }
    h += '</div>';
  }
  return h + '</div>';
}

function renderAbsences() {
  const A = (S.absences || []).slice().sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const M = (S.attendance && S.attendance.modules) || [];
  if (!A.length && !M.length) return `<div class="empty">${S.status === 'syncing' ? 'Lade Absenzen…' : 'Noch keine Absenzen geladen. Tippe oben auf ↻.'}</div>`;
  const semOf = (abbr) => { const m = String(abbr).match(/-S(\d+)(?:-|$)/); return m ? +m[1] : 0; };
  const sems = M.filter((m) => m.type === 'Semester').sort((a, b) => semOf(b.abbr) - semOf(a.abbr));
  const cur = sems[0];
  const unexc = A.filter((a) => a.status === 'absent_unexcused');
  const exc = A.filter((a) => a.status === 'absent_excused');
  const sum = (list) => list.reduce((x, a) => x + (+a.missed || 0), 0);
  const rateCls = (r, min) => r == null ? '' : r < min ? 'bad' : r < min + 3 ? 'warn' : 'good';
  const openAct = A.filter((a) => needsAction(a) && deadline(a).open).sort((a, b) => deadline(a).end - deadline(b).end);

  let h = `<div class="avg">
    <div class="card"><div class="k">Zu entschuldigen</div><div class="v ${openAct.length ? 'gval warn' : 'gval good'}">${openAct.length || '✓'}</div><div class="k">${openAct.length ? 'Frist ' + EXCUSE_DAYS + ' Tage' : 'nichts offen'}</div></div>
    <div class="card"><div class="k">Abwesend</div><div class="v">${A.length}</div><div class="k">${exc.length} entsch. · ${unexc.length} unentsch.</div></div>
    <div class="card"><div class="k">${cur ? 'Semester ' + semOf(cur.abbr) : 'Anwesenheit'}</div><div class="v gval ${cur ? rateCls(cur.semRate, cur.min || 90) : ''}">${cur && cur.semRate != null ? cur.semRate + ' %' : '–'}</div><div class="k">Minimum ${cur ? cur.min || 90 : 90} %</div></div></div>`;

  // only what still needs doing goes on top
  if (openAct.length) {
    h += `<div class="section-title">Jetzt entschuldigen <small>innert ${EXCUSE_DAYS} Tagen (Teams-Genehmigung)</small></div>`;
    for (const a of openAct) h += absRow(a, true);
  }

  h += `<div class="section-title">Übersicht</div>` + renderHeat(A);
  if (A.length) h += `<div class="section-title">Verlauf <small>${A.length} Absenzen · ${fmtG(sum(A))} Lektionen</small></div>` + renderAbsTimeline(A);

  // modules per semester: current semester open, older ones folded
  const now = Date.now();
  sems.forEach((sem, si) => {
    const n = semOf(sem.abbr);
    const mods = M.filter((m) => m.type !== 'Semester' && semOf(m.abbr) === n && m.total > 0 && m.label)
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
    if (!mods.length) return;
    let body = '';
    for (const m of mods) {
      const min = m.min || 90, rate = m.rate ?? 100;
      const { num, name } = splitLabel(m.label);
      const future = D.lessons.filter((l) => l._ev === m.event && new Date(l.start) > now);
      const F = future.reduce((x, l) => x + lessonsOf((new Date(l.end) - new Date(l.start)) / 60000), 0);
      let extra = '';
      if (F > 0 && rate < min + 5) {
        const endRate = Math.round(((m.actual || 0) + F) / ((m.total || 0) + F) * 100);
        const buffer = Math.floor((m.actual || 0) + F - (min / 100) * ((m.total || 0) + F));
        extra = `<div class="need">${tr('Noch {F} Lekt. geplant · am Ende max. {R}', { F, R: `<b class="gval ${rateCls(endRate, min)}">${endRate} %</b>` })} · ${buffer >= 0 ? tr('noch {B} Lekt. Puffer', { B: `<b>${buffer}</b>` }) : `<b class="gval bad">${tr('Minimum nicht mehr erreichbar')}</b>`}</div>`;
      } else if (rate < min) {
        extra = `<div class="need"><b class="gval bad">Unter der Mindestanwesenheit</b> (${min} %)</div>`;
      }
      const lid = (D.mods.get(m.event)?.lessons.find((l) => new Date(l.end) > now) || D.mods.get(m.event)?.lessons.slice(-1)[0])?.id;
      body += `<div class="card gmod amod" style="${sv(m.label)}" ${lid ? `data-lid="${lid}"` : ''}>
        <div class="h"><div class="t">${num ? `<span class="badge">${esc(num)}</span> ` : ''}${esc(name)}</div>
        <div class="gval ${rateCls(rate, min)}" style="font-weight:700">${rate} %</div></div>
        <div class="pbar"><i class="${rateCls(rate, min)}" style="width:${Math.min(100, rate)}%"></i><span class="pmin" style="left:${min}%" title="Minimum ${min} %"></span></div>
        <div class="muted" style="font-size:11.5px;margin-top:5px">${fmtG(m.actual ?? 0)} / ${fmtG(m.total)} Lektionen${m.excused ? ` · ${fmtG(m.excused)} entsch.` : ''}${m.unexcused ? ` · <b class="gval bad">${fmtG(m.unexcused)} unentsch.</b>` : ''}</div>${extra}</div>`;
    }
    const head = `Semester ${n} <small>${sem.semActual ?? '–'} / ${sem.semTotal ?? '–'} Lekt. · <b class="gval ${rateCls(sem.semRate, sem.min || 90)}">${sem.semRate ?? '–'} %</b></small>`;
    h += si === 0 ? `<div class="section-title">${head}</div>${body}`
      : `<details class="semfold"><summary class="section-title">${head}</summary>${body}</details>`;
  });
  return h;
}

function absRow(a, withDeadline) {
  const k = dayKey(new Date(a.start)), d = keyDate(k), i = absInfo(a.status);
  const { num, name } = splitLabel(a.label);
  let dl = '';
  if (withDeadline) {
    const x = deadline(a);
    dl = x.open ? `<b class="${x.left <= 2 ? 'gval bad' : 'gval warn'}">noch ${x.left} Tag${x.left === 1 ? '' : 'e'}</b>zum Entschuldigen` : `<b class="gval bad">Frist abgelaufen</b>seit ${fmtShort(dayKey(new Date(x.end)))}`;
  } else if (needsAction(a) && !deadline(a).open) {
    dl = `<span class="muted">Frist abgelaufen</span>`;
  }
  const old = !withDeadline && needsAction(a) && !deadline(a).open;
  const inTimetable = D.lessons.some((l) => l.id === a.lesson);
  return `<div class="card xrow arow ${old ? 'old' : i.cls}" ${inTimetable ? `data-lid="${a.lesson}"` : ''} style="${sv(a.label)}">
    <div class="xdate"><small>${WDS[dow(k)]}</small><b>${d.getUTCDate()}</b><small>${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}</small></div>
    <div class="xmain"><div class="t">${esc(name)}</div>
      <div class="m">${absTag(a)}${num ? `<span class="badge">${esc(num)}</span>` : ''}<span>${hm(new Date(a.start))}–${hm(new Date(a.end))}</span>${a.missed ? `<span>${fmtG(a.missed)} Lekt.</span>` : ''}${a.comment ? `<span data-raw>· ${esc(a.comment)}</span>` : ''}</div></div>
    <div class="xright">${dl}</div></div>`;
}

// =====================================================================
// ROOMS view
// =====================================================================
function buildingOf(room) { const r = (S.rooms || []).find((x) => x.label === room); return r ? r.building : ''; }
function myBuilding() {
  const cnt = {};
  for (const l of D.lessons) { const b = buildingOf(l.room); if (b && !/online|extern/i.test(b)) cnt[b] = (cnt[b] || 0) + 1; }
  return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || 'WISS Zürich';
}
async function loadRoomDay(k, force) {
  const c = roomState.cache[k];
  if (c && !force && Date.now() - c.ts < 5 * 60 * 1000) return;
  if (!hasChrome) return;
  roomState.loading = true; roomState.err = null; render();
  try {
    const res = await browser.runtime.sendMessage({ type: 'roomDay', from: `${k} 00:00`, to: `${keyAdd(k, 1)} 00:00` });
    if (res && res.bookings) {
      roomState.cache[k] = { ts: Date.now(), bookings: res.bookings };
      const keep = Object.fromEntries(Object.entries(roomState.cache).sort((a, b) => b[1].ts - a[1].ts).slice(0, 7));
      browser.storage.local.set({ roomCache: keep });
    } else roomState.err = res && res.error === 'needsLogin' ? 'Anmeldung nötig' : (res && res.error) || 'Fehler';
  } catch (e) { roomState.err = String(e.message || e); }
  roomState.loading = false; render();
}
function floorSort(f) { if (!f) return 99; if (/^EG/i.test(f)) return 0; if (/^UG/i.test(f)) return -1; const m = f.match(/(\d+)/); return m ? +m[1] : 50; }

function roomStatus(room, bookings, atMs) {
  const bs = bookings.filter((b) => b.room === room).sort((a, b) => new Date(a.start) - new Date(b.start));
  const mineIds = new Set(D.lessons.map((l) => l.id));
  const myCls = D.lessons[0]?.cls;
  const cur = bs.find((b) => new Date(b.start) <= atMs && new Date(b.end) > atMs);
  const next = bs.find((b) => new Date(b.start) > atMs);
  const long = cur && new Date(cur.end) - new Date(cur.start) > 24 * 3600 * 1000;
  let state = 'free', text;
  if (cur) {
    state = long ? 'long' : mineIds.has(cur.id) ? 'mine' : cur.cls && cur.cls === myCls ? 'cls' : 'busy';
    text = long ? 'Langzeit reserviert' : state === 'mine' ? `Du · bis ${hm(new Date(cur.end))}` : `belegt bis ${hm(new Date(cur.end))}`;
  } else text = next ? `frei bis ${hm(new Date(next.start))}` : 'frei';
  return { state, text, cur, next, bs, mineIds };
}

function timeline(bs, mineIds, from, to, atMs, cls = '') {
  const span = to - from;
  const pos = (t) => Math.max(0, Math.min(100, ((t - from) / span) * 100));
  let h = `<div class="tl ${cls}">`;
  for (const b of bs) {
    const a = pos(new Date(b.start)), z = pos(new Date(b.end));
    if (z <= a) continue;
    const mine = mineIds.has(b.id);
    h += `<i class="${mine ? 'mine' : ''}" style="left:${a}%;width:${z - a}%" data-tip-booking="${esc(JSON.stringify({ s: b.start, e: b.end, l: b.label, c: b.cls, mine }))}"></i>`;
  }
  if (atMs >= from && atMs <= to) h += `<span class="cur" style="left:${pos(atMs)}%"></span>`;
  return h + '</div>';
}

// Traced floor plans (floorplans.js). Floor names in Tocco look like "2.OG".
function floorPlan(building, floor) {
  const fp = window.FLOORPLANS && window.FLOORPLANS[building];
  return fp ? fp[String(floor || '').replace(/\s+/g, '')] || null : null;
}
function renderFloorPlan(fp, list, bookings, atMs) {
  const [vx, vy, vw, vh] = fp.view;
  const known = new Set(list.map((r) => r.label));
  // '|' in a label = line break
  const txt = (x, y, str, cls) => {
    const lines = String(str).split('|');
    const lh = cls === 'fp-small' ? 22 : 34, y0 = y - ((lines.length - 1) * lh) / 2;
    return `<text x="${x}" y="${y0}" class="${cls}">${lines.map((t, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(t)}</tspan>`).join('')}</text>`;
  };
  const shape = (o) => o.p
    ? `<polygon points="${o.p.map((q) => q.join(',')).join(' ')}"/>`
    : `<rect x="${o.r[0]}" y="${o.r[1]}" width="${o.r[2]}" height="${o.r[3]}"/>`;
  const center = (o) => o.c || (o.p ? [o.p.reduce((a, q) => a + q[0], 0) / o.p.length, o.p.reduce((a, q) => a + q[1], 0) / o.p.length] : [o.r[0] + o.r[2] / 2, o.r[1] + o.r[3] / 2]);
  const height = (o) => o.p ? Math.max(...o.p.map((q) => q[1])) - Math.min(...o.p.map((q) => q[1])) : o.r[3];
  const width = (o) => o.p ? Math.max(...o.p.map((q) => q[0])) - Math.min(...o.p.map((q) => q[0])) : o.r[2];
  const outline = fp.outline.map((q) => q.join(',')).join(' ');

  let svg = `<svg class="fplan" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="Grundriss">`;
  if (fp.terrace) { const [x, y, w, hh] = fp.terrace; svg += `<rect class="fp-terrace" x="${x}" y="${y}" width="${w}" height="${hh}"/>` + txt(x + w / 2, y + hh / 2 + 7, 'Terrasse', 'fp-small'); }
  svg += `<polygon class="fp-floor" points="${outline}"/>`;          // hallways = what's left of the floor
  for (const a of fp.areas || []) {
    const [cx, cy] = center(a);
    svg += `<g class="fp-area ${a.kind}">${shape(a)}</g>` + txt(cx, cy + 6, a.label, 'fp-small');
  }
  for (const rm of fp.rooms) {
    const [cx, cy] = center(rm);
    const hh = height(rm), ww = width(rm);
    if (!rm.id || !known.has(rm.id)) {
      svg += `<g class="sroom other ${rm.kind || ''}">${shape(rm)}${rm.label ? txt(cx, cy + 8, rm.label, rm.kind || ww < 110 ? 'fp-small' : 'fp-label') : ''}</g>`;
      continue;
    }
    const st = roomStatus(rm.id, bookings, atMs);
    const short = st.state === 'long' ? 'reserviert' : st.state === 'mine' ? 'Du' : st.cur ? 'bis ' + hm(new Date(st.cur.end)) : st.next ? 'bis ' + hm(new Date(st.next.start)) : 'frei';
    const two = hh >= 95;
    svg += `<g class="sroom ${st.state} ${roomState.sel === rm.id ? 'sel' : ''}" data-room="${esc(rm.id)}">${shape(rm)}
      ${txt(cx, cy + (two ? -4 : 10), rm.label, 'fp-label')}${two ? txt(cx, cy + 28, short, 'fp-status') : ''}</g>`;
  }
  svg += `<polygon class="fp-walls" points="${outline}"/>`;           // outer wall drawn last, on top
  return svg + `</svg>`;
}

function renderRooms() {
  if (!roomState.date) {
    roomState.date = todayKey();
    const n = mod(new Date());
    roomState.minute = Math.min(18 * 60, Math.max(7 * 60, Math.round(n / 15) * 15));
  }
  if (!roomState.building) roomState.building = myBuilding();
  const k = roomState.date;
  const cache = roomState.cache[k];
  if (!cache && !roomState.loading && !roomState.err) setTimeout(() => loadRoomDay(k), 0);

  const buildings = [...new Set((S.rooms || []).map((r) => r.building).filter((b) => b && !/online|extern/i.test(b)))].sort();
  const dayStart = new Date(`${k}T00:00:00`);
  // minute → absolute ms in Zurich (assume same offset as noon of that day)
  const noon = new Date(k + 'T12:00:00Z');
  const offsetMin = mod(noon) - 12 * 60;
  const at = (min) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), 0, min - offsetMin);
  const atMs = at(roomState.minute);
  const hhmm = `${p2(Math.floor(roomState.minute / 60))}:${p2(roomState.minute % 60)}`;

  let h = `<div class="rbar">
    <button class="icon sm" data-act="rprev">${ICON.prev}</button>
    <input type="date" id="rDate" value="${k}">
    <button class="icon sm" data-act="rnext">${ICON.next}</button>
    ${k !== todayKey() ? '<button class="chip" data-act="rtoday">Heute</button>' : ''}
    <select id="rBuilding">${buildings.map((b) => `<option ${b === roomState.building ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
    <button class="chip" data-act="rreload">${roomState.loading ? 'Lade…' : 'Neu laden'}</button>
  </div>
  <div class="slider"><span class="muted">${esc(fmtDay(k))}</span><input type="range" id="rTime" min="420" max="1080" step="15" value="${roomState.minute}"><b>${hhmm}</b></div>`;

  if (roomState.err) h += `<div class="banner" style="margin:10px 0 0"><p>Räume konnten nicht geladen werden: ${esc(roomState.err)}</p></div>`;
  if (!cache) return h + `<div class="empty">${roomState.loading ? 'Lade Raumbelegung…' : ''}</div>`;

  const bookings = cache.bookings;
  const rooms = (S.rooms || []).filter((r) => r.building === roomState.building && r.active);
  const byFloor = {};
  for (const r of rooms) (byFloor[r.floor || '–'] = byFloor[r.floor || '–'] || []).push(r);
  const floors = Object.keys(byFloor).sort((a, b) => floorSort(b) - floorSort(a));
  const freeCount = rooms.filter((r) => roomStatus(r.label, bookings, atMs).state === 'free').length;

  // where is my class right now / today
  const mineToday = D.lessons.filter((l) => l._day === k);
  const curMine = mineToday.find((l) => new Date(l.start) <= atMs && new Date(l.end) > atMs);
  h += `<div class="section-title">${esc(roomState.building)} <small>${freeCount} von ${rooms.length} frei um ${hhmm}${curMine ? ` · deine Klasse: <b style="color:var(--accent)">${esc(curMine.room || '?')}</b>` : ''}</small></div>`;

  for (const f of floors) {
    const list = byFloor[f].sort((a, b) => a.label.localeCompare(b.label, 'de', { numeric: true }));
    const fp = floorPlan(roomState.building, f);
    h += `<div class="floor"><h3><span>${esc(f)}</span><span>${list.length} Räume</span></h3>`;
    if (fp) h += renderFloorPlan(fp, list, bookings, atMs);
    const tiles = fp ? list.filter((r) => !fp.rooms.some((x) => x.id === r.label)) : list;
    if (!tiles.length) { h += `</div>`; continue; }
    h += `<div class="plan ${fp ? 'extra' : ''}">`;
    for (const r of tiles) {
      const st = roomStatus(r.label, bookings, atMs);
      const short = r.label.replace(/^[A-Z]{2}-/, '').trim();
      h += `<div class="room ${st.state} ${roomState.sel === r.label ? 'sel' : ''}" data-room="${esc(r.label)}" style="--w:${Math.max(70, (r.surface || 60) * 1.25)}px">
        <b>${esc(short)}</b><div class="s">${esc(st.text)}${r.seats ? `<br>${r.seats} Plätze` : ''}</div></div>`;
    }
    h += `</div></div>`;
  }
  if (Object.keys(byFloor).some((f) => floorPlan(roomState.building, f))) {
    h += `<div class="legend" style="margin-top:8px"><span class="lg free"></span>frei <span class="lg busy"></span>belegt <span class="lg mine"></span>du <span class="lg long"></span>reserviert <span class="lg other"></span>nicht buchbar</div>`;
  }

  const from = at(7 * 60), to = at(18 * 60);
  if (roomState.sel) {
    const r = (S.rooms || []).find((x) => x.label === roomState.sel);
    const st = roomStatus(roomState.sel, bookings, atMs);
    h += `<div class="card rdetail"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:14px">${esc(roomState.sel)}</b><span class="muted">${r && r.seats ? r.seats + ' Plätze' : ''}${r && r.surface ? ' · ' + r.surface + ' m²' : ''}${r && r.floor ? ' · ' + esc(r.floor) : ''}</span></div>
      ${r && r.comment ? `<div class="muted" style="margin-top:4px;white-space:pre-line;font-size:12px">${esc(r.comment.replace(/Weitere Informationen.*$/s, '').trim())}</div>` : ''}
      ${timeline(st.bs, st.mineIds, from, to, atMs)}
      <div class="tlaxis">${[8, 10, 12, 14, 16].map((hh) => `<span style="left:${((hh - 7) / 11) * 100}%">${hh}:00</span>`).join('')}</div>
      <div style="margin-top:6px;font-size:12px">${st.bs.filter((b) => new Date(b.end) - new Date(b.start) < 86400000).map((b) => `<div>${hm(new Date(b.start))}–${hm(new Date(b.end))} · ${st.mineIds.has(b.id) ? `<b style="color:var(--accent)">${esc(splitLabel(b.label).name)}</b>` : b.label ? esc(b.label) : '<span class="muted">andere Klasse</span>'}</div>`).join('') || '<span class="muted">Den ganzen Tag frei</span>'}</div></div>`;
  }

  if (FULL) {
    h += `<div class="card gantt"><div class="grow"><span></span><div class="tlaxis">${[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((hh) => `<span style="left:${((hh - 7) / 11) * 100}%">${hh}</span>`).join('')}</div></div>`;
    for (const r of rooms.sort((a, b) => a.label.localeCompare(b.label, 'de', { numeric: true }))) {
      const st = roomStatus(r.label, bookings, atMs);
      h += `<div class="grow"><span class="n" data-room="${esc(r.label)}">${esc(r.label)}</span>${timeline(st.bs, st.mineIds, from, to, atMs)}</div>`;
    }
    h += `</div>`;
  }
  return h;
}

// =====================================================================
// Detail sheet
// =====================================================================
let sheetTab = 'lesson';  // 'lesson' | 'info' – remembered between lessons
function openSheet(lid) {
  const l = D.lessons.find((x) => x.id === lid);
  if (!l) return;
  const m = D.mods.get(l._ev);
  const { num, name } = splitLabel(l.label);
  const s = new Date(l.start), e = new Date(l.end);
  const t = teacherFor(l);
  const xs = examsOf(l);
  const structure = m ? m.structure : [];
  const options = [...new Set([...structure.map((x) => x.label), 'Test'])];
  const ov = S.examOverrides[l.id];
  const isOn = (lab) => xs.some((x) => x.label === lab);

  // module timeline: one square per module day, coloured by attendance (like a commit graph)
  let tl = '', att = null;
  if (m) {
    tl = `<div class="mtl">${m.days.map((d, i) => {
      const dls = m.lessons.filter((x) => x._day === d);
      const dx = dls[0] ? examsOf(dls[0]) : [];
      const k = dx[0] ? dx[0].kind : '';
      const st = worstSt(dls.map(lessonSt));
      return `<i class="${st} ${d === l._day ? 'this' : ''} ${k ? 'x ' + k : ''}" title="${fmtDay(d)} · ${AST[st] || ''}${dx.length ? ' · ' + dx.map((x) => x.label).join(', ') : ''}" ${dls[0] && dls[0].id !== l.id ? `data-act="openl" data-lid="${dls[0].id}"` : ''}>${dx.length ? esc(dx[0].label.replace(/\s/g, '').slice(0, 3)) : i + 1}</i>`;
    }).join('')}</div>`;
    att = ((S.attendance && S.attendance.modules) || []).find((x) => x.event === l._ev || x.event === l.event) || null;
  }
  const gr = m && m.grades.length ? m.grades : [];
  const finalG = gr.find((g) => g.grade != null);
  const a = absenceOf(l.id);
  const infos = modInfos(l.label);
  if (!infos.length && sheetTab === 'info') sheetTab = 'lesson';
  const rateCls = (r, min) => r == null ? '' : r < min ? 'bad' : r < min + 3 ? 'warn' : 'good';
  const room = l.room ? `<a data-act="toroom" data-room="${esc(l.room.split(',')[0].trim())}" data-day="${l._day}" data-min="${mod(s)}">${esc(l.room)}</a>` : '–';

  setHTML($('sheet'), `<div class="sh" style="${sv(l.label)}"><div><div class="stripe"></div>
      <h2>${esc(name)}</h2><div class="muted">${num ? 'Modul ' + esc(num) + ' · ' : ''}${esc(l.cls || '')}</div></div>
      <button class="icon" data-act="close" aria-label="Schliessen">${ICON.close}</button></div>
    <div class="when"><b>${fmtDay(l._day, true)}, ${hm(s)}–${hm(e)}</b><span>${inDays(l._day)}</span></div>
    <div class="facts">
      <div class="fact"><span>Raum</span><b>${room}</b></div>
      <div class="fact"><span>Dozent/in</span><b>${esc(t || '–')}</b></div>
      ${l._dayN ? `<div class="fact"><span>Modultag</span><b>${l._dayIdx + 1} von ${l._dayN}</b></div>` : ''}
      ${finalG ? `<div class="fact"><span>Note</span><b class="gval ${gradeCls(+finalG.grade)}">${fmtG(+finalG.grade)}</b></div>` : ''}
    </div>
    ${l.comment ? `<div class="snote" data-raw>${esc(l.comment)}</div>` : ''}
    ${a ? (() => { const x = deadline(a); return `<div class="sabs ${absSt(a)}">${absTag(a)}<span>${a.missed ? fmtG(a.missed) + ' Lektionen verpasst' : 'Abwesend'}${a.comment ? ` · <span data-raw>${esc(a.comment)}</span>` : ''}</span>${needsAction(a) ? (x.open ? `<b class="gval warn">noch ${x.left} Tage</b>` : '<small class="muted">Frist vorbei</small>') : ''}</div>`; })() : ''}
    ${infos.length ? `<div class="seg" role="tablist"><button data-act="stab" data-tab="lesson" class="${sheetTab !== 'info' ? 'on' : ''}">Lektion</button><button data-act="stab" data-tab="info" class="${sheetTab === 'info' ? 'on' : ''}">Modulinfo</button></div>` : ''}
    <div class="spane" data-pane="lesson" ${sheetTab === 'info' && infos.length ? 'hidden' : ''}>
      ${m ? `<h4>Modulverlauf ${att && att.rate != null ? `<small>Anwesenheit <b class="gval ${rateCls(att.rate, att.min || 90)}">${att.rate} %</b> · min. ${att.min || 90} %</small>` : `<small>${fmtShort(m.days[0])}–${fmtShort(m.days[m.days.length - 1])}</small>`}</h4>${tl}
        <div class="mtl-legend"><span><i class="ok"></i>da</span><span><i class="exc"></i>entsch.</span><span><i class="bad"></i>unentsch.</span><span><i class="fut"></i>geplant</span></div>` : ''}
      <h4>Meine Notizen</h4>
      <textarea id="noteBox" placeholder="z.B. Laptop mitnehmen, Kapitel 3 lernen…">${esc(S.notes[l.id] || '')}</textarea>
      <div class="saved" id="savedMsg"></div>
      ${gr.some((g) => g.exams.length) ? `<h4>Noten</h4><div class="chips">${gr.map((g) => g.exams.map((x) => `<span class="xtag ${examKind(x.label)}">${esc(x.label)} ${x.weight ?? ''}%: ${fmtG(x.grade)}</span>`).join(' ')).join(' ')}</div>` : ''}
      <h4>Prüfung in dieser Lektion ${xs.some((x) => x.est) ? '<small>geschätzt</small>' : ''}</h4>
      <div class="chips">
        <button class="chip ${ov && !ov.length ? 'on' : ''}" data-act="exam" data-lab="">Keine</button>
        ${options.map((o) => `<button class="chip ${isOn(o) ? 'on' : ''}" data-act="exam" data-lab="${esc(o)}">${esc(o)}</button>`).join('')}
        ${ov ? '<button class="chip" data-act="exam-reset">Automatisch</button>' : ''}
      </div>
    </div>
    ${infos.length ? `<div class="spane" data-pane="info" ${sheetTab === 'info' ? '' : 'hidden'}>${infos.map((mi) => `
      <div class="minfo">${infos.length > 1 ? `<h4>Modul ${esc(mi.num)}</h4>` : ''}<div class="mtags">${[mi.typ, mi.lj, mi.feld].filter(Boolean).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
      <p><b>Kompetenz:</b> <span data-raw>${esc(mi.k)}</span></p>${mi.o ? `<p class="muted"><b>Objekt:</b> <span data-raw>${esc(mi.o)}</span></p>` : ''}
      ${mi.z && mi.z.length ? `<h4>${mi.z.length} Handlungsziele</h4><ol>${mi.z.map((z) => `<li data-raw>${esc(z)}</li>`).join('')}</ol>` : ''}
      ${mi.pdf ? `<a class="mlink" href="${MBK_PDF + mi.pdf}" target="_blank" rel="noopener">Modulbeschreibung (PDF) ↗</a>` : ''}</div>`).join('')}</div>` : ''}`);
  $('sheet').dataset.sheetLid = l.id;
  $('sheet').setAttribute('style', sv(l.label));
  $('sheetWrap').hidden = false;
  const box = $('noteBox');
  let t0;
  box.addEventListener('input', () => {
    clearTimeout(t0);
    t0 = setTimeout(() => {
      const v = box.value.trim();
      if (v) S.notes[l.id] = v; else delete S.notes[l.id];
      persist({ notes: S.notes });
      $('savedMsg').textContent = 'Gespeichert ✓';
    }, 400);
  });
}
function closeSheet() { $('sheetWrap').hidden = true; render(); }

// =====================================================================
// Tooltip (hover)
// =====================================================================
function tipFor(el) {
  if (el.dataset.lid) {
    const l = D.lessons.find((x) => x.id === el.dataset.lid);
    if (!l) return '';
    const { num, name } = splitLabel(l.label);
    const t = teacherFor(l), xs = examsOf(l), m = D.mods.get(l._ev);
    const note = S.notes[l.id];
    return `<b>${esc(name)}</b>${num ? ` <span class="tm">· ${esc(num)}</span>` : ''}
      <dl class="tk"><dt>Zeit</dt><dd>${fmtDay(l._day)} · ${hm(new Date(l.start))}–${hm(new Date(l.end))}</dd>
      ${l.room ? `<dt>Raum</dt><dd>${esc(l.room)}</dd>` : ''}${t ? `<dt>Dozent/in</dt><dd>${esc(t)}</dd>` : ''}
      ${l._dayN ? `<dt>Modul</dt><dd>Tag ${l._dayIdx + 1} von ${l._dayN}${m ? ' · bis ' + fmtShort(m.days[m.days.length - 1]) : ''}</dd>` : ''}</dl>
      ${xs.length ? `<div class="x">${xs.map((x) => xtag(x, true) + (x.est ? ' <span class="tm">geschätzt</span>' : '')).join(' ')}</div>` : ''}
      ${l.comment ? `<hr><span data-raw>${esc(l.comment)}</span>` : ''}${note ? `<hr><span class="tn">Notiz:</span> <span data-raw>${esc(note)}</span>` : ''}`;
  }
  if (el.dataset.room) {
    const k = roomState.date, c = roomState.cache[k];
    const r = (S.rooms || []).find((x) => x.label === el.dataset.room);
    if (!c || !r) return '';
    const bs = c.bookings.filter((b) => b.room === r.label && new Date(b.end) - new Date(b.start) < 86400000);
    const mine = new Set(D.lessons.map((l) => l.id));
    return `<b>${esc(r.label)}</b> <span class="tm">${r.seats ? r.seats + ' Plätze' : ''}${r.surface ? ' · ' + r.surface + ' m²' : ''}</span>
      ${r.comment && !/^Weitere Informationen/.test(r.comment) ? `<div class="r">${esc(r.comment.replace(/Weitere Informationen.*$/s, '').trim().slice(0, 120))}</div>` : ''}<hr>
      ${bs.length ? bs.map((b) => `<div class="r">${hm(new Date(b.start))}–${hm(new Date(b.end))} ${mine.has(b.id) ? '· <b>Du</b>' : b.label ? '· ' + esc(splitLabel(b.label).name) : '· belegt'}</div>`).join('') : 'Ganzer Tag frei'}`;
  }
  if (el.dataset.tipBooking) {
    const b = JSON.parse(el.dataset.tipBooking);
    return `<b>${hm(new Date(b.s))}–${hm(new Date(b.e))}</b><div class="r">${b.mine ? 'Deine Lektion: ' + esc(splitLabel(b.l).name) : b.l ? esc(b.l) : 'Andere Klasse (Details nicht sichtbar)'}</div>`;
  }
  return '';
}
// Tooltips only where items are too small to show everything: the full-page
// week grid and room chart. In the popup the cards already show the details
// (click opens the panel), so no hover popups there.
// Shown after a short pause, placed NEXT to the item (never on top of it).
const TIP_DELAY = 550;
let tipEl = null, tipTimer = null;
function hideTip() { clearTimeout(tipTimer); tipTimer = null; tipEl = null; $('tip').classList.remove('on'); }
function tipAllowed(el) {
  if (!FULL) return false;
  return el.matches('.gev, .grow [data-tip-booking], .rdetail [data-tip-booking], .grow .n, .sroom');
}
function placeTip(el) {
  const tip = $('tip'), r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(), gap = 10;
  let x = r.right + gap, y = r.top;
  if (x + t.width > innerWidth - 8) x = r.left - t.width - gap;          // flip to the left side
  if (x < 8) { x = Math.min(innerWidth - t.width - 8, Math.max(8, r.left)); y = r.bottom + gap; } // no room beside → below
  if (y + t.height > innerHeight - 8) y = Math.max(8, innerHeight - t.height - 8);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
document.addEventListener('mouseover', (ev) => {
  const el = ev.target.closest('[data-lid],[data-room],[data-tip-booking]');
  if (el === tipEl) return;
  hideTip();
  if (!el || !D || !$('sheetWrap').hidden || !tipAllowed(el)) return;
  tipEl = el;
  tipTimer = setTimeout(() => {
    const html = tipFor(el);
    if (!html || tipEl !== el) return;
    const tip = $('tip');
    setHTML(tip, html);
    tip.style.left = '-9999px';
    tip.classList.add('on');
    placeTip(el);
  }, TIP_DELAY);
});
document.addEventListener('mousedown', hideTip);
document.addEventListener('wheel', hideTip, { passive: true });
document.addEventListener('keydown', hideTip);
document.addEventListener('mouseleave', hideTip);
$('view').addEventListener('scroll', hideTip, { passive: true });

// =====================================================================
// SETUP / SETTINGS
// =====================================================================
const HOSTS = ['https://wiss.tocco.ch/*', 'https://www.modulbaukasten.ch/*', 'https://ictbb.crm17.dynamics.com/*'];
const setupState = { catalog: null, catErr: null, catLoading: false, sel: null, loading: false, msg: '', autoTried: false, resetArm: false };
const yearOf = (name) => +((name || '').match(/\((\d{4})/) || [0, 0])[1];
function myModuleNums() {
  const s = new Set();
  for (const x of [...(S.grades || []).map((g) => g.label), ...S.lessons.map((l) => l.label)]) for (const n of (splitLabel(x).num || '').split('-').filter(Boolean)) s.add(n);
  return [...s];
}
function detectAbschluss() {
  const mine = myModuleNums();
  if (!setupState.catalog || !mine.length) return null;
  let best = null;
  for (const a of setupState.catalog) {
    if (a.typ !== 'Grundbildung' && a.typ) continue;
    const score = mine.filter((n) => a.nums.includes(n)).length;
    if (!best || score > best.score || (score === best.score && yearOf(a.name) > yearOf(best.a.name))) best = { a, score };
  }
  return best && best.score > 0 ? best.a : null;
}
async function loadCatalog() {
  if (setupState.catalog || setupState.catLoading || !hasChrome) return;
  setupState.catLoading = true;
  const r = await browser.runtime.sendMessage({ type: 'mbkCatalog' }).catch((e) => ({ error: String(e) }));
  setupState.catLoading = false;
  if (r && r.list) setupState.catalog = r.list;
  else if (window.MBK_CATALOG && window.MBK_CATALOG.length) { setupState.catalog = window.MBK_CATALOG; setupState.catOffline = true; }   // site down → built-in list
  else setupState.catErr = (r && r.error) || 'Fehler';
  render();
}
async function loadModulesFor(id) {
  if (!id || !hasChrome) return;
  setupState.loading = true; setupState.msg = ''; render();
  const r = await browser.runtime.sendMessage({ type: 'mbkLoad', id, extraNums: myModuleNums() }).catch((e) => ({ error: String(e) }));
  setupState.loading = false;
  if (r && r.count) setupState.msg = tr('✓ {N} Module geladen', { N: r.count });
  else {
    // modulbaukasten.ch not reachable: remember the choice anyway; Applikationsentwicklung 2021 works offline
    const a = (setupState.catalog || window.MBK_CATALOG || []).find((x) => x.id === id);
    const abschluss = { id, name: a ? a.name : '', ts: Date.now(), offline: true };
    S.abschluss = abschluss;
    if (id === BUNDLED_ABSCHLUSS) {
      await browser.storage.local.set({ abschluss, modules: {} });
      MODS = window.MODULES || {};
      setupState.msg = tr('✓ {N} Module (eingebaut, modulbaukasten.ch ist gerade offline)', { N: Object.keys(MODS).length });
    } else {
      await browser.storage.local.set({ abschluss });
      setupState.msg = tr('modulbaukasten.ch ist gerade offline. Die Beschreibungen kannst du später mit "Laden" holen.');
    }
  }
  render();
}

function renderSetup() {
  const first = !S.setupDone;
  const user = S.user && S.user.username;
  if (!setupState.catalog && !setupState.catErr && setupState.permOk !== false) setTimeout(loadCatalog, 0);
  const det = detectAbschluss();
  if (!setupState.sel) setupState.sel = (S.abschluss && S.abschluss.id) || (det && det.id) || null;
  // first run: once logged in and detected, load the modules automatically
  if (first && user && det && !S.abschluss && !setupState.autoTried && !setupState.loading) {
    setupState.autoTried = true; setupState.sel = det.id; setTimeout(() => loadModulesFor(det.id), 0);
  }
  const syncing = S.status === 'syncing';
  const step = (n, title, done, body) => `<div class="card sstep ${done ? 'done' : ''}"><div class="sh2"><span class="snum">${done ? '✓' : n}</span><b>${title}</b></div>${body}</div>`;

  if (setupState.permOk === undefined && hasChrome && browser.permissions) {
    setupState.permOk = null;
    browser.permissions.contains({ origins: HOSTS }).then((ok) => { setupState.permOk = ok; render(); }, () => { setupState.permOk = true; render(); });
  }
  let acc;
  const tCount = new Set(Object.keys(S.teachers || {}).filter((k) => k.startsWith('l:'))).size;
  if (setupState.permOk === false) acc = `<p class="muted">Braucht Zugriff auf <b>wiss.tocco.ch</b> und <b>modulbaukasten.ch</b>.</p>
    <div class="row"><button class="btn" data-act="grant">Zugriff erlauben</button></div>`;
  else if (user) acc = `<p><b class="priv" data-act="reveal" data-raw tabindex="0" role="button" title="${tr('Antippen zum Anzeigen')}">${esc(user)}</b><br><span class="muted">${S.lessons.length} Lektionen · ${(S.grades || []).length} Noten · ${tCount ? tCount + ' Lehrpersonen' : 'Lehrpersonen laden…'}</span></p>
    ${!first ? '<div class="row"><button class="btn ghost" data-act="teachers">Lehrpersonen aktualisieren</button></div>' : ''}`;
  else acc = `${syncing ? '<p><span class="spin" style="display:inline-block;vertical-align:-1px"></span> Prüfe Anmeldung…</p>' : ''}<p class="muted">Einmal mit deinem WISS-Konto (<b>@wiss-edu.ch</b>) anmelden.</p>
    <div class="row"><button class="btn" data-act="login">Anmelden</button><button class="btn ghost" data-act="setup-check">Schon angemeldet</button></div>
    ${setupState.loginOpened ? '<p class="muted" style="font-size:12px">Melde dich im neuen Fenster an, danach geht es hier weiter.</p>' : ''}`;

  let ab;
  if (setupState.catErr) ab = `<p class="muted">Modulkatalog nicht erreichbar (${esc(setupState.catErr)}). <a data-act="cat-retry">Erneut versuchen</a></p>`;
  else if (!setupState.catalog) ab = `<p class="muted">Lade Lehrberufe…</p>`;
  else {
    const groups = {};
    for (const a of setupState.catalog) (groups[a.typ || 'Andere'] = groups[a.typ || 'Andere'] || []).push(a);
    ab = `<p class="muted">Für Modulbeschreibungen.${det && !(S.abschluss && S.abschluss.id === det.id) ? ` Erkannt: <b>${esc(det.name)}</b>.` : user ? '' : ' Wird nach der Anmeldung erkannt.'}</p>
      <div class="row"><select id="abSel"><option value="">– wählen –</option>${Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((a) => `<option value="${a.id}" ${a.id === setupState.sel ? 'selected' : ''}>${esc(a.name)}${det && det.id === a.id ? ' ✓' : ''}</option>`).join('')}</optgroup>`).join('')}</select>
      <button class="btn ghost" data-act="mbk-load" ${!setupState.sel || setupState.loading ? 'disabled' : ''}>${setupState.loading ? 'Lade…' : 'Laden'}</button></div>
      ${setupState.catOffline ? `<p class="muted" style="font-size:11.5px;margin:6px 0 0">${tr('modulbaukasten.ch ist gerade offline, darum wird die eingebaute Liste verwendet.')}</p>` : ''}
      <p class="smsg">${setupState.loading ? 'Lade Module…' : esc(setupState.msg || (S.abschluss && S.abschluss.name ? `${Object.keys(MODS).length} Module geladen` : ''))}</p>`;
  }

  const rule = S.zpRule || 'every3';
  const opt = (v, t, d) => `<label class="radio"><input type="radio" name="zp" data-act="zp" data-val="${v}" ${rule === v ? 'checked' : ''}><span><b>${t}</b><br><span class="muted">${d}</span></span></label>`;
  const zp = `<p class="muted">Das Extranet zeigt keine Prüfungsdaten, darum werden sie geschätzt. LB und Projekt sind am letzten Modultag. Einzelne Lektionen kannst du von Hand ändern.</p>
    ${opt('every3', 'Jede 3. Lektion', 'Tag 3, 6, 9 …')}${opt('once3', 'Einmal', 'nur am 3. Tag')}${opt('none', 'Keine', 'nur LB/Projekt')}`;

  if (!first && typeof renderSettings === 'function') return renderSettings({ acc, ab, zp, user });
  let h = `<div class="setup">
    <div class="shero">${first && typeof seg === 'function' ? `<div class="wiz-lang">${seg('lang', [['de', 'Deutsch'], ['en', 'English']])}</div>` : ''}${first ? '<h2>Willkommen</h2><p>Stundenplan, Prüfungen, Noten und Räume ohne Warten. Deine Daten bleiben auf deinem Gerät.</p>' : '<h2>Einstellungen</h2>'}</div>
    ${step(1, 'WISS-Konto', !!user, acc)}
    ${step(2, 'Lehrberuf', !!(S.abschluss && Object.keys(MODS).length), ab)}
    ${step(3, 'ZP-Schätzung', !first, zp)}
    <div class="row" style="margin-top:12px;justify-content:flex-end">
      ${first ? `<button class="btn" data-act="setup-done" ${user ? '' : 'disabled'}>${user ? 'Los geht’s' : 'Erst anmelden'}</button>` : `<button class="btn" data-act="setup-close">Fertig</button>`}
    </div>`;
  if (!first && S.syncLog && S.syncLog.lines && S.syncLog.lines.length) h += `<details class="card sstep diag"><summary><b>Diagnose</b> <small class="muted">letzte Aktualisierung, ${esc(ago(S.syncLog.at))}</small></summary><pre>${S.syncLog.lines.map(esc).join('\n')}</pre></details>`;
  if (!first) h += `<div class="card sstep danger"><div class="sh2"><b>Lokale Daten</b></div>
      <p class="muted">Löscht Stundenplan, Noten, Notizen und Einstellungen in diesem Browser. Dein WISS-Konto bleibt.</p>
      <button class="btn ${setupState.resetArm ? '' : 'ghost'}" data-act="${setupState.resetArm ? 'reset-confirm' : 'reset'}">${setupState.resetArm ? 'Wirklich löschen?' : 'Alles löschen'}</button></div>`;
  return h + `<p class="muted" style="font-size:11px;text-align:center;margin-top:12px">Inoffiziell · wiss.tocco.ch · modulbaukasten.ch</p></div>`;
}

// =====================================================================
// Render + events
// =====================================================================
function render() {
  if (!D) derive();
  renderStatus();
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === S.tab);
  const v = $('view');
  const scroll = v.scrollTop;
  const keepX = {}; for (const id of ['stiles']) { const el = $(id); if (el) keepX[id] = el.scrollLeft; }
  const setup = hasChrome && (!S.setupDone || S.showSetup);
  $('tabs').hidden = setup;
  if (setup) setHTML($('banner'), '');
  setHTML(v, setup ? renderSetup() : S.tab === 'week' ? renderWeek() : S.tab === 'exams' ? renderExams() : S.tab === 'grades' ? renderGrades() : S.tab === 'absences' ? renderAbsences() : renderRooms());
  v.scrollTop = scroll;
  // horizontal strips keep their position; the first time, the selected item is brought into view
  for (const id of ['stiles']) {
    const el = $(id); if (!el) continue;
    if (keepX[id] != null) el.scrollLeft = keepX[id];
    else { const on = el.querySelector('.on'); if (on) el.scrollLeft = Math.max(0, on.offsetLeft - el.offsetLeft - 8); }
  }
  const hs = $('heatScroll');
  if (hs) {
    // squares grow to fill the card (min 12 px → scrolls on small screens, max 22 px)
    const heat = hs.firstElementChild, weeks = heat.children.length - 1;
    const cs = Math.max(MOBILE ? 14 : 12, Math.min(26, Math.floor((hs.clientWidth - 24) / weeks - 3)));
    heat.style.setProperty('--cs', cs + 'px');
    heat.classList.toggle('fit', heat.scrollWidth <= hs.clientWidth);
    const sel = hs.querySelector('.hc.sel');
    const keep = heatScrollX;
    hs.scrollLeft = keep != null ? keep : hs.scrollWidth;
    if (sel) { const r = sel.offsetLeft; if (r < hs.scrollLeft || r > hs.scrollLeft + hs.clientWidth - 20) hs.scrollLeft = r - hs.clientWidth / 2; }
    hs.addEventListener('scroll', () => { heatScrollX = hs.scrollLeft; }, { passive: true });
  }
  hideTip();
}

function persist(obj) { if (hasChrome) browser.storage.local.set(obj); }

document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-act]');
  if (a) {
    const act = a.dataset.act;
    if (act === 'reveal') { const on = a.classList.toggle('shown'); a.title = on ? '' : tr('Antippen zum Anzeigen'); return; }
    if (act === 'prev') { weekOffset--; render(); }
    else if (act === 'next') { weekOffset++; render(); }
    else if (act === 'today') { weekOffset = 0; showPast = !P('foldPast'); render(); }
    else if (act === 'login') { setupState.loginOpened = true; browser.runtime.sendMessage({ type: 'openLogin' }); render(); }
    else if (act === 'teachers') { browser.runtime.sendMessage({ type: 'learnTeachers' }).catch(() => {}); a.textContent = 'Läuft im Hintergrund (~30 s)…'; a.disabled = true; }
    else if (act === 'grant') {
      // must be called directly from the click (user gesture)
      browser.permissions.request({ origins: HOSTS }).then((ok) => {
        setupState.permOk = ok; setupState.catErr = null; setupState.catalog = null; render();
        if (ok) browser.runtime.sendMessage({ type: 'refresh', force: true }).catch(() => {});
      });
    }
    else if (act === 'setup-check') browser.runtime.sendMessage({ type: 'refresh', force: true }).catch(() => {});
    else if (act === 'cat-retry') { setupState.catErr = null; loadCatalog(); }
    else if (act === 'mbk-load') loadModulesFor(setupState.sel);
    else if (act === 'zp') { S.zpRule = a.dataset.val; persist({ zpRule: S.zpRule }); derive(); }
    else if (act === 'setup-done') { S.setupDone = true; S.showSetup = false; persist({ setupDone: true }); $('view').scrollTop = 0; render(); }
    else if (act === 'setup-close') { S.showSetup = false; setupState.resetArm = false; $('view').scrollTop = 0; render(); }
    else if (act === 'reset') { setupState.resetArm = true; render(); }
    else if (act === 'reset-confirm') {
      try { localStorage.removeItem('wissLook'); } catch (e) {}
      browser.runtime.sendMessage({ type: 'resetAll' }).then(() => location.reload());
    }
    else if (act === 'close') closeSheet();
    else if (act === 'openl') openSheet(a.dataset.lid);
    else if (act === 'update-go') { startUpdate(); if (PLATFORM === 'android') { a.textContent = tr('Lädt…'); a.disabled = true; } }
    else if (act === 'update-later') { setPref('updateDismissed', S.updateInfo.latest); renderStatus(); }
    else if (act === 'togglepast') { showPast = !showPast; render(); }
    else if (act === 'hday') { heatSel = a.dataset.k; render(); }
    else if (act === 'stab') {
      sheetTab = a.dataset.tab;
      for (const b of $('sheet').querySelectorAll('.seg button')) b.classList.toggle('on', b.dataset.tab === sheetTab);
      for (const p of $('sheet').querySelectorAll('.spane')) p.hidden = p.dataset.pane !== sheetTab;
    }
    else if (act === 'exam' || act === 'exam-reset') {
      const lid = $('sheet').dataset.sheetLid;
      if (act === 'exam-reset') delete S.examOverrides[lid];
      else {
        const lab = a.dataset.lab;
        const cur = S.examOverrides[lid] || examsOf(D.lessons.find((l) => l.id === lid)).map((x) => x.label);
        S.examOverrides[lid] = !lab ? [] : cur.includes(lab) ? cur.filter((x) => x !== lab) : [...cur, lab];
      }
      persist({ examOverrides: S.examOverrides });
      derive(); openSheet(lid);
    } else if (act === 'toroom') {
      roomState.date = a.dataset.day; roomState.minute = Math.round(+a.dataset.min / 15) * 15; roomState.sel = a.dataset.room;
      roomState.building = buildingOf(a.dataset.room) || roomState.building; roomState.err = null;
      S.tab = 'rooms'; $('sheetWrap').hidden = true; render();
    } else if (act === 'rprev' || act === 'rnext') {
      let k = keyAdd(roomState.date, act === 'rprev' ? -1 : 1);
      while (dow(k) === 6) k = keyAdd(k, act === 'rprev' ? -1 : 1);
      roomState.date = k; roomState.err = null; render();
    } else if (act === 'rtoday') { roomState.date = todayKey(); roomState.err = null; render(); }
    else if (act === 'rreload') loadRoomDay(roomState.date, true);
    return;
  }
  const tab = ev.target.closest('#tabs button');
  if (tab) { S.tab = tab.dataset.tab; persist({ uiTab: S.tab }); $('view').scrollTop = 0; render(); return; }
  if (ev.target.id === 'scrim') { closeSheet(); return; }
  if (ev.target.closest('#sheet')) return;   // clicks inside the detail panel (e.g. the notes box) never re-render it
  const room = ev.target.closest('[data-room]');
  if (room) { roomState.sel = roomState.sel === room.dataset.room ? null : room.dataset.room; render(); return; }
  const les = ev.target.closest('[data-lid]');
  if (les) { openSheet(les.dataset.lid); return; }
  const md = ev.target.closest('[data-mod]');
  if (md) openModuleSheet(md.dataset.mod);
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'rDate' && ev.target.value) { roomState.date = ev.target.value; roomState.err = null; render(); }
  if (ev.target.id === 'rBuilding') { roomState.building = ev.target.value; roomState.sel = null; render(); }
  if (ev.target.id === 'abSel') { setupState.sel = ev.target.value || null; if (setupState.sel) loadModulesFor(setupState.sel); else render(); }
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'rTime') {
    roomState.minute = +ev.target.value;
    clearTimeout(ev.target._t);
    ev.target._t = setTimeout(render, 60);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape' && !$('sheetWrap').hidden) closeSheet();
  if (S.tab === 'week' && e.key === 'ArrowLeft') { weekOffset--; render(); }
  if (S.tab === 'week' && e.key === 'ArrowRight') { weekOffset++; render(); }
});
$('btnRefresh').onclick = () => { if (hasChrome) browser.runtime.sendMessage({ type: 'refresh', force: true }).catch(() => {}); if (S.tab === 'rooms') loadRoomDay(roomState.date, true); };
$('btnSettings').onclick = () => { if (!S.setupDone) return; S.showSetup = !S.showSetup; setupState.resetArm = false; setupState.msg = ''; $('sheetWrap').hidden = true; $('view').scrollTop = 0; render(); };
$('btnFull').onclick = () => { if (hasChrome) browser.tabs.create({ url: browser.runtime.getURL('popup.html?full') }); };
if (FULL || MOBILE) $('btnFull').style.display = 'none';   // on phones the popup already is a full page
window.addEventListener('resize', () => FULL && $('sheetWrap').hidden && render());
setInterval(() => { if ($('sheetWrap').hidden && document.activeElement?.id !== 'rTime' && !(window.__customPopoverOpen && window.__customPopoverOpen())) render(); }, 30 * 1000);

function initWeekOffset() {
  if (weekOffset !== null) return;
  const d = dow(todayKey());
  weekOffset = d >= 5 ? 1 : 0;   // weekend → next week
}

let loadedOnce = false;
async function load() {
  const s = await browser.storage.local.get(['lessons', 'teachers', 'grades', 'rooms', 'notes', 'examOverrides', 'status', 'lastSync', 'error', 'uiTab', 'roomCache',
    'user', 'setupDone', 'zpRule', 'modules', 'abschluss', 'absences', 'attendance', 'lastAttempt', 'syncLog', 'prefs', 'updateInfo']);
  const keep = { tab: S.tab, showSetup: S.showSetup };
  S = { ...S, ...s, lessons: s.lessons || [], teachers: s.teachers || {}, grades: s.grades || [], rooms: s.rooms || [], notes: s.notes || {}, examOverrides: s.examOverrides || {}, absences: s.absences || [], attendance: s.attendance || null,
    user: s.user || null, setupDone: !!s.setupDone, abschluss: s.abschluss || null, prefs: s.prefs || {} };
  S.tab = keep.tab; S.showSetup = keep.showSetup;
  if (typeof applyLook === 'function') applyLook();
  if (!loadedOnce) {
    loadedOnce = true;
    showPast = !P('foldPast');
    const st = P('startTab');
    if (st && st !== 'last') S.tab = st;
    const h = location.hash.slice(1); if (['week', 'exams', 'grades', 'absences', 'rooms'].includes(h)) S.tab = h;
  }
  MODS = s.modules && Object.keys(s.modules).length ? s.modules
    : (!s.abschluss || s.abschluss.id === BUNDLED_ABSCHLUSS) ? (window.MODULES || {}) : {};
  if (s.roomCache && !Object.keys(roomState.cache).length) roomState.cache = s.roomCache;
  derive(); initWeekOffset();
  if ($('sheetWrap').hidden) render(); else renderStatus();
}

if (hasChrome) {
  browser.storage.local.get(['uiTab', 'prefs']).then(({ uiTab, prefs }) => { if (uiTab && (!prefs || !prefs.startTab || prefs.startTab === 'last')) S.tab = uiTab; });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.lastAttempt) S.lastAttempt = changes.lastAttempt.newValue;
    if (changes.syncLog) { S.syncLog = changes.syncLog.newValue; if (S.showSetup && Object.keys(changes).length === 1) { render(); return; } }
    if (Object.keys(changes).every((k) => ['notes', 'examOverrides', 'roomCache', 'uiTab', 'lastAttempt', 'syncLog'].includes(k))) { if (changes.status) renderStatus(); return; }
    load();
  });
  load().then(() => browser.runtime.sendMessage({ type: 'refresh', force: false }).catch(() => {}));
}

// Preview / testing outside the extension
window.__setData = (data) => {
  S = { ...S, ...data, lastSync: Date.now(), status: 'ok' };
  if (data.roomCache) roomState.cache = data.roomCache;
  derive(); initWeekOffset(); render();
};
window.__S = () => S; window.__D = () => D; window.__open = openSheet; window.__room = roomState;
