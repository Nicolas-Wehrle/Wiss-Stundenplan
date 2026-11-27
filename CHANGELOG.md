## Unreleased

- Desktop app: ready for Flathub (Linux app stores) and winget (Windows). Flatpak recipe, store texts and screenshots in `desktop app/flatpak/`, winget manifests in `desktop app/winget/`, a test build of the Flatpak on GitHub, and automatic winget updates after each release.
- Flatpak: "Mit dem Computer starten" works through the desktop's Background portal and, like everywhere else, starts quietly in the tray.
- Flatpak: the tray icon shows its picture (it was empty, because the picture file was only visible inside the sandbox).
- Linux (.deb, .rpm, AppImage): the app menu now says "Erix Stundenplan". The package name stays the same, so updates keep working.

## 1.14.0

WISS Stundenplan is now **Erix Stundenplan**.


- New name: **Erix Stundenplan** (inoffiziell). The app, website, store texts, pictures, privacy policy and terms no longer name the school or the extranet's maker. Install IDs, file names and data folders stay the same, so nothing has to be installed again.
- Ready for the GitHub repository to be renamed to `Erix-Stundenplan`: the update check, the Android installer and the desktop updater accept both the old and the new name.
- Sign-in never pops up by itself anymore. When it's needed, the top of the app says "Anmeldung nötig", and ↻ shows the sign-in. The "Du musst dich kurz neu anmelden" banner is gone. This also stops the pop-ups when a VPN connects or the network changes.
- No internet or a very slow connection now shows "Kein Internet" or "Schlechte Verbindung" at the top instead of asking you to sign in. When the connection comes back, the app loads again quietly.
- Android and desktop app: "Alles löschen" now also signs out of the extranet (all sign-in cookies are deleted), so the app doesn't sign in again right away and "Demokonto testen" shows up.
- iPhone: native app in the App Store by Danylo Kovalenko (`ios app/`), with home and lock-screen widgets and reminders. It runs the same app code. The website now links to it; the Safari userscript stays as an alternative.
- Custom themes: one CSS file can restyle the whole app. Settings › Darstellung › Eigenes Theme: import a file or write one with a live preview, export, switch or delete. The active theme syncs to your other devices (up to 60 KB; all devices need this version). Nothing is loaded from the internet, a theme that hides the settings button is paused, and `?safe` starts without a theme. Theme rules win over the built-in styles on their own, so themes can also rebuild the layout. Four example themes in `themes/` (each with its own layout), guide on the website under Docs › Eigene Themes.
- Android widget: with the look "App" it follows the custom theme's base style, accent colour and light/dark mode.
- Demo account: changing a setting no longer resets the other settings.
- Android: file picker for importing files.
- Android: the app now reaches behind the status bar and the navigation bar, in the colours of your style. No more grey stripe at the top, and the clock and icons switch between light and dark with the app.

## 1.13.0

- Grades: new overview with best grade, finished and school modules and grades below 4 next to the average; finished modules as one list with a grade bar; tidier "all modules" section with clear status icons.
- Grades chart: point at a dot to see the module, its grade, the average after it and the date (tap on phones).
- Desktop app: grows with the window. On large screens everything gets bigger instead of staying small in the middle.
- Settings › About: Danylo Kovalenko is credited as co-developer for the iPhone version.

## 1.12.3

- Standard style: no more short white line under the tab you just left.

**New: desktop app for Windows, macOS and Linux**
- A real app instead of a browser add-on, built with Tauri: the installer is a few MB and it uses the web engine that's already on the computer.
- Same screens, styles and settings as everywhere else, always in the full-page layout.
- The sign-in runs in hidden windows. A window only appears when Microsoft really needs you, and closes itself afterwards.
- Lives in the tray: the next lesson and room in the tray menu, reminders and new grades as system notifications, also with the window closed.
- Mini window: a small card with the next lesson and room that stays on top. Turn it on in the tray menu.
- Can start with the computer (tray menu), quietly in the tray.
- Updates install themselves from the GitHub release (signed). On Linux, one command adds the app's own package source (Fedora, openSUSE, Ubuntu, Debian, Mint), and new versions then come with the normal system updates.
- GitHub builds the app for all three systems by itself whenever a release is published.

