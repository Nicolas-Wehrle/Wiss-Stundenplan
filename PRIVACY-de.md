# Datenschutzerklärung: WISS Stundenplan

Stand: 20. November 2026. English version: [PRIVACY.md](PRIVACY.md).

Wie WISS Stundenplan mit deinen Daten umgeht. Gilt für alle Versionen: die Browser-Erweiterungen für Chrome und Firefox, die Android-App, die Desktop-App für Windows, macOS und Linux, das iPhone-Skript, die optionale Gerätesynchronisation und diese Website.

**Kurz gesagt**

- Deine Schuldaten (Stundenplan, Noten, Absenzen) bleiben auf deinem Gerät. Wir bekommen sie nie zu sehen.
- Die App sieht und speichert dein Passwort nicht. Du meldest dich direkt bei der WISS und Microsoft an.
- Keine Werbung, kein Tracking, keine Analyse-Tools, kein Konto bei uns.
- Die Synchronisation zwischen deinen Geräten ist freiwillig, ausgeschaltet, bis du sie einschaltest, und Ende-zu-Ende verschlüsselt.

## Wer verantwortlich ist

Severin Wehrle, Schweiz, Entwickler von WISS Stundenplan. Danylo Kovalenko arbeitet an der iPhone-Version mit. WISS Stundenplan ist ein unabhängiges, inoffizielles Projekt von Lernenden und hat keine Verbindung zur WISS oder zu Tocco.

Kontakt: über die Issues im öffentlichen GitHub-Projekt (https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/issues). Bitte dort keine Zugangsdaten oder persönlichen Schuldaten posten. Für Anliegen, die nicht öffentlich sein sollen, schreib im Issue, dass du privat Kontakt willst; du bekommst dann eine private Kontaktmöglichkeit.

## Was die App auf deinem Gerät speichert

Wenn du dich anmeldest, lädt die App über wiss.tocco.ch genau die Daten, die du auch im Extranet siehst: Stundenplan, Prüfungen, Noten, Absenzen und Präsenz, Raumbelegungen und deinen Benutzernamen. Dazu kommen deine eigenen Notizen, Korrekturen an Prüfungsterminen und deine Einstellungen.

Alles davon bleibt lokal auf deinem Gerät:

- Browser-Erweiterungen: im Speicher der Erweiterung in deinem Browserprofil.
- Android-App: im privaten Speicher der App.
- Desktop-App: in ihrem Datenordner (Windows: %APPDATA%\ch.wisstools.stundenplan, macOS: ~/Library/Application Support/ch.wisstools.stundenplan, Linux: ~/.local/share/ch.wisstools.stundenplan).
- iPhone: im Speicher von Safari für wiss.tocco.ch; der Schlüssel für die Synchronisation im privaten Speicher der App «Userscripts».

Die Daten werden nur gebraucht, um dir deinen Schulalltag anzuzeigen. Sie werden nicht an uns oder an Dritte geschickt, nicht ausgewertet und nicht verkauft.

## Anmeldung

Die Anmeldung läuft auf den offiziellen Seiten der WISS und von Microsoft. Die App benutzt danach die angemeldete Sitzung, so wie dein Browser, um deine Daten bei der WISS abzurufen. Sie liest, speichert oder tippt dein Passwort nie. In der Android- und der Desktop-App passiert die Anmeldung in einem versteckten Fenster; ein sichtbares Fenster erscheint nur, wenn Microsoft dich wirklich braucht.

Beim Zurücksetzen der App wird deine Sitzung bei der WISS oder bei Microsoft nicht automatisch beendet. Abmelden kannst du dich jederzeit auf deren Seiten.

## Mit wem die App Verbindung aufnimmt

Bei jeder Verbindung sieht der Betreiber technisch nötige Daten wie deine IP-Adresse und die Uhrzeit. Was diese Dienste damit machen, regeln ihre eigenen Datenschutzerklärungen.

| Dienst | Wofür |
|---|---|
| wiss.tocco.ch (WISS / Tocco) | deine Schuldaten, mit deiner Anmeldung |
| login.microsoftonline.com (Microsoft) | die Anmeldung mit deinem WISS-Konto |
| modulbaukasten.ch und ictbb.crm17.dynamics.com (ICT-Berufsbildung Schweiz) | öffentliche Beschreibungen der Lehrberufe und Module, ohne Bezug zu dir |
| api.github.com und github.com (GitHub, USA) | nachsehen, ob es eine neue Version gibt, und Updates herunterladen |
| stundenplan.severinwehrle.dev (auf GitHub Pages) | diese Website und die Paketquelle für Linux |
| wiss-stundenplan-sync.onrender.com (Render, Rechenzentrum in Frankfurt) | nur wenn du die Synchronisation einschaltest, siehe unten |

