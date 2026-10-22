#!/usr/bin/env python3
"""Collects everything for a GitHub release into release/v<version>/ and updates updates.json.

Run it after the build steps (see README). Then upload the files from release/v<version>/
to a new GitHub release with the tag v<version>, and commit + push updates.json and
iphone/WISS-Stundenplan.user.js (the iPhone and Firefox auto-update read them from the repo).
"""
import json, os, shutil, zipfile
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

zipdir(ROOT / 'chrome addon', out / 'WISS-Stundenplan-Chrome.zip')
zipdir(ROOT / 'firefox addon', out / 'WISS-Stundenplan-Firefox.zip')
done = ['WISS-Stundenplan-Chrome.zip', 'WISS-Stundenplan-Firefox.zip']
missing = []

apk = ROOT / 'android app' / 'app' / 'build' / 'outputs' / 'apk' / 'release' / 'app-release.apk'
if apk.exists(): shutil.copy2(apk, out / 'WISS-Stundenplan.apk'); done.append('WISS-Stundenplan.apk')
else: missing.append('WISS-Stundenplan.apk  (build it: cd "android app" && ./gradlew assembleRelease)')

ios = ROOT / 'iphone' / 'WISS-Stundenplan.user.js'
if ios.exists(): shutil.copy2(ios, out / 'WISS-Stundenplan.user.js'); done.append('WISS-Stundenplan.user.js')
else: missing.append('WISS-Stundenplan.user.js  (build it: python3 iphone/build-ios.py "chrome addon" iphone)')

xpi = ROOT / 'WISS-Stundenplan-Firefox.xpi'
if xpi.exists(): shutil.copy2(xpi, out / 'WISS-Stundenplan-Firefox.xpi'); done.append('WISS-Stundenplan-Firefox.xpi')
else: missing.append('WISS-Stundenplan-Firefox.xpi  (upload the Firefox zip on addons.mozilla.org, download the signed .xpi into this folder, run again)')

# Firefox reads this file from the repo to find new versions
updates = {'addons': {'wiss-stundenplan@wiss-tools': {'updates': [{
    'version': version,
    'update_link': f'https://github.com/{REPO}/releases/download/v{version}/WISS-Stundenplan-Firefox.xpi'
}]}}}
(ROOT / 'updates.json').write_text(json.dumps(updates, indent=2) + '\n', encoding='utf-8')

print(f'Release v{version} in {out}:')
for f in done: print('  ok   ', f)
for f in missing: print('  todo ', f)
print('\nNext: commit + push (updates.json, iphone/WISS-Stundenplan.user.js), then create a GitHub release')
print(f'with the tag v{version} and attach the files above.')
