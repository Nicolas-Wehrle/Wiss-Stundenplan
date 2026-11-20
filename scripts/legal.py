"""Privacy policy and terms of use, written once, in German and English.

Writes PRIVACY-de.md, PRIVACY.md, TERMS-de.md, TERMS.md and the two legal pages inside docs/index.html
(between the <!-- LEGAL:START --> and <!-- LEGAL:END --> markers). Run after changing the text:

    python3 scripts/legal.py
"""
from html import escape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
UPDATED = {'de': '20. November 2026', 'en': '20 November 2026'}
GH = 'https://github.com/Nicolas-Wehrle/Wiss-Stundenplan'
CONTACT = {
    'de': f'Kontakt: über die Issues im öffentlichen GitHub-Projekt ({GH}/issues). Bitte dort keine Zugangsdaten oder persönlichen Schuldaten posten. Für Anliegen, die nicht öffentlich sein sollen, schreib im Issue, dass du privat Kontakt willst; du bekommst dann eine private Kontaktmöglichkeit.',
    'en': f'Contact: through the issues of the public GitHub project ({GH}/issues). Please don\'t post login details or personal school data there. For anything that shouldn\'t be public, say in the issue that you\'d like to talk privately and you\'ll get a private way to reach us.',
}

# Each document: list of (heading, [blocks]); a block is a paragraph (str), a list (list of str) or a table (dict).
PRIVACY = {
    'de': {
        'title': 'Datenschutzerklärung',
        'intro': 'Wie WISS Stundenplan mit deinen Daten umgeht. Gilt für alle Versionen: die Browser-Erweiterungen für Chrome und Firefox, die Android-App, die Desktop-App für Windows, macOS und Linux, das iPhone-Skript, die optionale Gerätesynchronisation und diese Website.',
        'summary': [
            'Deine Schuldaten (Stundenplan, Noten, Absenzen) bleiben auf deinem Gerät. Wir bekommen sie nie zu sehen.',
            'Die App sieht und speichert dein Passwort nicht. Du meldest dich direkt bei der WISS und Microsoft an.',
            'Keine Werbung, kein Tracking, keine Analyse-Tools, kein Konto bei uns.',
            'Die Synchronisation zwischen deinen Geräten ist freiwillig, ausgeschaltet, bis du sie einschaltest, und Ende-zu-Ende verschlüsselt.',
        ],
        'sections': [
            ('Wer verantwortlich ist', [
                'Severin Wehrle, Schweiz, Entwickler von WISS Stundenplan. Danylo Kovalenko arbeitet an der iPhone-Version mit. WISS Stundenplan ist ein unabhängiges, inoffizielles Projekt von Lernenden und hat keine Verbindung zur WISS oder zu Tocco.',
                CONTACT['de'],
            ]),
            ('Was die App auf deinem Gerät speichert', [
                'Wenn du dich anmeldest, lädt die App über wiss.tocco.ch genau die Daten, die du auch im Extranet siehst: Stundenplan, Prüfungen, Noten, Absenzen und Präsenz, Raumbelegungen und deinen Benutzernamen. Dazu kommen deine eigenen Notizen, Korrekturen an Prüfungsterminen und deine Einstellungen.',
                'Alles davon bleibt lokal auf deinem Gerät:',
                ['Browser-Erweiterungen: im Speicher der Erweiterung in deinem Browserprofil.',
                 'Android-App: im privaten Speicher der App.',
                 'Desktop-App: in ihrem Datenordner (Windows: %APPDATA%\\ch.wisstools.stundenplan, macOS: ~/Library/Application Support/ch.wisstools.stundenplan, Linux: ~/.local/share/ch.wisstools.stundenplan).',
                 'iPhone: im Speicher von Safari für wiss.tocco.ch; der Schlüssel für die Synchronisation im privaten Speicher der App «Userscripts».'],
                'Die Daten werden nur gebraucht, um dir deinen Schulalltag anzuzeigen. Sie werden nicht an uns oder an Dritte geschickt, nicht ausgewertet und nicht verkauft.',
            ]),
            ('Anmeldung', [
                'Die Anmeldung läuft auf den offiziellen Seiten der WISS und von Microsoft. Die App benutzt danach die angemeldete Sitzung, so wie dein Browser, um deine Daten bei der WISS abzurufen. Sie liest, speichert oder tippt dein Passwort nie. In der Android- und der Desktop-App passiert die Anmeldung in einem versteckten Fenster; ein sichtbares Fenster erscheint nur, wenn Microsoft dich wirklich braucht.',
                'Beim Zurücksetzen der App wird deine Sitzung bei der WISS oder bei Microsoft nicht automatisch beendet. Abmelden kannst du dich jederzeit auf deren Seiten.',
            ]),
            ('Mit wem die App Verbindung aufnimmt', [
                'Bei jeder Verbindung sieht der Betreiber technisch nötige Daten wie deine IP-Adresse und die Uhrzeit. Was diese Dienste damit machen, regeln ihre eigenen Datenschutzerklärungen.',
                {'head': ['Dienst', 'Wofür'], 'rows': [
                    ['wiss.tocco.ch (WISS / Tocco)', 'deine Schuldaten, mit deiner Anmeldung'],
                    ['login.microsoftonline.com (Microsoft)', 'die Anmeldung mit deinem WISS-Konto'],
                    ['modulbaukasten.ch und ictbb.crm17.dynamics.com (ICT-Berufsbildung Schweiz)', 'öffentliche Beschreibungen der Lehrberufe und Module, ohne Bezug zu dir'],
                    ['api.github.com und github.com (GitHub, USA)', 'nachsehen, ob es eine neue Version gibt, und Updates herunterladen'],
                    ['stundenplan.severinwehrle.dev (auf GitHub Pages)', 'diese Website und die Paketquelle für Linux'],
                    ['wiss-stundenplan-sync.onrender.com (Render, Rechenzentrum in Frankfurt)', 'nur wenn du die Synchronisation einschaltest, siehe unten'],
                ]},
                'Auf dem iPhone werden Updates des Skripts über die App «Userscripts» von GitHub geladen.',
            ]),
            ('Erinnerungen und Benachrichtigungen', [
                'Erinnerungen an Lektionen, Fristen für Absenzen und Hinweise auf neue Noten werden auf deinem Gerät aus deinen gespeicherten Daten berechnet und als normale Benachrichtigung deines Systems angezeigt. Es gibt keinen Push-Dienst und keinen Server, der dafür deine Daten bekommt. Neue Noten werden gemeldet, sobald die App deine Daten bei der WISS aktualisiert.',
            ]),
            ('Synchronisation zwischen deinen Geräten (freiwillig)', [
                'Die Synchronisation ist ausgeschaltet, bis du sie in den Einstellungen einschaltest. Dann werden Notizen, Korrekturen an Prüfungsterminen und einige Einstellungen (zum Beispiel deine Lehre) zwischen deinen Geräten abgeglichen.',
                ['Die Daten werden auf deinem Gerät verschlüsselt, bevor sie es verlassen. Der Schlüssel bleibt auf deinen Geräten und im Wiederherstellungscode, den nur du hast.',
                 'Der Server (Render, Frankfurt) speichert nur die verschlüsselten Pakete, zufällige technische Kennungen und Verbindungsdaten. Er kann den Inhalt nicht lesen.',
                 'Die verschlüsselten Pakete werden zusätzlich in einem privaten GitHub-Repository gesichert.',
                 'Stundenplan, Noten, Absenzen, dein Benutzername und dein Login werden nie synchronisiert.',
                 'Ein neues Gerät verbindest du mit einem Code, der nur einmal und nur 10 Minuten gilt.'],
            ]),
            ('Diese Website', [
                'Die Website liegt auf GitHub Pages. GitHub speichert dabei technisch nötige Zugriffsdaten wie deine IP-Adresse, um die Seite auszuliefern und vor Missbrauch zu schützen. Die Website setzt keine Cookies, nutzt kein Tracking und lädt keine Schriften oder Skripte von Dritten. Um die aktuelle Versionsnummer und die Download-Links anzuzeigen, fragt dein Browser die öffentliche Schnittstelle von GitHub (api.github.com) ab.',
            ]),
            ('Wie lange Daten gespeichert bleiben', [
                ['Auf deinem Gerät: bis du sie unter Einstellungen › Daten löschst, die App deinstallierst oder dein Browserprofil entfernst.',
                 'Synchronisation: Unter «Sync» kannst du die Daten auf dem Server löschen lassen. Konten, die 365 Tage lang nicht synchronisiert haben, werden automatisch gelöscht. Nur trennen oder deinstallieren löscht die Serverdaten nicht. Nach dem Löschen können verschlüsselte Kopien noch eine Weile in der Versionsgeschichte der GitHub-Sicherung bleiben; lesbar sind sie ohne deinen Schlüssel nicht.'],
            ]),
            ('Übermittlung ins Ausland', [
                'GitHub ist ein Dienst aus den USA. Wenn die App nach Updates sucht oder du diese Website besuchst, gehen technische Verbindungsdaten an GitHub. Der Sync-Server läuft in der EU (Frankfurt). Schuldaten werden an keinen dieser Dienste übermittelt.',
            ]),
            ('Deine Rechte', [
                'Du hast nach dem Schweizer Datenschutzgesetz (und, wo anwendbar, der DSGVO) das Recht auf Auskunft, Berichtigung und Löschung deiner Daten. Weil fast alles nur auf deinem Gerät liegt, kannst du es dort selbst einsehen und löschen. Für Fragen melde dich über den Kontakt oben. Du kannst dich auch beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) beschweren.',
            ]),
            ('Demokonto', [
                'Das Demokonto erzeugt frei erfundene Daten auf deinem Gerät. Es braucht kein WISS-Konto, lädt keine Schuldaten und kann nicht synchronisieren. «Demo beenden» löscht die erfundenen Daten wieder; echte Daten werden von der Demo nie überschrieben.',
            ]),
            ('Änderungen', [
                'Wenn sich an der App etwas Wichtiges ändert, wird diese Erklärung angepasst. Das Datum oben zeigt den aktuellen Stand. Frühere Fassungen findest du in der Versionsgeschichte auf GitHub.',
            ]),
        ],
    },
    'en': {
        'title': 'Privacy policy',
        'intro': 'How WISS Stundenplan handles your data. It applies to every version: the browser extensions for Chrome and Firefox, the Android app, the desktop app for Windows, macOS and Linux, the iPhone script, the optional device sync and the website.',
        'summary': [
            'Your school data (timetable, grades, absences) stays on your device. We never see it.',
            'The app never sees or stores your password. You sign in directly with WISS and Microsoft.',
            'No ads, no tracking, no analytics, no account with us.',
            'Syncing between your devices is optional, off until you turn it on, and end-to-end encrypted.',
        ],
        'sections': [
            ('Who is responsible', [
                'Severin Wehrle, Switzerland, developer of WISS Stundenplan. Danylo Kovalenko works on the iPhone version. WISS Stundenplan is an independent, unofficial project by students and has no connection to WISS or Tocco.',
                CONTACT['en'],
            ]),
            ('What the app stores on your device', [
                'When you sign in, the app loads exactly the data you can also see in the extranet, through wiss.tocco.ch: timetable, exams, grades, absences and attendance, room bookings and your username. It also keeps your own notes, corrections to exam dates and your settings.',
                'All of it stays on your device:',
                ['Browser extensions: in the extension\'s storage in your browser profile.',
                 'Android app: in the app\'s private storage.',
                 'Desktop app: in its data folder (Windows: %APPDATA%\\ch.wisstools.stundenplan, macOS: ~/Library/Application Support/ch.wisstools.stundenplan, Linux: ~/.local/share/ch.wisstools.stundenplan).',
                 'iPhone: in Safari\'s storage for wiss.tocco.ch; the sync key in the private storage of the Userscripts app.'],
                'The data is only used to show you your school day. It is not sent to us or anyone else, not analysed and not sold.',
            ]),
            ('Signing in', [
                'Signing in happens on the official WISS and Microsoft pages. The app then uses the signed-in session, like your browser does, to load your data from WISS. It never reads, stores or types your password. In the Android and desktop apps, sign-in happens in a hidden window; a visible window only appears when Microsoft really needs you.',
                'Resetting the app doesn\'t end your WISS or Microsoft session. You can sign out on their pages at any time.',
            ]),
            ('Who the app connects to', [
                'With every connection, the operator sees technically necessary data such as your IP address and the time. What these services do with it is covered by their own privacy policies.',
                {'head': ['Service', 'What for'], 'rows': [
                    ['wiss.tocco.ch (WISS / Tocco)', 'your school data, with your sign-in'],
                    ['login.microsoftonline.com (Microsoft)', 'signing in with your WISS account'],
                    ['modulbaukasten.ch and ictbb.crm17.dynamics.com (ICT-Berufsbildung Schweiz)', 'public descriptions of apprenticeships and modules, nothing about you'],
                    ['api.github.com and github.com (GitHub, USA)', 'checking for a new version and downloading updates'],
                    ['stundenplan.severinwehrle.dev (on GitHub Pages)', 'the website and the Linux package source'],
                    ['wiss-stundenplan-sync.onrender.com (Render, data centre in Frankfurt)', 'only if you turn on sync, see below'],
                ]},
                'On iPhone, the Userscripts app loads updates of the script from GitHub.',
            ]),
            ('Reminders and notifications', [
                'Lesson reminders, absence deadlines and new-grade alerts are worked out on your device from your stored data and shown as normal system notifications. There is no push service and no server that gets your data for this. New grades are reported as soon as the app refreshes your data from WISS.',
            ]),
            ('Syncing between your devices (optional)', [
                'Sync is off until you turn it on in the settings. Then notes, corrections to exam dates and some settings (such as your apprenticeship) are kept in step between your devices.',
                ['The data is encrypted on your device before it leaves it. The key stays on your devices and in the recovery code, which only you have.',
                 'The server (Render, Frankfurt) only stores the encrypted packages, random technical IDs and connection data. It can\'t read the content.',
                 'The encrypted packages are also backed up in a private GitHub repository.',
                 'Your timetable, grades, absences, username and login are never synced.',
                 'You link a new device with a code that works once and for 10 minutes.'],
            ]),
            ('The website', [
                'The website is hosted on GitHub Pages. GitHub keeps technically necessary access data such as your IP address to deliver the site and protect it from abuse. The website sets no cookies, uses no tracking and loads no fonts or scripts from third parties. To show the current version number and download links, your browser asks GitHub\'s public interface (api.github.com).',
            ]),
            ('How long data is kept', [
                ['On your device: until you delete it under Settings › Data, uninstall the app or remove your browser profile.',
                 'Sync: under "Sync" you can have the data on the server deleted. Accounts that haven\'t synced for 365 days are deleted automatically. Only disconnecting or uninstalling doesn\'t delete the server data. After deletion, encrypted copies can stay in the version history of the GitHub backup for a while; without your key they can\'t be read.'],
            ]),
            ('Transfers abroad', [
                'GitHub is a US service. When the app checks for updates or you visit the website, technical connection data goes to GitHub. The sync server runs in the EU (Frankfurt). No school data goes to any of these services.',
            ]),
            ('Your rights', [
                'Under the Swiss Federal Act on Data Protection (and the GDPR where it applies) you have the right to access, correct and delete your data. Because almost everything is only on your device, you can see and delete it there yourself. For questions, use the contact above. You can also complain to the Federal Data Protection and Information Commissioner (FDPIC).',
            ]),
            ('Demo account', [
                'The demo account creates invented data on your device. It needs no WISS account, loads no school data and can\'t sync. "End demo" deletes the invented data again; the demo never overwrites real data.',
            ]),
            ('Changes', [
                'If something important about the app changes, this policy is updated. The date at the top shows the current version. Earlier versions are in the history on GitHub.',
            ]),
        ],
    },
}

