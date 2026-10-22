# WISS Stundenplan (Chrome)

Shows your WISS timetable right away and updates it in the background, so you don't have to wait for the extranet.

Unofficial. Not made by or affiliated with WISS.

## Install
1. Unzip `WISS-Stundenplan-Chrome.zip` into a folder you keep. Chrome loads the add-on from there, so don't delete it.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the folder.
5. Pin the red **W** icon and open it. Sign in with your @wiss-edu.ch account and follow the setup.

To update, replace the files and click the reload icon on the add-on in `chrome://extensions`.

## What it does
- **Woche:** the current and next lesson, your week as a list or grid, holidays and school breaks.
- **Prüfungen:** ZP, LB and project dates. The extranet doesn't list them, so most are estimated (dashed). You can correct each one.
- **Noten:** your grades, your average over the year and what you still need for a 4, 5 or 6.
- **Absenzen:** all absences, the 7-day deadline to excuse them, attendance per module and a year overview.
- **Räume:** which rooms are free at any time, with floor plans of the 2nd and 4th floor in Zürich.
- **Einstellungen:** Deutsch/English, three styles (Standard, Nothing, GitHub), light/dark, reminders and more.

## Privacy
Everything is loaded with your own WISS login and only stored in your browser. Nothing is sent anywhere else.
Einstellungen > Daten > "Alles löschen" removes it all.

## How syncing works
- It uses the same Tocco API as the extranet, with your normal login.
- If your session ran out, it opens the extranet in a minimized window, Microsoft signs you in again and the window closes.
- If Microsoft wants your password, you'll see "Anmelden". Sign in once and it works on its own again.
- Teacher names aren't in the API. Once a week the add-on reads them from the extranet's timetable page in a minimized window.

## Files
- `background.js`: sync, sign-in, reminders
- `content.js`: reads teacher names on the extranet
- `popup.html`, `popup.css`, `popup.js`: the interface
- `settings.js`: settings page and styles
- `i18n.js`: English translation
- `controls.js`: dropdowns and date picker
- `floorplans.js`: floor plans of WISS Zürich
- `modules.js`: built-in module descriptions for Applikationsentwicklung (2021), from modulbaukasten.ch
- `catalog.js`: built-in list of apprenticeships, from modulbaukasten.ch
- `fonts/`: Doto and Space Mono (SIL Open Font License)
