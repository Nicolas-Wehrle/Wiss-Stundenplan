# WISS Stundenplan: project handover

Everything about this project in one place: what it is, how it's built, how releases work, what's tricky, and what's planned next. Written so a new chat (or a new person) can pick it up without the old conversation.

Current source version: **1.11.0**, unreleased encrypted-sync pilot. The Firefox update manifest remains on signed 1.10.1. Server deployment and real-device pilot checks are required before release.

---

## 1. What it is

An unofficial app for WISS students that shows the timetable, exams, grades, absences and rooms **instantly**, instead of waiting for the slow school extranet (Tocco, `wiss.tocco.ch`).

How it works in one sentence: it shows the last saved data immediately and fetches fresh data in the background, using the student's own login (Microsoft school account via the extranet), and keeps everything on the device.

- **Author:** Nicolas Wehrle (student, class IFZK-2524-017).
- **Repo:** https://github.com/Nicolas-Wehrle/Wiss-Stundenplan (public, MIT license).
- **Local folder:** `C:\Users\sever\Documents\Wiss-Stundenplan` (git repo). The older folder `C:\Users\sever\Documents\tocco chrome addon` is outdated.
- **Not affiliated with WISS or Tocco.** It only uses each user's own login, the same way the extranet website does.

---

## 2. Platforms

| Platform | How | Update mechanism |
|---|---|---|
| Chrome / Edge / Brave | MV3 add-on, "Load unpacked" from the zip | Banner with download link (Chrome blocks auto-update outside the store) |
| Firefox (computer + Android 142+) | Self-hosted signed `.xpi` ("On your own" on addons.mozilla.org) | Automatic via `updates.json` in the repo |
| Android app | Java app with a WebView that runs the add-on code | In-app: downloads the APK, opens the install screen |
| iPhone | Safari userscript via the free "Userscripts" app | Userscripts app updates it from the repo (`@updateURL`) |

All four run **the same web code** (`chrome addon/`). The others are built from it.

---

## 3. Features (as of 1.10.1)

- **Week:** current and next lesson, week view, holidays and breaks, past lessons folded away, big view in its own tab (desktop).
- **Exams:** ZP, LB, projects. The extranet has no exam dates, so the app estimates them (ZP rule: every 3rd lesson / once / none; LB and project on the last module day). Users can correct dates by hand.
- **Grades:** average, trend chart, per-exam weights, calculator "what do I need for a 5", list of all modules of the apprenticeship.
- **Absences:** GitHub-style year grid, history, 7-day excuse deadline, attendance per module.
- **Rooms:** free rooms at any time (school-wide bookings, other classes anonymized by Tocco), floor plans for WISS Zürich.
- **Module info** from modulbaukasten.ch, with a built-in offline copy (`modules.js`, `catalog.js`), because modulbaukasten.ch had certificate problems.
- **Notes** per lesson, teacher names.
- **Settings:** German/English, light/dark/system, 9 styles, accent colour, corners, size, modules in colour or plain, start tab, sync interval, notifications.
- **9 styles**, each with its own layout (not just colours): Standard, Apple, Samsung, Nothing, GitHub, Pastell, Neon, Papier, Terminal. The style picker is a sideways strip.
- **Android:** notifications (lesson reminders, new grades, absences), home-screen widget with its own settings (style, background, colour mode, transparency), widget adapts to its height.
- **Privacy:** email blurred until tapped. All data stays on the device.
- **Auto-update** on every platform (see table above).
- **Automatic sign-in** in the background, including pressing the extranet's "WISS Office 365" button (details in section 6).

---

## 4. Repository layout

