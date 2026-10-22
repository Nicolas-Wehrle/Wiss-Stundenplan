#!/usr/bin/env python3
"""Builds the Firefox add-on from the Chrome add-on.

Usage:  python3 build-firefox.py "chrome addon" "firefox addon"

The Chrome folder is the source of truth. This script copies it and applies the
few changes Firefox needs, so both versions always have the same features.
"""
import json, re, shutil, sys
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else 'chrome addon')
dst = Path(sys.argv[2] if len(sys.argv) > 2 else 'firefox addon')
dst.mkdir(parents=True, exist_ok=True)

FILES = ['background.js', 'content.js', 'popup.html', 'popup.css', 'popup.js', 'modules.js', 'floorplans.js', 'controls.js', 'i18n.js', 'settings.js', 'catalog.js']

def to_browser_ns(js: str) -> str:
    # Firefox: the promise-based API lives in `browser.*`
    js = re.sub(r'\btypeof chrome\b', 'typeof browser', js)
    js = re.sub(r'(?<![\w.$])chrome\.', 'browser.', js)
    return js

for name in FILES:
    text = (src / name).read_text(encoding='utf-8')
    if name.endswith('.js'):
        text = to_browser_ns(text)
    if name == 'background.js':
        # Firefox's windows.create() has no "focused: false" for new windows
        old = "[{ url, focused: false, state: 'minimized' }, { url, focused: false }]"
        assert old in text, 'openHidden options changed – update build-firefox.py'
        text = text.replace(old, "[{ url, state: 'minimized' }, { url }]")
        # Functions that also run inside a Tocco tab (scripting.executeScript): in Firefox a
        # content script's plain fetch() is made by the extension, not the page, so use
        # content.fetch (the page's own fetch) there to send the school login cookies.
        # The page's fetch may not accept the add-on's AbortSignal, so the timeout is a race here.
        shim = ("\n  const fetch = (u, o = {}) => { const { signal, ...rest } = o; "
                "const f = (typeof content !== 'undefined' && content && content.fetch) ? content.fetch.bind(content) : globalThis.fetch; "
                "return Promise.race([f(u, rest), new Promise((_, r) => setTimeout(() => r(new Error('Zeitüberschreitung')), 20000))]); };")
        for fn in ['async function toccoWhoAmI() {',
                   'async function toccoFetchAll(userPk, fromStr, toStr) {',
                   'async function toccoFetchRoomDay(fromStr, toStr) {']:
            assert fn in text, f'missing {fn}'
            text = text.replace(fn, fn + shim, 1)
    (dst / name).write_text(text, encoding='utf-8')

shutil.copytree(src / 'icons', dst / 'icons', dirs_exist_ok=True)
shutil.copytree(src / 'fonts', dst / 'fonts', dirs_exist_ok=True)

m = json.loads((src / 'manifest.json').read_text(encoding='utf-8'))
m.pop('key', None)                                   # Chrome-only
m['background'] = {'scripts': ['background.js']}     # Firefox MV3 uses an event page, not a service worker
m['browser_specific_settings'] = {'gecko': {
    'id': 'wiss-stundenplan@wiss-tools',
    'strict_min_version': '140.0',                  # 140+ understands data_collection_permissions (required by AMO)
    'data_collection_permissions': {'required': ['none']},
    # self-hosted updates: Firefox checks this file in the GitHub repo (see release.py)
    'update_url': 'https://raw.githubusercontent.com/Nicolas-Wehrle/Wiss-Stundenplan/main/updates.json'
}, 'gecko_android': {
    'strict_min_version': '142.0'                   # also runs on Firefox for Android (142+ for data_collection_permissions)
}}
m['description'] = m['description']
(dst / 'manifest.json').write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

readme = (Path(__file__).resolve().parent / 'firefox-README.md').read_text(encoding='utf-8')
(dst / 'README.md').write_text(readme, encoding='utf-8')
print('Firefox add-on built in', dst)
