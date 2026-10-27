# WISS Stundenplan

A faster way to check your WISS timetable. It shows your last data right away and updates in the background, so you don't have to wait for the extranet to load.

Works as a Chrome/Edge add-on, a Firefox add-on, an Android app and on iPhone (Safari).

> **Unofficial.** This is a student project. It is not made by, endorsed by or affiliated with WISS or Tocco.
> It only uses your own WISS login, the same way the extranet website does.

## Features
- Week view with the current and next lesson, holidays and school breaks
- Exam dates (ZP, LB, projects), estimated where the extranet doesn't list them
- Grades, average over the year and a calculator for what you still need
- Absences with the 7-day deadline and attendance per module
- Free rooms at any time, with floor plans for WISS Zürich
- Notes per lesson
- Deutsch / English, three styles (Standard, Nothing, GitHub), light and dark
- Android: reminders and a home-screen widget

## Download
Get the latest version from the **[Releases](../../releases/latest)** page. Under "Assets", download the file for your device:

| Device | Download this | Guide |
|---|---|---|
| Chrome, Edge, Brave | `WISS-Stundenplan-Chrome.zip` | [chrome addon/README.md](chrome%20addon/README.md) |
| Firefox (computer and Android) | `WISS-Stundenplan-Firefox.xpi` | [firefox addon/README.md](firefox%20addon/README.md) |
| Android app | `WISS-Stundenplan.apk` | [android app/README.md](android%20app/README.md) |
| iPhone | `WISS-Stundenplan.user.js` | [iphone/README.md](iphone/README.md) |

**Firefox users:** take the `.xpi`, not `WISS-Stundenplan-Firefox.zip`. The `.xpi` is the version signed by Mozilla. Firefox refuses to install the unsigned `.zip`; that file is only there so it can be uploaded to Mozilla for signing.

## Privacy
School data is loaded with your own login and stays on your device. Optional end-to-end encrypted sync can transfer notes, exam corrections and selected settings between your devices. The sync server is never contacted before you enable it. It receives encrypted packages and a random ID, never the encryption key or your school login.

Keep your recovery code safe: losing it and every linked device means the synced data cannot be recovered. Deletion removes the active server file after durable confirmation; encrypted copies can remain in GitHub backups. See [sync-server/README.md](sync-server/README.md) for the full setup and retention details.

Version 1.11.0 is an unreleased sync pilot. Deploy the server and complete the real-device checks before publishing a release. Existing public download links and Firefox update metadata remain on the last signed release.

## Sync server
The source in `sync-server/` runs on Render and stores encrypted packages in a separate private GitHub repository. [Exact Render settings and deployment steps](sync-server/README.md).

## Sync tests
Run `node --test tests/sync/*.test.mjs` with Node 22 or later. All public tests use synthetic data. The optional browser test, `tests/browser/sync-ui.mjs`, requires Playwright and rebuilt Android/iPhone web assets. Set `PLAYWRIGHT_MODULE` to its installed package directory if it is not on the normal module path. Private regression fixtures live in the ignored `tests-private/` folder.

## Project layout
- `chrome addon/`: the main code. All other versions are built from it.
- `firefox addon/`: built with `build-firefox.py`
- `android app/`: Android project. Its web part is copied in with `build-android-web.py`.
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
- **Chrome / Edge:** Chrome doesn't allow auto-updates for add-ons loaded with "Load unpacked". The add-on shows a banner with the download link instead.

## Credits
- Module descriptions and the list of apprenticeships come from [modulbaukasten.ch](https://www.modulbaukasten.ch) (ICT-Berufsbildung Schweiz). A copy is included in `modules.js` and `catalog.js` so the app also works offline. All rights to that text stay with them.
- Fonts: [Doto](https://github.com/oliverlalan/Doto) and Space Mono, both under the SIL Open Font License (see `chrome addon/fonts/LICENSE-fonts.txt`).
- The "Nothing" and "GitHub" styles are only inspired by those designs. No logos or brand assets are used.

## License
[MIT](LICENSE) for the code in this repository. This doesn't cover the third-party content listed under Credits.
