// Erix Stundenplan – desktop app adapter (Tauri: Windows, macOS, Linux).
// Provides the `chrome.*` APIs the add-on code uses, backed by src-tauri/src/main.rs.
// Same job as android app/web-src/app-shim.js:
//  - storage → a file in the app's data folder (read once, every change handed over right away)
//  - tabs → extra windows, normally hidden (silent sign-in, teacher names)
//  - requests to wiss.tocco.ch → run inside a hidden wiss.tocco.ch page, so they carry the
//    sign-in cookies exactly like in a browser; other sites (module catalog, sync server,
//    GitHub) → fetched by the app itself, because a page here may not call them directly.
(() => {
  'use strict';
  const invoke = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args || {});
  const VERSION = '__APP_VERSION__';
  const TOCCO = 'https://wiss.tocco.ch/';
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

  // ---------- results of scripts run inside hidden pages ----------
  const pending = new Map();
  let seq = 1;
  window.__hostResult = (id, json) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    let r; try { r = JSON.parse(json); } catch (e) { r = { error: 'bad result' }; }
    if (r.error) p.reject(new Error(r.error)); else p.resolve(r.value);
  };
  // runs func(...args) inside tab `tabId` and resolves with its (JSON-able) return value
  function runIn(tabId, func, args, timeout) {
    return new Promise((resolve, reject) => {
      const id = seq++;
      pending.set(id, { resolve, reject });
      const code = `(async () => { try { const v = await (${func.toString()}).apply(null, ${JSON.stringify(args || [])});
        window.__wissTab.result(${id}, JSON.stringify({ value: v === undefined ? null : v })); }
        catch (e) { window.__wissTab.result(${id}, JSON.stringify({ error: String((e && e.message) || e) })); } })();`;
      invoke('tab_exec', { id: tabId, call: id, code }).catch((e) => { pending.delete(id); reject(e); });
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); } }, timeout || 90000);
    });
  }

  // ---------- storage ----------
  const fireChanged = (obj) => {
    const changes = {};
    for (const k of Object.keys(obj)) changes[k] = { newValue: obj[k] };
    setTimeout(() => L.changed.forEach((fn) => { try { fn(changes, 'local'); } catch (e) { console.error(e); } }), 0);
  };
  let mem = {};
  const ready = invoke('store_load').then((d) => { mem = d && typeof d === 'object' ? d : {}; }).catch((e) => console.error('store', e));
  const clone = (v) => (v === undefined ? undefined : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  // changes made in the same moment go over together
  let dirty = null;
  const flush = () => {
    if (!dirty) return;
    const patch = {}; for (const k of dirty) if (k in mem) patch[k] = mem[k];
    dirty = null;
    invoke('store_set', { patch }).catch((e) => console.error('store', e));
  };
  window.__appFlush = flush;
  const storage = {
    local: {
      get: async (keys) => {
        await ready;
        const list = keys == null ? Object.keys(mem) : typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        const o = {};
        for (const k of list) if (k in mem) o[k] = clone(mem[k]);
        return o;
      },
      set: async (obj) => {
        await ready;
        if (!dirty) { dirty = new Set(); queueMicrotask(flush); }
        for (const k of Object.keys(obj)) { mem[k] = clone(obj[k]); dirty.add(k); }
        fireChanged(obj);
      },
      remove: async (keys) => {
        await ready;
        const removed = {};
        for (const k of typeof keys === 'string' ? [keys] : keys) { delete mem[k]; removed[k] = undefined; }
        dirty = null;
        await invoke('store_replace', { data: mem });
        fireChanged(removed);
      },
      clear: async () => {
        await ready;
        const ch = {};
        for (const k in mem) ch[k] = undefined;
        mem = {}; dirty = null;
        await invoke('store_replace', { data: {} });
        fireChanged(ch);
      }
    },
    onChanged: { addListener: (fn) => L.changed.push(fn) }
  };

  // ---------- tabs → extra windows ----------
  const tabs = {
    create: async ({ url, active }) => ({ id: await invoke('tab_create', { url, active: active !== false }), url }),
    get: async (id) => {
      const t = await invoke('tab_info', { id });
      if (!t) throw new Error('No tab with id ' + id);
      return t;
    },
    update: async (id, { url, active }) => {
      if (url) await invoke('tab_update', { id, url });
      if (active) await invoke('tab_show', { id });
      return { id, url };
    },
    remove: async (id) => { await invoke('tab_remove', { id }); }
  };
  const scripting = {
    executeScript: ({ target, func, args }) => runIn(target.tabId, func, args).then((v) => [{ result: v }])
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

  // ---------- requests ----------
  // A hidden page on wiss.tocco.ch, made when needed and closed again after a quiet minute.
  let bridge = null, bridgeIdle = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function bridgeTab() {
    clearTimeout(bridgeIdle);
    bridgeIdle = setTimeout(() => { const b = bridge; bridge = null; if (b) b.then((id) => invoke('tab_remove', { id })).catch(() => {}); }, 60000);
    if (bridge) {
      try { const id = await bridge; if (await invoke('tab_info', { id })) return id; } catch (e) { /* make a new one */ }
    }
    bridge = (async () => {
      const id = await invoke('tab_create', { url: TOCCO + 'nice2/username?_wissapp=1', active: false, internal: true });
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        const t = await invoke('tab_info', { id });
        if (!t) break;
        if (t.status === 'complete') {
          // a page that didn't load (offline) can't answer → give up quickly
          try { if (await runIn(id, () => location.origin, [], 4000) === 'https://wiss.tocco.ch') return id; } catch (e) { /* offline */ }
          break;
        }
        await sleep(120);
      }
      invoke('tab_remove', { id }).catch(() => {});
      throw new TypeError('Failed to fetch');
    })();
    bridge.catch(() => { bridge = null; });
    return bridge;
  }
  // runs inside the wiss.tocco.ch page
  async function pageFetch(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'include', cache: 'no-store' }, opts));
    return { status: r.status, statusText: r.statusText, headers: [...r.headers], body: await r.text() };
  }
  const nativeFetch = window.fetch.bind(window);
  const NATIVE = /^https:\/\/(www\.modulbaukasten\.ch|ictbb\.crm17\.dynamics\.com|api\.github\.com|[a-z0-9-]+\.onrender\.com)\//;
  const abortable = (p, signal) => {
    if (!signal) return p;
    if (signal.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', onAbort, { once: true });
      p.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  };
  const toResponse = (r) => new Response([101, 204, 205, 304].includes(r.status) ? null : r.body, { status: r.status, statusText: r.statusText || '', headers: r.headers });
  window.fetch = async (input, init) => {
    init = init || {};
    const req = typeof input === 'string' || input instanceof URL ? null : input;
    const url = req ? req.url : String(input);
    if (!url.startsWith(TOCCO) && !NATIVE.test(url)) return nativeFetch(input, init);
    const method = (init.method || (req && req.method) || 'GET').toUpperCase();
    const headers = [...new Headers(init.headers || (req && req.headers) || {})];
    let body = init.body != null ? init.body : null;
    if (body != null && typeof body !== 'string') body = await new Response(body).text();
    const signal = init.signal || (req && req.signal);
    if (url.startsWith(TOCCO)) {
      const work = (async () => {
        const id = await bridgeTab();
        try { return toResponse(await runIn(id, pageFetch, [url, { method, headers, body: body == null ? undefined : body }], 30000)); }
        catch (e) { throw new TypeError('Failed to fetch'); }
      })();
      return abortable(work, signal);
    }
    const work = invoke('http', { req: { url, method, headers, body } })
      .then((r) => toResponse({ status: r.status, statusText: r.status_text, headers: r.headers, body: r.body }))
      .catch(() => { throw new TypeError('Failed to fetch'); });
    return abortable(work, signal);
  };

  // ---------- native extras ----------
  const zh = (ms, o) => new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', ...o }).format(new Date(ms));
  window.__wissApp = {
    desktop: true,
    notify: (id, title, body) => invoke('notify', { title: String(title), body: String(body || '') }).catch(() => {}),
    schedule: (plan) => invoke('schedule', { plan: (plan || []).map((r) => ({ id: String(r.id), at: Number(r.at), title: String(r.title || ''), body: String(r.body || '') })) }).catch(() => {}),
    // the tray and the mini window: times already formatted (the app side has no time zones)
    widget: (data) => {
      const en = data.lang === 'en';
      const lessons = (data.lessons || []).map((l) => {
        const s = Date.parse(l.s), e = Date.parse(l.e);
        return { ...l, s, e, sh: zh(s, { hour: '2-digit', minute: '2-digit' }), eh: zh(e, { hour: '2-digit', minute: '2-digit' }),
          dl: new Intl.DateTimeFormat(en ? 'en-GB' : 'de-CH', { timeZone: 'Europe/Zurich', weekday: 'short' }).format(new Date(s)).replace(/\.$/, '') };
      });
      return invoke('widget', { data: { ...data, lessons } }).catch(() => {});
    },
    setLang: (l) => invoke('set_lang', { lang: String(l) }).catch(() => {}),
    permission: () => 'granted',
    requestPermission: () => {},
    installUpdate: () => invoke('install_update').catch(() => window.__appUpdateFailed && window.__appUpdateFailed()),
    openExternal: (url) => invoke('open_external', { url: String(url) }).catch(() => {}),
    signOut: async () => { clearTimeout(bridgeIdle); bridge = null; await invoke('sign_out').catch(() => {}); }
  };

  // keep WebView2's own window.chrome (the app's messaging may use it) and add what the add-on needs
  window.chrome = Object.assign(window.chrome || {}, {
    runtime: {
      id: 'wiss-stundenplan-app',
      sendMessage: (msg) => dispatch(msg, { url: chrome.runtime.getURL('popup.html') }),
      onMessage: { addListener: (fn) => L.msg.push(fn) },
      onInstalled: { addListener: (fn) => L.installed.push(fn) },
      onStartup: { addListener: (fn) => L.startup.push(fn) },
      getURL: (p) => location.origin + '/' + p,
      getManifest: () => ({ version: VERSION })
    },
    storage, tabs, scripting, alarms,
    permissions: { contains: async () => true, request: async () => true }
    // no `windows`: the add-on then uses (hidden) tabs, which are hidden windows here
  });

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
  // first frame drawn → show the window (it starts hidden, so there is no white flash).
  // Not waiting for 'load': that also waits for every font and picture.
  document.addEventListener('DOMContentLoaded', () => {
    ready.then(() => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => invoke('app_ready').catch(() => {}))), 30));
  });

  // ---------- hooks called by the app side ----------
  let lastResume = 0;
  window.__appResume = () => {
    if (Date.now() - lastResume < 60000) return;   // not on every click on the tray icon
    lastResume = Date.now();
    chrome.runtime.sendMessage({ type: 'refresh', force: false, resume: true }).catch(() => {});
  };
  window.__appUpdateFailed = () => { try { window.__wissApp.openExternal(S.updateInfo.page); } catch (e) {} };
  window.__appTabClosed = (id) => { chrome.runtime.sendMessage({ type: 'tabClosed', id }).catch(() => {}); };
  window.addEventListener('pagehide', flush);
})();
