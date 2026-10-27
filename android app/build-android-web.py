#!/usr/bin/env python3
"""Copies the add-on (Chrome version = source of truth) into the Android app.

Usage:  python3 build-android-web.py "chrome addon" "android app"

Run it after changing the add-on, then rebuild the APK (see android app/README.md).
"""
import json, re, shutil, sys
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else 'chrome addon')
app = Path(sys.argv[2] if len(sys.argv) > 2 else 'android app')
web = app / 'app/src/main/assets/web'
web.mkdir(parents=True, exist_ok=True)

version = json.loads((src / 'manifest.json').read_text(encoding='utf-8'))['version']

for name in ['popup.css', 'popup.js', 'modules.js', 'floorplans.js', 'controls.js', 'i18n.js', 'settings.js', 'catalog.js', 'content.js', 'sync-core.js', 'sync-engine.js', 'sync-background.js', 'sync-ui.js']:
    shutil.copy2(src / name, web / name)

shutil.copytree(src / 'fonts', web / 'fonts', dirs_exist_ok=True)
shutil.copytree(src / 'vendor', web / 'vendor', dirs_exist_ok=True)
shutil.copy2(src / 'icons/128.png', web / 'icon128.png')

# background.js shares the page with popup.js here → own scope to avoid name clashes
bg = (src / 'background.js').read_text(encoding='utf-8')
(web / 'background.js').write_text('(() => {\n' + bg + '\n})();\n', encoding='utf-8')

shim = (app / 'web-src/app-shim.js').read_text(encoding='utf-8').replace('__APP_VERSION__', version)
(web / 'app-shim.js').write_text(shim, encoding='utf-8')

html = (src / 'popup.html').read_text(encoding='utf-8')
html = html.replace('<script src="modules.js"></script>',
                    '<script src="app-shim.js"></script>\n  <script src="sync-core.js"></script>\n  <script src="sync-engine.js"></script>\n  <script src="sync-background.js"></script>\n  <script src="background.js"></script>\n  <script src="modules.js"></script>')
html = html.replace('  <script src="sync-core.js"></script>\n  <script src="vendor/qrcode.js"></script>', '  <script src="vendor/qrcode.js"></script>')
assert 'app-shim.js' in html
(web / 'popup.html').write_text(html, encoding='utf-8')

# keep the app version in sync with the add-on
g = app / 'app/build.gradle'
gt = g.read_text(encoding='utf-8')
major, minor, patch = (int(x) for x in (version.split('.') + ['0', '0'])[:3])
gt = re.sub(r"versionName '[^']*'", f"versionName '{version}'", gt)
gt = re.sub(r'versionCode \d+', f'versionCode {major * 10000 + minor * 100 + patch}', gt)
g.write_text(gt, encoding='utf-8')
print(f'Android web assets updated to {version} in {web}')
