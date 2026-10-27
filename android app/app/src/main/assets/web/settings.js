// Einstellungen: categorized settings page + applying the look (style, mode, accent, …).
// Uses the globals of popup.js (S, P, setPref, render, esc, tr, …).

const LOOK_KEY = 'wissLook';          // cached in localStorage so the next open has no flash
const ACCENTS = ['#b52a33', '#d71921', '#0969da', '#1a7f37', '#7a4cc9', '#e36209', '#d63384', '#0f8a83'];
const SET_SECTIONS = [
  ['account', 'Konto'], ['look', 'Darstellung'], ['timetable', 'Stundenplan'], ['notify', 'Benachrichtigungen'],
  ['grades', 'Noten'], ['job', 'Lehrberuf'], ['sync', 'Synchronisation'], ['data', 'Daten'], ['about', 'Über']
];
const IS_APP_PAGE = !!(window.chrome && globalThis.__wissApp);
let setSec = 'account';

// ---------- look ----------
function systemDark() { return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }
function applyLook() {
  const r = document.documentElement;
  const style = P('style'), mode = P('theme');
  r.dataset.style = style;
  r.dataset.mode = mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode;
  const acc = P('accent');
  if (acc) {
    r.style.setProperty('--accent', acc);
    r.style.setProperty('--now', acc);
    r.style.setProperty('--accent-soft', `color-mix(in srgb, ${acc} ${r.dataset.mode === 'dark' ? 22 : 13}%, var(--surface))`);
  } else ['--accent', '--now', '--accent-soft'].forEach((k) => r.style.removeProperty(k));
  if (P('mono')) r.dataset.mono = '1'; else delete r.dataset.mono;
  r.dataset.corners = P('corners');
  r.dataset.size = P('size');
  window.setLang(P('lang'));
  translateStatic();
  try { localStorage.setItem(LOOK_KEY, JSON.stringify({ style, mode, acc, mono: P('mono'), corners: P('corners'), size: P('size'), lang: P('lang') })); } catch (e) {}
}
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (P('theme') === 'system') applyLook(); });

// static texts in popup.html (tabs, button titles)
function translateStatic() {
  const tabs = { week: 'Woche', exams: 'Prüfungen', grades: 'Noten', absences: 'Absenzen', rooms: 'Räume' };
  for (const b of document.querySelectorAll('#tabs button')) {
    const label = tabs[b.dataset.tab];
    if (label && b.firstChild && b.firstChild.nodeType === 3) b.firstChild.textContent = tr(label) + ' ';
  }
  const t = (id, de) => { const el = document.getElementById(id); if (el) { el.title = tr(de); el.setAttribute('aria-label', tr(de)); } };
  t('btnSettings', 'Einstellungen'); t('btnRefresh', 'Jetzt aktualisieren'); t('btnFull', 'Gross im Tab öffnen');
  const h1 = document.querySelector('.brand h1'); if (h1) h1.textContent = tr('Stundenplan');
}

// ---------- building blocks ----------
const row = (label, hint, control, extra = '') => `<div class="srow ${extra}"><div class="sl"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="sc">${control}</div></div>`;
const seg = (k, opts, cur = P(k)) => `<div class="seg sm" role="radiogroup">${opts.map(([v, l]) =>
  `<button role="radio" aria-checked="${String(cur) === String(v)}" class="${String(cur) === String(v) ? 'on' : ''}" data-act="pref" data-k="${k}" data-v="${esc(String(v))}">${l}</button>`).join('')}</div>`;