TERMS = {
    'de': {
        'title': 'Nutzungsbedingungen',
        'intro': 'Die Regeln für WISS Stundenplan, in allen Versionen. Kurz und so verständlich wie möglich.',
        'summary': [
            'WISS Stundenplan ist kostenlos, inoffiziell und nicht von der WISS.',
            'Massgebend sind immer die Angaben der Schule im Extranet, nicht die App.',
            'Du benutzt die App mit deinem eigenen Konto und nach den Regeln deiner Schule.',
            'Die App kommt ohne Garantie. Wir geben uns Mühe, können aber nicht für jeden Fehler einstehen.',
        ],
        'sections': [
            ('Wer anbietet', [
                'WISS Stundenplan wird von Severin Wehrle (Schweiz) entwickelt, die iPhone-Version zusammen mit Danylo Kovalenko. Es ist ein unabhängiges Projekt von Lernenden. Es wird nicht von der WISS, von Tocco oder von Microsoft angeboten, unterstützt oder geprüft. «WISS» und andere Namen gehören ihren jeweiligen Inhabern und werden nur verwendet, um zu beschreiben, wofür die App gedacht ist.',
                CONTACT['de'],
            ]),
            ('Was die App ist', [
                'Die App zeigt deine Daten aus dem WISS-Extranet schneller und übersichtlicher an. Sie ist kostenlos, ohne Werbung und ohne Konto bei uns. Wenn du sie installierst oder benutzt, gelten diese Bedingungen. Wenn du nicht einverstanden bist, benutze die App bitte nicht.',
            ]),
            ('Angaben ohne Gewähr', [
                'Die App zeigt an, was das Extranet liefert, und rechnet manches daraus aus. Massgebend sind aber immer die offiziellen Angaben der Schule.',
                ['Geschätzte Prüfungstermine sind Schätzungen und als solche markiert.',
                 'Schnitt, Notenrechner und Fristen für Absenzen sind Hilfen. Prüf wichtige Termine und Fristen im Extranet oder bei der Schule.',
                 'Wenn die WISS oder Tocco etwas am Extranet ändert, kann die App zeitweise falsche, alte oder gar keine Daten zeigen.'],
            ]),
            ('Dein Konto und faire Nutzung', [
                ['Melde dich nur mit deinem eigenen WISS-Konto an. Du bist für dein Konto und dein Gerät verantwortlich.',
                 'Halte dich an die Regeln deiner Schule für das Extranet und deine Zugangsdaten.',
                 'Benutze die App nicht, um Daten anderer abzurufen, Sicherheitsmassnahmen zu umgehen oder die Systeme der WISS übermässig zu belasten, zum Beispiel mit automatisierten Massenabfragen.'],
            ]),
            ('Synchronisation', [
                'Die Synchronisation ist freiwillig und kann jederzeit ausfallen oder eingestellt werden. Bewahr deinen Wiederherstellungscode gut auf: Ohne ihn und ohne ein verbundenes Gerät können deine synchronisierten Daten nicht wiederhergestellt werden, auch nicht von uns.',
            ]),
            ('Verfügbarkeit und Updates', [
                'Wir entwickeln die App in unserer Freizeit. Es gibt keinen Anspruch darauf, dass sie immer funktioniert, weiterentwickelt oder in den Stores angeboten wird. Funktionen können sich ändern oder wegfallen, und das Projekt kann jederzeit eingestellt werden. Updates kommen automatisch oder über die Stores.',
            ]),
            ('Open Source und Stores', [
                f'Der Quellcode ist unter der MIT-Lizenz veröffentlicht ({GH}). Für den Code gilt diese Lizenz. Wenn du die App über einen Store installierst (zum Beispiel den Chrome Web Store, Mozilla oder den App Store), gelten zusätzlich die Bedingungen dieses Stores.',
            ]),
            ('Haftung', [
                'Die App wird so angeboten, wie sie ist, ohne Garantie für Richtigkeit, Vollständigkeit oder Verfügbarkeit. Soweit das Gesetz es erlaubt, haften wir nicht für Schäden durch die Nutzung der App, zum Beispiel durch verpasste Termine oder falsch angezeigte Noten. Nicht ausgeschlossen ist die Haftung für Absicht und grobe Fahrlässigkeit.',
            ]),
            ('Datenschutz', [
                'Wie die App mit deinen Daten umgeht, steht in der Datenschutzerklärung.',
            ]),
            ('Änderungen und anwendbares Recht', [
                'Diese Bedingungen können angepasst werden, wenn sich an der App etwas Wichtiges ändert. Das Datum oben zeigt den aktuellen Stand. Es gilt Schweizer Recht.',
            ]),
        ],
    },
    'en': {
        'title': 'Terms of use',
        'intro': 'The rules for WISS Stundenplan, in every version. Short and as clear as possible.',
        'summary': [
            'WISS Stundenplan is free, unofficial and not made by WISS.',
            'What counts is always the information from your school in the extranet, not the app.',
            'You use the app with your own account and within your school\'s rules.',
            'The app comes without a guarantee. We do our best but can\'t stand behind every mistake.',
        ],
        'sections': [
            ('Who provides it', [
                'WISS Stundenplan is developed by Severin Wehrle (Switzerland), the iPhone version together with Danylo Kovalenko. It\'s an independent project by students. It isn\'t provided, supported or reviewed by WISS, Tocco or Microsoft. "WISS" and other names belong to their owners and are only used to describe what the app is for.',
                CONTACT['en'],
            ]),
            ('What the app is', [
                'The app shows your data from the WISS extranet faster and more clearly. It\'s free, without ads and without an account with us. By installing or using it, you accept these terms. If you don\'t agree, please don\'t use the app.',
            ]),
            ('No guarantee for the information', [
                'The app shows what the extranet provides and works some things out from it. What counts, though, is always the official information from the school.',
                ['Estimated exam dates are estimates and marked as such.',
                 'Your average, the grade calculator and absence deadlines are aids. Check important dates and deadlines in the extranet or with the school.',
                 'When WISS or Tocco change the extranet, the app may for a while show wrong, old or no data.'],
            ]),
            ('Your account and fair use', [
                ['Only sign in with your own WISS account. You\'re responsible for your account and your device.',
                 'Follow your school\'s rules for the extranet and your login details.',
                 'Don\'t use the app to access other people\'s data, get around security measures or put an excessive load on the WISS systems, for example with automated mass requests.'],
            ]),
            ('Sync', [
                'Sync is optional and may fail or be discontinued at any time. Keep your recovery code safe: without it and without a linked device, your synced data can\'t be recovered, not even by us.',
            ]),
            ('Availability and updates', [
                'We build the app in our free time. There is no right to it always working, being developed further or being offered in the stores. Features may change or go away, and the project may end at any time. Updates arrive automatically or through the stores.',
            ]),
            ('Open source and stores', [
                f'The source code is published under the MIT licence ({GH}). That licence applies to the code. If you install the app from a store (for example the Chrome Web Store, Mozilla or the App Store), that store\'s terms also apply.',
            ]),
            ('Liability', [
                'The app is provided as it is, without any guarantee of accuracy, completeness or availability. As far as the law allows, we are not liable for damage caused by using the app, for example missed dates or wrongly shown grades. Liability for intent and gross negligence is not excluded.',
            ]),
            ('Privacy', [
                'How the app handles your data is described in the privacy policy.',
            ]),
            ('Changes and applicable law', [
                'These terms may be updated when something important about the app changes. The date at the top shows the current version. Swiss law applies.',
            ]),
        ],
    },
}

