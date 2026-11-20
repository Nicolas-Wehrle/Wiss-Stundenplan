// Custom themes: import, cleaning, live editor preview, sync pref, guard, ?safe.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/[/\\]$/, ''), out = root + '/tests/browser/artifacts/themes';
fs.mkdirSync(out, { recursive: true });
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(out + '/profile-'), { executablePath: process.env.BROWSER_EXECUTABLE, headless: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'], viewport: { width: 1280, height: 800 } });
try {
  const cdp = await ctx.browser().newBrowserCDPSession(); const { id } = await cdp.send('Extensions.loadUnpacked', { path: root + '/chrome addon' });
  let worker = ctx.serviceWorkers().find((w) => w.url().includes(id)); if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  await worker.evaluate(async () => { globalThis.calls = []; globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(JSON.stringify(String(url).includes('/nice2/username') ? { username: 'anonymous' } : {}), { status: String(url).includes('api.github.com') ? 404 : 200 }); }; await chrome.storage.local.set({ privacyOk: true }); });
  const p = await ctx.newPage(), errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const base = 'chrome-extension://' + id + '/popup.html?full';
  await p.goto(base); await p.getByRole('button', { name: 'Demokonto testen', exact: true }).click();
  await p.getByRole('button', { name: 'Demo beenden', exact: true }).waitFor();
  const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const before = await bg();

  // import an example theme
  await p.locator('#btnSettings').click(); await p.locator('[data-act=setnav][data-sec=look]').click();
  await p.locator('#themeFile').setInputFiles(root + '/themes/mitternacht.css');
  await p.locator('.theme-row.on').getByText('Mitternacht').waitFor();
  assert.equal(await bg(), 'rgb(10, 15, 31)');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.mode), 'dark');
  let st = await worker.evaluate(() => chrome.storage.local.get(['prefs', 'themeLibrary']));
  assert.equal(st.themeLibrary.length, 1); assert.equal(st.prefs.customTheme.name, 'Mitternacht'); assert.ok(st.prefs.customTheme.source.includes('--bg: #0a0f1f'));
  await p.locator('.theme-sec').scrollIntoViewIfNeeded(); await p.screenshot({ path: out + '/imported.png' });

  // the cache paints it before the first render
  await p.reload(); assert.equal(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(10, 15, 31)');

  // editor: live preview + removal of internet links
  await p.locator('#btnSettings').click(); await p.locator('[data-act=setnav][data-sec=look]').click();
  await p.locator('[data-act=theme-new]').click();
  const bad = '/* @name Böse */\n@import url("https://evil.example/x.css");\n:root{--bg:#123456}\nbody{background-image:url(https://evil.example/p.png)}\n.x{background:\\75 rl(https://evil.example)}';
  await p.locator('#themeCode').fill(bad.replace(/\n\.x.*$/, ''));
  await p.waitForTimeout(400);
  assert.equal(await bg(), 'rgb(18, 52, 86)');
  const css = await p.evaluate(() => document.getElementById('customThemeStyle').textContent);
  assert.ok(!css.includes('evil.example'), css); assert.ok(!/@import/i.test(css));
  await p.locator('#themeCode').fill(bad); await p.waitForTimeout(400);
  await p.locator('[data-act=theme-save]').click();
  await p.locator('.theme-ed-msg.bad, .shint.bad').first().waitFor();
  await p.locator('[data-act=theme-cancel]').click();
  assert.equal(await bg(), 'rgb(10, 15, 31)'); // preview gone, active theme back

  // guard: a theme that hides the settings button is paused
  await p.locator('[data-act=theme-new]').click();
  await p.locator('#themeCode').fill('/* @name Versteckt */\n#btnSettings{display:none !important}');
  await p.waitForTimeout(350); await p.locator('[data-act=theme-save]').click();
  await p.getByText('Theme pausiert', { exact: true }).waitFor({ timeout: 3000 });
  assert.ok(await p.locator('#btnSettings').isVisible());
  await p.locator('[data-act=setup-done], button:has-text("Fertig")').first().click().catch(() => {});

  // no theme + ?safe
  await p.goto(base); await p.locator('#btnSettings').click(); await p.locator('[data-act=setnav][data-sec=look]').click();
  await p.locator('[data-act=theme-off]').click();
  assert.equal(await bg(), before);
  st = await worker.evaluate(() => chrome.storage.local.get('prefs')); assert.equal(st.prefs.customTheme, null);
  await p.locator('.theme-row', { hasText: 'Mitternacht' }).locator('[data-act=theme-toggle]').click();
  await p.goto(base + '&safe'); await p.waitForTimeout(500);
  assert.equal(await bg(), before);
  assert.ok(await p.evaluate(() => !document.getElementById('customThemeStyle') || !document.getElementById('customThemeStyle').textContent));

  // narrow popup layout
  await p.setViewportSize({ width: 400, height: 600 }); await p.goto('chrome-extension://' + id + '/popup.html');
  await p.locator('#btnSettings').click(); await p.locator('[data-act=setnav][data-sec=look]').click().catch(() => {});
  await p.locator('.theme-sec').scrollIntoViewIfNeeded(); await p.screenshot({ path: out + '/popup-narrow.png' });
  assert.equal(await worker.evaluate(() => calls.filter((u) => u.includes('evil.example')).length), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: theme import, early paint, editor preview, link removal, escape refusal, guard, no theme, safe mode.');
} finally { await ctx.close(); }