```
Wiss-Stundenplan/
  chrome addon/        main source code, everything else is built from here
    manifest.json      version number lives here (source of truth)
    background.js      data fetching, sign-in, notifications, update check (~800 lines)
    popup.js           the whole UI: week, exams, grades, absences, rooms (~1570 lines)
    settings.js        settings page, styles list (STYLES), applyLook()
    i18n.js            German → English dictionary + translateDom()
    controls.js        custom dropdown/date controls + mouse drag-to-scroll
    content.js         runs on extranet pages: teacher names, presses "WISS Office 365"
    modules.js         offline copy of module descriptions (modulbaukasten)
    catalog.js         offline list of all 22 apprenticeships
    floorplans.js      SVG floor plans
    popup.html/.css    markup + all styles (styles are at the end of popup.css)
    fonts/             Doto + Space Mono (SIL OFL)
  firefox addon/       built by build-firefox.py
  android app/         Android project (Java, no libraries)
    app/src/main/java/ch/wisstools/stundenplan/
      MainActivity.java         WebView host, native bridge, cookies, update install
      Store.java                key-value storage (one JSON file, written in background)
      NextLessonWidget.java     widget: content, per-style layout, size adaptation
      WidgetConfigActivity.java widget settings with live preview
      Notifs.java, ReminderReceiver.java, BootReceiver.java
    app/src/main/res/layout/    widget_*.xml (one per style + widget_nothing_s for flat)
    web-src/app-shim.js         provides chrome.* APIs inside the app
    build-android-web.py        copies the web code into the app
  iphone/
    entry.js           decides: become the app (/extranet/?stundenplan) or show a helper button
    ios-shim.js        chrome.* APIs for Safari (localStorage, sign-in by navigation)
    build-ios.py       bundles everything into WISS-Stundenplan.user.js
  build-firefox.py     turns chrome addon/ into firefox addon/
  release.py           collects release files + writes updates.json
  updates.json         Firefox update manifest (read from the main branch)
  README.md, CHANGELOG.md, LICENSE (MIT), firefox-README.md, .gitignore
```

**Never commit or share:** `android app/wiss-stundenplan.jks` and `android app/keystore.properties` (the Android signing key). `.gitignore` covers them. If the key is lost, existing users can't update the app anymore (they'd have to uninstall first).

---

## 5. Data sources

### Tocco (`wiss.tocco.ch`)
REST API, same one the extranet uses. Base: `/nice2/rest/entities/2.0/<Entity>`. Works with the session cookie of a signed-in user.

| What | Entity / endpoint | Notes |
|---|---|---|
| Who am I | `/nice2/username` | `username`, `userEntityPk`, session `timeout` (30 min) |
| Lessons | `Reservation` | date, room, module (`relEvent.label`), class, comment, type of lesson |
| Grades | `Input_data` | grade, status, exam parts with weight |
| Absences | via `Reservation_registration` | status, lesson times |
| Attendance | event fields incl. `minimal_presence` | minimum attendance per module (not yet used for calculations) |
| Rooms | `Room` | name, floor, seats, area, building |
| Room bookings | `Reservation` (all, by date) | other classes come back anonymized |

- **Teacher names** are hidden from students in the API, but shown on the extranet timetable page. `content.js` reads them from that page (an old ExtJS table with paging, takes ~30 s).
- **Exam dates** are not in the data at all, hence the estimates.
- **Documents tab** exists in the extranet (personal + general documents). Not used yet (see section 13).

### modulbaukasten.ch
Module descriptions and the list of apprenticeships, via `www.modulbaukasten.ch/assets/auth.php` (token) and the Dynamics API at `ictbb.crm17.dynamics.com`. Has had a broken certificate, so the built-in copy is the fallback. Text belongs to ICT-Berufsbildung Schweiz (not covered by MIT).

### GitHub
`https://api.github.com/repos/Nicolas-Wehrle/Wiss-Stundenplan/releases/latest` for the update check (twice a day, cached 12 h).

---

## 6. Sign-in (the trickiest part)

Users sign in with their Microsoft school account through the extranet. The app never sees or types passwords.

