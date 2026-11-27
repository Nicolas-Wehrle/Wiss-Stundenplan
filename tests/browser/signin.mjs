// Sign-in, connection and reset behaviour with synthetic data only:
// - nothing pops up by itself, the top says "Anmeldung nötig", only ↻ shows a sign-in page
// - no internet / far too slow → "Kein Internet" / "Schlechte Verbindung", no sign-in attempt
// - "Alles löschen" signs the Android and desktop apps out
// Run the Android and desktop web builds first (see DEVELOPMENT.md). Takes about a minute.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const version = JSON.parse(fs.readFileSync(path.join(root, 'chrome addon/manifest.json'), 'utf8')).version;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000, what = 'condition') => {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out waiting for ' + what); await sleep(150); }
};
const statusText = (page) => page.locator('#status').innerText();
const mime = (f) => (f.endsWith('.html') ? 'text/html' : f.endsWith('.css') ? 'text/css' : f.endsWith('.woff2') ? 'font/woff2' : f.endsWith('.png') ? 'image/png' : 'application/javascript');
const serve = (route, dir, rel) => {
  const file = path.join(dir, rel || 'index.html');
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ contentType: mime(file), body: fs.readFileSync(file) });
};
const known = { privacyOk: true, setupDone: true, user: { username: 'synthetic' }, lessons: [], status: 'ok', lastSync: 1, teachersDone: Date.now() };

