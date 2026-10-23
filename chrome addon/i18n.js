// Language layer (Deutsch / English).
// The code is written in German. In English mode:
//  • tr('…') looks a phrase up in EN (used where text is built in code), and
//  • translateDom(el) runs after every render and translates text nodes + titles/placeholders:
//    exact phrases via EN, then patterns (dates, counts, …) via RULES.
// Module names and other data from the school are left as they are.
(() => {
  let lang = 'de';

  // apply the cached look before anything renders (no flash of the default style)
  try {
    const L = JSON.parse(localStorage.getItem('wissLook') || 'null');
    if (L) {
      const r = document.documentElement;
      r.dataset.style = L.style || 'standard';
      r.dataset.mode = L.mode === 'system' || !L.mode ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : L.mode;
      if (L.acc) r.style.setProperty('--accent', L.acc);
      if (L.mono) r.dataset.mono = '1';
      r.dataset.corners = L.corners || 'round'; r.dataset.size = L.size || 'm';
      lang = L.lang === 'en' ? 'en' : 'de';
      r.lang = lang;
    }
  } catch (e) {}

  const EN = {
    'Installieren': 'Install', 'Herunterladen': 'Download', 'Update laden': 'Get update', 'Version {V} ist da.': 'Version {V} is out.',
    'ZIP entpacken, alten Ordner ersetzen, dann in chrome://extensions neu laden.': 'Unzip it, replace the old folder, then reload it in chrome://extensions.',
    'Lädt…': 'Downloading…', 'Du hast die neuste Version.': 'You have the latest version.', 'Updates': 'Updates', 'Antippen zum Anzeigen': 'Tap to show', 'Wie iOS': 'Like iOS', 'Wie One UI': 'Like One UI', 'Pastell': 'Pastel', 'Sanfte Farben': 'Soft colours', 'Leuchtend': 'Glowing', 'Papier': 'Paper', 'Warm, mit Serifen': 'Warm, with serifs', 'Grün auf Schwarz': 'Green on black', 'Prüfen': 'Check',
    'Prüfe…': 'Checking…', 'GitHub nicht erreichbar.': 'Can\'t reach GitHub.', 'Öffnen': 'Open',
    // header / tabs / status
    'Stundenplan': 'Timetable', 'Woche': 'Week', 'Prüfungen': 'Exams', 'Noten': 'Grades', 'Absenzen': 'Absences', 'Räume': 'Rooms',
    'Einstellungen': 'Settings', 'Jetzt aktualisieren': 'Refresh now', 'Gross im Tab öffnen': 'Open in a big tab',
    'Aktualisiere…': 'Updating…', 'Anmeldung nötig': 'Sign-in needed', 'Fehler': 'Error', 'Noch keine Daten': 'No data yet',
    ' (dauert länger, tippe ↻ zum Neustarten)': ' (taking longer, tap ↻ to restart)',
    'Du musst dich kurz neu anmelden.': 'You need to sign in again.',
    'Anmelden': 'Sign in', 'Später': 'Later', 'Konnte nicht aktualisieren:': 'Could not update:',
    'Der WISS-Server antwortet nicht. Versuch es später nochmals.': 'The WISS server isn\'t responding. Try again later.',
    'Zeitüberschreitung, bitte nochmals aktualisieren': 'Timeout, please refresh again',

    // week
    'Heute': 'Today', 'HEUTE': 'TODAY', 'Kein Unterricht': 'No lessons', 'Feiertag': 'Public holiday', 'Für heute fertig': 'Done for today',
    'Noch kein Stundenplan': 'No timetable yet', 'Lade deinen Stundenplan…': 'Loading your timetable…',
    'Noch keine Daten. Tippe oben auf ↻.': 'No data yet. Tap ↻ at the top.',
    'Diese Woche ist vorbei. Mit dem Pfeil oben gehts zur nächsten.': 'This week is over. Use the arrow above for the next one.',
    'Vergangenes ausblenden': 'Hide past lessons', 'Nächste Prüfung:': 'Next exam:', 'Vorherige Woche': 'Previous week', 'Nächste Woche': 'Next week',
    'Schliessen': 'Close', 'Weihnachtsferien': 'Christmas holidays', 'Sportferien': 'Ski holidays', 'Frühlingsferien': 'Spring holidays',
    'Sommerferien': 'Summer holidays', 'Herbstferien': 'Autumn holidays', 'Unterrichtsfrei': 'No school',

    // lesson panel
    'Raum': 'Room', 'Dozent/in': 'Teacher', 'Modultag': 'Module day', 'Note': 'Grade', 'Lektion': 'Lesson', 'Modulinfo': 'Module info',
    'Modulverlauf': 'Module timeline', 'Meine Notizen': 'My notes', 'z.B. Laptop mitnehmen, Kapitel 3 lernen…': 'e.g. bring laptop, study chapter 3…',
    'Gespeichert ✓': 'Saved ✓', 'Keine': 'None', 'Automatisch': 'Automatic', 'geschätzt': 'estimated', 'Kompetenz:': 'Competence:', 'Objekt:': 'Object:',
    'Handlungsziele': 'Learning objectives', 'Modulbeschreibung (PDF) ↗': 'Module description (PDF) ↗', 'da': 'present', 'entsch.': 'exc.',
    'unentsch.': 'unexc.', 'geplant': 'planned', 'Frist vorbei': 'deadline passed', 'Abwesend': 'Absent', 'Zeit': 'Time', 'Modul': 'Module', 'Notiz:': 'Note:',
    'Dieses Modul ist (noch) nicht in deinem Stundenplan.': 'This module is not (yet) in your timetable.',
    'Prüfung in dieser Lektion': 'Exam in this lesson',

    // exams
    'Keine Prüfungen gefunden.': 'No exams found.', 'Nächste 7 Tage': 'Next 7 days', 'Später': 'Later', 'Vergangen': 'Past',
    'Zwischenprüfung': 'Interim exam', 'Leistungsbeurteilung': 'Assessment', 'Projekt': 'Project', 'Note ausstehend': 'Grade pending',
    'gestrichelt': 'dashed', '= geschätzt, Klick zum Korrigieren': '= estimated, click to correct',

    // grades
    'Noch keine Noten geladen.': 'No grades loaded yet.', 'Schnitt': 'Average', 'Abgeschlossen': 'Completed', 'Ungenügend': 'Insufficient',
    'Laufend': 'Ongoing', 'offen': 'open', 'Rest': 'rest', 'bisher': 'so far', 'Nötig für': 'Needed for', 'für eine {T} im Modul': 'for a {T} in the module',
    'Für eine {T} brauchst du in {R} ({W} %) mindestens eine {N}.': 'For a {T} you need at least a {N} in {R} ({W} %).',
    'Für eine {T} brauchst du in {R} ({W} %) im Schnitt mindestens eine {N}.': 'For a {T} you need an average of at least {N} in {R} ({W} %).',
    'Eine {T} geht nicht mehr, höchstens noch eine {M}.': 'A {T} isn\'t possible anymore, {M} at most.',
    'Schnitt im Verlauf': 'Average over time', 'aktuell': 'now', 'Modulnote': 'Module grade', 'frühere Module': 'earlier modules',
    'Alle Module der Ausbildung': 'All modules of the apprenticeship', 'abgeschlossen': 'completed', 'läuft': 'running', 'benotet': 'graded',
    'noch nicht geplant': 'not planned yet', 'Wahl': 'Elective', 'Modulbeschreibungen: modulbaukasten.ch (ICT-Berufsbildung Schweiz)': 'Module descriptions: modulbaukasten.ch (ICT-Berufsbildung Schweiz)',
    'offen · üK = überbetrieblicher Kurs': 'open · üK = inter-company course',

    // absences
    'Lade Absenzen…': 'Loading absences…', 'Noch keine Absenzen geladen. Tippe oben auf ↻.': 'No absences loaded yet. Tap ↻ at the top.',
    'Zu entschuldigen': 'To excuse', 'nichts offen': 'nothing open', 'Jetzt entschuldigen': 'Excuse now', 'Übersicht': 'Overview', 'Verlauf': 'History',
    'Anwesenheit': 'Attendance', 'kein Unterricht': 'no lessons', 'Ferien': 'Holidays', 'keine Daten': 'no data', 'anwesend': 'present',
    'entschuldigt': 'excused', 'teilweise': 'partial', 'unentschuldigt': 'unexcused', 'dispensiert': 'exempt', 'abwesend': 'absent',
    'teilweise abwesend': 'partly absent', 'Wochenende': 'Weekend', 'Kein Unterricht an diesem Tag.': 'No lessons on this day.',
    'Unter der Mindestanwesenheit': 'Below the minimum attendance', 'Minimum nicht mehr erreichbar': 'Minimum no longer reachable',
    'Keine Daten (vor deinem Stundenplan-Zeitraum)': 'No data (before your timetable period)', 'zum Entschuldigen': 'to excuse',
    'Frist abgelaufen': 'Deadline passed', 'Nichts zu entschuldigen.': 'Nothing to excuse.',

    // rooms
    'Neu laden': 'Reload', 'Lade…': 'Loading…', 'Lade Raumbelegung…': 'Loading room occupancy…', 'frei': 'free', 'belegt': 'occupied',
    'Du': 'You', 'andere Klasse': 'other class', 'Andere Klasse (Details nicht sichtbar)': 'Other class (details not visible)',
    'Den ganzen Tag frei': 'Free all day', 'Ganzer Tag frei': 'Free all day', 'reserviert': 'reserved', 'Langzeit reserviert': 'Reserved long-term',
    'nicht buchbar': 'not bookable', 'Deine Lektion:': 'Your lesson:', 'deine Klasse:': 'your class:', 'Treppe': 'Stairs', 'Lift': 'Lift', 'WC': 'WC',
    'Verpflegung': 'Catering', 'Aufenthalt': 'Lounge', 'Kurs-': 'Course', 'leitung': 'office', 'Drucker': 'Printer', 'Empfang': 'Reception',
    'Schulleitung': 'Management', 'Höhere BB': 'Higher ed.', 'Grundbildung': 'Basic ed.', 'Treppe · Lift': 'Stairs · Lift', 'Treppe · Lift · WC': 'Stairs · Lift · WC',
    'Räume konnten nicht geladen werden:': 'Rooms could not be loaded:', 'bis': 'until', 'ab': 'from',

    // setup wizard + settings
    'Willkommen': 'Welcome', 'Stundenplan, Prüfungen, Noten und Räume ohne Warten. Deine Daten bleiben auf deinem Gerät.': 'Timetable, exams, grades and rooms without the wait. Your data stays on your device.',
    'WISS-Konto': 'WISS account', 'Lehrberuf': 'Apprenticeship', 'ZP-Schätzung': 'Interim exam estimate', 'Prüfe Anmeldung…': 'Checking sign-in…',
    'Schon angemeldet': 'Already signed in', 'Melde dich im neuen Fenster an, danach geht es hier weiter.': 'Sign in in the new window, then it continues here.',
    'Zugriff erlauben': 'Allow access', 'Braucht Zugriff auf': 'Needs access to', 'und': 'and', 'Lehrpersonen aktualisieren': 'Update teachers',
    'Lehrpersonen laden…': 'loading teachers…', 'Läuft im Hintergrund (~30 s)…': 'Running in the background (~30 s)…', 'Für Modulbeschreibungen.': 'For module descriptions.',
    'Wird nach der Anmeldung erkannt.': 'Detected after you sign in.', 'Lade Lehrberufe…': 'Loading apprenticeships…', 'Lade Module…': 'Loading modules…',
    'Laden': 'Load', '– wählen –': '– choose –', 'Erneut versuchen': 'Try again', 'Erkannt:': 'Detected:',
    'Das Extranet zeigt keine Prüfungsdaten, darum werden sie geschätzt. LB und Projekt sind am letzten Modultag. Einzelne Lektionen kannst du von Hand ändern.': 'The extranet doesn\'t show exam dates, so they get estimated. LB and project are on the last module day. You can change single lessons by hand.',
    'Jede 3. Lektion': 'Every 3rd lesson', 'Tag 3, 6, 9 …': 'day 3, 6, 9 …', 'Einmal': 'Once', 'nur am 3. Tag': 'only on day 3', 'nur LB/Projekt': 'only LB/project',
    'Los geht’s': 'Let’s go', 'Erst anmelden': 'Sign in first', 'Fertig': 'Done', 'Lokale Daten': 'Local data',
    'Löscht Stundenplan, Noten, Notizen und Einstellungen in diesem Browser. Dein WISS-Konto bleibt.': 'Deletes timetable, grades, notes and settings in this browser. Your WISS account stays.',
    'Löscht Stundenplan, Noten, Notizen und Einstellungen auf diesem Gerät.': 'Deletes timetable, grades, notes and settings on this device.',
    'Alles löschen': 'Delete everything', 'Wirklich löschen?': 'Really delete?', 'Inoffiziell · wiss.tocco.ch · modulbaukasten.ch': 'Unofficial · wiss.tocco.ch · modulbaukasten.ch',
    'Kategorien': 'Categories', 'Konto': 'Account', 'Darstellung': 'Appearance', 'Benachrichtigungen': 'Notifications', 'Synchronisation': 'Sync', 'Daten': 'Data', 'Über': 'About',
    'Sprache': 'Language', 'Stil': 'Style', 'WISS-Rot': 'WISS red', 'Schwarz-weiss': 'Black and white',
    'GitHub-Farben': 'GitHub colours', 'Modus': 'Mode', 'System': 'System', 'Hell': 'Light', 'Dunkel': 'Dark', 'Akzentfarbe': 'Accent colour',
     'Vom Stil': 'From the style', 'Auto': 'Auto', 'Eigene Farbe': 'Custom colour',
    'Modulfarben': 'Module colours', 'Bunt': 'Colourful', 'Einfarbig': 'Single colour',
    'Ecken': 'Corners', 'Rund': 'Round', 'Eckig': 'Square', 'Textgrösse': 'Text size', 'Start-Ansicht': 'Start view',
    'Zuletzt offen': 'Last opened', 'Im Popup nur kommende Lektionen dieser Woche zeigen': 'Only show upcoming lessons of this week in the popup',
    'Benachrichtigungen sind blockiert': 'Notifications are blocked', 'Sonst kommen keine Erinnerungen.': 'Otherwise no reminders arrive.', 'Erlauben': 'Allow',
    'Vor jeder Lektion': 'Before each lesson', 'z.B. "Mathematik in ZH-404, 10:30"': 'e.g. "Mathematik in ZH-404, 10:30"', 'Vorlauf': 'How early', 'Min.': 'min',
    'Absenzen-Frist': 'Absence deadline', '2 Tage bevor die Frist abläuft': '2 days before the deadline', 'Neue Noten': 'New grades',
     'Testen': 'Test', 'Test-Benachrichtigung': 'Test notification', 'Gesendet ✓': 'Sent ✓',
    'Erinnerungen kommen auch bei geschlossener App. Neue Noten siehst du, sobald die App aktualisiert.': 'Reminders also come when the app is closed. New grades show up once the app refreshes.',
    'Erinnerungen kommen nur, wenn der Browser offen ist.': 'Reminders only come while the browser is open.', 'Wunschnote': 'Target grade',
    'Für den Notenrechner': 'For the grade calculator', 'Rundung der Modulnote': 'Module grade rounding',
     'keine': 'none', 'Im Hintergrund': 'In the background',
    'Lädt regelmässig neue Daten': 'Loads new data regularly', 'Aus': 'Off', 'Jetzt': 'Now', 'Aktualisieren': 'Refresh',
    'Läuft…': 'Running…', 'Diagnose': 'Diagnostics', 'Notizen': 'Notes', 'Kopieren': 'Copy', 'Exportieren': 'Export', 'Kopiert ✓': 'Copied ✓', 'Nicht möglich': 'Not possible',
    'Inoffiziell, nicht von der WISS': 'Unofficial, not made by WISS',
    'Daten: wiss.tocco.ch (dein Login) · Module: modulbaukasten.ch · Schriften: Doto, Space Mono (SIL OFL)': 'Data: wiss.tocco.ch (your login) · Modules: modulbaukasten.ch · Fonts: Doto, Space Mono (SIL OFL)',
    'Datum wählen': 'Choose date', '✓ {N} Module geladen': '✓ {N} modules loaded',
    '✓ {N} Module (eingebaut, modulbaukasten.ch ist gerade offline)': '✓ {N} modules (built in, modulbaukasten.ch is offline right now)',
    'modulbaukasten.ch ist gerade offline. Die Beschreibungen kannst du später mit "Laden" holen.': 'modulbaukasten.ch is offline right now. You can get the descriptions later with "Load".',
    'modulbaukasten.ch ist gerade offline, darum wird die eingebaute Liste verwendet.': 'modulbaukasten.ch is offline right now, so the built-in list is used.', 'Auf dem iPhone gibt es keine Benachrichtigungen. Das erlaubt Apple nur Apps aus dem App Store.': 'There are no notifications on iPhone. Apple only allows that for App Store apps.', '1 Block': '1 block', '{N} Blöcke': '{N} blocks', '· geschätzt': '· estimated', 'Geschätzt': 'Estimated',
    'Tag der Arbeit': 'Labour Day', 'Neujahr': 'New Year', 'Berchtoldstag': 'St Berchtold’s Day', 'Karfreitag': 'Good Friday', 'Ostermontag': 'Easter Monday',
    'Auffahrt': 'Ascension Day', 'Pfingstmontag': 'Whit Monday', 'Bundesfeier': 'Swiss National Day', 'Weihnachten': 'Christmas', 'Stephanstag': 'St Stephen’s Day',
    'Noch {F} Lekt. geplant · am Ende max. {R}': '{F} lessons still planned · max. {R} at the end', 'noch {B} Lekt. Puffer': '{B} lessons of buffer left', 'Vorheriger Monat': 'Previous month', 'Nächster Monat': 'Next month'
  };

  const WD_L = { Montag: 'Monday', Dienstag: 'Tuesday', Mittwoch: 'Wednesday', Donnerstag: 'Thursday', Freitag: 'Friday', Samstag: 'Saturday', Sonntag: 'Sunday' };
  const WD_S = { Mo: 'Mon', Di: 'Tue', Mi: 'Wed', Do: 'Thu', Fr: 'Fri', Sa: 'Sat', So: 'Sun' };
  const MON = { Jan: 'Jan', Feb: 'Feb', 'Mär': 'Mar', Apr: 'Apr', Mai: 'May', Jun: 'Jun', Jul: 'Jul', Aug: 'Aug', Sep: 'Sep', Okt: 'Oct', Nov: 'Nov', Dez: 'Dec' };
  const MONTHS_FULL = { Januar: 'January', Februar: 'February', 'März': 'March', April: 'April', Mai: 'May', Juni: 'June', Juli: 'July', August: 'August', September: 'September', Oktober: 'October', November: 'November', Dezember: 'December' };
  const MON_RE = 'Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez';
  const plural = (n, one, many) => (String(n) === '1' ? one : many);

  // patterns for text built from data (order matters: longer / more specific first)
  const RULES = [
    [/\bvor (\d+) (Tag|Tagen|Wochen?|Min\.?|Minuten|Std\.?|Stunden)\b/g, (m, n, u) => `${n} ${/^Tag/.test(u) ? plural(n, 'day', 'days') : /^Woche/.test(u) ? plural(n, 'week', 'weeks') : /^Min/.test(u) ? 'min' : plural(n, 'hour', 'hours')} ago`],
    [/\bin (\d+) (Tag|Tagen)\b/g, (m, n) => `in ${n} ${plural(n, 'day', 'days')}`],
    [/\bAktualisiert gerade eben\b/g, 'Updated just now'], [/\bgerade eben\b/g, 'just now'], [/\bAktualisiert\b/g, 'Updated'], [/\bgestern\b/g, 'yesterday'],
    [/\bheute\b/g, 'today'], [/\bmorgen\b/g, 'tomorrow'], [/\bübermorgen\b/g, 'in 2 days'],
    [/\bStand\b/g, 'as of'],
    [/^JETZT · NOCH (.+)$/g, 'NOW · $1 LEFT'], [/^Jetzt · noch (.+)$/g, 'Now · $1 left'], [/\bJETZT\b/g, 'NOW'], [/\bNÄCHSTE\b/g, 'NEXT'], [/\bDANACH\b/g, 'AFTER'],
    [/\bnoch (\d+) Tage?\b/g, (m, n) => `${n} ${plural(n, 'day', 'days')} left`], [/\bnoch 1 Tag\b/g, '1 day left'],
    [/(\d+) vergangene Lektion(en)? anzeigen/g, (m, n) => `Show ${n} past ${plural(n, 'lesson', 'lessons')}`],
    [/\bMo–Di\b/g, 'Mon–Tue'], [/ \+ heute\b/g, ' + today'],
    [/\bKW (\d+)/g, 'Week $1'],
    [/\bTag (\d+) von (\d+)\b/g, 'Day $1 of $2'], [/\bTag (\d+)\/(\d+)\b/g, 'Day $1/$2'], [/\bModul (\d)/g, 'Module $1'], [/\bModul\b/g, 'Module'],
    [/\bendet\b/g, 'ends'], [/\bläuft bis\b/g, 'runs until'],
    [/(\d+(?:\.\d+)?) Lektionen verpasst/g, '$1 lessons missed'], [/(\d+(?:\.\d+)?) Lektionen\b/g, '$1 lessons'], [/(\d+(?:\.\d+)?) Lektion\b/g, '$1 lesson'], [/(\d+(?:\.\d+)?) Lekt\./g, (m, n) => `${n} ${plural(n, 'lesson', 'lessons')}`],
    [/(\d+) Noten\b/g, '$1 grades'], [/(\d+) Lehrpersonen\b/g, '$1 teachers'], [/(\d+) Plätze\b/g, '$1 seats'], [/(\d+) Räume\b/g, '$1 rooms'], [/(\d+) RÄUME\b/g, '$1 ROOMS'],
    [/(\d+) Absenz(en)?\b/g, (m, n) => `${n} ${plural(n, 'absence', 'absences')}`], [/(\d+) Tage anwesend\b/g, '$1 days present'],
    [/(\d+) entschuldigt\b/g, '$1 excused'], [/(\d+) unentschuldigt\b/g, '$1 unexcused'], [/(\d+) Prüfungen\b/g, '$1 exams'],
    [/(\d+) von (\d+) frei um/g, '$1 of $2 free at'], [/\b(\d+) von (\d+)\b/g, '$1 of $2'], [/\bdeine Klasse:/g, 'your class:'],
    [/(\d+) gespeichert\b/g, '$1 saved'], [/(\d+) Module geladen\b/g, '$1 modules loaded'], [/(\d+) offen\b/g, '$1 open'],
    [/\bFrist (\d+) Tage\b/g, 'deadline $1 days'], [/\binnert (\d+) Tagen \(Teams-Genehmigung\)/g, 'within $1 days (Teams approval)'],
    [/\bMinimum (\d+) %/g, 'minimum $1 %'], [/\bmin\. (\d+) %/g, 'min. $1 %'], [/\bAnwesenheit\b/g, 'Attendance'],
    [/\bNoch (\d+) Lekt\. geplant\b/g, '$1 les. still planned'], [/\bam Ende max\./g, 'max. at the end'], [/\bnoch (\d+) Lekt\. Puffer\b/g, '$1 les. buffer left'],
    [/\bSemester (\d+)\b/g, 'Semester $1'], [/(\d+(?:\.\d+)?) entsch\./g, '$1 exc.'], [/(\d+(?:\.\d+)?) unentsch\./g, '$1 unexc.'],
    [/\bZuletzt: /g, 'Last: '], [/\bletzte Aktualisierung, /g, 'last update, '],
    [/\bSchule wieder ab\b/g, 'school again from'], [/\bLetzter bekannter Schultag:/g, 'Last known school day:'],
    [/\b(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b/g, (m) => WD_L[m]],
    [/\b(MONTAG|DIENSTAG|MITTWOCH|DONNERSTAG|FREITAG|SAMSTAG|SONNTAG)\b/g, (m) => WD_L[m[0] + m.slice(1).toLowerCase()].toUpperCase()],
    [new RegExp(`\\b(Mo|Di|Mi|Do|Fr|Sa|So)(?=,? \\d)`, 'g'), (m) => WD_S[m]],
    [/\b(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/g, (m) => MONTHS_FULL[m]],
    [new RegExp(`(\\d+)\\. (${MON_RE})\\.?`, 'g'), (m, d, mo) => `${d} ${MON[mo]}`],
    [new RegExp(`\\b(${MON_RE})\\b`, 'g'), (m) => MON[m]],
    [/\bab (\d)/g, 'from $1'], [/\bbis (\d)/g, 'until $1'], [/\bum (\d)/g, 'at $1'],
    [/\bfrei\b/g, 'free'], [/\bbelegt\b/g, 'occupied']
  ];
  const WD_ONLY = { MO: 'MON', DI: 'TUE', MI: 'WED', DO: 'THU', FR: 'FRI', SA: 'SAT', SO: 'SUN', Mo: 'Mon', Di: 'Tue', Mi: 'Wed', Do: 'Thu', Fr: 'Fri', Sa: 'Sat', So: 'Sun' };

  function translateText(s) {
    const core = s.trim();
    if (!core) return s;
    if (EN[core] != null) return s.replace(core, EN[core]);
    if (WD_ONLY[core]) return s.replace(core, WD_ONLY[core]);
    let out = s;
    for (const [re, rep] of RULES) out = out.replace(re, rep);
    return out;
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'CODE']);
  window.translateDom = (root) => {
    if (lang !== 'en' || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentNode && (SKIP.has(n.parentNode.nodeName) || n.parentNode.closest('[data-raw]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) { const v = translateText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    const els = root.querySelectorAll ? root.querySelectorAll('[title],[aria-label],[placeholder]') : [];
    for (const el of els) for (const a of ['title', 'aria-label', 'placeholder']) {
      const v = el.getAttribute(a); if (v) { const t = translateText(v); if (t !== v) el.setAttribute(a, t); }
    }
    if (root.querySelectorAll) for (const t of root.querySelectorAll('svg title')) { const v = translateText(t.textContent); if (v !== t.textContent) t.textContent = v; }
  };

  window.I18N_EN = EN;
  window.setLang = (l) => { lang = l === 'en' ? 'en' : 'de'; document.documentElement.lang = lang; };
  window.getLang = () => lang;
  window.tr = (s, vars) => {
    let out = lang === 'en' && EN[s] != null ? EN[s] : s;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return out;
  };
})();
