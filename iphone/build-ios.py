#!/usr/bin/env python3
"""Builds the iPhone version: one userscript for the free "Userscripts" Safari extension.

Usage:  python3 build-ios.py "chrome addon" "iphone"
Output: iphone/WISS-Stundenplan.user.js  (+ README.md)
"""
import base64, json, re, sys
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else 'chrome addon')
dst = Path(sys.argv[2] if len(sys.argv) > 2 else 'iphone')
here = Path(__file__).resolve().parent
dst.mkdir(parents=True, exist_ok=True)

version = json.loads((src / 'manifest.json').read_text(encoding='utf-8'))['version']
read = lambda n: (src / n).read_text(encoding='utf-8')

# CSS with the fonts inlined (no extra files on the phone)
css = read('popup.css')
for f in (src / 'fonts').glob('*.woff2'):
    b64 = base64.b64encode(f.read_bytes()).decode()
    css = css.replace(f'url("fonts/{f.name}")', f'url("data:font/woff2;base64,{b64}")')
assert 'fonts/' not in css.split('LICENSE')[0], 'font not inlined'
css += """
/* iPhone (Safari) */
html.ios body.mobile .top { padding-top: max(10px, env(safe-area-inset-top)); }
html.ios body.mobile #view { padding-bottom: max(18px, env(safe-area-inset-bottom)); }
html.ios #btnFull { display: none !important; }
html.ios, html.ios body { -webkit-text-size-adjust: 100%; }
"""

html = read('popup.html')
body = html[html.index('<body>') + len('<body>'):html.index('<script')].strip()

header = f"""// ==UserScript==
// @name         WISS Stundenplan
// @namespace    wiss-stundenplan
// @version      {version}
// @description  Dein WISS-Stundenplan sofort – Prüfungen, Noten, Absenzen, Räume. Öffne wiss.tocco.ch/extranet/?stundenplan
// @match        https://wiss.tocco.ch/*
// @homepageURL  https://github.com/Nicolas-Wehrle/Wiss-Stundenplan
// @updateURL    https://raw.githubusercontent.com/Nicolas-Wehrle/Wiss-Stundenplan/main/iphone/WISS-Stundenplan.user.js
// @downloadURL  https://raw.githubusercontent.com/Nicolas-Wehrle/Wiss-Stundenplan/main/iphone/WISS-Stundenplan.user.js
// @run-at       document-start
// @inject-into  content
// @noframes
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      www.modulbaukasten.ch
// @connect      ictbb.crm17.dynamics.com
// ==/UserScript==
"""

entry = (here / 'entry.js').read_text(encoding='utf-8')
shim = (here / 'ios-shim.js').read_text(encoding='utf-8')

parts = [
    header,
    '(function () {',
    f'const VERSION = {json.dumps(version)};',
    f'const CSS = {json.dumps(css)};',
    f'const BODY = {json.dumps(body)};',
    f'const CONTENT_JS = {json.dumps(read("content.js"))};',
    entry,
    '// wait one tick after window.stop() so the (empty) document is settled, then build the app',
    'const __wissStart = () => {', 'takeOver();',
    '// ---------- adapter ----------', shim,
    '// ---------- i18n.js ----------', read('i18n.js'),
    '// ---------- modules.js ----------', read('modules.js'),
    '// ---------- catalog.js ----------', read('catalog.js'),
    '// ---------- floorplans.js ----------', read('floorplans.js'),
    '// ---------- background.js ----------', '(() => {\n' + read('background.js') + '\n})();',
    '// ---------- popup.js ----------', read('popup.js'),
    '// ---------- settings.js ----------', read('settings.js'),
    '// ---------- controls.js ----------', read('controls.js'),
    '// ---------- start ----------', 'startApp();',
    '};',
    "if (document.documentElement && document.body) __wissStart(); else setTimeout(__wissStart, 0);",
    '})();',
]
out = '\n'.join(parts) + '\n'
(dst / 'WISS-Stundenplan.user.js').write_text(out, encoding='utf-8')
import shutil; shutil.copy2(here / 'README.md', dst / 'README.md')
print(f'iPhone userscript {version}: {dst / "WISS-Stundenplan.user.js"} ({len(out) // 1024} KB)')
