// WISS Stundenplan – iOS app bridge.
// The web bundle is the project's iPhone userscript, which expects the userscript manager's
// GM.* API. Inside this app the native side (NativeBridge.swift) provides it instead:
//   GM.xmlHttpRequest → native request, only to the hosts the userscript declares with @connect
//   GM.getValue/setValue/deleteValue → iOS Keychain (used for the sync master key)
// Plus what the Android app adds natively: notifications (lesson reminders, absence deadlines,
// new grades) and the home-screen widget.
// Runs in the same isolated content world as the bundle, so the school page never sees it.
(() => {
  'use strict';
  const native = (msg) => window.webkit.messageHandlers.wissGM.postMessage(msg);

  // ---------- GM.* (userscript manager) ----------
  function xmlHttpRequest(d) {
    const done = (fn, arg) => { if (typeof fn === 'function') try { fn(arg); } catch (e) { console.error(e); } };
    native({ op: 'xhr', method: d.method || 'GET', url: String(d.url), headers: d.headers || {},
             body: d.data == null ? null : String(d.data), timeout: d.timeout || 30000 })
      .then((r) => {
        const res = { status: r.status, statusText: '', responseText: r.text, response: r.text, finalUrl: r.url, responseHeaders: r.headers || '' };
        done(d.onload, res);
      })
      .catch((e) => {
        const m = String((e && e.message) || e);
        done(/timed?\s*out/i.test(m) ? (d.ontimeout || d.onerror) : d.onerror, { error: m, status: 0 });
      });
    return { abort() {} };
  }

  globalThis.GM = {
    xmlHttpRequest,
    getValue: async (key, def) => {
      const v = await native({ op: 'get', key: String(key) });
      if (v == null) return def;
      try { return JSON.parse(v); } catch (e) { return def; }
    },
    setValue: async (key, value) => { await native({ op: 'set', key: String(key), value: JSON.stringify(value) }); },
    deleteValue: async (key) => { await native({ op: 'delete', key: String(key) }); },
    info: { scriptHandler: 'WISS Stundenplan iOS' }
  };
  globalThis.GM_xmlhttpRequest = xmlHttpRequest;

  // ---------- notifications + widget (like the Android app) ----------
  // Same interface the add-on code uses for the Android app (globalThis.__wissApp).
  let perm = 'default';
  const setPerm = (p) => {
    if (!p || p === perm) return;
    perm = p;
    window.dispatchEvent(new CustomEvent('app-permission', { detail: p }));   // settings re-render
  };
  globalThis.__wissNativeNotify = true;
  globalThis.__wissApp = {
    notify: (id, title, body) => native({ op: 'notify', id: String(id), title: String(title), body: String(body || '') }).catch(() => {}),
    schedule: () => {}, widget: () => {}, setLang: () => {},
    permission: () => perm,
    requestPermission: () => native({ op: 'notifRequest' }).then(setPerm, () => {}),
    openExternal: (url) => native({ op: 'open', url: String(url) }).catch(() => {})
  };
  native({ op: 'notifStatus' }).then(setPerm, () => {});
  // "Erlauben" in the settings: the add-on only handles it for the Android app, so do it here
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-act="notif-perm"]')) globalThis.__wissApp.requestPermission();
  }, true);

  const cleanLabel = (l) => String(l || '').replace(/^[\d-]+\s*-\s*/, '').replace(/\s+Semester\s+\d+$/i, '').trim();
  const ms = (d) => { const t = new Date(d).getTime(); return Number.isFinite(t) ? t : null; };
  let C = null;

  // reminders: the add-on plans them itself (next 7 days) and stores the plan as `notifyPlan`.
  // The phone schedules them, so they also arrive when the app is closed.
  function schedule(plan) {
    native({ op: 'schedule', plan: (plan || []).map((r) => ({ id: String(r.id), at: +r.at, title: String(r.title || ''), body: String(r.body || ''), abs: r.abs ? String(r.abs) : null })) }).catch(() => {});
  }

  // home-screen widget: the next lessons with room and teacher (same data as on Android)
  let widgetT = 0;
  function pushWidget() {
    clearTimeout(widgetT);
    widgetT = setTimeout(async () => {
      if (!C) return;
      const { lessons = [], teachers = {}, prefs = {} } = await C.storage.local.get(['lessons', 'teachers', 'prefs']);
      const now = Date.now();
      const next = (Array.isArray(lessons) ? lessons : [])
        .map((l) => ({ l, s: ms(l.start), e: ms(l.end) }))
        .filter((x) => x.s != null && x.e != null && x.e > now)
        .sort((a, b) => a.s - b.s).slice(0, 40)
        .map(({ l, s, e }) => ({ s, e, t: cleanLabel(l.label), r: (l.room || '').split(',')[0].trim(), p: teachers['l:' + l.label] || '' }));
      native({ op: 'widget', data: { lang: prefs.lang || 'de', accent: prefs.accent || '', style: prefs.style || 'standard', lessons: next } }).catch(() => {});
    }, 300);
  }

  // absence reminders come only once: tell the add-on which ones the phone already showed
  async function markFiredAbsences() {
    if (!C) return;
    try {
      const fired = await native({ op: 'firedAbs' });
      if (!fired || !fired.length) return;
      const { notifiedAbs = {} } = await C.storage.local.get('notifiedAbs');
      let changed = false;
      for (const id of fired) if (!notifiedAbs[id]) { notifiedAbs[id] = Date.now(); changed = true; }
      if (changed) await C.storage.local.set({ notifiedAbs });
    } catch (e) { /* not ready */ }
  }

  // The adapter sets window.chrome once; extend it right then, before the add-on starts.
  function extend(c) {
    if (!c || !c.storage || c.__wissNative) return;
    c.__wissNative = true;
    c.notifications = {
      create: async (id, o) => { globalThis.__wissApp.notify(id, (o && o.title) || '', (o && o.message) || ''); return id; },
      clear: async () => true
    };
    if (c.alarms) {
      const create = c.alarms.create.bind(c.alarms);
      c.alarms.create = (name, o) => (String(name).startsWith('n:') ? undefined : create(name, o));   // reminders: the phone does it
      c.alarms.getAll = async () => [];
    }
    c.storage.onChanged.addListener((ch) => {
      if (ch.notifyPlan) schedule(ch.notifyPlan.newValue);
      if (ch.lessons || ch.teachers || ch.prefs) pushWidget();
    });
    setTimeout(() => { pushWidget(); markFiredAbsences(); }, 1000);
  }
  Object.defineProperty(window, 'chrome', {
    configurable: true, enumerable: true,
    get: () => C,
    set: (v) => { C = v; try { extend(v); } catch (e) { console.error(e); } }
  });

  // called by the app when it comes back to the front / from a notification
  globalThis.__wissNativeResume = () => {
    native({ op: 'notifStatus' }).then(setPerm, () => {});
    markFiredAbsences();
    pushWidget();
  };
  globalThis.__wissNativeOpenTab = (tab) => {
    try {
      const wrap = document.getElementById('sheetWrap');
      if (wrap && !wrap.hidden) document.getElementById('scrim').click();
      const b = document.querySelector('#tabs [data-tab="' + tab + '"]');
      if (b) b.click();
    } catch (e) { /* app not ready */ }
  };
})();