## 1.12.2

- Full screen: today and your next exams on the left, the week on the right. Lists stay at a readable width, and the header is bigger.
- No more black bars behind the header in full screen (Apple, Pastell, Neon, Papier, Nothing).
- Light animations on buttons, cards and fold-outs. Switching tabs is instant, without a fade. Can be turned off under Einstellungen › Darstellung › Animationen.
- New setting for the logo: matching the style, or always the red one.
- The card at the top of the week looks calmer in the Standard style: no glow, the room in plain colours.
- Firefox: the sign-in runs in a tab that is hidden from the tab bar, so nothing pops up anymore (it opened a window in front on Linux). Firefox asks once for the permission to hide tabs. If Microsoft ever needs you, nothing pops up either: the popup shows "Anmelden", and one tap shows the waiting sign-in. Chrome keeps using a minimized window. Under Einstellungen › Schuldaten aktualisieren › Selbst anmelden you can turn the background sign-in off completely.
- Rooms: new time picker. Big slider that no longer jumps while you drag, hour marks, and quick buttons for now and your lesson start times.
- Faster: screens that didn't change aren't redrawn, and long lists off screen are skipped until you scroll to them.
- Tab bars with icons (Pastell, Apple) use the full width again.
- Smoother scrolling: the blinking "now" dot and the Apple glass are much cheaper to draw, no fixed backgrounds.
- Settings: no more dark strip behind the section buttons.
- Readme links to the Chrome Web Store.

## 1.12.1: demo account on every platform
- Optional local demo account with invented data, in the same format as real data.
- Existing accounts are protected, and device sync is turned off in the demo.
- Firefox, Android and iPhone builds can load the demo and remove it for good.
- The logo is drawn through the DOM parser instead of setting innerHTML directly.
- Store pictures, German description, test instructions and privacy policy.
- The release packager removes the Chrome development key and refuses outdated APKs.

## 1.12.0

**New look**
- New logo: a tile with a 3×3 grid, one "today" square and a gold one. Every style has its own version, in the app and as the add-on icon in the browser toolbar.
- The Standard style has its own brand now: new fonts (Bricolage Grotesque for titles, Geist for text), warmer colours, softer cards and a gold "now" dot.
- Apple style uses the new glass look: a soft colourful background, see-through cards and a floating tab bar.
- The style previews in the settings show each style in the mode you're using, light or dark.
- In light mode there are no more dark cards.
- Much less text everywhere.

**Every tab starts with an overview**
- Week: a big card for the lesson now or next, with the room in large numbers and today's day as a strip. Below it, Monday to Friday at a glance; tap a day to jump to it.
- The next exam in the week card can be hidden with the ×, and turned back on in the settings.
- Exams: countdown to the next exam, numbers for the next 7 and 30 days, the rest grouped by month, past exams folded.
- Grades: your average, how many school modules are done, finished modules as tiles, the next four running modules first.
- Absences: what you still need to excuse comes first, then how many lessons you can still miss per module.
- Rooms: the free rooms that stay free the longest are at the top.

**Sync between your devices (new, optional)**
- Notes, exam corrections and a few settings can be synced between your devices, end-to-end encrypted. Off until you turn it on.
- Link a new device with an 8-character code from "Gerät hinzufügen". The code works once and only for 10 minutes.
- Recovery code with a QR code, in case all devices are gone.
- In Chrome you only have to press "Einschalten" once. The add-on finishes after you allow access.

**Privacy**
- On the first start the app shows in a few points what happens with your data. You can read it again under Einstellungen, Über.

**Sync server**
- Wrong or unknown requests are rejected without touching storage, so nobody can block sync for everyone.
- Limits on how many accounts can be created, a cap on storage calls per hour, and stricter HTTPS headers.

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
