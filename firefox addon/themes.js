// Eigene Themes: one CSS file restyles the whole app.
// CSS only, never scripts: a theme can change how everything looks, but can't read or send data.
// Nothing a theme names is loaded from the internet (no @import, no url(https://…)); fonts and pictures
// have to be inside the file as data: URIs. Uses the globals of popup.js / settings.js (S, P, setPref, …).

const THEME_MAX = 200 * 1024;         // per theme
const THEME_SYNC_MAX = 60 * 1024;     // bigger themes stay on the device (sync packages are small)
const THEME_CACHE = 'wissTheme';      // localStorage: applied by i18n.js before the first paint
const THEME_STYLES = ['standard', 'apple', 'samsung', 'nothing', 'github', 'pastel', 'neon', 'paper', 'terminal'];
const SAFE_MODE = new URLSearchParams(location.search).has('safe');
let themeSuspended = false;           // set when a theme hid the settings button (this session only)
const themeUI = { editor: null, err: '', msg: '', delArm: null, removed: 0 };

function themeHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
const themeBytes = (s) => new TextEncoder().encode(s || '').length;
const themeKb = (n) => (n / 1024 < 10 ? Math.max(0.1, n / 1024).toFixed(1) : Math.round(n / 1024)) + ' KB';

// Everything that could make the browser fetch something is removed. CSS escapes (\75 rl) can't be
// used to hide it: if the unescaped text has more of these than the raw text, the theme is refused.
const THEME_DATA_OK = /^data:(image\/(png|jpe?g|gif|webp|avif|svg\+xml)|font\/[a-z0-9.+-]+|application\/(font-[a-z0-9.+-]+|x-font-[a-z0-9.+-]+|vnd\.ms-fontobject))[;,]/i;
function sanitizeThemeCss(css) {
  const risky = /@import|url\s*\(|image-set\s*\(|\bsrc\s*\(|expression\s*\(|-moz-binding|behavior\s*:/gi;
  const count = (s) => (s.match(risky) || []).length;
  const unescaped = css.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return ''; } }).replace(/\\([^\n])/g, '$1');
  if (count(unescaped) !== count(css)) return { error: 'escape' };
  let removed = 0;
  const cut = (re, to) => { css = css.replace(re, (...m) => { const r = typeof to === 'function' ? to(...m) : to; if (r !== m[0]) removed++; return r; }); };
  cut(/@import[^;]*;?/gi, '');
  cut(/url\s*\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (m, q, u) => (THEME_DATA_OK.test(u.trim()) ? m : 'url("data:,")'));
  cut(/(-webkit-)?image-set\s*\(/gi, 'x-removed(');
  cut(/\bsrc\s*\(/gi, 'x-removed(');
  cut(/expression\s*\(|-moz-binding|behavior\s*:/gi, 'x-removed:');
  // a theme's :root beats the built-in styles (those go up to :root[data-style][data-mode])
  css = css.replace(/(^|[\s,{}>+~(])(:root)(?![\w-])/g, '$1:root:root:root:root');
  return { css, removed };
}

// Reads a theme file. Header (optional): /* @name … @author … @version … @base nothing @mode dark */
function parseTheme(text, fileName = '') {
  if (typeof text !== 'string') return { error: tr('Datei konnte nicht gelesen werden.') };
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return { error: tr('Die Datei ist leer.') };
  if (themeBytes(text) > THEME_MAX) return { error: tr('Zu gross: höchstens {N}.', { N: themeKb(THEME_MAX) }) };
  if (/<\/?(script|style|html|body)\b/i.test(text)) return { error: tr('Das ist keine CSS-Datei.') };
  const meta = {};
  const head = text.match(/^\s*\/\*([\s\S]*?)\*\//);
  if (head) for (const m of head[1].matchAll(/@(name|author|version|base|mode)\b[ \t:=]*([^\n*]*)/gi)) meta[m[1].toLowerCase()] = m[2].trim().slice(0, 80);
  const san = sanitizeThemeCss(text);
  if (san.error) return { error: tr('Der Code versteckt eine Adresse hinter Escape-Zeichen. So ein Theme wird nicht geladen.') };
  const base = THEME_STYLES.includes((meta.base || '').toLowerCase()) ? meta.base.toLowerCase() : '';
  const mode = /^(light|hell)$/i.test(meta.mode || '') ? 'light' : /^(dark|dunkel)$/i.test(meta.mode || '') ? 'dark' : '';
  const name = (meta.name || fileName.replace(/\.(css|txt)$/i, '') || tr('Eigenes Theme')).slice(0, 60);
  return {
    removed: san.removed,
    theme: { id: themeHash(name + '\n' + text), name, author: (meta.author || '').slice(0, 60), version: (meta.version || '').slice(0, 20), base, mode, source: text }
  };
}

// ---------- which theme is on ----------
const themeLibrary = () => (Array.isArray(S.themeLibrary) ? S.themeLibrary : []);
// The pref holds the active theme; with its CSS when it is small enough to sync.
function activeTheme() {
  const t = P('customTheme');
  if (!t || !t.id) return null;
  if (typeof t.source === 'string') return t;
  return themeLibrary().find((x) => x.id === t.id) || null;
}
const themeShown = () => (SAFE_MODE || themeSuspended ? null : activeTheme());
const themeMissing = () => { const t = P('customTheme'); return !!(t && t.id && !activeTheme()); };

let themePreview = null;   // the editor's text, shown live while typing
function applyCustomTheme() {
  const r = document.documentElement;
  const t = themePreview || themeShown();
  let el = document.getElementById('customThemeStyle');
  if (!el) { el = document.createElement('style'); el.id = 'customThemeStyle'; document.head.appendChild(el); }
  const css = t ? (sanitizeThemeCss(t.source).css || '') : '';
  if (el.textContent !== css) el.textContent = css;
  if (t) r.dataset.customTheme = t.id || 'preview'; else delete r.dataset.customTheme;
  if (!themePreview) {
    try {
      if (t && css.length < 1.5e6) localStorage.setItem(THEME_CACHE, JSON.stringify({ id: t.id, css }));
      else localStorage.removeItem(THEME_CACHE);
    } catch (e) {}
    if (t) setTimeout(guardTheme, 80);
  }
}

// A theme must never lock you out: if the settings button is hidden or covered only because of the
// theme, the theme is paused for this session and the settings say why.
function settingsReachable() {
  const b = document.getElementById('btnSettings');
  if (!b) return true;
  const rc = b.getBoundingClientRect(), cs = getComputedStyle(b);
  if (rc.width < 14 || rc.height < 14 || cs.visibility === 'hidden' || +cs.opacity < 0.25) return false;
  const x = rc.left + rc.width / 2, y = rc.top + rc.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
  const hit = document.elementFromPoint(x, y);
  return !!hit && (hit === b || b.contains(hit));
}
function guardTheme() {
  const el = document.getElementById('customThemeStyle');
  if (!el || !el.textContent || themePreview || !S.setupDone) return;
  if (settingsReachable()) return;
  el.disabled = true; const without = settingsReachable(); el.disabled = false;
  if (!without) return;                       // covered anyway (a sheet is open): not the theme's fault
  themeSuspended = true;
  applyLook();
  toast(tr('Theme pausiert: die Einstellungen waren nicht mehr erreichbar.'));
  if (S.showSetup) render();
}

// ---------- changing themes ----------
function saveLibrary(list) {
  S.themeLibrary = list;
  return persist({ themeLibrary: list });
}
function activateTheme(t) {
  themeSuspended = false;
  const small = t && themeBytes(t.source) <= THEME_SYNC_MAX;
  setPref('customTheme', t ? (small ? { id: t.id, name: t.name, author: t.author, version: t.version, base: t.base, mode: t.mode, source: t.source } : { id: t.id, name: t.name }) : null);
  applyLook(); render();
}
function installTheme(t, activate = true) {
  const list = themeLibrary().filter((x) => x.id !== t.id && x.name !== t.name);
  saveLibrary([{ ...t, added: Date.now() }, ...list].slice(0, 30));
  if (activate) activateTheme(t); else render();
}
function deleteTheme(id) {
  saveLibrary(themeLibrary().filter((x) => x.id !== id));
  if ((P('customTheme') || {}).id === id) activateTheme(null); else render();
}
// a theme that came in through sync is added to this device's list
function adoptSyncedTheme() {
  const t = P('customTheme');
  if (t && typeof t.source === 'string' && !themeLibrary().some((x) => x.id === t.id))
    saveLibrary([{ id: t.id, name: t.name, author: t.author || '', version: t.version || '', base: t.base || '', mode: t.mode || '', source: t.source, added: Date.now() }, ...themeLibrary()].slice(0, 30));
}

function exportTheme(t, btn) {
  if (IS_APP_PAGE || !window.Blob) {
    (navigator.clipboard ? navigator.clipboard.writeText(t.source) : Promise.reject()).then(() => { btn.textContent = tr('Kopiert ✓'); }, () => { btn.textContent = tr('Nicht möglich'); });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t.source], { type: 'text/css' }));
  a.download = (t.name || 'theme').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.css';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const THEME_TEMPLATE = `/* @name Mein Theme
   @author Dein Name
   @base standard
   @mode auto
*/

/* Farben: gelten in jedem Stil */
:root {
  --accent: #4f7cff;
}

/* nur im Dunkelmodus */
:root[data-mode=dark] {
  --bg: #0b1020;
  --surface: #141a2e;
}

/* alles andere ist normales CSS, zum Beispiel: */
.tabs button { text-transform: uppercase; letter-spacing: .04em; }
`;

// ---------- settings ----------
function renderThemeSettings() {
  const lib = themeLibrary(), cur = P('customTheme') || {}, ed = themeUI.editor;
  const notes = [];
  if (SAFE_MODE) notes.push(`<div class="srow warnrow"><div class="sl"><b>${tr('Sicherer Modus')}</b><small>${tr('Ohne Theme gestartet. Schliess und öffne die App normal, um es wieder zu sehen.')}</small></div></div>`);
  if (themeSuspended) notes.push(`<div class="srow warnrow"><div class="sl"><b>${tr('Theme pausiert')}</b><small>${tr('Es hat den Einstellungen-Knopf versteckt oder verdeckt.')}</small></div><div class="sc"><button class="btn ghost" data-act="theme-resume">${tr('Trotzdem anwenden')}</button></div></div>`);
  if (themeMissing()) notes.push(`<div class="srow warnrow"><div class="sl"><b>${esc(cur.name || tr('Theme'))}</b><small>${tr('Ist auf einem anderen Gerät aktiv, aber zu gross für den Sync. Importier die Datei auch hier.')}</small></div></div>`);

  const rows = lib.map((t) => {
    const on = cur.id === t.id, size = themeBytes(t.source);
    const info = [t.author, t.base ? tr('Basis: {S}', { S: tr((STYLES.find((s) => s[0] === t.base) || [0, t.base])[1]) }) : '', themeKb(size), on && size > THEME_SYNC_MAX ? tr('zu gross für Sync') : ''].filter(Boolean).join(' · ');
    return `<div class="theme-row ${on ? 'on' : ''}">
      <div class="sl"><b>${esc(t.name)}</b><small>${esc(info)}</small></div>
      <div class="sc theme-btns">
        <button class="btn ${on ? '' : 'ghost'}" data-act="theme-toggle" data-id="${esc(t.id)}" aria-pressed="${on}">${on ? tr('Aktiv') : tr('Anwenden')}</button>
        <button class="btn ghost" data-act="theme-edit" data-id="${esc(t.id)}">${tr('Bearbeiten')}</button>
        <button class="btn ghost" data-act="theme-export" data-id="${esc(t.id)}">${IS_APP_PAGE ? tr('Kopieren') : tr('Exportieren')}</button>
        <button class="btn ${themeUI.delArm === t.id ? '' : 'ghost'} danger" data-act="theme-del" data-id="${esc(t.id)}">${themeUI.delArm === t.id ? tr('Wirklich?') : tr('Löschen')}</button>
      </div></div>`;
  }).join('');

  const editor = ed ? `<div class="theme-editor">
      <textarea id="themeCode" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${esc(tr('CSS des Themes'))}">${esc(ed.text)}</textarea>
      <div class="theme-ed-bar"><span class="theme-ed-msg ${themeUI.err ? 'bad' : ''}" id="themeMsg">${esc(themeUI.err || themeUI.msg || tr('Änderungen siehst du sofort.'))}</span>
        <button class="btn ghost" data-act="theme-cancel">${tr('Abbrechen')}</button><button class="btn" data-act="theme-save">${tr('Speichern und anwenden')}</button></div></div>` : '';

  return `<div class="srow col theme-sec"><div class="sl"><b>${tr('Eigenes Theme')}</b><small>${tr('Eine CSS-Datei, die das ganze Aussehen ändert. Das aktive Theme kommt mit dem Sync auf deine anderen Geräte.')}</small></div>
    ${notes.join('')}
    ${rows ? `<div class="theme-list">${rows}</div>` : ''}
    ${themeUI.msg && !ed ? `<p class="shint">${esc(themeUI.msg)}</p>` : ''}${themeUI.err && !ed ? `<p class="shint bad">${esc(themeUI.err)}</p>` : ''}
    ${editor}
    ${ed ? '' : `<div class="theme-actions">
      <label class="btn ghost theme-file">${tr('Datei importieren')}<input type="file" id="themeFile" accept=".css,text/css,text/plain" hidden></label>
      <button class="btn ghost" data-act="theme-new">${tr('Neu schreiben')}</button>
      ${cur.id ? `<button class="btn ghost" data-act="theme-off">${tr('Ohne Theme')}</button>` : ''}
      <button class="btn ghost" data-act="theme-help">${tr('Anleitung')}</button></div>`}
  </div>`;
}

let themeTypeT = 0;
function themeEditorInput(text) {
  themeUI.editor.text = text;
  clearTimeout(themeTypeT);
  themeTypeT = setTimeout(() => {
    const p = parseTheme(text, themeUI.editor.name || '');
    const msg = document.getElementById('themeMsg');
    if (p.error) { themeUI.err = p.error; themePreview = null; }
    else {
      themeUI.err = '';
      themePreview = p.theme;
      themeUI.msg = p.removed ? tr('{N} Verweise ins Internet entfernt (nicht erlaubt).', { N: p.removed }) : tr('Vorschau. Speichern, um es zu behalten.');
    }
    applyLook();
    if (msg) { msg.textContent = themeUI.err || themeUI.msg; msg.classList.toggle('bad', !!themeUI.err); }
  }, 250);
}
function closeThemeEditor() { themeUI.editor = null; themePreview = null; themeUI.err = ''; applyLook(); }

function importThemeText(text, fileName) {
  const p = parseTheme(text, fileName);
  themeUI.delArm = null;
  if (p.error) { themeUI.err = p.error; themeUI.msg = ''; render(); return; }
  themeUI.err = '';
  themeUI.msg = tr('«{N}» installiert.', { N: p.theme.name }) + (p.removed ? ' ' + tr('{N} Verweise ins Internet entfernt (nicht erlaubt).', { N: p.removed }) : '');
  installTheme(p.theme, true);
}

document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-act^="theme-"]');
  if (!a) return;
  const act = a.dataset.act, t = themeLibrary().find((x) => x.id === a.dataset.id);
  if (act !== 'theme-del') themeUI.delArm = null;
  if (act === 'theme-toggle' && t) { themeUI.msg = ''; themeUI.err = ''; activateTheme((P('customTheme') || {}).id === t.id ? null : t); }
  else if (act === 'theme-off') { themeUI.msg = ''; activateTheme(null); }
  else if (act === 'theme-resume') { themeSuspended = false; applyLook(); render(); }
  else if (act === 'theme-export' && t) exportTheme(t, a);
  else if (act === 'theme-del' && t) { if (themeUI.delArm === t.id) { themeUI.delArm = null; deleteTheme(t.id); } else { themeUI.delArm = t.id; render(); } }
  else if (act === 'theme-new') { themeUI.editor = { id: null, name: '', text: THEME_TEMPLATE }; themeUI.msg = ''; themeUI.err = ''; render(); themeEditorInput(THEME_TEMPLATE); }
  else if (act === 'theme-edit' && t) { themeUI.editor = { id: t.id, name: t.name, text: t.source }; themeUI.msg = ''; themeUI.err = ''; render(); themeEditorInput(t.source); }
  else if (act === 'theme-cancel') { closeThemeEditor(); render(); }
  else if (act === 'theme-save') {
    const ed = themeUI.editor; if (!ed) return;
    const p = parseTheme(ed.text, ed.name);
    if (p.error) { themeUI.err = p.error; render(); return; }
    if (ed.id) saveLibrary(themeLibrary().filter((x) => x.id !== ed.id));
    themeUI.editor = null; themePreview = null;
    themeUI.msg = tr('«{N}» gespeichert.', { N: p.theme.name });
    installTheme(p.theme, true);
  }
  else if (act === 'theme-help') openUrl('https://stundenplan.severinwehrle.dev/#docs/themes');
});
document.addEventListener('input', (ev) => { if (ev.target.id === 'themeCode' && themeUI.editor) themeEditorInput(ev.target.value); });
document.addEventListener('keydown', (ev) => {
  if (ev.target.id !== 'themeCode' || ev.key !== 'Tab') return;          // Tab indents instead of leaving the box
  ev.preventDefault();
  const el = ev.target, s = el.selectionStart;
  el.setRangeText('  ', s, el.selectionEnd, 'end');
  themeEditorInput(el.value);
});
document.addEventListener('change', (ev) => {
  if (ev.target.id !== 'themeFile') return;
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  if (f.size > THEME_MAX) { themeUI.err = tr('Zu gross: höchstens {N}.', { N: themeKb(THEME_MAX) }); render(); return; }
  f.text().then((txt) => importThemeText(txt, f.name), () => { themeUI.err = tr('Datei konnte nicht gelesen werden.'); render(); });
});
// The small toolbar popup closes when a file picker opens: there, importing opens the big view.
document.addEventListener('click', (ev) => {
  const lab = ev.target.closest('.theme-file');
  if (!lab || FULL || IS_APP_PAGE || PLATFORM === 'ios') return;
  ev.preventDefault();
  browser.tabs.create({ url: browser.runtime.getURL('popup.html?full#theme') });
  window.close();
}, true);

// popup.html?full#theme (from the toolbar popup's import button): open the settings at the themes
if (location.hash === '#theme') {
  const wait = setInterval(() => {
    if (!loadedOnce || !S.setupDone) return;
    clearInterval(wait);
    S.showSetup = true; setSec = 'look'; render();
    setTimeout(() => { const el = document.querySelector('.theme-sec'); if (el) el.scrollIntoView({ block: 'center' }); }, 60);
  }, 120);
  setTimeout(() => clearInterval(wait), 15000);
}
