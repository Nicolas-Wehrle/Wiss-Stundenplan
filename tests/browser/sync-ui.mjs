// Browser integration with synthetic school data, a native bridge stub and the real HTTP sync server.
// PLAYWRIGHT_MODULE may point to an installed playwright package directory.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DurableStore } from '../../sync-server/store.mjs';
import { createServer } from '../../sync-server/server.mjs';
import { FakeRepository } from '../sync/helpers.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url)), web = path.join(root, 'android app/app/src/main/assets/web');
const out = path.join(root, 'tests/browser/artifacts'); fs.mkdirSync(out, { recursive: true });
const repo = new FakeRepository(), store = new DurableStore(repo, { debounceMs: 5, maxWaitMs: 10 }), server = createServer(store);
server.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
const b = await chromium.launch(), errors = []; let syncRequests = 0;
async function waitData(page, predicate) {
  for (let i = 0; i < 200; i++) {
    try { if (await page.evaluate(predicate)) return; }
    catch (e) { if (!e.message.includes('chrome is not defined') && !e.message.includes('Execution context was destroyed')) throw e; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for synthetic sync state: ' + JSON.stringify(await page.evaluate(() => chrome.storage.local.get(['notes', 'deviceSync']))));
}
async function device(style, platform = 'android') {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: platform === 'ios' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36' });
  await c.addInitScript(({ style }) => {
    let data = { __appVersion: '1.11.0', setupDone: true, user: 'synthetic', teachersDone: Date.now(), status: 'ok', lessons: [], notes: { demo: 'Synthetic note' }, prefs: { style, theme: 'light' } };
    window.AndroidStore = { get: () => JSON.stringify(data), set: (p) => { Object.assign(data, JSON.parse(p)); }, clear: () => { data = {}; } };
    window.AndroidTab = { result: (id, json) => window.__hostResult(id, json) };
    window.AndroidHost = {
      tabCreate: () => 1, tabInfo: () => JSON.stringify({ id: 1, url: 'https://wiss.tocco.ch/extranet/', status: 'complete' }), tabUpdate() {}, tabShow() {}, tabRemove() {},
      exec: (_tab, _id, code) => { (0, eval)(code); }, notify() {}, schedule() {}, widgetData() {}, setLang() {}, notifPermission: () => 'granted', requestNotifPermission() {}, installUpdate() {}, openExternal() {}
    };
  }, { style });
  if (platform === 'ios') {
    const privateValues = new Map();
    await c.exposeBinding('__gmGet', (_, key) => privateValues.get(key) ?? null);
    await c.exposeBinding('__gmSet', (_, key, value) => { privateValues.set(key, value); });
    await c.exposeBinding('__gmDelete', (_, key) => { privateValues.delete(key); });
    await c.addInitScript({ content: `if (location.hostname === 'wiss.tocco.ch' && window.top === window) {
      if (!localStorage.getItem('wiss:store')) localStorage.setItem('wiss:store', JSON.stringify({ __appVersion: '1.11.0', setupDone: true, user: 'synthetic', teachersDone: Date.now(), notes: {}, prefs: { style: 'paper' } }));
      window.GM = { getValue: (k) => window.__gmGet(k), setValue: (k,v) => window.__gmSet(k,v), deleteValue: (k) => window.__gmDelete(k), xmlHttpRequest: (o) => o.onerror?.() };
      ${fs.readFileSync(path.join(root, 'iphone/WISS-Stundenplan.user.js'), 'utf8')}
    }` });
  }
  await c.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname.endsWith('.onrender.com')) {
      syncRequests++;
      const response = await fetch('http://127.0.0.1:' + server.address().port + u.pathname, { method: req.method(), headers: req.headers(), ...(req.postData() ? { body: req.postData() } : {}) });
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    }
    if (u.hostname === 'wiss.tocco.ch' && u.pathname.startsWith('/__wissapp/')) {
      const name = u.pathname.slice('/__wissapp/'.length), file = path.join(web, name);
      if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.woff2') ? 'font/woff2' : 'application/javascript', body: fs.readFileSync(file) });
    }
    if (u.pathname === '/nice2/username') return route.fulfill({ json: { username: 'synthetic', userEntityPk: '123', success: true, timeout: 30 } });
    if (u.pathname.startsWith('/nice2/rest/')) return route.fulfill({ json: { data: [], _links: {} } });
    if (platform === 'ios' && u.pathname.startsWith('/extranet/')) return route.fulfill({ contentType: 'text/html', body: '<html><body>School placeholder</body></html>' });
    return route.fulfill({ status: 404, body: '' });
  });
  const p = await c.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(platform === 'ios' ? 'https://wiss.tocco.ch/extranet/?stundenplan' : 'https://wiss.tocco.ch/__wissapp/popup.html', { waitUntil: 'commit' });
  await waitData(p, async () => { const s = await chrome.storage.local.get(['status', 'lastSync']); return s.status === 'ok' && s.lastSync; });
  await p.click('#btnSettings'); return p;
}
try {
  const a = await device('standard'); assert.equal(syncRequests, 0);
  await a.locator('#set-sync').screenshot({ path: path.join(out, 'disabled.png') });
  await a.click('[data-act=device-enable]'); await a.waitForSelector('#syncRecovery');
  const recovery = await a.inputValue('#syncRecovery'); assert.match(recovery, /^WISS1\./);
  await a.waitForFunction(() => S.deviceSync?.status === 'synced');
  assert.equal(await a.locator('#syncQR svg').count(), 1);
  await a.locator('#set-sync').screenshot({ path: path.join(out, 'connected.png') });
  const second = await device('nothing'); await second.locator('summary').filter({ hasText: 'Mit vorhandenem Code' }).click();
  await second.fill('#syncJoin', recovery); await second.click('[data-act=device-join]');
  await second.waitForFunction(() => S.deviceSync?.status === 'synced');
  await a.evaluate(() => chrome.runtime.sendMessage({ type: 'deviceSyncWrite', patch: { notes: { demo: 'Changed on A' }, prefs: { targetGrade: 5.5 } } }));
  await a.click('[data-act=device-now]'); await a.waitForFunction(() => S.deviceSync?.status === 'synced');
  await second.click('[data-act=device-now]'); await second.waitForFunction(() => S.notes.demo === 'Changed on A');
  assert.equal(await second.evaluate(() => S.prefs.style), 'nothing');
  await second.evaluate(() => { setPref('lang', 'en'); applyLook(); render(); });
  await second.waitForFunction(() => document.documentElement.lang === 'en');
  assert.match(await second.locator('#set-sync').innerText(), /Device sync/);
  await second.locator('#set-sync').screenshot({ path: path.join(out, 'english.png') });
  const ios = await device('paper', 'ios');
  await ios.locator('summary').filter({ hasText: 'Mit vorhandenem Code' }).click();
  await ios.fill('#syncJoin', recovery); await ios.click('[data-act=device-join]');
  await waitData(ios, async () => { const s = await chrome.storage.local.get(['notes', 'deviceSync']); return s.deviceSync?.status === 'synced' && s.notes?.demo === 'Changed on A'; });
  const iosState = await ios.evaluate(async () => chrome.storage.local.get(['notes', 'deviceSync', 'syncMeta']));
  assert.equal(iosState.notes.demo, 'Changed on A', JSON.stringify(iosState));
  const master = recovery.split('.')[2];
  assert.equal(await ios.evaluate((key) => JSON.stringify(localStorage).includes(key), master), false);
  await ios.evaluate(() => chrome.runtime.sendMessage({ type: 'deviceSyncWrite', patch: { notes: { iphone: 'From iPhone' } } }));
  await ios.click('[data-act=device-now]'); await waitData(ios, async () => (await chrome.storage.local.get('deviceSync')).deviceSync?.status === 'synced');
  await a.click('[data-act=device-now]'); await a.waitForFunction(() => S.notes.iphone === 'From iPhone');
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await a.click('[data-act=device-delete]'); await a.click('[data-act=device-delete-confirm]'); await a.waitForSelector('[data-act=device-enable]');
  assert.equal(repo.records.size, 0);
  await second.click('[data-act=device-now]'); await second.waitForFunction(() => S.deviceSync?.error === 'account-gone');
  assert.equal(repo.records.size, 0); assert.equal(await second.evaluate(() => S.notes.demo), 'Changed on A');
  assert.deepEqual(errors, []); console.log('PASS: Android + iPhone adapters, opt-in, QR, linking, private GM key storage, merging, appearance, English, mobile layout and deletion; no traffic before opt-in.');
} finally { await b.close(); await store.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); }
