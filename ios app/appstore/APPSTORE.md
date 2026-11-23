# App Store Connect – WISS Stundenplan (iOS)

Everything you need to fill in on App Store Connect, field by field. German (primary language,
students at WISS are in Switzerland) plus English as a second localisation. The character limits
Apple enforces are in brackets; every text here fits.

Screenshots: `appstore/screenshots/de/` (7 PNGs, **1206 × 2622 px**).
Header image: `appstore/screenshots/header.png` (**5244 × 2950 px**).
Rebuild both any time with `python3 appstore/make_screens.py`.

---

## 1. App Information

| Field | Value |
|---|---|
| Name (30) | **WISS Stundenplan** |
| Subtitle (30) – DE | **Lektionen, Noten & Prüfungen** |
| Subtitle (30) – EN | **Classes, grades & exams** |
| Bundle ID | `dandev.Wiss-Stundenplan` |
| Primary language | German (Switzerland) – or German if CH isn't offered |
| Primary category | **Education** |
| Secondary category | **Productivity** |
| Content rights | **Yes, it contains, shows, or accesses third-party content, and I have the necessary rights** – the app loads the WISS site (wiss.tocco.ch) and public module info from modulbaukasten.ch; a written OK from WISS backs this up |
| Age rating | **4+** – answer "None" to everything; "Unrestricted Web Access": **No** (the app only opens the WISS site; other links open in Safari view) |

## 2. Pricing and Availability

- Price: **Free**, no in-app purchases.
- Availability: **Switzerland** is enough (WISS is a Swiss school). Add Germany/Austria/Liechtenstein only if you want.

## 3. App Privacy (the "nutrition label")

Answer **"Yes, we collect data"** only because of the optional device sync; everything else stays on the phone.

| Data type | Collected? | Linked to the user? | Tracking? | Purpose |
|---|---|---|---|---|
| Other User Content (notes, exam corrections, chosen settings – only when the user turns on device sync) | Yes | **No** | No | App Functionality |

Not collected: name, e-mail, password, grades/timetable on a server, location, identifiers,
usage data, diagnostics. School data comes from wiss.tocco.ch and is stored only on the device
(passwords are never read: sign-in happens on the official WISS / Microsoft pages).

- **Privacy Policy URL:** `https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/blob/main/PRIVACY-de.md`
  ⚠️ The policy currently says it applies to the *Chrome extension*. Ask Severin to add one line
  "gilt auch für die iOS-App" (or host your own copy) before you submit – Apple checks this.
- **Support URL:** `https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/issues`
- **Marketing URL (optional):** `https://stundenplan.severinwehrle.dev`

## 4. Version 1.13.0 – texts (German)

### Promotional Text (170) – can be changed any time without a review
> Neu: Noten mit Übersicht und Verlauf – tippe auf einen Punkt im Diagramm und sieh Modul, Note und deinen Schnitt danach. Plus Widgets für Home- und Sperrbildschirm.

### Description (4000)
```
Dein ganzer Schulalltag an der WISS – in einer App. WISS Stundenplan zeigt dir Lektionen, Prüfungen, Noten, Absenzen und freie Räume übersichtlich auf deinem iPhone.

Du meldest dich einfach mit deinem WISS-Konto auf der offiziellen WISS-Anmeldeseite an. Dein Passwort liest oder speichert die App nie.

STUNDENPLAN
• Die laufende Lektion mit Raum, Lehrperson und Restzeit auf einen Blick
• Wochenansicht mit allen Lektionen – Zwischenprüfungen sind markiert
• Was als Nächstes kommt, ohne zu suchen

PRÜFUNGEN
• Countdown bis zur nächsten Prüfung
• Alle Termine mit Datum, Zeit, Raum und Modul
• Prüfungen der nächsten 7 und 30 Tage auf einen Blick

NOTEN
• Dein Schnitt, deine Bestnote, abgeschlossene Module und ungenügende Noten
• Diagramm mit deinem Verlauf – tippe auf einen Punkt für Modul, Note und Datum
• Alle Modulnoten in einer klaren Liste

ABSENZEN
• Offene Absenzen und wie viele Tage du noch zum Entschuldigen hast
• Anwesenheit als übersichtliches Kalenderraster
• Erinnerung, bevor die Frist abläuft

FREIE RÄUME
• Sieh, welche Zimmer jetzt oder zu jeder anderen Uhrzeit frei sind
• Ideal für Gruppenarbeiten und Lernen zwischen den Lektionen

WIDGETS UND ERINNERUNGEN
• Widget für den Homescreen mit der nächsten Lektion
• Kleine Widgets für den Sperrbildschirm: Ring mit Restzeit, Lektion mit Raum oder eine Zeile über der Uhr
• Erinnerungen vor Lektionen, bei neuen Noten und vor Absenz-Fristen – auch wenn die App geschlossen ist

DEIN STIL
• 9 Stile: Standard, Apple, Samsung, Nothing, GitHub, Neon, Paper, Pastel und Terminal
• Hell, dunkel oder automatisch – mit deiner eigenen Akzentfarbe
• Deutsch und Englisch

PRIVAT
• Deine Schuldaten bleiben auf deinem iPhone
• Keine Werbung, kein Tracking, kein Konto bei uns
• Optionale Synchronisation zwischen Geräten – standardmässig aus

Noch kein Konto zur Hand? Mit dem Demokonto probierst du alle Funktionen mit fiktiven Daten aus.

WISS Stundenplan ist ein unabhängiges Schülerprojekt (Open Source auf GitHub) und keine offizielle App der WISS.
```

