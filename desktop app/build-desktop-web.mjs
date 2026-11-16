#!/usr/bin/env node
// Copies the add-on (Chrome version = source of truth) into the desktop app's web/ folder.
// Tauri runs this before every build (see src-tauri/tauri.conf.json); by hand: node build-desktop-web.mjs
// Same idea as android app/build-android-web.py: the app shows the add-on's own files,
// web-src/desktop-shim.js gives them the browser APIs they expect.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'chrome addon');
const web = path.join(here, 'web');
// Windows checkouts can have CRLF line endings: work with \n everywhere
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
fs.rmSync(web, { recursive: true, force: true });
fs.mkdirSync(web, { recursive: true });

const version = JSON.parse(read(path.join(src, 'manifest.json'))).version;

for (const name of ['demo.js', 'popup.css', 'popup.js', 'modules.js', 'floorplans.js', 'controls.js', 'i18n.js', 'settings.js', 'catalog.js', 'content.js', 'sync-core.js', 'sync-engine.js', 'sync-background.js', 'sync-ui.js'])
  fs.copyFileSync(path.join(src, name), path.join(web, name));
for (const dir of ['fonts', 'vendor', 'icons']) fs.cpSync(path.join(src, dir), path.join(web, dir), { recursive: true });
fs.copyFileSync(path.join(here, 'web-src/mini.html'), path.join(web, 'mini.html'));

// background.js shares the page with popup.js here → own scope to avoid name clashes
fs.writeFileSync(path.join(web, 'background.js'), '(() => {\n' + read(path.join(src, 'background.js')) + '\n})();\n');
fs.writeFileSync(path.join(web, 'desktop-shim.js'), read(path.join(here, 'web-src/desktop-shim.js')).replace('__APP_VERSION__', version));

let html = read(path.join(src, 'popup.html'));
const replace = (a, b) => { if (!html.includes(a)) throw new Error('popup.html changed, update build-desktop-web.mjs: ' + a); html = html.replace(a, b); };
replace('<script src="modules.js"></script>',
  '<script src="desktop-shim.js"></script>\n  <script src="demo.js"></script>\n  <script src="sync-core.js"></script>\n  <script src="sync-engine.js"></script>\n  <script src="sync-background.js"></script>\n  <script src="background.js"></script>\n  <script src="modules.js"></script>');
replace('  <script src="sync-core.js"></script>\n  <script src="vendor/qrcode.js"></script>', '  <script src="vendor/qrcode.js"></script>');
// the window is a full page: use the add-on's full-page layout (popup.js reads ?full)
replace('<head>', '<head>\n  <script>if (!location.search.includes("full")) history.replaceState(null, "", location.pathname + "?full" + location.hash);</script>');
fs.writeFileSync(path.join(web, 'index.html'), html);

// keep the app version in sync with the add-on
const conf = path.join(here, 'src-tauri/tauri.conf.json');
const c = JSON.parse(read(conf));
if (c.version !== version) { c.version = version; fs.writeFileSync(conf, JSON.stringify(c, null, 2) + '\n'); }
const cargo = path.join(here, 'src-tauri/Cargo.toml');
const ct = read(cargo), ct2 = ct.replace(/^version = "[^"]*"/m, `version = "${version}"`);
if (ct2 !== ct) fs.writeFileSync(cargo, ct2);
console.log(`Desktop web files updated to ${version} in ${web}`);