const sw = (k, on = !!P(k)) => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="pref-toggle" data-k="${k}"><i></i></button>`;
const sec = (id, title, body) => `<section class="set-sec" id="set-${id}" data-sec="${id}"><div class="set-h">${tr(title)}</div><div class="card set-card">${body}</div></section>`;

// id, name, short description (all names are German source strings, translated with tr())
const STYLES = [
  ['standard', 'Standard', 'WISS-Rot'], ['apple', 'Apple', 'Wie iOS'], ['samsung', 'Samsung', 'Wie One UI'],
  ['nothing', 'Nothing', 'Schwarz-weiss'], ['github', 'GitHub', 'GitHub-Farben'], ['pastel', 'Pastell', 'Sanfte Farben'],
  ['neon', 'Neon', 'Leuchtend'], ['paper', 'Papier', 'Warm, mit Serifen'], ['terminal', 'Terminal', 'Grün auf Schwarz']
];
function stylePreview(id, name, desc) {
  const on = P('style') === id;
  return `<button class="stile ${on ? 'on' : ''}" data-act="pref" data-k="style" data-v="${id}" aria-pressed="${on}">
    <span class="sprev sp-${id}"><i class="a"></i><i class="b"></i><i class="c"></i><span class="dots"></span></span>
    <b>${name}</b><small>${desc}</small></button>`;
}

function renderSettings({ acc, ab, zp, user }) {
  const notifPerm = IS_APP_PAGE ? (window.__notifPerm || globalThis.__wissApp.permission()) : 'granted';
  const nav = `<nav class="set-nav" aria-label="${esc(tr('Kategorien'))}">${SET_SECTIONS.map(([id, t]) => `<button data-act="setnav" data-sec="${id}" class="${setSec === id ? 'on' : ''}">${tr(t)}</button>`).join('')}</nav>`;

  const look = [
    row(tr('Sprache'), '', seg('lang', [['de', 'Deutsch'], ['en', 'English']])),
    `<div class="srow col"><div class="sl"><b>${tr('Stil')}</b><small>${''}</small></div><div class="stiles-wrap"><div class="stiles" id="stiles">
      ${STYLES.map(([id, name, desc]) => stylePreview(id, tr(name), tr(desc))).join('')}</div></div></div>`,
    row(tr('Modus'), '', seg('theme', [['system', tr('System')], ['light', tr('Hell')], ['dark', tr('Dunkel')]])),
    `<div class="srow col"><div class="sl"><b>${tr('Akzentfarbe')}</b><small>${''}</small></div><div class="swatches">
      <button class="swatch auto ${!P('accent') ? 'on' : ''}" data-act="pref" data-k="accent" data-v="" title="${esc(tr('Vom Stil'))}"><span>${tr('Auto')}</span></button>
      ${ACCENTS.map((c) => `<button class="swatch ${P('accent') === c ? 'on' : ''}" style="--sw:${c}" data-act="pref" data-k="accent" data-v="${c}" aria-label="${c}"></button>`).join('')}
      <label class="swatch custom ${P('accent') && !ACCENTS.includes(P('accent')) ? 'on' : ''}" style="--sw:${esc(P('accent') || '#888888')}" title="${esc(tr('Eigene Farbe'))}"><input type="color" id="prefAccent" value="${esc(P('accent') || '#b52a33')}"><span>+</span></label></div></div>`,
    row(tr('Modulfarben'), '', seg('mono', [[false, tr('Bunt')], [true, tr('Einfarbig')]])),
    row(tr('Ecken'), '', seg('corners', [['round', tr('Rund')], ['square', tr('Eckig')]])),
    row(tr('Textgrösse'), '', seg('size', [['s', 'S'], ['m', 'M'], ['l', 'L']]))
  ].join('');

  const tabs = [['last', tr('Zuletzt offen')], ['week', tr('Woche')], ['exams', tr('Prüfungen')], ['grades', tr('Noten')], ['absences', tr('Absenzen')], ['rooms', tr('Räume')]];
  const timetable = [
    row(tr('Start-Ansicht'), '', `<select id="prefStartTab">${tabs.map(([v, l]) => `<option value="${v}" ${P('startTab') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`),
    row(tr('Vergangenes ausblenden'), tr('Im Popup nur kommende Lektionen dieser Woche zeigen'), sw('foldPast')),
    `<div class="srow col"><div class="sl"><b>${tr('ZP-Schätzung')}</b></div>${zp}</div>`
  ].join('');

  const permRow = IS_APP_PAGE && notifPerm !== 'granted'
    ? `<div class="srow warnrow"><div class="sl"><b>${tr('Benachrichtigungen sind blockiert')}</b><small>${tr('Sonst kommen keine Erinnerungen.')}</small></div><div class="sc"><button class="btn" data-act="notif-perm">${tr('Erlauben')}</button></div></div>` : '';
  const notify = permRow + [
    row(tr('Vor jeder Lektion'), tr('z.B. "Mathematik in ZH-404, 10:30"'), sw('notifyLessons')),
    P('notifyLessons') ? row(tr('Vorlauf'), '', seg('notifyLessonMin', [[5, '5'], [10, '10'], [15, '15'], [30, '30']]) + `<span class="unit">${tr('Min.')}</span>`, 'sub') : '',
    row(tr('Absenzen-Frist'), tr('2 Tage bevor die Frist abläuft'), sw('notifyAbsences')),
    row(tr('Neue Noten'), '', sw('notifyGrades')),
    row(tr('Testen'), '', `<button class="btn ghost" data-act="notif-test">${tr('Test-Benachrichtigung')}</button>`)
  ].join('') + (IS_APP_PAGE ? `<p class="shint">${tr('Erinnerungen kommen auch bei geschlossener App. Neue Noten siehst du, sobald die App aktualisiert.')}</p>`
    : `<p class="shint">${tr('Erinnerungen kommen nur, wenn der Browser offen ist.')}</p>`);

  const notifyBox = window.__wissIOS
    ? `<p class="shint" style="margin-top:12px">${tr('Auf dem iPhone gibt es keine Benachrichtigungen. Das erlaubt Apple nur Apps aus dem App Store.')}</p>` : notify;
  const grades = [
    row(tr('Wunschnote'), tr('Für den Notenrechner'), seg('targetGrade', [[4, '4'], [4.5, '4.5'], [5, '5'], [5.5, '5.5'], [6, '6']])),
    row(tr('Rundung der Modulnote'), '', seg('gradeStep', [[0.5, '0.5'], [0.1, '0.1'], [0, tr('keine')]]))
  ].join('');

  const sync = [
    `<div class="set-h">${tr('Schuldaten aktualisieren')}</div>`,
    row(tr('Im Hintergrund'), tr('Lädt regelmässig neue Daten'), seg('syncMinutes', [[0, tr('Aus')], [10, '10'], [20, '20'], [30, '30']]) + `<span class="unit">${tr('Min.')}</span>`),
    row(tr('Jetzt'), S.lastSync ? tr('Zuletzt: {T}', { T: ago(S.lastSync) }) : '', `<button class="btn ghost" data-act="sync-now">${tr('Aktualisieren')}</button>`),
    S.syncLog && S.syncLog.lines && S.syncLog.lines.length ? `<details class="diag"><summary><b>${tr('Diagnose')}</b> <small class="muted">${tr('letzte Aktualisierung, {T}', { T: esc(ago(S.syncLog.at)) })}</small></summary><pre>${S.syncLog.lines.map(esc).join('\n')}</pre></details>` : ''
  ].join('');

  const data = [
    row(tr('Notizen'), tr('{N} gespeichert', { N: Object.keys(S.notes || {}).length }), `<button class="btn ghost" data-act="export-notes">${IS_APP_PAGE ? tr('Kopieren') : tr('Exportieren')}</button>`),
    row(tr('Lokale Daten'), tr('Löscht Stundenplan, Noten, Notizen und Einstellungen auf diesem Gerät. Synchronisierte Daten bleiben auf dem Server.'),
      `<button class="btn ${setupState.resetArm ? '' : 'ghost'} danger" data-act="${setupState.resetArm ? 'reset-confirm' : 'reset'}">${setupState.resetArm ? tr('Wirklich löschen?') : tr('Alles löschen')}</button>`)
  ].join('');

  const ver = hasChrome && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '';
  const ui = S.updateInfo;
  const updText = setupState.updMsg || (ui && ui.latest ? (updateAvailable() ? tr('Version {V} ist da.', { V: esc(ui.latest) }) : tr('Du hast die neuste Version.')) : '');
  const about = `<div class="about"><span class="logo">W</span><div><b>WISS Stundenplan ${esc(ver)}</b><small>${tr('Inoffiziell, nicht von der WISS')}</small></div></div>
    ${row(tr('Updates'), updText, updateAvailable() ? `<button class="btn" data-act="update-go">${tr('Update laden')}</button>` : `<button class="btn ghost" data-act="update-check">${tr('Prüfen')}</button>`)}
    ${row('GitHub', '', `<button class="btn ghost" data-act="open-repo">${tr('Öffnen')}</button>`)}
    <p class="shint">${tr('Daten: wiss.tocco.ch (dein Login) · Module: modulbaukasten.ch · Schriften: Doto, Space Mono (SIL OFL)')}</p>`;

  return `<div class="settings">
    <div class="set-top"><h2>${tr('Einstellungen')}</h2><button class="btn" data-act="setup-close">${tr('Fertig')}</button></div>
    ${nav}
    <div class="set-body">
      ${sec('account', 'Konto', acc)}
      ${sec('look', 'Darstellung', look)}
      ${sec('timetable', 'Stundenplan', timetable)}
      ${sec('notify', 'Benachrichtigungen', notifyBox)}
      ${sec('grades', 'Noten', grades)}
      ${sec('job', 'Lehrberuf', ab)}
      ${sec('sync', 'Synchronisation', sync + `<div class="set-h">${tr('Geräte-Synchronisation')}</div>` + (typeof renderDeviceSync === 'function' ? renderDeviceSync() : ''))}
      ${sec('data', 'Daten', data)}
      ${sec('about', 'Über', about)}
    </div></div>`;
}

