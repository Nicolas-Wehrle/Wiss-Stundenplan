# Chrome Web Store: Veröffentlichung 1.13.0

## Fertige Dateien
- `release/v1.13.0/WISS-Stundenplan-Chrome-Web-Store.zip` (von `scripts/release.py` erstellt): ausschliesslich die Chrome-Erweiterung, ohne Entwicklungsschlüssel; manifest.json liegt direkt im ZIP.
- `store-icon-128.png`: bestehendes Projektlogo mit transparentem Rand.
- `screenshot-1…5-*-1280x800.png`: fünf gestaltete Store-Bilder (Übersicht, Prüfungen, Noten, Absenzen, Räume im Dunkelmodus), aufgebaut aus echten Screenshots der Erweiterung mit fiktiven Demodaten. In dieser Reihenfolge hochladen.
- `promo-small-440x280.png`: kleine Werbekachel.
- `promo-marquee-1400x560.png`: grosse Werbekachel.
- `beschreibung-de.txt`: fertige ausführliche Beschreibung.
Alle Screenshots und Werbekacheln sind RGB-PNG ohne Alphakanal. Das Logo bleibt transparent. Gestaltet im Stil der Website, mit dem bestehenden Logo. Neu erzeugen: `node scripts/store-pictures/capture.mjs && node scripts/store-pictures/make.mjs`. Keine WISS-/Tocco-Logos ergänzt.

## Fehler «key stimmt nicht mit dem aktuellen Artikel überein»
Die Store-ZIP lässt den Entwicklungsschlüssel bewusst weg. Die Store-ID wird von Google für den bestehenden Artikel verwaltet. Der Quellcode behält seinen bisherigen key für lokale Installationen. Neue Store-ZIP jederzeit mit `python scripts/build-chrome-store.py` erstellen und die Datei `release/v1.13.0/WISS-Stundenplan-Chrome-Web-Store.zip` hochladen.

## Eintrag
Name: bestehenden Store-Namen beibehalten («Stundenplan für WISS (inoffiziell)»).
Kurzbeschreibung (bereits im Manifest): Dein WISS-Stundenplan ohne Warten. Zeigt sofort die letzten Daten und lädt im Hintergrund neu.
Sprache: Deutsch. Kategorie: Bildung. Kosten: kostenlos. Website: https://stundenplan.severinwehrle.dev
Support: https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/issues
Datenschutz-URL: https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/blob/main/PRIVACY-de.md (deutsch) oder …/PRIVACY.md (englisch)
Vor dem Einreichen prüfen, dass die URL öffentlich ohne Anmeldung erreichbar ist und der Kontaktweg für dich passt.

## Testanweisungen (direkt einfügen)
1. Open the extension. Accept the introductory data notice (“Verstanden”).
2. In setup, choose “Demokonto testen” (Try demo account). No username, password, Microsoft account, school account, or access code is required.
3. The local fictional account is labelled demo@example.invalid. This is a display identifier, not an email inbox or a server login.
4. Review Woche, Prüfungen, Noten, Absenzen and Räume. Use refresh, lesson details and notes. Data is generated around the current week; grades are randomized. Room occupancy is also fictional. Estimated exam dates retain the ordinary app labels.
5. Settings and appearance options can be tested. Device sync is intentionally disabled for the demo. The real school login still uses the unchanged WISS/Microsoft flow and requires an authorized WISS account.
6. Click “Demo beenden” to remove the fictional data and return to setup. If settings are open, click “Fertig” first.
7. Use a fresh browser profile for review. The demo refuses to replace an existing signed-in account or local school data.

## Einzelzweck
Studierenden der WISS ihren eigenen Stundenplan und die zugehörigen Prüfungen, Noten, Absenzen und Raumangaben übersichtlich im Browser anzeigen.

