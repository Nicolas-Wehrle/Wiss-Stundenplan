#!/usr/bin/env python3
"""Writes desktop app/flatpak/cargo-sources.json from desktop app/src-tauri/Cargo.lock.

Flathub builds without internet, so every Rust crate is listed as a download (with its checksum
from Cargo.lock) and Cargo is told to use them instead of crates.io. Same output format as
flatpak-cargo-generator, for crates.io packages only (this project has no git dependencies).
Run it again whenever Cargo.lock changes:  python3 scripts/flatpak-cargo-sources.py
"""
import json, sys, tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
lock = tomllib.loads((ROOT / 'desktop app' / 'src-tauri' / 'Cargo.lock').read_text(encoding='utf-8'))
CRATES_IO = 'registry+https://github.com/rust-lang/crates.io-index'

sources = []
for pkg in lock['package']:
    src = pkg.get('source')
    if src is None:
        continue                      # our own package
    if src != CRATES_IO:
        sys.exit(f"{pkg['name']}: only crates.io packages are supported, not {src}")
    name, version, sha = pkg['name'], pkg['version'], pkg['checksum']
    dest = f'cargo/vendor/{name}-{version}'
    sources.append({
        'type': 'archive', 'archive-type': 'tar-gzip',
        'url': f'https://static.crates.io/crates/{name}/{name}-{version}.crate',
        'sha256': sha, 'dest': dest,
    })
    sources.append({
        'type': 'inline', 'contents': json.dumps({'package': sha, 'files': {}}),
        'dest': dest, 'dest-filename': '.cargo-checksum.json',
    })
sources.append({
    'type': 'inline', 'dest': 'cargo', 'dest-filename': 'config',
    'contents': '[source.vendored-sources]\ndirectory = "cargo/vendor"\n\n'
                '[source.crates-io]\nreplace-with = "vendored-sources"\n',
})
out = ROOT / 'desktop app' / 'flatpak' / 'cargo-sources.json'
out.write_text(json.dumps(sources, indent=1) + '\n', encoding='utf-8')
print(f'{out}: {len(sources) // 2} crates')
