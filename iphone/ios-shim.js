// WISS Stundenplan – iPhone/Safari adapter (runs inside the "Userscripts" Safari extension).
// Provides the chrome.* APIs the add-on code uses:
//   storage  → localStorage of wiss.tocco.ch (stays on this iPhone)
//   tabs     → sign-in: the page itself goes to the school login and comes back;
//              teacher names: an invisible same-site frame of the Stundenplan page
//   scripting.executeScript → simply runs the function here (we are already on wiss.tocco.ch)
//   fetch to modulbaukasten / dynamics → GM.xmlHttpRequest (cross-site)
const L = { msg: [], changed: [], installed: [], startup: [], alarm: [] };
const STORE_KEY = 'wiss:store';
const RETURN_KEY = 'wiss:return';
const LOGIN_AT_KEY = 'wiss:loginAt';
const APP_URL = location.origin + '/extranet/?stundenplan';

function dispatch(msg, sender) {
  return new Promise((resolve) => {
    let async = false, done = false;
    const respond = (v) => { if (!done) { done = true; resolve(v); } };
    for (const fn of L.msg) {
      try { if (fn(msg, sender || {}, respond) === true) async = true; } catch (e) { console.error(e); }
    }
    if (!async) setTimeout(() => respond(undefined), 0);
  });
}

// ---------- storage ----------
let mem = null;
function readStore() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { mem = {}; }
  return mem;
}
function writeStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); }
  catch (e) {                                   // quota: drop the room cache first, it is only a cache
    if (mem.roomCache) { delete mem.roomCache; try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); } catch (e2) {} }
  }
}
const fireChanged = (changes) => setTimeout(() => L.changed.forEach((fn) => { try { fn(changes, 'local'); } catch (e) { console.error(e); } }), 0);
const storage = {
  local: {
    get: async (keys) => {
      const s = readStore();
      if (keys == null) return JSON.parse(JSON.stringify(s));
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const o = {};
      for (const k of list) if (k in s) o[k] = JSON.parse(JSON.stringify(s[k]));
      return o;
    },
    set: async (obj) => {
      const s = readStore(), ch = {};
      for (const k of Object.keys(obj)) { ch[k] = { oldValue: s[k], newValue: obj[k] }; s[k] = JSON.parse(JSON.stringify(obj[k])); }
      writeStore(); fireChanged(ch);
    },
    clear: async () => {
      const s = readStore(), ch = {};
      for (const k of Object.keys(s)) ch[k] = { oldValue: s[k] };
      mem = {}; writeStore(); fireChanged(ch);
    }
  },
  onChanged: { addListener: (fn) => L.changed.push(fn) }
};

// ---------- tabs ----------
const frames = new Map();   // id → { iframe, url, status }
let nextTab = 1;
function goLogin(url) {
  try { sessionStorage.setItem(RETURN_KEY, '1'); sessionStorage.setItem(LOGIN_AT_KEY, String(Date.now())); } catch (e) {}
  location.href = url;
}
const tabs = {
  create: async ({ url, active }) => {
    const id = nextTab++;
    const isTeacherPage = /Stundenplan/i.test(decodeURIComponent(url));
    if (!isTeacherPage) {
      // sign-in. Visible request (button) → always go. Automatic → only if not tried in the last 90 s
      let recent = 0; try { recent = +sessionStorage.getItem(LOGIN_AT_KEY) || 0; } catch (e) {}
      if (active !== false || Date.now() - recent > 90000) { goLogin(url); frames.set(id, { url, status: 'loading', nav: true }); }
      else frames.set(id, { url: 'https://login.microsoftonline.com/', status: 'complete', fake: true });   // → "needs you"
      return { id, url };
    }
    // teacher names: invisible same-site frame; content.js logic runs against its document
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-4000px;top:0;width:1100px;height:900px;border:0;visibility:hidden';
    const t = { iframe: f, url, status: 'loading' };
    frames.set(id, t);
    f.addEventListener('load', () => {
      t.status = 'complete';
      try { t.url = String(f.contentWindow.location.href); } catch (e) { t.url = 'about:blank'; }
      try {
        // eslint-disable-next-line no-new-func
        new Function('document', 'location', 'window', 'chrome', '"use strict";' + CONTENT_JS)(
          f.contentDocument, f.contentWindow.location, f.contentWindow, { runtime: { sendMessage: (m) => dispatch(m, { tab: { id } }) } });
      } catch (e) { console.error('wiss teacher frame', e); }
    });
    f.src = url;
    document.body.appendChild(f);
    return { id, url };
  },
  get: async (id) => {
    const t = frames.get(id);
    if (!t) throw new Error('No tab with id ' + id);
    return { id, url: t.url, status: t.status };
  },
  update: async (id, { url }) => { const t = frames.get(id); if (t && t.iframe) { t.status = 'loading'; t.iframe.src = url; } return { id, url }; },
  remove: async (id) => { const t = frames.get(id); if (t && t.iframe) t.iframe.remove(); frames.delete(id); }
};

