// Real Chrome extension smoke test. Chrome's extension-debugging API avoids deprecated load flags.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url)), extension = path.join(root, 'chrome addon');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wiss-sync-extension-'));
const context = await chromium.launchPersistentContext(profile, { executablePath: process.env.BROWSER_EXECUTABLE, headless: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] });
try {
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension });
  let worker = context.serviceWorkers().find((w) => w.url().includes(id));
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    globalThis.__syncContacts = 0;
    globalThis.fetch = async (url) => {
      if (String(url).includes('.onrender.com')) globalThis.__syncContacts++;
      return new Response(JSON.stringify(String(url).includes('/nice2/username') ? { username: 'anonymous' } : {}), { status: String(url).includes('api.github.com') ? 404 : 200 });
    };
    await chrome.storage.local.set({ setupDone: true, status: 'ok', lastSync: Date.now(), teachersDone: Date.now(), user: { username: 'synthetic' }, lessons: [], notes: { demo: 'Only local' }, prefs: { targetGrade: 5 } });
  });
  const errors = [], p = await context.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('chrome-extension://' + id + '/popup.html?full'); await p.click('#btnSettings');
  await p.click('[data-act=pref][data-k=targetGrade][data-v="5.5"]');
  let state;
  for (let i = 0; i < 50; i++) {
    state = await worker.evaluate(() => chrome.storage.local.get(['prefs', 'syncMeta']));
    if (state.syncMeta?.doc.settings.targetGrade?.value === 5.5) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(state.prefs.targetGrade, 5.5); assert.equal(state.syncMeta.doc.settings.targetGrade.value, 5.5);
  assert.equal(await p.locator('#syncServer').count(), 1);
  assert.equal(await worker.evaluate(() => globalThis.__syncContacts), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: real extension service worker, script imports, popup, settings, persisted per-field edits and no sync traffic before consent.');
} finally { await context.close(); fs.rmSync(profile, { recursive: true, force: true }); }
