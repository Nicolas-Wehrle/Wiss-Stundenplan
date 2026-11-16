// Real generated desktop page (desktop app/web) with a synthetic Tauri side.
// Run `node "desktop app/build-desktop-web.mjs"` first.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url)), web = path.join(root, 'desktop app/web');
const version = JSON.parse(fs.readFileSync(path.join(root, 'chrome addon/manifest.json'), 'utf8')).version;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  await context.addInitScript(() => {
    // the Rust side, in miniature: store, tabs that run code in this page, native http, extras
    let data = JSON.parse(localStorage.getItem('__desktopStore') || 'null') || { privacyOk: true };
    const save = () => localStorage.setItem('__desktopStore', JSON.stringify(data));
    const log = (window.__calls = []);
    window.__origFetch = window.fetch.bind(window);   // "the hidden page" fetches directly
    const tabs = new Map(); let next = 1;
    window.__wissTab = { result: (id, json) => setTimeout(() => window.__hostResult(id, json), 0) };
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, a) => {
        log.push(cmd);
        switch (cmd) {
          case 'store_load': return JSON.parse(JSON.stringify(data));
          case 'store_set': Object.assign(data, a.patch); save(); return null;
          case 'store_replace': data = JSON.parse(JSON.stringify(a.data)); save(); return null;
          case 'tab_create': { const id = next++; tabs.set(id, { id, url: a.url, status: 'complete', internal: !!a.internal }); return id; }
          case 'tab_info': return tabs.get(a.id) || null;
          case 'tab_remove': tabs.delete(a.id); return null;
          case 'tab_exec': (0, eval)(a.code.replace('() => location.origin', '() => "https://wiss.tocco.ch"').replace('await fetch(', 'await window.__origFetch('));  return null;   // "the tab" is this test page
          case 'http': return { status: 200, status_text: 'OK', headers: [['content-type', 'application/json']], body: JSON.stringify({ native: a.req.url }) };
          case 'app_ready': window.__ready = true; return null;
          default: return null;
        }
      }
    };
  });
  let school = 0;
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'tauri.localhost') {
      const file = path.join(web, u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
      if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.png') ? 'image/png' : 'application/javascript', body: fs.readFileSync(file) });
    }
    if (u.hostname === 'wiss.tocco.ch') { school++; return route.fulfill({ json: { username: 'anonymous', success: true }, headers: { 'access-control-allow-origin': 'http://tauri.localhost', 'access-control-allow-credentials': 'true' } }); }
    return route.fulfill({ status: 404, body: '' });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://tauri.localhost/index.html', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__ready === true);
  assert.equal(await page.evaluate(() => location.search), '?full');
  assert.equal(await page.evaluate(() => chrome.runtime.getManifest().version), version);
  assert.equal(await page.evaluate(() => PLATFORM), 'desktop');

  // school requests go through a hidden wiss.tocco.ch page, other sites through the app
  const bridged = await page.evaluate(async () => { const r = await fetch('https://wiss.tocco.ch/nice2/username?x=1', { credentials: 'include' }); return [r.status, (await r.json()).username]; });
  assert.deepEqual(bridged, [200, 'anonymous']);
  const native = await page.evaluate(async () => (await (await fetch('https://api.github.com/repos/x/y/releases/latest')).json()).native);
  assert.equal(native, 'https://api.github.com/repos/x/y/releases/latest');
  const aborted = await page.evaluate(async () => { const c = new AbortController(); c.abort(); try { await fetch('https://wiss.tocco.ch/nice2/username', { signal: c.signal }); return 'no'; } catch (e) { return e.name; } });
  assert.equal(aborted, 'AbortError');

  // demo: every view, no school traffic, data survives a reload through the store
  await page.getByRole('button', { name: 'Demokonto testen', exact: true }).click();
  await page.getByRole('button', { name: 'Demo beenden', exact: true }).waitFor();
  school = 0;
  for (const tab of ['week', 'exams', 'grades', 'absences', 'rooms']) await page.locator('#tabs button[data-tab=' + tab + ']').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => chrome.storage.local.set({ notes: { demo: 'Synthetic desktop note' } }));
  await page.waitForTimeout(50);
  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  assert.equal((await page.evaluate(() => chrome.storage.local.get('notes'))).notes.demo, 'Synthetic desktop note');
  assert.equal(school, 0);
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'demoExit' }));
  const state = await page.evaluate(() => chrome.storage.local.get(null));
  assert.equal(state.demoMode, undefined); assert.equal(state.lessons, undefined);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('__desktopStore')).demoMode), undefined);
  assert.deepEqual(errors, []);
  console.log('PASS: desktop ' + version + ' shim: store, hidden-page requests, native requests, abort, demo views, reload, exit cleanup.');
} finally { await browser.close(); }
