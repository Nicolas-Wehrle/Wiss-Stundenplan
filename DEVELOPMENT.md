# Developing WISS Stundenplan

Everything for building, releasing and maintaining the project. For users, see the [README](README.md) or the [website](https://stundenplan.severinwehrle.dev).
More background for anyone taking over the project: [PROJECT.md](PROJECT.md).

## Project layout
- `chrome addon/`: the main code. All other versions are built from it.
- `firefox addon/`: built with `build-firefox.py`
- `android app/`: Android project. Its web part is copied in with `build-android-web.py`.
- `desktop app/`: Windows/macOS/Linux app (Tauri, Rust). Copies the web part in by itself when it builds.
- `iphone/`: Safari userscript, built with `build-ios.py`
- `docs/`: the website, published with the Linux package sources by `.github/workflows/pages.yml`
- `store-assets-src/`: makes the store pictures, the README banner and the link preview from demo screenshots

## Building
After changing something in `chrome addon/`:
```
python3 build-firefox.py "chrome addon" "firefox addon"
python3 "android app/build-android-web.py" "chrome addon" "android app"
cd "android app" && ./gradlew assembleRelease && cd ..
python3 iphone/build-ios.py "chrome addon" iphone
```
The Android build needs JDK 17+ and the Android SDK, plus your own signing key (see `android app/README.md`).

The desktop app needs nothing by hand: GitHub builds it for Windows, macOS and Linux when a release is published (see `desktop app/README.md`, including the two secrets it needs). To build it yourself: `cd "desktop app" && npm ci && npm run build` (needs Rust).

## Publishing a release
1. Raise `version` in `chrome addon/manifest.json` and run the build steps above. Every release needs a new version number, Mozilla won't sign the same one twice.
2. Run `python3 release.py` once. It makes `release/v<version>/WISS-Stundenplan-Firefox.zip` and tells you the signed `.xpi` is still missing.
3. Get the signed Firefox file:
   1. Go to the [Developer Hub](https://addons.mozilla.org/developers/addons) on addons.mozilla.org and open the add-on (the first time: "Submit a New Add-on").
   2. Click "Upload New Version", choose **On your own** and upload `WISS-Stundenplan-Firefox.zip`.
   3. Wait for the automatic check (usually a few minutes), then download the signed `.xpi` on the version page.
   4. Rename it to exactly `WISS-Stundenplan-Firefox.xpi` and put it in the main folder, next to `release.py`.
4. Run `python3 release.py` again. Now all 5 files should show `ok`, and `updates.json` is updated.
   The `.apk` is taken from the Android build. If you built it somewhere else, copy it into `release/v<version>/` yourself.
5. Commit and push, so `updates.json` and `iphone/WISS-Stundenplan.user.js` are on GitHub.
   After the release is published (step 6), GitHub adds the Windows, macOS and Linux apps to it by itself within about 15 minutes (Actions › Desktop app), then updates the Linux package sources (Actions › Website and Linux updates).
6. Create the GitHub release with the tag `v<version>` (for example `v1.9.4`) and attach all 5 files from `release/v<version>/`. The file names must stay as they are, the update links point to them.
   Website: Releases > Draft a new release. Or with the GitHub CLI in PowerShell:
   ```
   gh release create v1.9.4 (Get-ChildItem release\v1.9.4\*).FullName --title "1.9.4"
   ```

Never attach or commit `wiss-stundenplan.jks` or `keystore.properties`.

## Sync server
The source in `sync-server/` runs on Render and stores encrypted packages in a separate private GitHub repository. [Exact Render settings and deployment steps](sync-server/README.md).

## Sync tests
Run `node --test tests/sync/*.test.mjs` with Node 22 or later. All public tests use synthetic data. The optional browser test, `tests/browser/sync-ui.mjs`, requires Playwright and rebuilt Android/iPhone web assets. Set `PLAYWRIGHT_MODULE` to its installed package directory if it is not on the normal module path. Private regression fixtures live in the ignored `tests-private/` folder.

## Project layout
- `chrome addon/`: the main code. All other versions are built from it.
- `firefox addon/`: built with `build-firefox.py`
- `android app/`: Android project. Its web part is copied in with `build-android-web.py`.
- `desktop app/`: Windows/macOS/Linux app (Tauri, Rust). Copies the web part in by itself when it builds.
- `iphone/`: Safari userscript, built with `build-ios.py`

## Building
After changing something in `chrome addon/`:
```
python3 build-firefox.py "chrome addon" "firefox addon"
python3 "android app/build-android-web.py" "chrome addon" "android app"
cd "android app" && ./gradlew assembleRelease && cd ..
python3 iphone/build-ios.py "chrome addon" iphone
```
The Android build needs JDK 17+ and the Android SDK, plus your own signing key (see `android app/README.md`).

The desktop app needs nothing by hand: GitHub builds it for Windows, macOS and Linux when a release is published (see `desktop app/README.md`, including the two secrets it needs). To build it yourself: `cd "desktop app" && npm ci && npm run build` (needs Rust).

## Publishing a release
1. Raise `version` in `chrome addon/manifest.json` and run the build steps above. Every release needs a new version number, Mozilla won't sign the same one twice.
2. Run `python3 release.py` once. It makes `release/v<version>/WISS-Stundenplan-Firefox.zip` and tells you the signed `.xpi` is still missing.
3. Get the signed Firefox file:
   1. Go to the [Developer Hub](https://addons.mozilla.org/developers/addons) on addons.mozilla.org and open the add-on (the first time: "Submit a New Add-on").
   2. Click "Upload New Version", choose **On your own** and upload `WISS-Stundenplan-Firefox.zip`.
   3. Wait for the automatic check (usually a few minutes), then download the signed `.xpi` on the version page.
   4. Rename it to exactly `WISS-Stundenplan-Firefox.xpi` and put it in the main folder, next to `release.py`.
4. Run `python3 release.py` again. Now all 5 files should show `ok`, and `updates.json` is updated.
   The `.apk` is taken from the Android build. If you built it somewhere else, copy it into `release/v<version>/` yourself.
5. Commit and push, so `updates.json` and `iphone/WISS-Stundenplan.user.js` are on GitHub.
   After the release is published (step 6), GitHub adds the Windows, macOS and Linux apps to it by itself within about 15 minutes (Actions › Desktop app), then updates the Linux package sources (Actions › Website and Linux updates).
6. Create the GitHub release with the tag `v<version>` (for example `v1.9.4`) and attach all 5 files from `release/v<version>/`. The file names must stay as they are, the update links point to them.
   Website: Releases > Draft a new release. Or with the GitHub CLI in PowerShell:
   ```
   gh release create v1.9.4 (Get-ChildItem release\v1.9.4\*).FullName --title "1.9.4"
   ```

Never attach or commit `wiss-stundenplan.jks` or `keystore.properties`.

## Updates
- **Android:** the app checks GitHub twice a day. When there's a new release it shows "Installieren", downloads the APK and opens Android's install screen.
- **iPhone:** the Userscripts app updates the script on its own from `iphone/WISS-Stundenplan.user.js` in this repo.
- **Firefox:** updates on its own through `updates.json`. This only works if the release has the signed `WISS-Stundenplan-Firefox.xpi` and `updates.json` is pushed.
- **Chrome / Edge:** the Chrome Web Store version updates itself. Add-ons loaded with "Load unpacked" can't update themselves; they show a banner with the download link instead.