// ---------------------------------------------------------------- 1. Chrome extension (quiet mode)
{
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wiss-signin-'));
  const context = await chromium.launchPersistentContext(profile, { executablePath: process.env.BROWSER_EXECUTABLE, headless: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] });
  try {
    await context.route('https://wiss.tocco.ch/**', (r) => r.fulfill({ contentType: 'text/html', body: '<html><body>School placeholder</body></html>' }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.join(root, 'chrome addon') });
    let worker = context.serviceWorkers().find((w) => w.url().includes(id));
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await worker.evaluate(async (state) => {
      globalThis.__net = 'anon';
      globalThis.fetch = async (url) => {
        if (globalThis.__net === 'offline') throw new TypeError('Failed to fetch');
        if (globalThis.__net === 'slow') throw new DOMException('The operation timed out.', 'TimeoutError');
        return new Response(JSON.stringify(String(url).includes('/nice2/username') ? { username: 'anonymous' } : {}), { status: String(url).includes('api.github.com') ? 404 : 200 });
      };
      await chrome.storage.local.set(state);
    }, known);
    const errors = [], p = await context.newPage(); p.on('pageerror', (e) => errors.push(e.message));
    const startPages = context.pages().length;   // a persistent profile also has its own blank page
    await p.goto('chrome-extension://' + id + '/popup.html?full');
    await until(async () => /Anmeldung nötig/.test(await statusText(p)), 20000, 'Anmeldung nötig');
    assert.match(await statusText(p), /↻ zum Anmelden/);
    assert.equal(await p.locator('#banner [data-act=login]').count(), 0, 'no sign-in banner');
    await sleep(1500);
    assert.equal(context.pages().length, startPages, 'nothing opened by itself: ' + context.pages().map((x) => x.url()).join(', '));

    // ↻ → the sign-in page opens
    const opened = context.waitForEvent('page');
    await p.click('#btnRefresh');
    const login = await opened;
    await until(() => login.url().includes('wiss.tocco.ch/extranet/'), 10000, 'sign-in page');
    await login.close();

    // no internet → said so, nothing opens even with ↻
    await worker.evaluate(() => { globalThis.__net = 'offline'; });
    const before = context.pages().length;
    await p.click('#btnRefresh');
    await until(async () => /Kein Internet/.test(await statusText(p)), 10000, 'Kein Internet');
    assert.equal((await worker.evaluate(() => chrome.storage.local.get('status'))).status, 'offline');
    await sleep(1000);
    assert.equal(context.pages().length, before, 'no sign-in page while offline');

    // far too slow → "Schlechte Verbindung"
    await worker.evaluate(() => { globalThis.__net = 'slow'; });
    await p.click('#btnRefresh');
    await until(async () => /Schlechte Verbindung/.test(await statusText(p)), 10000, 'Schlechte Verbindung');

    // English
    await worker.evaluate(() => chrome.storage.local.get('prefs').then(({ prefs }) => chrome.storage.local.set({ prefs: { ...(prefs || {}), lang: 'en' } })));
    await p.reload();
    await until(async () => /Bad connection/.test(await statusText(p)), 10000, 'Bad connection');
    assert.deepEqual(errors, []);
    console.log('PASS: extension: no pop-up or banner, "Anmeldung nötig" at the top, ↻ opens the sign-in, offline and slow connection, English.');
  } finally { await context.close(); fs.rmSync(profile, { recursive: true, force: true }); }
}

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
try {
  // ---------------------------------------------------------------- 2. Android app page
  {
    const web = path.join(root, 'android app/app/src/main/assets/web');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(({ version, known }) => {
      let data = { ...known, __appVersion: version, lastSync: 1 };
      const log = (window.__native = { created: [], shown: [], signOut: 0 });
      const tabs = {}; let next = 1;
      window.AndroidStore = { get: () => JSON.stringify(data), set: (j) => Object.assign(data, JSON.parse(j)), clear: () => { data = {}; } };
      window.AndroidHost = {
        // a hidden sign-in where Microsoft waits for the user
        tabCreate: (url, active) => { const id = next++; tabs[id] = { id, url: 'https://login.microsoftonline.com/x', status: 'complete' }; log.created.push({ id, active }); return id; },
        tabInfo: (id) => (tabs[id] ? JSON.stringify(tabs[id]) : ''),
        tabUpdate() {}, tabShow: (id) => log.shown.push(id), tabRemove: (id) => { delete tabs[id]; }, exec() {},
        notify() {}, schedule() {}, widgetData() {}, setLang() {}, notifPermission: () => 'granted', requestNotifPermission() {}, installUpdate() {}, openExternal() {}, setBars() {},
        signOut: () => { log.signOut++; },
      };
      window.AndroidTab = { result() {} };
    }, { version, known });
    let net = 'anon';
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname !== 'wiss.tocco.ch') return route.fulfill({ status: 404, body: '' });
      if (u.pathname.startsWith('/__wissapp/')) return serve(route, web, u.pathname.slice('/__wissapp/'.length));
      if (u.pathname === '/nice2/username') return net === 'offline' ? route.abort('internetdisconnected') : route.fulfill({ json: { username: 'anonymous' } });
      return route.fulfill({ json: { data: [] } });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('https://wiss.tocco.ch/__wissapp/popup.html', { waitUntil: 'commit' });
    // the silent sign-in runs hidden; Microsoft "waits" → after ~12 s it stays hidden
    await until(() => page.evaluate(() => window.__native.created.length === 1), 15000, 'hidden sign-in');
    assert.equal(await page.evaluate(() => window.__native.created[0].active), false);
    await until(async () => /Anmeldung nötig/.test(await statusText(page)), 25000, 'Anmeldung nötig');
    assert.deepEqual(await page.evaluate(() => window.__native.shown), [], 'nothing shown by itself');
    assert.equal(await page.locator('#banner [data-act=login]').count(), 0);
    // a page the app closed itself → no new sign-in
    await page.evaluate(() => window.__appTabClosed(999));
    await sleep(1500);
    assert.equal(await page.evaluate(() => window.__native.created.length), 1);
    // ↻ → the waiting page is shown, no second one
    await page.click('#btnRefresh');
    await until(() => page.evaluate(() => window.__native.shown.length > 0), 5000, 'tabShow');
    assert.equal(await page.evaluate(() => window.__native.shown[0]), 1);
    assert.equal(await page.evaluate(() => window.__native.created.length), 1);
    // offline
    net = 'offline';
    await page.click('#btnRefresh');
    await until(async () => /Kein Internet/.test(await statusText(page)), 10000, 'Kein Internet');
    // Alles löschen → signed out
    const r = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'deviceSyncReset' }));
    assert.equal(r.ok, true);
    assert.equal(await page.evaluate(() => window.__native.signOut), 1);
    assert.deepEqual(await page.evaluate(() => chrome.storage.local.get('user')), {});
    assert.deepEqual(errors, []);
    console.log('PASS: android: hidden sign-in never shown by itself, ↻ shows it, own closes ignored, offline, "Alles löschen" signs out.');
    await context.close();
  }

  // ---------------------------------------------------------------- 3. desktop app page
  {
    const web = path.join(root, 'desktop app/web');
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    await context.addInitScript((version) => {
      // __appVersion: a normal start, not a fresh install (that one waits for the setup screen)
      let data = { privacyOk: true, setupDone: true, lessons: [], status: 'ok', lastSync: 1, __appVersion: version };
      const log = (window.__calls = []);
      const tabs = new Map(); let next = 1;
      window.__origFetch = window.fetch.bind(window);
      window.__wissTab = { result: (id, json) => setTimeout(() => window.__hostResult(id, json), 0) };
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd, a) => {
          log.push({ cmd, active: a && a.active, internal: a && a.internal });
          switch (cmd) {
            case 'store_load': return JSON.parse(JSON.stringify(data));
            case 'store_set': Object.assign(data, a.patch); return null;
            case 'store_replace': data = JSON.parse(JSON.stringify(a.data)); return null;
            case 'tab_create': { const id = next++; tabs.set(id, { id, url: a.url, status: 'complete' }); return id; }
            case 'tab_info': return tabs.get(a.id) || null;
            case 'tab_remove': tabs.delete(a.id); return null;
            case 'tab_exec': (0, eval)(a.code.replace('() => location.origin', '() => "https://wiss.tocco.ch"').replace('await fetch(', 'await window.__origFetch(')); return null;
            case 'http': return { status: 404, status_text: 'Not Found', headers: [], body: '' };
            case 'app_ready': window.__ready = true; return null;
            default: return null;
          }
        }
      };
    }, version);
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === 'tauri.localhost') return serve(route, web, u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
      if (u.hostname === 'wiss.tocco.ch') return route.fulfill({ json: { username: 'anonymous' }, headers: { 'access-control-allow-origin': 'http://tauri.localhost', 'access-control-allow-credentials': 'true' } });
      return route.fulfill({ status: 404, body: '' });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://tauri.localhost/index.html', { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__ready === true);
    const visibleTabs = () => page.evaluate(() => window.__calls.filter((c) => (c.cmd === 'tab_create' && c.active && !c.internal) || c.cmd === 'tab_show').length);
    // never signed in here → no hidden attempt, nothing visible
    await until(async () => /Anmeldung nötig/.test(await statusText(page)), 20000, 'Anmeldung nötig');
    await sleep(1000);
    assert.equal(await visibleTabs(), 0, 'nothing shown by itself');
    // ↻ → a visible sign-in window
    await page.click('#btnRefresh');
    await until(async () => (await visibleTabs()) === 1, 15000, 'visible sign-in window');
    // Alles löschen → sign_out
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'deviceSyncReset' }));
    assert.equal(await page.evaluate(() => window.__calls.filter((c) => c.cmd === 'sign_out').length), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop ' + version + ': nothing shown by itself, ↻ opens the sign-in window, "Alles löschen" signs out.');
    await context.close();
  }
} finally { await browser.close(); }