Auf dem iPhone werden Updates des Skripts über die App «Userscripts» von GitHub geladen.

## Erinnerungen und Benachrichtigungen

Erinnerungen an Lektionen, Fristen für Absenzen und Hinweise auf neue Noten werden auf deinem Gerät aus deinen gespeicherten Daten berechnet und als normale Benachrichtigung deines Systems angezeigt. Es gibt keinen Push-Dienst und keinen Server, der dafür deine Daten bekommt. Neue Noten werden gemeldet, sobald die App deine Daten bei der WISS aktualisiert.

## Synchronisation zwischen deinen Geräten (freiwillig)

Die Synchronisation ist ausgeschaltet, bis du sie in den Einstellungen einschaltest. Dann werden Notizen, Korrekturen an Prüfungsterminen und einige Einstellungen (zum Beispiel deine Lehre) zwischen deinen Geräten abgeglichen.

- Die Daten werden auf deinem Gerät verschlüsselt, bevor sie es verlassen. Der Schlüssel bleibt auf deinen Geräten und im Wiederherstellungscode, den nur du hast.
- Der Server (Render, Frankfurt) speichert nur die verschlüsselten Pakete, zufällige technische Kennungen und Verbindungsdaten. Er kann den Inhalt nicht lesen.
- Die verschlüsselten Pakete werden zusätzlich in einem privaten GitHub-Repository gesichert.
- Stundenplan, Noten, Absenzen, dein Benutzername und dein Login werden nie synchronisiert.
- Ein neues Gerät verbindest du mit einem Code, der nur einmal und nur 10 Minuten gilt.

## Diese Website

Die Website liegt auf GitHub Pages. GitHub speichert dabei technisch nötige Zugriffsdaten wie deine IP-Adresse, um die Seite auszuliefern und vor Missbrauch zu schützen. Die Website setzt keine Cookies, nutzt kein Tracking und lädt keine Schriften oder Skripte von Dritten. Um die aktuelle Versionsnummer und die Download-Links anzuzeigen, fragt dein Browser die öffentliche Schnittstelle von GitHub (api.github.com) ab.

## Wie lange Daten gespeichert bleiben

- Auf deinem Gerät: bis du sie unter Einstellungen › Daten löschst, die App deinstallierst oder dein Browserprofil entfernst.
- Synchronisation: Unter «Sync» kannst du die Daten auf dem Server löschen lassen. Konten, die 365 Tage lang nicht synchronisiert haben, werden automatisch gelöscht. Nur trennen oder deinstallieren löscht die Serverdaten nicht. Nach dem Löschen können verschlüsselte Kopien noch eine Weile in der Versionsgeschichte der GitHub-Sicherung bleiben; lesbar sind sie ohne deinen Schlüssel nicht.

## Übermittlung ins Ausland

GitHub ist ein Dienst aus den USA. Wenn die App nach Updates sucht oder du diese Website besuchst, gehen technische Verbindungsdaten an GitHub. Der Sync-Server läuft in der EU (Frankfurt). Schuldaten werden an keinen dieser Dienste übermittelt.

## Deine Rechte

Du hast nach dem Schweizer Datenschutzgesetz (und, wo anwendbar, der DSGVO) das Recht auf Auskunft, Berichtigung und Löschung deiner Daten. Weil fast alles nur auf deinem Gerät liegt, kannst du es dort selbst einsehen und löschen. Für Fragen melde dich über den Kontakt oben. Du kannst dich auch beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) beschweren.

## Demokonto

Das Demokonto erzeugt frei erfundene Daten auf deinem Gerät. Es braucht kein WISS-Konto, lädt keine Schuldaten und kann nicht synchronisieren. «Demo beenden» löscht die erfundenen Daten wieder; echte Daten werden von der Demo nie überschrieben.

## Änderungen

Wenn sich an der App etwas Wichtiges ändert, wird diese Erklärung angepasst. Das Datum oben zeigt den aktuellen Stand. Frühere Fassungen findest du in der Versionsgeschichte auf GitHub.