LINKS = {'de': ('Datenschutzerklärung', 'datenschutz'), 'en': ('privacy policy', 'datenschutz')}
URL_RE = re.compile(r'(https?://[^\s)]+)')


def md(doc, lang, other_lang_file, other_label):
    upd = 'Stand' if lang == 'de' else 'Last updated'
    out = [f'# {doc["title"]}: WISS Stundenplan', '', f'{upd}: {UPDATED[lang]}. {other_label}: [{other_lang_file}]({other_lang_file}).', '', doc['intro'], '']
    out += ['**' + ('Kurz gesagt' if lang == 'de' else 'In short') + '**', ''] + [f'- {s}' for s in doc['summary']] + ['']
    for h, blocks in doc['sections']:
        out += [f'## {h}', '']
        for b in blocks:
            if isinstance(b, str):
                out += [b, '']
            elif isinstance(b, list):
                out += [f'- {x}' for x in b] + ['']
            else:
                out += ['| ' + ' | '.join(b['head']) + ' |', '|' + '---|' * len(b['head'])] + ['| ' + ' | '.join(r) + ' |' for r in b['rows']] + ['']
    return '\n'.join(out).rstrip() + '\n'


def link_html(text):
    t = escape(text, quote=False)
    t = URL_RE.sub(lambda m: f'<a href="{m.group(1)}" target="_blank" rel="noopener">{m.group(1).replace("https://", "")}</a>', t)
    return t.replace('Datenschutzerklärung.', '<a href="#datenschutz" data-go="datenschutz">Datenschutzerklärung</a>.')


