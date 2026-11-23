#!/usr/bin/env bash
# Pulls the latest WISS Stundenplan from GitHub and rebuilds the web bundle the iOS app injects.
#
# The bundle is produced by the original project's own iPhone build (iphone/build-ios.py), so the
# app runs exactly the same code, styles and sign-in flow as the Chrome add-on / Android app.
#
# Usage:  ./scripts/update-web.sh            (latest main)
#         ./scripts/update-web.sh v1.12.3    (a specific tag/branch)
set -euo pipefail

REPO="https://github.com/Nicolas-Wehrle/Wiss-Stundenplan.git"
REF="${1:-main}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/Wiss_Stundenplan/Web"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --quiet --depth 1 --branch "$REF" "$REPO" "$TMP/src"
python3 -I "$TMP/src/iphone/build-ios.py" "$TMP/src/chrome addon" "$TMP/out"

# The only change to the original code: the settings normally say "no notifications on iPhone"
# (true for Safari + Userscripts). This app has real notifications, so it shows the normal
# notification settings when the native app says so (globalThis.__wissNativeNotify, see gm-bridge.js).
python3 -I - "$TMP/out/WISS-Stundenplan.user.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = 'const notifyBox = window.__wissIOS\n'
new = 'const notifyBox = window.__wissIOS && !globalThis.__wissNativeNotify\n'
assert s.count(old) == 1, 'upstream settings.js changed: update the notification patch in scripts/update-web.sh'
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
PY

mkdir -p "$OUT"
cp "$TMP/out/WISS-Stundenplan.user.js" "$OUT/wiss-stundenplan.user.js"
cp "$TMP/src/LICENSE" "$OUT/LICENSE-upstream.txt"

VERSION="$(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$TMP/src/chrome addon/manifest.json")"
COMMIT="$(git -C "$TMP/src" rev-parse --short HEAD)"
echo "$VERSION ($COMMIT)" > "$OUT/UPSTREAM_VERSION"

# keep the app's version in line with the add-on, and raise the build number by one
# (App Store Connect refuses a build number it has already seen)
PBX="$ROOT/Wiss_Stundenplan.xcodeproj/project.pbxproj"
BUILD="$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' "$PBX" | grep -oE '[0-9]+$')"
BUILD=$((BUILD + 1))
sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $VERSION;/g; s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = $BUILD;/g" "$PBX"

echo "Web bundle updated to $VERSION ($COMMIT) → $OUT/wiss-stundenplan.user.js, app $VERSION ($BUILD)"