## Begründungen der Berechtigungen
storage: Speichert zuletzt geladene Schulangaben und Benutzereinstellungen lokal, damit sie sofort und auch ohne erneuten Abruf angezeigt werden; speichert selbst erstellte Notizen und optionale Sync-Konfiguration.
alarms: Plant Hintergrundaktualisierungen, optionale Unterrichts-/Absenzhinweise und Wiederholungen einer aktivierten Gerätesynchronisation.
scripting: Liest benötigte Stundenplan-/Lehrpersonenangaben innerhalb der WISS-Extranet-Seiten und verwendet die vorhandene Sitzung als Fallback für den Datenabruf.
notifications: Zeigt vom Nutzer gewählte Hinweise auf Unterricht, neue Noten und offene Absenzen.
https://wiss.tocco.ch/*: Ruft die eigenen Schulangaben in der angemeldeten Extranet-Sitzung ab und unterstützt die WISS-Anmeldung sowie die Zuordnung von Lehrpersonen.
https://www.modulbaukasten.ch/*: Lädt öffentliche Modul- und Lehrberufsinformationen sowie den für deren öffentliche Schnittstelle nötigen Token.
https://ictbb.crm17.dynamics.com/*: Datenendpunkt des öffentlichen Modulbaukasten-Katalogs; liefert Modul- und Lehrberufsinformationen.
Optional https://*.onrender.com/*: Nur nach Aktivierung und Freigabe für die freiwillige, Ende-zu-Ende-verschlüsselte Gerätesynchronisation mit dem vom Nutzer gewählten Render-Server. Im Demokonto deaktiviert.

## Remote-Code
«Nein» für remote gehosteten ausführbaren Code: JavaScript, Schriften und QR-Bibliothek werden mitgeliefert. Externe Abfragen liefern Daten und Versionsinformationen; sie laden keinen auszuführenden Erweiterungscode. Die bestehende Scripting-Berechtigung injiziert mitgelieferte Funktionen.

## Datenschutzformular
Die Angaben müssen mit der Datenschutzerklärung (PRIVACY-de.md / PRIVACY.md) und dem tatsächlichen Verhalten übereinstimmen. Nicht pauschal «keine Nutzerdaten» wählen: Die Erweiterung verarbeitet Benutzername, Schuldaten und eigene Notizen lokal und überträgt nach freiwilliger Aktivierung verschlüsselte Notizen/Einstellungen.
Relevante Kategorien im jeweiligen Formular prüfen: personenbezogene Informationen (Benutzername), Website-Inhalte (ausgelesene Schulangaben), persönliche Kommunikation (Freitextnotizen). Bei Authentifizierungsinformationen die Nutzung der vorhandenen Sitzung erklären: kein eingegebenes/gespeichertes Passwort, keine Anmeldung am Projektserver. Keine Finanz-, Gesundheits-, Standort- oder allgemeinen Browserverlaufsfunktionen behaupten.
Die drei Nutzungszusicherungen nur entsprechend dem tatsächlichen Code bestätigen: kein Verkauf, nur notwendige Funktionsverwendung, keine Kreditwürdigkeitsbewertung. Die öffentliche Datenschutzerklärung verlinken.

## Noch vor dem Einreichen
1. Publisher-Einstellungen: eigene Kontakt-E-Mail eintragen, Bestätigungslink im Postfach öffnen. Das sind die zwei E-Mail-Fehler in deinem Screenshot; die Adresse wird nicht erfunden.
2. Google-Konto: Zwei-Faktor-Authentifizierung für das Entwicklerkonto sicherstellen.
3. Unter «Paket» die neue Chrome-ZIP hochladen; Version 1.13.0 kontrollieren.
4. Beschreibung, Symbol, mindestens einen Screenshot und kleine Werbekachel hinterlegen. Grosse Kachel ist zusätzlich vorbereitet.
5. Testanweisungen, Datenschutz-URL und Berechtigungsbegründungen einfügen; Kategorie, Sprache und Vertriebsregionen kontrollieren.
6. Entwurf speichern, verbleibende Dashboard-Fehler prüfen, dann zur Prüfung einreichen. Google entscheidet über die Freigabe; Upload ist keine Veröffentlichung.

Version 1.13.0 gibt es auch für Firefox, Android, iPhone und als Desktop-App (Windows, macOS, Linux). Die Firefox-XPI muss von Mozilla signiert sein; updates.json wird erst auf die neue Version gesetzt, wenn diese signierte Datei vorliegt. Die Android-APK wird mit dem vorhandenen Zertifikat signiert. Der iPhone-Build ist ein Safari-Userscript, keine native App-Store-App.

## Offizielle Quellen
- Bilder: https://developer.chrome.com/docs/webstore/images
- Datenschutzfelder und Berechtigungen: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Publisher-E-Mail: https://developer.chrome.com/docs/webstore/set-up-account
- Review: https://developer.chrome.com/docs/webstore/review-process
