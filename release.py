#!/usr/bin/env python3
"""Collects everything for a GitHub release into release/v<version>/ and updates updates.json.

Run it after the build steps (see README). Then upload the files from release/v<version>/
to a new GitHub release with the tag v<version>, and commit + push updates.json and
iphone/WISS-Stundenplan.user.js (the iPhone and Firefox auto-update read them from the repo).
"""
import json, os, shutil, zipfile, runpy, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = 'Nicolas-Wehrle/Wiss-Stundenplan'
version = json.loads((ROOT / 'chrome addon' / 'manifest.json').read_text(encoding='utf-8'))['version']
out = ROOT / 'release' / f'v{version}'
out.mkdir(parents=True, exist_ok=True)

def zipdir(src, dst):
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(src):
            for f in files:
                p = Path(root) / f
                z.write(p, p.relative_to(src))

runpy.run_path(str(ROOT / 'build-chrome-store.py'))
shutil.copy2(out / 'WISS-Stundenplan-Chrome-Web-Store.zip', out / 'WISS-Stundenplan-Chrome.zip')
zipdir(ROOT / 'firefox addon', out / 'WISS-Stundenplan-Firefox.zip')
zipdir(ROOT / 'store-assets', out / 'Chrome-Web-Store-Assets.zip')   # store pictures + texts, checked by verify-release.py
done = ['WISS-Stundenplan-Chrome.zip', 'WISS-Stundenplan-Firefox.zip']
missing = []

apk = ROOT / 'android app' / 'app' / 'build' / 'outputs' / 'apk' / 'release' / 'app-release.apk'
if not apk.exists(): apk = ROOT / 'WISS-Stundenplan.apk'   # built elsewhere and put in the main folder
def apk_version(f):
    try:
        with zipfile.ZipFile(f) as z:
            match = re.search(r"const VERSION = '([^']+)'", z.read('assets/web/app-shim.js').decode('utf-8'))
            return match.group(1) if match else None
    except Exception: return None
if apk.exists() and apk_version(apk) == version: shutil.copy2(apk, out / 'WISS-Stundenplan.apk'); done.append('WISS-Stundenplan.apk')
elif apk.exists(): missing.append(f'WISS-Stundenplan.apk  (built version {apk_version(apk)}, expected {version}; rebuild before publishing)')
else: missing.append('WISS-Stundenplan.apk  (build it: cd "android app" && ./gradlew assembleRelease, or put the APK in this folder)')

ios = ROOT / 'iphone' / 'WISS-Stundenplan.user.js'
if ios.exists(): shutil.copy2(ios, out / 'WISS-Stundenplan.user.js'); done.append('WISS-Stundenplan.user.js')
else: missing.append('WISS-Stundenplan.user.js  (build it: python3 iphone/build-ios.py "chrome addon" iphone)')

xpi = ROOT / 'WISS-Stundenplan-Firefox.xpi'
def xpi_version(f):
    try:
        with zipfile.ZipFile(f) as z: return json.loads(z.read('manifest.json').decode('utf-8-sig')).get('version')
    except Exception: return None
xv = xpi_version(xpi) if xpi.exists() else None
if xpi.exists() and xv != version:
    missing.append(f'WISS-Stundenplan-Firefox.xpi  (the one in this folder is version {xv}, not {version}. Sign the new Firefox zip and replace it)')
elif xpi.exists(): shutil.copy2(xpi, out / 'WISS-Stundenplan-Firefox.xpi'); done.append('WISS-Stundenplan-Firefox.xpi')
else: missing.append('WISS-Stundenplan-Firefox.xpi  (upload the Firefox zip on addons.mozilla.org, download the signed .xpi into this folder, run again)')

# Firefox reads this file from the repo to find new versions
updates = {'addons': {'wiss-stundenplan@wiss-tools': {'updates': [{
    'version': version,
    'update_link': f'https://github.com/{REPO}/releases/download/v{version}/WISS-Stundenplan-Firefox.xpi'
}]}}}
# only point Firefox at the new version once its signed file is part of the release
if 'WISS-Stundenplan-Firefox.xpi' in done:
    (ROOT / 'updates.json').write_text(json.dumps(updates, indent=2) + '\n', encoding='utf-8')
else:
    print('updates.json not changed yet (signed .xpi missing), so Firefox keeps the old version for now.\n')

print(f'Release v{version} in {out}:')
for f in done: print('  ok   ', f)
for f in missing: print('  todo ', f)
print('\nNext: commit + push (updates.json, iphone/WISS-Stundenplan.user.js), then create a GitHub release')
print(f'with the tag v{version} and attach the files above.')
