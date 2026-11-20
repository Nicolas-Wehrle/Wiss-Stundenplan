# Developing WISS Stundenplan

Everything for building, testing and releasing the project. Current version: **1.13.0**.
For users, see the [README](README.md) or the [website](https://stundenplan.severinwehrle.dev). Background for anyone taking over the project: [PROJECT.md](PROJECT.md).

## Project layout
- `chrome addon/`: the main code. All other versions are built from it.
- `firefox addon/`: built with `scripts/build-firefox.py`
- `android app/`: Android project. Its web part is copied in with `build-android-web.py`.
- `desktop app/`: Windows/macOS/Linux app (Tauri 2, Rust). Copies the web part in by itself when it builds. See [desktop app/README.md](desktop%20app/README.md).
- `iphone/`: Safari userscript, built with `build-ios.py`
- `sync-server/`: the optional end-to-end encrypted sync server (Render). See [sync-server/README.md](sync-server/README.md).
- `docs/`: the website, published with the Linux package sources by `.github/workflows/pages.yml`
- `store-assets/`: Chrome Web Store pictures and texts (German). `scripts/store-pictures/` makes them, plus the README pictures and the link preview, from demo screenshots.
- `tests/`: public tests with invented data only
- `scripts/`: build, release and publish scripts (`build-firefox.py`, `build-chrome-store.py`, `release.py`, `verify-release.py`, `publish-release.ps1`) and the store picture maker
- `release-notes/`: the text of each GitHub release
- `updates.json`: Firefox update manifest; it has to stay in the main folder, installed add-ons read it from there

## Building
After changing something in `chrome addon/`:
```
python3 scripts/build-firefox.py "chrome addon" "firefox addon"
python3 "android app/build-android-web.py" "chrome addon" "android app"
cd "android app" && ./gradlew assembleRelease && cd ..
python3 iphone/build-ios.py "chrome addon" iphone
```
The Android build needs JDK 17+ and the Android SDK, plus your own signing key (see [android app/README.md](android%20app/README.md)).

The desktop app needs nothing by hand: GitHub builds it for Windows, macOS and Linux when a release is published. To build it yourself: `cd "desktop app" && npm ci && npm run build` (needs Rust).

## Testing
- Sync: `node --test tests/sync/*.test.mjs` (Node 22 or later).
- Browser tests (Playwright, Chromium): `tests/browser/demo.mjs`, `extension.mjs`, `mobile-demo.mjs`, `sync-ui.mjs`, `desktop-demo.mjs` and `themes.mjs`. Rebuild the Android, iPhone and desktop web parts first (`node "desktop app/build-desktop-web.mjs"` for the desktop one). Set `PLAYWRIGHT_MODULE` if Playwright is not on the normal module path.
- Private regression tests with real data live in the ignored `tests-private/` folder and never go into the repo.

## Store pictures, README pictures and link preview
```
node scripts/store-pictures/capture.mjs && node scripts/store-pictures/make.mjs
```
This loads the add-on in the demo account (German and English), takes screenshots and lays them out as the Chrome Web Store pictures (`store-assets/`), the README banner and pictures (`docs/readme-banner*.png`, `docs/readme/`, each in light and dark) and the link preview (`docs/og.png`).

## Privacy policy and terms
The text lives in `scripts/legal.py`, in German and English. `python3 scripts/legal.py` writes `PRIVACY.md`, `PRIVACY-de.md`, `TERMS.md`, `TERMS-de.md` and the two pages on the website (`#datenschutz`, `#nutzungsbedingungen`). Change the text there, not in the generated files, and update the date at the top when something real changes.

## Publishing a release
1. Raise `version` in `chrome addon/manifest.json` and run the build steps above. Every release needs a new version number; Mozilla won't sign the same one twice.
2. Add a section to `CHANGELOG.md` and write `release-notes/<version>.txt`.
3. Run `python3 scripts/release.py`. It collects the files into `release/v<version>/` and tells you the signed Firefox file is still missing.
4. Get the signed Firefox file: on the [Developer Hub](https://addons.mozilla.org/developers/addons), open the add-on, "Upload New Version", choose **On your own** and upload `WISS-Stundenplan-Firefox.zip`. After the automatic check, download the signed `.xpi`, rename it to exactly `WISS-Stundenplan-Firefox.xpi` and put it in the main folder.
5. Run `python3 scripts/release.py` again. Everything should show `ok`, and `updates.json` is updated. Then `python3 scripts/verify-release.py` checks all six files and writes `SHA256SUMS.txt`.
6. Commit everything, then run `scripts/publish-release.ps1` in PowerShell. It pushes, creates the GitHub release `v<version>` with the notes and all files, and publishes it once every upload worked.
7. GitHub then builds the desktop apps and adds them to the release (Actions › Desktop app, about 15 minutes), and refreshes the website and the Linux package sources (Actions › Website and Linux updates).
8. Chrome Web Store: upload `release/v<version>/WISS-Stundenplan-Chrome-Web-Store.zip` as a new version (details in `store-assets/VEROEFFENTLICHUNG-DE.md`).

The file names in the release must stay as they are; the update links point to them.

**Secrets:** the desktop build needs `TAURI_SIGNING_PRIVATE_KEY`, the Linux package sources `LINUX_REPO_GPG_KEY` (repository Settings › Secrets and variables › Actions). Never commit or share `wiss-stundenplan.jks`, `keystore.properties`, `wiss-desktop-updater.key` or `wiss-linux-repo.private.asc`.

## How each version updates
- **Chrome / Edge:** through the Chrome Web Store. Add-ons loaded with "Load unpacked" show a banner with the download link instead.
- **Firefox:** through `updates.json` on `main`, which points at the signed `.xpi` in the release.
- **Android:** the app checks GitHub twice a day, downloads the APK and opens Android's install screen.
- **Windows, macOS, Linux AppImage:** the app reads `latest.json` from the latest release, checks the signature and installs.
- **Linux `.rpm`/`.deb`:** from the package sources on the website, with the normal system updates.
- **iPhone:** the Userscripts app updates the script from `iphone/WISS-Stundenplan.user.js` on `main`.

## Sync server
The source in `sync-server/` runs on Render and stores encrypted packages in a separate private GitHub repository. Settings and deployment: [sync-server/README.md](sync-server/README.md).
