#!/usr/bin/env python3
"""Validate the complete 1.12.1 release and generate SHA-256 checksums."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parent
VERSION = json.loads((ROOT / 'chrome addon/manifest.json').read_text(encoding='utf-8'))['version']
OUT = ROOT / 'release' / ('v' + VERSION)
FILES = ['WISS-Stundenplan-Chrome.zip', 'WISS-Stundenplan-Firefox.zip', 'WISS-Stundenplan-Firefox.xpi', 'WISS-Stundenplan.apk', 'WISS-Stundenplan.user.js', 'Chrome-Web-Store-Assets.zip']
for name in FILES:
    if not (OUT / name).is_file():
        raise SystemExit('Missing release asset: ' + name)
for name in FILES[:3]:
    with zipfile.ZipFile(OUT / name) as archive:
        manifest = json.loads(archive.read('manifest.json').decode('utf-8-sig'))
        assert manifest['version'] == VERSION, name + ': wrong version'
        assert 'demo.js' in archive.namelist(), name + ': demo data missing'
        if name.endswith('.xpi'):
            assert manifest['browser_specific_settings']['gecko']['id'] == 'wiss-stundenplan@wiss-tools'
            assert {'META-INF/mozilla.rsa', 'META-INF/cose.sig'} & set(archive.namelist()), 'Firefox file has no Mozilla signature files'
            for script in ['demo.js', 'background.js', 'popup.js', 'sync-background.js']:
                assert archive.read(script).replace(b'\r\n', b'\n') == (ROOT / 'firefox addon' / script).read_bytes().replace(b'\r\n', b'\n'), 'Signed Firefox file does not match the final source: ' + script
        if name == 'WISS-Stundenplan-Chrome.zip':
            assert 'key' not in manifest, 'Development key must not be in the Chrome store package'
with zipfile.ZipFile(OUT / 'WISS-Stundenplan.apk') as archive:
    text = archive.read('assets/web/app-shim.js').decode('utf-8')
    assert re.search(r"const VERSION = '([^']+)'", text).group(1) == VERSION, 'Stale APK'
assert '// @version      ' + VERSION in (OUT / 'WISS-Stundenplan.user.js').read_text(encoding='utf-8'), 'Stale iPhone userscript'
updates = json.loads((ROOT / 'updates.json').read_text(encoding='utf-8'))
entry = updates['addons']['wiss-stundenplan@wiss-tools']['updates'][0]
assert entry['version'] == VERSION and '/v' + VERSION + '/' in entry['update_link'], 'Firefox update metadata does not match release'
(OUT / 'SHA256SUMS.txt').write_text(''.join(hashlib.sha256((OUT / name).read_bytes()).hexdigest() + '  ' + name + '\n' for name in FILES), encoding='utf-8')
print('Verified ' + VERSION + ': all six assets, matching signed Firefox source, platform versions, updater metadata and SHA-256 checksums.')