### Keywords (100) – comma, no spaces, words from the name are already indexed
```
Schule,Noten,Prüfung,Absenzen,Lektion,Raum,Zimmer,Berufsschule,Informatik,Lehre,Tocco,Widget,Schnitt
```

### What's New in This Version (4000)
```
• Noten: neue Übersicht mit Bestnote, abgeschlossenen Modulen, Schulmodulen und ungenügenden Noten
• Noten: tippe auf einen Punkt im Diagramm und sieh Modul, Note, deinen Schnitt danach und das Datum
• Noten: abgeschlossene Module als klare Liste mit Notenbalken
• Kleine Widgets für den Sperrbildschirm
• Einstellungen › Über: Danylo Kovalenko als Mitentwickler der iPhone-Version
```

### Copyright
`2026 Severin Wehrle, Danylo Kovalenko`

## 5. English localisation (add "English (U.K.)" or "English (U.S.)")

**Promotional Text**
> New: grades with an overview and history – tap a point in the chart to see the module, grade and your average after it. Plus widgets for the Home and Lock Screen.

**Description**
```
Your whole school day at WISS – in one app. WISS Stundenplan shows your lessons, exams, grades, absences and free rooms clearly on your iPhone.

Just sign in with your WISS account on the official WISS sign-in page. The app never reads or stores your password.

TIMETABLE
• The current lesson with room, teacher and time left at a glance
• Week view with every lesson – interim exams are marked
• What's next, without searching

EXAMS
• Countdown to your next exam
• Every date with time, room and module
• Exams in the next 7 and 30 days at a glance

GRADES
• Your average, best grade, finished modules and failing grades
• Chart of your progress – tap a point for module, grade and date
• All module grades in one clear list

ABSENCES
• Open absences and how many days you have left to excuse them
• Attendance as a clear calendar grid
• A reminder before the deadline passes

FREE ROOMS
• See which rooms are free now or at any other time
• Perfect for group work and studying between lessons

WIDGETS AND REMINDERS
• Home Screen widget with your next lesson
• Small Lock Screen widgets: ring with time left, lesson with room, or one line above the clock
• Reminders before lessons, for new grades and before absence deadlines – even when the app is closed

YOUR STYLE
• 9 styles: Standard, Apple, Samsung, Nothing, GitHub, Neon, Paper, Pastel and Terminal
• Light, dark or automatic – with your own accent colour
• German and English

PRIVATE
• Your school data stays on your iPhone
• No ads, no tracking, no account with us
• Optional sync between devices – off by default

No account at hand? Try every feature with fictional data in the demo account.

WISS Stundenplan is an independent student project (open source on GitHub) and not an official WISS app.
```

**Keywords**
```
school,timetable,schedule,grades,exams,absences,room,lesson,student,widget,vocational,IT,apprentice
```

**What's New**
```
• Grades: new overview with best grade, finished modules, school modules and failing grades
• Grades: tap a point in the chart to see the module, grade, your average after it and the date
• Grades: finished modules as a clear list with a grade bar
• Small widgets for the Lock Screen
• Settings › About: Danylo Kovalenko credited as co-developer of the iPhone version
```

## 6. App Review Information

- **Sign-in required:** Yes → but **don't** give a WISS account. Write this in *Notes* instead:

```
The app is for students of WISS (a Swiss IT school). Real data needs a WISS student account,
which we cannot share. Please use the built-in demo account instead:

1. Open the app. The setup screen appears.
2. Tap "Demokonto testen" (English: "Try demo account").
3. All features now work with fictional data: Woche (timetable), Prüfungen (exams),
   Noten (grades), Absenzen (absences), Räume (free rooms), Settings › Stil (9 styles).
4. Widgets: add "Stundenplan" to the Home Screen and "Stundenplan – Sperrbildschirm" to the
   Lock Screen – they show the next demo lesson.
5. Notifications: Settings › Benachrichtigungen › "Erlauben", then "Test".

Native features: WidgetKit Home and Lock Screen widgets, local notifications scheduled with
UNUserNotificationCenter (lesson reminders, absence deadlines, new grades), Keychain storage,
share sheet for downloads. Sign-in happens on the official WISS/Microsoft pages; the app never
sees the password. The project is open source:
https://github.com/Nicolas-Wehrle/Wiss-Stundenplan
```

- Contact: your name, phone and e-mail (only Apple sees them).

## 7. Things that can get the app rejected – check before you submit

1. **Guideline 4.2 (minimum functionality / "just a website")** – the app shows the school
   website's data. The review notes above list the native features (widgets, notifications);
   keep them in.
2. **Guideline 5.2 (names of others)** – "WISS" is the school's name. The description already
   says it is an independent, unofficial project. Best: get a short written OK from the school
   and add it under *Attachment* in App Review Information.
3. **Privacy policy** must mention the iOS app (see section 3).
4. **Build number** must be new for every upload (`update-web.sh` now raises it).