def page(doc, slug, other_slug, other_title, md_link):
    blocks = []
    for i, (h, bs) in enumerate(doc['sections']):
        sid = f'{slug}-{i + 1}'
        inner = []
        for b in bs:
            if isinstance(b, str):
                inner.append(f'<p>{link_html(b)}</p>')
            elif isinstance(b, list):
                inner.append('<ul>' + ''.join(f'<li>{link_html(x)}</li>' for x in b) + '</ul>')
            else:
                inner.append('<div class="ltable"><table><thead><tr>' + ''.join(f'<th>{escape(c)}</th>' for c in b['head']) + '</tr></thead><tbody>'
                             + ''.join('<tr>' + ''.join(f'<td>{escape(c)}</td>' for c in r) + '</tr>' for r in b['rows']) + '</tbody></table></div>')
        blocks.append(f'<section id="{sid}"><h2><span>{i + 1:02d}</span>{escape(h)}</h2>{"".join(inner)}</section>')
    toc = ''.join(f'<a href="#{slug}/{i + 1}" data-go="{slug}">{escape(h)}</a>' for i, (h, _) in enumerate(doc['sections']))
    return f'''<main data-page="{slug}">
  <div class="wrap legal">
    <aside class="ltoc"><h4>Inhalt</h4>{toc}</aside>
    <div class="ldoc">
      <div class="nmeta"><b>Rechtliches</b><span>Stand {UPDATED["de"]}</span></div>
      <h1>{escape(doc["title"])}</h1>
      <p class="lead">{escape(doc["intro"])}</p>
      <div class="lsum"><h3>Kurz gesagt</h3><ul>{"".join(f"<li>{escape(s)}</li>" for s in doc["summary"])}</ul></div>
      {"".join(blocks)}
      <div class="lfoot"><a href="#{other_slug}" data-go="{other_slug}">{escape(other_title)} →</a><a href="{GH}/blob/main/{md_link}" target="_blank" rel="noopener">English version</a></div>
    </div>
  </div>
</main>'''


def main():
    (ROOT / 'PRIVACY-de.md').write_text(md(PRIVACY['de'], 'de', 'PRIVACY.md', 'English version'))
    (ROOT / 'PRIVACY.md').write_text(md(PRIVACY['en'], 'en', 'PRIVACY-de.md', 'Deutsche Fassung'))
    (ROOT / 'TERMS-de.md').write_text(md(TERMS['de'], 'de', 'TERMS.md', 'English version'))
    (ROOT / 'TERMS.md').write_text(md(TERMS['en'], 'en', 'TERMS-de.md', 'Deutsche Fassung'))
    html = (page(PRIVACY['de'], 'datenschutz', 'nutzungsbedingungen', 'Nutzungsbedingungen', 'PRIVACY.md') + '\n\n'
            + page(TERMS['de'], 'nutzungsbedingungen', 'datenschutz', 'Datenschutzerklärung', 'TERMS.md'))
    p = ROOT / 'docs' / 'index.html'
    s = p.read_text()
    a, b = '<!-- LEGAL:START -->', '<!-- LEGAL:END -->'
    s = s[:s.index(a) + len(a)] + '\n' + html + '\n' + s[s.index(b):]
    p.write_text(s)
    print('ok')


if __name__ == '__main__':
    main()
