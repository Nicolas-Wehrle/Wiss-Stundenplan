// WISS Stundenplan – Android app adapter.
// Provides the `chrome.*` APIs the add-on code uses, backed by the native app
// (MainActivity.java): storage on the phone, hidden WebViews instead of tabs/windows.
(() => {
  'use strict';
  const H = window.AndroidHost, ST = window.AndroidStore;
  const VERSION = '__APP_VERSION__';
  const L = { msg: [], changed: [], installed: [], startup: [], alarm: [] };

  // ---------- messaging (popup ⇄ background run in the same page here) ----------
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
  window.__hostMessage = (json, tabId) => { dispatch(JSON.parse(json), { tab: { id: tabId } }); };

  // ---------- results of scripts run inside hidden WebViews ----------
  const pending = new Map();
  let seq = 1;
  window.__hostResult = (id, json) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    let r; try { r = JSON.parse(json); } catch (e) { r = { error: 'bad result' }; }
    if (r.error) p.reject(new Error(r.error)); else p.resolve(r.value);
  };

  // ---------- storage ----------
  const fireChanged = (obj) => {
    const changes = {};
    for (const k of Object.keys(obj)) changes[k] = { newValue: obj[k] };
    setTimeout(() => L.changed.forEach((fn) => { try { fn(changes, 'local'); } catch (e) { console.error(e); } }), 0);
  };
  // All data is read from the phone once and then kept in memory. Reads never cross the bridge,
  // writes are batched and handed to the phone a moment later (it saves them in the background).
  let mem = null, dirty = null, flushT = 0;
  const clone = (v) => (v === undefined ? undefined : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  const memory = () => {
    if (!mem) { try { mem = JSON.parse(ST.get('null') || '{}') || {}; } catch (e) { mem = {}; } }
    return mem;
  };
  const flush = () => {
    clearTimeout(flushT); flushT = 0;
    if (!dirty) return;
    const patch = {}; for (const k of dirty) if (k in mem) patch[k] = mem[k];
    dirty = null;
    try { ST.set(JSON.stringify(patch)); } catch (e) { console.error('store', e); }
  };
  window.__appFlush = flush;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  const storage = {
    local: {
      get: async (keys) => {
        const s = memory();
        const list = keys == null ? Object.keys(s) : typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        const o = {};
        for (const k of list) if (k in s) o[k] = clone(s[k]);
        return o;
      },
      set: async (obj) => {
        const s = memory();
        dirty = dirty || new Set();
        for (const k of Object.keys(obj)) { s[k] = clone(obj[k]); dirty.add(k); }
        if (!flushT) flushT = setTimeout(flush, 250);
        fireChanged(obj);
      },
      clear: async () => {
        const s = memory(); const ch = {};
        for (const k in s) ch[k] = undefined;
        mem = {}; dirty = null; clearTimeout(flushT); flushT = 0;
        ST.clear(); fireChanged(ch);
      }
    },
    onChanged: { addListener: (fn) => L.changed.push(fn) }
  };

  // ---------- tabs → native WebViews ----------
  const tabs = {
    create: async ({ url, active }) => {
      const id = H.tabCreate(url, active !== false);
      return { id, url };
    },
    get: async (id) => {
      const s = H.tabInfo(id);
      if (!s) throw new Error('No tab with id ' + id);
      return JSON.parse(s);
    },
    update: async (id, { url, active }) => { if (url) H.tabUpdate(id, url); if (active && H.tabShow) H.tabShow(id); return { id, url }; },
    remove: async (id) => { H.tabRemove(id); }
  };

  const scripting = {
    executeScript: ({ target, func, args }) => new Promise((resolve, reject) => {
      const id = seq++;
      pending.set(id, { resolve: (v) => resolve([{ result: v }]), reject });
      const code = `(async () => { try { const v = await (${func.toString()}).apply(null, ${JSON.stringify(args || [])});
        AndroidTab.result(${id}, JSON.stringify({ value: v === undefined ? null : v })); }
        catch (e) { AndroidTab.result(${id}, JSON.stringify({ error: String((e && e.message) || e) })); } })();`;
      H.exec(target.tabId, id, code);
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); } }, 90000);
    })
  };

  const timers = {};
  const alarms = {
    create: (name, { periodInMinutes, delayInMinutes }) => {
      clearInterval(timers[name]);
      const fire = () => L.alarm.forEach((fn) => fn({ name }));
      timers[name] = periodInMinutes ? setInterval(fire, periodInMinutes * 60000) : setTimeout(fire, (delayInMinutes || 0.5) * 60000);
    },
    clear: async (name) => { clearInterval(timers[name]); delete timers[name]; return true; },
    onAlarm: { addListener: (fn) => L.alarm.push(fn) }
  };

  window.__wissApp = {
    notify: (id, title, body) => H.notify(String(id), String(title), String(body || '')),
    schedule: (plan) => H.schedule(JSON.stringify(plan)),
    widget: (data) => H.widgetData(JSON.stringify(data)),
    setLang: (l) => H.setLang(l),
    permission: () => H.notifPermission(),
    requestPermission: () => H.requestNotifPermission(),
    installUpdate: (url) => H.installUpdate(String(url)),
    openExternal: (url) => H.openExternal(String(url))
  };

  window.chrome = {
    runtime: {
      id: 'wiss-stundenplan-app',
      sendMessage: (msg) => dispatch(msg, {}),
      onMessage: { addListener: (fn) => L.msg.push(fn) },
      onInstalled: { addListener: (fn) => L.installed.push(fn) },
      onStartup: { addListener: (fn) => L.startup.push(fn) },
      getURL: (p) => '/__wissapp/' + p,
      getManifest: () => ({ version: VERSION })
    },
    storage, tabs, scripting, alarms,
    // native extras used by background.js when running inside the app

    permissions: { contains: async () => true, request: async () => true }
    // no `windows`: the add-on then uses (hidden) tabs, which are hidden WebViews here
  };

  // Module catalog (modulbaukasten.ch) doesn't allow cross-site requests → native proxy
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const u = typeof input === 'string' ? input : input.url;
    if (/^https:\/\/(www\.modulbaukasten\.ch|ictbb\.crm17\.dynamics\.com)\//.test(u)) {
      return nativeFetch('/__wissapp/proxy?u=' + encodeURIComponent(u), init);
    }
    return nativeFetch(input, init);
  };

  // install / update / startup events, once all scripts are loaded
  window.addEventListener('load', async () => {
    const { __appVersion } = await storage.local.get('__appVersion');
    if (__appVersion !== VERSION) {
      await storage.local.set({ __appVersion: VERSION });
      L.installed.forEach((fn) => fn({ reason: __appVersion ? 'update' : 'install' }));
    } else {
      L.startup.forEach((fn) => fn());
    }
  });

  // ---------- hooks called by the native app ----------
  window.__appResume = () => { chrome.runtime.sendMessage({ type: 'refresh', force: false, resume: true }).catch(() => {}); };
  window.__appUpdateFailed = () => { try { openUrl(S.updateInfo.page); } catch (e) {} };
  window.__appPermission = (state) => { window.dispatchEvent(new CustomEvent('app-permission', { detail: state })); };
  window.__appOpenTab = (tab) => { try { S.tab = tab; S.showSetup = false; render(); } catch (e) {} };
  window.__appTabClosed = () => { chrome.runtime.sendMessage({ type: 'refresh', force: true }).catch(() => {}); };
  // Android back button: close panel → close settings → go to "Woche" → leave app
  window.__appBack = () => {
    const wrap = document.getElementById('sheetWrap');
    if (wrap && !wrap.hidden) { document.getElementById('scrim').click(); return true; }
    try {
      if (S.setupDone && S.showSetup) { document.getElementById('btnSettings').click(); return true; }
      if (S.setupDone && S.tab !== 'week') { document.querySelector('#tabs [data-tab=week]').click(); return true; }
    } catch (e) { /* popup not ready */ }
    return false;
  };
})();