// ---------- events ----------
function parseVal(v) { return v === 'true' ? true : v === 'false' ? false : v !== '' && !isNaN(+v) && !/^#/.test(v) ? +v : v; }
const LOOK_KEYS = ['style', 'theme', 'accent', 'mono', 'corners', 'size', 'lang'];
function prefChanged(k) {
  if (LOOK_KEYS.includes(k)) applyLook();
  if (k === 'foldPast') showPast = !P('foldPast');
  if (k.startsWith('notify') && P(k) && IS_APP_PAGE) globalThis.__wissApp.requestPermission();
  if (k === 'gradeStep' || k === 'targetGrade') { /* grades view reads them on render */ }
  render();
}

document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'pref') { setPref(a.dataset.k, parseVal(a.dataset.v)); prefChanged(a.dataset.k); }
  else if (act === 'pref-toggle') { setPref(a.dataset.k, !P(a.dataset.k)); prefChanged(a.dataset.k); }
  else if (act === 'setnav') {
    setSec = a.dataset.sec;
    const el = document.getElementById('set-' + setSec);
    const v = $('view');
    if (el && v) {
      const navH = FULL ? 10 : (document.querySelector('.set-nav') || { offsetHeight: 0 }).offsetHeight + 4;
      v.scrollTo({ top: el.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - navH, behavior: 'smooth' });
    }
    for (const b of document.querySelectorAll('.set-nav button')) b.classList.toggle('on', b.dataset.sec === setSec);
  }
  else if (act === 'notif-test') { chrome.runtime.sendMessage({ type: 'testNotify' }).catch(() => {}); a.textContent = tr('Gesendet ✓'); }
  else if (act === 'notif-perm') chrome.runtime.sendMessage({ type: 'notifPermission' }).catch(() => {});
  else if (act === 'sync-now') { chrome.runtime.sendMessage({ type: 'refresh', force: true }).catch(() => {}); a.textContent = tr('Läuft…'); }
  else if (act === 'export-notes') exportNotes(a);
  else if (act === 'update-check') {
    a.textContent = tr('Prüfe…'); a.disabled = true;
    chrome.runtime.sendMessage({ type: 'checkUpdate' }).then((r) => {
      setupState.updMsg = r && r.error ? tr('GitHub nicht erreichbar.') : '';
      if (r && r.info) S.updateInfo = r.info;
      render();
    }, () => { setupState.updMsg = tr('GitHub nicht erreichbar.'); render(); });
  }
  else if (act === 'open-repo') openUrl('https://github.com/Nicolas-Wehrle/Wiss-Stundenplan');
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'prefStartTab') { setPref('startTab', ev.target.value); render(); }
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'prefAccent') { setPref('accent', ev.target.value); applyLook(); }
});
document.addEventListener('change', (ev) => { if (ev.target.id === 'prefAccent') render(); });
window.addEventListener('app-permission', (e) => { window.__notifPerm = e.detail; if (S.showSetup) render(); });

// highlight the category that is currently on screen
document.addEventListener('scroll', () => {
  const secs = document.querySelectorAll('.set-sec');
  if (!secs.length) return;
  const top = ($('view').getBoundingClientRect().top || 0) + 70;
  let cur = secs[0].dataset.sec;
  for (const s of secs) if (s.getBoundingClientRect().top <= top) cur = s.dataset.sec;
  if (cur !== setSec) {
    setSec = cur;
    for (const b of document.querySelectorAll('.set-nav button')) b.classList.toggle('on', b.dataset.sec === setSec);
  }
}, true);

function exportNotes(btn) {
  const notes = S.notes || {};
  const rows = Object.entries(notes).map(([id, text]) => {
    const l = S.lessons.find((x) => String(x.id) === String(id));
    return { lesson: id, date: l ? dayKey(new Date(l.start)) : null, module: l ? l.label : null, note: text };
  });
  const json = JSON.stringify(rows, null, 2);
  if (IS_APP_PAGE || !window.Blob) {
    (navigator.clipboard ? navigator.clipboard.writeText(json) : Promise.reject()).then(() => { btn.textContent = tr('Kopiert ✓'); }, () => { btn.textContent = tr('Nicht möglich'); });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `wiss-notizen-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
