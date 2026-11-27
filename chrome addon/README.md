# Erix Stundenplan (Chrome)

Shows your timetable right away and updates it in the background, so you don't have to wait for the extranet.

Unofficial. Not made by or affiliated with your school.

## Install
**Easiest:** install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/wiss-stundenplan/ljhofcahlfajoepidneficpnjckmcomc). Works in Chrome, Edge and Brave, and updates itself. Then pin the logo in the toolbar, open it and sign in with your WISS account.

**By hand** (for testing a build):
1. Unzip `WISS-Stundenplan-Chrome.zip` into a folder you keep. Chrome loads the add-on from there, so don't delete it.
2. Open `chrome://extensions` (Edge: `edge://extensions`), turn on **Developer mode** and click **Load unpacked**, then pick the folder.
3. To update, replace the files and click the reload icon on the add-on. A banner in the add-on tells you when there's a new version.

Want to look around first? Choose "Try demo account" (Demokonto testen) during setup. No school login needed, all data is invented.

## What it does
- **Week:** the current and next lesson, your week as a list or grid, holidays and school breaks.
- **Exams:** ZP, LB and project dates with a countdown. The extranet doesn't list them, so most are estimated (dashed). You can correct each one.
- **Grades:** your grades, your average over the year, a history chart and what you still need for a 4, 5 or 6.
- **Absences:** all absences, the 7-day deadline to excuse them, attendance per module and a year overview.
- **Rooms:** which rooms are free at any time, with floor plans of the Zürich building.
- **Settings:** German/English, nine styles, light and dark, accent colour, reminders, optional sync between your devices and more.

## Privacy
Everything is loaded with your own school login and only stored in your browser. Nothing is sent anywhere else, unless you turn on the optional end-to-end encrypted sync (notes, exam corrections and some settings only). Settings > Data > "Delete everything" removes it all. Full details: [PRIVACY.md](../PRIVACY.md).

## How syncing works
- It uses the same interface as the extranet website, with your normal login.
- If your session ran out, it opens the extranet in a minimized window, Microsoft signs you in again and the window closes.
- If Microsoft wants your password, you'll see "Sign in" (Anmelden). Sign in once and it works on its own again.
- Teacher names aren't in the API. Once a week the add-on reads them from the extranet's timetable page in a minimized window.

## Files
- `background.js`: sync, sign-in, reminders
- `content.js`: reads teacher names on the extranet
- `popup.html`, `popup.css`, `popup.js`: the interface
- `settings.js`: settings page and styles
- `i18n.js`: English translation
- `controls.js`: dropdowns and date picker
- `floorplans.js`: floor plans of the Zürich building
- `modules.js`: built-in module descriptions for Applikationsentwicklung (2021), from modulbaukasten.ch
- `catalog.js`: built-in list of apprenticeships, from modulbaukasten.ch
- `demo.js`: the invented data for the demo account
- `sync-*.js`: the optional encrypted device sync
- `fonts/`: Bricolage Grotesque, Geist, Doto and Space Mono (SIL Open Font License)