const scripting = {
  // everything here is already on wiss.tocco.ch → just run the function in this page
  executeScript: async ({ func, args }) => [{ result: await func.apply(null, args || []) }]
};

const timers = {};
const alarms = {
  create: (name, { periodInMinutes }) => {
    clearInterval(timers[name]);
    if (periodInMinutes) timers[name] = setInterval(() => L.alarm.forEach((fn) => fn({ name })), periodInMinutes * 60000);
  },
  clear: async (name) => { clearInterval(timers[name]); delete timers[name]; return true; },
  onAlarm: { addListener: (fn) => L.alarm.push(fn) }
};

const chrome = {
  runtime: {
    id: 'wiss-stundenplan-ios',
    sendMessage: (msg) => dispatch(msg, {}),
    onMessage: { addListener: (fn) => L.msg.push(fn) },
    onInstalled: { addListener: (fn) => L.installed.push(fn) },
    onStartup: { addListener: (fn) => L.startup.push(fn) },
    getURL: (p) => p,
    getManifest: () => ({ version: VERSION })
  },
  storage, tabs, scripting, alarms,
  permissions: { contains: async () => true, request: async () => true }
};
window.chrome = chrome;
window.__wissIOS = true;

// ---------- cross-site requests (module catalog) via the userscript manager ----------
const pageFetch = window.fetch.bind(window);
function gmFetch(url, init = {}) {
  const gm = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM)
    : (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);
  if (!gm) return Promise.reject(new Error('GM.xmlHttpRequest fehlt'));
  return new Promise((resolve, reject) => {
    gm({
      method: init.method || 'GET', url, headers: init.headers || {}, data: init.body, timeout: 30000,
      onload: (r) => resolve(new Response(r.responseText, { status: r.status || 200 })),
      onerror: () => reject(new Error('Netzwerkfehler')), ontimeout: () => reject(new Error('Zeitüberschreitung'))
    });
  });
}
window.fetch = (input, init) => {
  const u = typeof input === 'string' ? input : input.url;
  if (/^https:\/\/(www\.modulbaukasten\.ch|ictbb\.crm17\.dynamics\.com)\//.test(u)) return gmFetch(u, init);
  return pageFetch(input, init);
};

// install / update / startup events, once everything is loaded
function startApp() {
  setTimeout(async () => {
    const { __appVersion } = await chrome.storage.local.get('__appVersion');
    if (__appVersion !== VERSION) {
      await chrome.storage.local.set({ __appVersion: VERSION });
      L.installed.forEach((fn) => fn({ reason: __appVersion ? 'update' : 'install' }));
    } else {
      L.startup.forEach((fn) => fn());
    }
  }, 0);
  // back from another app / tab → refresh if needed
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') chrome.runtime.sendMessage({ type: 'refresh', force: false, resume: true }).catch(() => {});
  });
}
