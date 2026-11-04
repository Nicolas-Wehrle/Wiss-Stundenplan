#!/usr/bin/env python3
"""Build a Chrome Web Store ZIP without the development-only extension key."""
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
source = ROOT / 'chrome addon'
manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
manifest.pop('key', None)
out = ROOT / 'release' / ('v' + manifest['version']) / 'WISS-Stundenplan-Chrome-Web-Store.zip'
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob('*')):
        if not file.is_file():
            continue
        name = file.relative_to(source).as_posix()
        if name == 'manifest.json':
            archive.writestr(name, json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        else:
            archive.write(file, name)
print(out)
