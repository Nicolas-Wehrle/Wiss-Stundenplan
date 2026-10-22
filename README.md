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
Get the latest version from the **[Releases](../../releases)** page:

| Device | File | Guide |
|---|---|---|
| Chrome, Edge, Brave | `WISS-Stundenplan-Chrome.zip` | [chrome addon/README.md](chrome%20addon/README.md) |
| Firefox | `WISS-Stundenplan-Firefox.zip` | [firefox addon/README.md](firefox%20addon/README.md) |
| Android | `WISS-Stundenplan.apk` | [android app/README.md](android%20app/README.md) |
| iPhone | `WISS-Stundenplan.user.js` | [iphone/README.md](iphone/README.md) |

## Privacy
Everything is loaded with your own login and stored only on your device. There is no server and nothing is sent anywhere else.

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
1. Raise `version` in `chrome addon/manifest.json` and run the build steps above.
2. Firefox only: upload `WISS-Stundenplan-Firefox.zip` (made in the next step) on [addons.mozilla.org](https://addons.mozilla.org/developers/) as "On your own", download the signed `.xpi` and save it as `WISS-Stundenplan-Firefox.xpi` in this folder.
3. Run `python3 release.py`. It puts all files for the release into `release/v<version>/` and updates `updates.json`.
4. Commit and push, so `updates.json` and `iphone/WISS-Stundenplan.user.js` are on GitHub.
5. On GitHub: Releases > Draft a new release, tag `v<version>` (for example `v1.9.3`), attach the files from `release/v<version>/` and publish.

Never attach or commit `wiss-stundenplan.jks` or `keystore.properties`.

## Updates
- **Android:** the app checks GitHub twice a day. When there's a new release it shows "Installieren", downloads the APK and opens Android's install screen.
- **iPhone:** the Userscripts app updates the script on its own from `iphone/WISS-Stundenplan.user.js` in this repo.
- **Firefox:** updates on its own through `updates.json`, as long as the release has the signed `.xpi`.
- **Chrome / Edge:** Chrome doesn't allow auto-updates for add-ons loaded with "Load unpacked". The add-on shows a banner with the download link instead.

## Credits
- Module descriptions and the list of apprenticeships come from [modulbaukasten.ch](https://www.modulbaukasten.ch) (ICT-Berufsbildung Schweiz). A copy is included in `modules.js` and `catalog.js` so the app also works offline. All rights to that text stay with them.
- Fonts: [Doto](https://github.com/oliverlalan/Doto) and Space Mono, both under the SIL Open Font License (see `chrome addon/fonts/LICENSE-fonts.txt`).
- The "Nothing" and "GitHub" styles are only inspired by those designs. No logos or brand assets are used.

## License
[MIT](LICENSE) for the code in this repository. This doesn't cover the third-party content listed under Credits.