**How the extranet behaves (learned the hard way):**
1. A session ends after **30 minutes** without use.
2. Signed out, `/extranet/` does **not** forward to Microsoft by itself. It shows a page "Herzlich willkommen im Extranet WISS" with a red **"WISS Office 365"** button. Only that button goes to Microsoft.
3. Microsoft usually remembers the user and comes straight back (`/extranet/?openidStatus=successful`).
4. An expired session cookie can also show that page.
5. The extranet page itself shows a "Verbindungs-Problem" dialog when its own connection/session drops. That's Tocco's, not ours.

**What the app does (`silentLogin()` in background.js):**
- Checks the session (`/nice2/username`). If valid, loads data directly.
- If not: opens `/extranet/#wiss-login` out of sight (browser: minimized window; Android: a WebView *behind* the app; iPhone: the page itself navigates).
- `content.js` sees the `#wiss-login` marker and presses "WISS Office 365" (at most twice per 2 minutes, so it can't loop). A fallback presses it from the background too.
- If the page doesn't move on: reload with a fresh address (`?wl=<timestamp>#wiss-login`). Only changing the `#` part does not reload, which was a real bug.
- If Microsoft waits for input for 12 s: Android brings the hidden screen to the front; browsers show the "Anmelden" banner. Android also brings it to the front if the background sign-in takes over 15 s.
- One last session check before asking the user.
- **Android:** session cookies are saved on pause and restored on start, but only if younger than 25 minutes.

Key constants: `LOGIN_TIMEOUT_MS = 30 s`, `NEEDS_USER_MS = 12 s`, `APP_SHOW_AFTER_MS = 15 s`, `MIN_GAP_MS = 60 s`, `REFRESH_MAX_MS = 90 s`.

---

## 7. Storage and performance

- **Chrome/Firefox:** `chrome.storage.local`.
- **Android:** `app-shim.js` loads everything once from `Store.java` and keeps it in memory. Writes are batched (250 ms) and handed to the phone, which writes to disk in the background, and flushes when the app is paused. (Before 1.9.5 every save wrote everything to disk while the app waited; that was the lag.)
- **iPhone:** `localStorage`, writes batched the same way, flushed on `pagehide`. Tests must change data through `chrome.storage.local.set`, never by editing localStorage directly (the in-memory copy overwrites it).
- Long lists use CSS `content-visibility: auto` (grades tab 35 → 9 ms).
- Preferences live under `prefs` (defaults in `PREF_DEFAULTS` in popup.js).

---

## 8. Styles and widget

- Styles are CSS on `<html data-style=… data-mode=…>`. Colours are CSS variables per style; the "signature" layout rules are at the end of `popup.css` ("STYLE SIGNATURES").
- Adding a style: add to `STYLES` in `settings.js`, CSS variables + signature block in `popup.css`, a preview card `.sp-<id>`, translations in `i18n.js`, and for the widget: `STYLES` + `palette()` in `NextLessonWidget.java`, a layout in `res/layout`, and the list in `WidgetConfigActivity.java`.
- **Widget sizes:** under 110 dp height = compact (status, one-line title, room/teacher; no "Danach" line), 135+ shows "Danach", 165+ shows two-line titles. Uses `OPTION_APPWIDGET_MAX_HEIGHT`.
- **Android gotcha:** tinting a shape that has no fill colour makes Android fill it with solid black first and then colour that black (Terminal widget turned fully green). Every outline-only shape needs `<solid android:color="#00000000"/>`.
- RemoteViews only allow FrameLayout, LinearLayout, TextView, ImageView etc. A plain `<View>` breaks the widget ("Couldn't add widget").
- The Nothing style draws its dot-matrix time as a bitmap (widgets can't use custom fonts).

---

## 9. Building

From the repo folder (Python 3, Node for checks; Android needs JDK 17+ and the Android SDK):

```
python build-firefox.py "chrome addon" "firefox addon"
python "android app/build-android-web.py" "chrome addon" "android app"
cd "android app" && gradlew assembleRelease && cd ..
python iphone/build-ios.py "chrome addon" iphone
```

- **Version:** change only `chrome addon/manifest.json`. Android's versionCode is derived from it (1.10.1 → 11001). Mozilla never signs the same version twice, so every release needs a new number.
- Firefox build adds `update_url` → lint with `addons-linter --self-hosted` (without the flag it reports one expected error).

---

## 10. Releasing

1. Raise the version, run the builds.
2. Upload `WISS-Stundenplan-Firefox.zip` to addons.mozilla.org as a new version, "On your own". Download the signed file, save it as `WISS-Stundenplan-Firefox.xpi` in the main folder.
3. `python release.py`. It collects 5 files into `release/v<version>/` (Chrome zip, Firefox zip + signed xpi, APK, iPhone script). It refuses an xpi with the wrong version and only updates `updates.json` when the right xpi is there. It takes the APK from the Android build folder, or from the main folder if there's none.
4. `git add . && git commit -m "…" && git push`. `updates.json` and `iphone/WISS-Stundenplan.user.js` must be on `main`.
5. `gh release create v<version> (Get-ChildItem release\v<version>\*).FullName --title "<version>" --notes-file release-notes-<version>.txt` (PowerShell). File names must stay exactly as they are; the update links point to them.

Users on versions before 1.9.3 don't have auto-update and need one manual install.

---

## 11. Testing

The legacy regression tests are Playwright scripts (Chromium) that simulate the school server, Microsoft and the platform. They're in the `tests-private/` folder next to this file (listed in `.gitignore`, so git never pushes it). **They contain a real snapshot of the user's timetable, grades and absences (`fixture.js`): never put them in the public repo.** The main Android/iPhone runners now use project-relative paths; some older performance scripts still need path adjustments. Public tests under `tests/` contain synthetic data only.

| Suite | What it covers | Last result |
|---|---|---|
| `tests-private/android/run.mjs` + `bridge-mock.js` | The whole Android app web layer with a fake native bridge: first sign-in, modules, teachers, panels, back button, rooms, session expiry, slow network, "WISS Office 365" page, Microsoft needing input, server never answering, widget data, settings, styles, new-grade notification, update banner, reset. Checks that no sign-in screen pops up after a break. | 24/24 |
| `tests-private/iphone/run.mjs` | The userscript in Chromium posing as an iPhone: takeover, sign-in by navigation, return to the app, update banner, helper button. | 14/14 |
| `tests-private/chrome/ext.mjs` | Loads the real Chrome extension. | OK |
| `tests-private/chrome/en.mjs` | Looks for leftover German text in English mode. | Clean (only proper nouns) |
| `tests-private/perf/*` | Render timing, CPU profiles, storage bridge traffic, mouse drag test. | |
| `tests-private/widget-mockups/*` | HTML recreations of the 9 widget layouts at 150 dp and 80 dp (no Android emulator was available). | |

Run Android tests on their own: when run right after a Gradle build, the "server never answers" test can time out from CPU load.

---

## 12. Known limits and decisions

- **iPhone:** no notifications, no widget (Apple only allows that for App Store apps). Sign-in happens in the open page; Safari can't do Microsoft's sign-in in the background.
- **Chrome:** no automatic updates outside the Chrome Web Store.
- **Exam dates** are estimates.
- Styles named **Apple, Samsung, Nothing, GitHub** are only inspired by those designs, no logos. For a store release they may need renaming (e.g. "iOS-Stil").
- The extranet's teacher-name table is slow (~30 s), so names load in the background.
- No school data ever goes to a server. That's a core promise; keep it.
- Don't probe Tocco for data the extranet doesn't show the student. If something looks like other people's data, report it to `ict@wiss.ch`.

---

## 13. Future plans

### End-to-end encrypted sync: implemented in 1.11.0, deployment pending

Implementation is in `chrome addon/sync-core.js`, `sync-engine.js`, `sync-background.js` and `sync-ui.js`, shared by all platforms. `sync-server/README.md` has the exact Render setup, protocol and pilot checklist. Service name: `wiss-stundenplan-sync`; source repo: `Nicolas-Wehrle/Wiss-Stundenplan`; private data repo: `Nicolas-Wehrle/Wiss-Stundenplan-Data`, branch `main`.

Implemented scope: notes, existing per-lesson exam corrections, ZP rule, target grade, rounding and selected apprenticeship. Appearance, language, notifications, widgets, school data and refresh intervals stay local. There is no new manual grade-value editor. Keys use trusted extension storage, Android app-private storage (backup disabled), and Userscripts private GM storage on iPhone. QR codes are generated locally with vendored MIT-licensed qrcode-generator 2.0.4.

The original design discussion below is retained for context, with these implemented adjustments:

- Account files also contain `seen` and the hashed authentication verifier: `{v, updated, seen, auth, blob}`.
- Batch after 15 seconds of inactivity, at most 20 seconds, leaving time for GitHub before Chrome's 30-second fetch limit. Requests abort after 24 seconds and retry. Success is shown only after durable GitHub confirmation.
- Per-item timestamps, deterministic device tie-breaks, persistent deletion markers and up to 50 local recoverable notes handle merging. Existing data uses baseline timestamps. Local notes save on input; uploads debounce for two seconds.
- Routine commits never force-push. A separate private-repo monthly maintenance workflow publishes a lock, then replaces history with one current snapshot. This is the only force-update exception. GitHub may retain objects/backups: there is no guaranteed 30-day physical-erasure claim, and keys can still exist on another device.
- Missing accounts are never recreated automatically. An ambiguous initial creation is recovered with GET; if still absent, disconnect and enable again. Local data is retained.
- Background browser alarms check every 15 minutes; mobile checks run while the app/page is active. No separate keep-alive pinger.
- Public tests in `tests/sync/` use synthetic data and cover encryption, migration, merging, durability, version conflicts, expiry, limits and GitHub persistence. `tests/browser/sync-ui.mjs` tests Android/iPhone adapters, private key storage, linking, QR, English, appearance and deletion. Private Android/iPhone regression suites passed. The private runners now resolve the current workspace.

Before release: deploy Render, install/run the private-repo maintenance workflow, verify real GitHub writes, test real Android/Safari devices, build/sign Android and Firefox. The Android build currently stops because no SDK location is configured; dependencies resolved successfully. The existing Firefox update manifest must remain unchanged until the matching signed XPI exists.

**Original design notes (the adjustments above take precedence):**

**Scope:** only notes, exam/grade corrections and settings. Strictly opt-in: before opt-in the client never contacts the server (in Chrome/Firefox the server domain is an *optional* host permission, requested only on opt-in). A button deletes everything on the server immediately.

**Identity and keys (no Microsoft login needed):**
- On opt-in the device creates a random 256-bit key. It never leaves the user's devices.
- The server only knows a random sync ID and a check value derived from the key (e.g. HKDF(key, "auth")), stored hashed. No email, no name.
- Second device: QR code (or typed code) from the first device.
- Recovery code shown once. All devices + code lost = data gone (say so clearly).
- No self-chosen passwords as keys (too weak).

**Crypto:** WebCrypto AES-256-GCM, random 96-bit IV per upload. One small package per user (a few KB).

**Syncing:** download, decrypt, merge per note by timestamp, encrypt, upload with a version number. The server rejects stale versions (compare-and-swap), the client merges again. Decide: which settings sync (theme probably per device), and auto-sync after changes vs. a "Sync now" button.

**Server (the user's preferred pattern):** Render web service with a private GitHub repo as the database. Agreed adjustments:
- One file per user: `data/<syncId>.json` = `{ v, updated, blob }`, not one big SQLite file.
- Commit ~30 s after the last change, nothing when idle, and **always on shutdown** (Render sends SIGTERM; its disk is wiped on restart). Pull the latest state on startup.
- Normal commits, no force pushes (so a bug can't destroy the backup).
- Deletion: remove the file right away, plus a monthly history rewrite to one fresh commit. Tell users: "Deleted from the server right away. Encrypted backup copies disappear within 30 days." Leftover copies are unreadable anyway once the key is gone (crypto-shredding).
- Auto-delete accounts after ~12 months without sync.
- Probably no keep-alive pinger: sync runs in the background, so the ~1 minute wake-up doesn't matter, and a pinger uses up the 750 free hours per month.
- Exactly one instance. Fine-grained GitHub token for that one repo only. Size limit (~256 KB per user) and rate limit.
- Put the server code in the repo so people can verify it.
- Render free tier facts (Oct 2026): spins down after 15 min idle, ~1 min wake-up, free Postgres deleted after 30 days. Check whether an EU region (Frankfurt) is available.
- Short privacy note: the server sees ID, package size, time, IP; no content.

### Big features with data we already have
1. **Absence budget per module:** from lesson count, absences and `minimal_presence`: "In 320 you can miss at most 2 more lessons", warn before the limit.
2. **Apprenticeship overview + final grade forecast:** all modules (done/current/upcoming), average per year, forecast of the vocational school grade for the QV and "what do I still need". Use the official formula from the training regulations, not memory; it differs per profession.
3. **Timetable change notifications:** compare each sync with the last ("Tomorrow 4.11 instead of 2.03", "Thursday Mathematik cancelled").

### Smaller ideas
- **Calendar export (.ics)** of lessons and exams, especially for iPhone users (gives them reminders and Apple's calendar widgets). Later: a subscription via the sync server.
- **Exam reminders** a few days before ZP/LB, moving with manual corrections; countdown in the exams tab.
- **Homework list:** notes with "due next lesson" and checkboxes, plus a list of open items.
- **"Today" widget** (Android) with the whole day.
- **Documents:** only a clean list (name, date, personal/general) that opens files in the extranet, plus a notification for new personal documents. Never store PDFs in the app. Low priority; needs a screenshot of the documents tab first.
- **Public transport:** next connection home after the last lesson (transport.opendata.ch).
- **GitHub Actions:** run the tests on every push and draft releases automatically (signing stays manual, the key never goes to GitHub).

### Store publishing (discussed, not started)
- Firefox store is free; Chrome Web Store $5 once; Edge free.
- Needs: a privacy policy page, no impression of being official (e.g. "Stundenplan für WISS (inoffiziell)"), justification for each permission.
- Code changes: remove the fixed `key` from the Chrome manifest (new extension ID, users switch once); remove `update_url` for a listed Firefox add-on (Mozilla handles updates).
- Ask WISS (`ict@wiss.ch`) first; their OK makes the listing much safer.

---

## 14. Version history (short)

- **1.10.1** Widget adapts to its height; fixed green Terminal widget fill.
- **1.10.0** Every style has its own app layout and widget layout; tab icons.
- **1.9.9** Sign-in runs behind the app; only shown when Microsoft needs input.
- **1.9.8** Presses "WISS Office 365" automatically; fixed the non-reloading reload.
- **1.9.7** Six new styles, style strip, mouse drag-to-scroll, phone tabs on one line.
- **1.9.6** Sign-in after 30+ minutes away.
- **1.9.5** Big Android performance fix, blurred email, safer `release.py`. *(latest public release when this was written)*
- **1.9.4** Repo moved to Nicolas-Wehrle; clearer Firefox instructions.
- **1.9.3** Auto-update on all platforms, `release.py`.
- Before that: the app itself, iPhone and Firefox versions, Android app with notifications and widget, absences, settings, styles, translations, offline module catalog.

Full details per version: `CHANGELOG.md`.

---

## 15. Notes for working on this project

- Use **Nicolas Wehrle** as the project author and copyright name. Use "user" for general references.

- The user prefers plain, natural wording in all texts (no "AI-sounding" phrasing, no long dashes) in the app, READMEs and release notes.
- App texts are German first; English comes from `i18n.js`. New German strings need an English entry.
- After changing `chrome addon/`, rebuild all four platforms and run the Android + iPhone tests.
- Deliver changes into `C:\Users\sever\Documents\Wiss-Stundenplan` and verify with checksums.
- Keep the signing key out of everything: commits, zips, chats.
