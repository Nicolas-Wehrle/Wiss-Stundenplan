# WISS Stundenplan (iPhone)

Auf dem iPhone läuft der Stundenplan in Safari, mit der Gratis-App **Userscripts**.
Du meldest dich mit deinem eigenen WISS-Konto an. Deine Daten bleiben auf deinem iPhone.

Inoffiziell, nicht von der WISS.

## Einrichten
1. Im App Store **Userscripts** (von Justin Wasack) installieren.
2. Userscripts öffnen und auf **Set Userscripts Directory** tippen. Einen Ordner wählen, zum Beispiel *Auf meinem iPhone > Userscripts*.
3. `WISS-Stundenplan.user.js` in diesen Ordner speichern: Datei antippen, **Teilen > In „Dateien“ sichern**, Ordner wählen.
4. In *Einstellungen > Apps > Safari > Erweiterungen > Userscripts* die Erweiterung einschalten und bei *wiss.tocco.ch* **Erlauben** wählen.
5. In Safari **https://wiss.tocco.ch/extranet/?stundenplan** öffnen und auf **Anmelden** tippen. Nach dem Anmelden gehts von selbst zurück zum Stundenplan.

## Schneller öffnen
- Als Favorit speichern: Teilen > Zu Favoriten hinzufügen.
- Als Icon auf dem Home-Bildschirm: in der App *Kurzbefehle* einen Kurzbefehl mit **URL öffnen** und der Adresse oben erstellen, dann **Zum Home-Bildschirm**.
  Safaris eigenes "Zum Home-Bildschirm" geht nicht, dort laufen keine Erweiterungen.
- Auf jeder Extranet-Seite ist unten rechts ein Knopf **Stundenplan**.

## Was geht
- Woche, Prüfungen, Noten mit Rechner, Absenzen, Räume mit Plänen, Notizen, Lehrpersonen
- Alle Stile, hell und dunkel, Deutsch und English
- Wenn die Anmeldung abläuft, gehts kurz über die WISS-Anmeldung und dann zurück

Keine Benachrichtigungen und kein Widget. Das erlaubt Apple nur Apps aus dem App Store.

## Aktualisieren
Die neue `WISS-Stundenplan.user.js` in denselben Ordner legen und die alte ersetzen. Deine Daten bleiben.

## Probleme
- **Du siehst das normale Extranet:** Userscripts ist für wiss.tocco.ch noch nicht erlaubt. In Safari auf **aA > Erweiterungen verwalten** tippen, Userscripts einschalten und **Immer erlauben** wählen.
- **Es steht immer "Anmeldung nötig":** auf **Anmelden** tippen und bei Microsoft "Angemeldet bleiben" wählen.

## Für Entwickler
`build-ios.py` baut die Datei aus dem Chrome-Add-on: `python3 iphone/build-ios.py "chrome addon" iphone`
