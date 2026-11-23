# WISS Stundenplan – iOS app

Native iPhone/iPad app of [WISS Stundenplan](https://github.com/Nicolas-Wehrle/Wiss-Stundenplan)
(Chrome add-on / Android app). Unofficial, not made by WISS.

## How it works
It's the same app, not a rewrite. The original project already has an iPhone build
(`iphone/build-ios.py`, normally used with the Safari "Userscripts" extension). This app runs that
exact bundle, so the interface, all styles (Standard, Samsung, Nothing, GitHub, Pastell, Neon,
Papier, Terminal, light/dark), German/English and all data logic are identical.

- The app opens `https://wiss.tocco.ch/extranet/?stundenplan` in a `WKWebView` and injects the
  bundle at document start (`Web/wiss-stundenplan.user.js`), in its own script world.
- **Sign-in is the WISS one.** Without a valid session the app shows "Sign-in needed"; tapping
  *Anmelden* goes to the WISS extranet → Microsoft (Office 365) sign-in inside the app, and comes back
  to the timetable by itself. The app never sees or stores your password.
- Cookies (your WISS session) and data stay in the app's own storage on the phone.
- `Web/gm-bridge.js` + `GMBridge.swift` replace the userscript manager:
  cross-site requests only to `www.modulbaukasten.ch` / `ictbb.crm17.dynamics.com` (module
  descriptions), and the sync master key in the iOS Keychain.
- Offline: the app opens with the data saved on the phone.
- **Notifications** (like the Android app): a reminder before each lesson, 2 days before an
  absence has to be excused, and new grades. Settings → Benachrichtigungen. The add-on plans the
  reminders itself (`notifyPlan`), the phone schedules them (`Reminders.swift`), so they also come
  when the app is closed. New grades show up when the app refreshes.
- **Widget** (`StundenplanWidget/`, iOS 17+): current/next lesson with room and teacher, plus the one
  after. Same styles and colours as the Android widget; long-press → *Edit widget* to choose a style
  ("Wie in der App" by default), light/dark and background. Data is shared through the App Group
  `group.dandev.Wiss-Stundenplan`.
- **Lock-screen widgets** ("Stundenplan – Sperrbildschirm", `StundenplanWidget/LockScreenWidget.swift`):
  - round: during a lesson a ring that fills up with the end time in the middle; otherwise day, start
    time and room
  - rectangle: "JETZT · BIS 16:15" / "MORGEN · 08:15", module, room · teacher
  - inline (above the clock): time · module · room
- Outside links (GitHub, website) open in Safari; exported notes open the share sheet.

## Updating to a new upstream version
```bash
./scripts/update-web.sh
```
Clones the original repo, runs its own iPhone build, applies the one small patch (show the
notification settings instead of "no notifications on iPhone") and copies the result into `Wiss_Stundenplan/Web/`
(also sets the app version to the add-on version and raises the build number by one, ready for the next App Store upload). Pass a tag to pin a version, e.g. `./scripts/update-web.sh v1.13.0`.

## Building
Open `Wiss_Stundenplan.xcodeproj` in Xcode, pick your team under *Signing & Capabilities* for both
targets (app + `StundenplanWidgetExtension`), run. iOS 16 or newer (widget: iOS 17).
The App Group must be allowed for your team; if Xcode complains, change the group id in both
`.entitlements` files and in `SharedData.swift` / `StundenplanWidget/WidgetData.swift`.

Debug builds forward the web app's console to the Xcode console and allow Safari Web Inspector.
