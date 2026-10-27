# Changelog

All versions of WISS Stundenplan. Newest first.

## 1.11.0 (unreleased pilot)

- Optional end-to-end encrypted sync for notes, exam corrections, the ZP rule, target grade, rounding and apprenticeship. Appearance, notifications and school data stay on each device.
- Link devices with a recovery code or locally generated QR code. iPhone keys use Userscripts private storage.
- Automatic sync after edits, manual sync, per-item merging, deletion markers and local recovery of replaced notes.
- Public Render server source with private GitHub storage, durable versioned writes, account expiry and a monthly history-compaction template.
- German and English settings, separate school-refresh and device-sync status, disconnect and durable server deletion.
- Local note saves no longer wait for a typing debounce. Incoming sync updates appear without replacing an active note editor.
- Synthetic encryption/server/browser tests. Existing personal test fixtures remain private and ignored.

Deployment and real-device pilot checks are still required. No signed Firefox 1.11.0 update or Android APK is included in this source change.

## 1.10.1

**Widget**
- The widget now adapts to its size. A flat widget (one row high) shows status, title and room/teacher on one line each and leaves out the "Danach" line. Apple puts the time into the status line, Nothing uses a smaller dot-matrix time. From about 165 dp of height everything is shown, with two-line titles.
- The preview in the widget settings has the same height as the widget on the home screen.
- Fixed: the Terminal widget was filled with solid green (and the GitHub frame with grey). Android filled outline-only shapes before tinting them.

## 1.10.0

**Styles look different now, not just coloured differently**
- **Apple:** large title, iOS tab bar at the bottom with icons and a red badge, each day as one grouped list, calendar-style colour bars.
- **Samsung:** tall One UI header with a big title, tabs as one pill-shaped bar, large rounded cards.
- **GitHub:** each day as a box with a grey header row, monospace times, outlined labels, tab icons on the computer.
- **Pastell:** floating rounded tab bar at the bottom, cards tinted in the module colour, time in a bubble, soft colour blobs in the background.
- **Neon:** glowing grid in the background, gradient border on cards, gradient title, italic caps.
- **Papier:** lined notebook paper with a red margin line, folder tabs, day headings between lines, module numbers like highlighter.
- **Terminal:** `~/stundenplan_` with a blinking cursor, numbered tabs, `## MITTWOCH` headings, dashed lines, scanlines in dark mode.

**Widget**
- Every style has its own widget layout: large time (Apple), status pill (Samsung), time bubble (Pastell), glowing border (Neon), lined paper with serif font (Papier), monospace with dashed frame (Terminal).

## 1.9.9

**Sign-in**
- After a break the app now signs you in behind the timetable instead of showing the WISS page. The sign-in screen only comes to the front if Microsoft really needs you (for example after a password change), or if the background sign-in takes longer than 15 seconds.

## 1.9.8

**Sign-in**
- The extranet shows a welcome page with a red "WISS Office 365" button instead of going to Microsoft by itself. The app now presses that button for you (only that button, never a password), at most twice in 2 minutes so it can't loop. This works in the app, in Chrome, in Firefox and on iPhone.
- Fixed: the "reload" during sign-in never actually reloaded the page, so the app waited 30 seconds for nothing.
- When the WISS server doesn't answer at all, the app no longer waits twice as long before showing the error.

## 1.9.7

**New styles**
- Six new styles: Apple, Samsung, Pastell, Neon, Papier and Terminal (nine in total), each in light and dark.
- The style picker is now a sideways strip with a preview card for each style.

**Other**
- Everything that scrolls sideways can be dragged with the mouse (style picker, absence grid, settings categories).
- On phones all five tabs now fit on one line, no more swiping the tab bar.
- The widget can use all the new styles.

## 1.9.6

**Sign-in**
- After more than 30 minutes away, an expired WISS session could block the automatic sign-in. The app now loads the page again and checks one last time before asking you.
- The Android app only restores the old session if you were away less than 25 minutes.

## 1.9.5

**Faster**
- Android app: data is kept in memory and saved in the background. Before, every save wrote everything to disk while the app waited (a sync went from 20 slow storage calls to 2).
- iPhone: saves are grouped instead of writing everything on every change.
- Long lists only draw what's on screen. Opening the grades tab went from 35 ms to 9 ms, exams from 19 ms to 4 ms.

**Privacy**
- Your email address in the account section is blurred until you tap it.

**Releases**
- `release.py` also takes the APK from the main folder, refuses a signed Firefox file with the wrong version, and only updates `updates.json` when the matching signed file is there.

## 1.9.4

- The project moved to [Nicolas-Wehrle/Wiss-Stundenplan](https://github.com/Nicolas-Wehrle/Wiss-Stundenplan). All update links point there.
- Clearer download instructions: Firefox users need the signed `.xpi`, not the `.zip`.

## 1.9.3

**Updates**
- The app checks GitHub for new versions twice a day and shows a banner.
- Android: "Installieren" downloads the new APK and opens Android's install screen.
- Firefox: updates itself through `updates.json`.
- iPhone: the Userscripts app updates the script from the repository.
- Chrome: banner with a download link (Chrome doesn't allow automatic updates for add-ons outside its store).
- New `release.py` that collects all files for a GitHub release.

## Before 1.9.3

The features the app was built on:

- **Timetable** with the current and next lesson, holidays and school breaks, a week view, and a big view in its own tab.
- **Exams** (ZP, LB, projects), estimated where the extranet doesn't list them, correctable by hand.
- **Grades** with the average, a trend chart and a calculator for the grade you still need.
- **Absences** with a year grid, history, the 7-day deadline and attendance per module.
- **Rooms:** free rooms at any time, with floor plans for WISS Zürich.
- **Module info** from modulbaukasten.ch, with a built-in copy for when the site is down.
- **Notes** per lesson and teacher names.
- **Settings:** German and English, light and dark, accent colour, corners, size, modules in colour or plain.
- **Android app** with reminders, notifications for new grades and absences, and a home-screen widget with its own settings.
- **iPhone** version for Safari via the Userscripts app, plus a Firefox version for computers and Android.
- Automatic sign-in with your Microsoft school account. Everything stays on your device.
