// Step 1: real screenshots of the add-on in the demo account (invented data only).
// Writes store-assets-src/shots/*.png (German) and shots-en/*.png (English, for the README), used by make.mjs.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.dirname(here);
for (const lang of ['de', 'en']) {
const out = path.join(here, lang === 'en' ? 'shots-en' : 'shots');
fs.mkdirSync(out, { recursive: true });
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'wiss-store-')), {
  executablePath: process.env.BROWSER_EXECUTABLE, headless: true, ignoreDefaultArgs: ['--disable-extensions'],
  args: ['--enable-unsafe-extension-debugging'], viewport: { width: 1120, height: 720 }, deviceScaleFactor: 2,
});
try {
  const cdp = await ctx.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: root + '/chrome addon' });
  let worker = ctx.serviceWorkers().find((w) => w.url().includes(id)); if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  await worker.evaluate(async () => {
    globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).includes('/nice2/username') ? { username: 'anonymous' } : {}), { status: String(url).includes('api.github.com') ? 404 : 200 });
    await chrome.storage.local.set({ privacyOk: true });
    let seed = 20261117; // same invented demo data on every run
    Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  const hide = '.banner{display:none!important}';
  const p = await ctx.newPage();
  await p.goto(`chrome-extension://${id}/popup.html?full`);
  await p.getByRole('button', { name: 'Demokonto testen', exact: true }).click();
  await p.getByRole('button', { name: 'Demo beenden', exact: true }).waitFor();
  if (lang === 'en') {
    await worker.evaluate(async () => { const { prefs } = await chrome.storage.local.get('prefs'); await chrome.storage.local.set({ prefs: { ...(prefs || {}), lang: 'en' } }); });
    await p.reload(); await p.locator('#tabs').waitFor(); await p.waitForTimeout(500);
  }
  await p.addStyleTag({ content: hide });
  const shoot = async (tab, name) => {
    await p.locator(`#tabs button[data-tab=${tab}]`).click(); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(out, name + '.png') });
  };
  const facts = {};
  for (const t of ['week', 'exams', 'grades', 'absences', 'rooms']) {
    await shoot(t, t);
    if (t === 'exams') facts.exam = await p.evaluate(() => ({ days: document.querySelector('.xcount b')?.textContent, kicker: document.querySelector('.xhm .kicker')?.textContent.trim(), title: document.querySelector('.xhm .title')?.textContent, meta: document.querySelector('.xhm .meta')?.textContent }));
    if (t === 'absences') facts.abs = await p.evaluate(() => document.querySelector('.section-title.todo')?.nextElementSibling?.innerText.split('\n').map((x) => x.trim()).filter(Boolean));
    if (t === 'rooms') facts.rooms = await p.evaluate(() => ({ time: (document.querySelector('.rhero .k')?.textContent.match(/\d{1,2}:\d\d/) || [])[0], free: document.querySelector('.rhero .v')?.firstChild?.textContent.trim(), total: document.querySelector('.rhero .v small')?.textContent.replace(/\D/g, ''), chips: [...document.querySelectorAll('.rhero .rchip b')].map((b) => b.textContent) }));
    if (t === 'grades') Object.assign(facts, await p.evaluate(() => ({ avg: document.querySelector('.gval')?.textContent, done: +(document.body.innerText.match(/(?:Abgeschlossen|Completed)\s*(\d+)/) || [])[1] })));
  }
  fs.writeFileSync(path.join(out, 'facts.json'), JSON.stringify(facts, null, 1));
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(300);
  await shoot('week', 'week-dark');
  await shoot('rooms', 'rooms-dark');
  // the toolbar popup itself
  const q = await ctx.newPage(); await q.setViewportSize({ width: 420, height: 600 });
  for (const [mode, sfx] of [['light', ''], ['dark', '-dark']]) {
    await q.emulateMedia({ colorScheme: mode });
    await q.goto(`chrome-extension://${id}/popup.html`); await q.addStyleTag({ content: hide });
    await q.locator('#tabs button[data-tab=week]').click(); await q.waitForTimeout(700);
    await q.screenshot({ path: path.join(out, 'popup' + sfx + '.png') });
  }
  console.log('shots in', out);
} finally { await ctx.close(); }
}
