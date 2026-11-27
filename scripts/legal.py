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
NAME = 'Erix Stundenplan'   # the app's public name
MAIL = 'stundenplan@severinwehrle.dev'
CONTACT = {
    'de': f'Kontakt: {MAIL}',
    'en': f'Contact: {MAIL}',
}

# Each document: list of (heading, [blocks]); a block is a paragraph (str), a list (list of str) or a table (dict).
PRIVACY = {
    'de': {
        'title': 'Datenschutzerklärung',
        'intro': f'Gilt für alle Versionen von {NAME}: Chrome, Firefox, Android, Windows, macOS, Linux, iPhone, die Synchronisation und diese Website.',
        'summary': [
            'Deine Schuldaten bleiben auf deinem Gerät.',
            'Die App sieht und speichert dein Passwort nie.',
            'Keine Werbung, kein Tracking, kein Konto bei uns.',
            'Sync ist freiwillig und Ende-zu-Ende verschlüsselt.',
        ],
        'sections': [
            ('Wer dahinter steht', [
                'Das Projekt wird von Lernenden betrieben. Es ist inoffiziell und nicht von deiner Schule.',
                CONTACT['de'],
            ]),
            ('Was gespeichert wird', [
                'Die App lädt aus dem Extranet dieselben Daten, die du im Extranet siehst: Stundenplan, Prüfungen, Noten, Absenzen, Räume und deinen Benutzernamen. Dazu deine Notizen und Einstellungen.',
                'Alles bleibt auf deinem Gerät und wird nur dafür gebraucht, es dir anzuzeigen. Wir bekommen nichts davon, und nichts wird ausgewertet oder verkauft.',
            ]),
            ('Anmeldung', [
                'Du meldest dich auf den offiziellen Seiten deiner Schule und von Microsoft an. Die App nutzt danach die Sitzung wie ein Browser und kommt nie an dein Passwort.',
            ]),
            ('Verbindungen', [
                'Jeder Dienst sieht dabei technische Daten wie deine IP-Adresse.',
                {'head': ['Dienst', 'Wofür'], 'rows': [
                    ['Extranet deiner Schule', 'deine Schuldaten'],
                    ['Microsoft', 'Anmeldung'],
                    ['modulbaukasten.ch, ictbb.crm17.dynamics.com', 'öffentliche Modulbeschreibungen'],
                    ['GitHub (USA)', 'Updates und diese Website'],
                    ['Render (Frankfurt)', 'nur Sync, wenn du ihn einschaltest'],
                ]},
            ]),
            ('Benachrichtigungen', [
                'Erinnerungen und Hinweise auf neue Noten berechnet die App auf deinem Gerät. Dafür bekommt kein Server deine Daten.',
            ]),
            ('Sync (freiwillig)', [
                ['Aus, bis du ihn einschaltest.',
                 'Übertragen werden nur Notizen, Prüfungskorrekturen und einige Einstellungen. Nie Noten, Absenzen, Stundenplan oder Login.',
                 'Alles wird auf deinem Gerät verschlüsselt. Der Server und die Sicherung auf GitHub sehen nur verschlüsselte Daten.',
                 'Nach 365 Tagen ohne Sync wird dein Konto automatisch gelöscht. Unter «Sync» kannst du es jederzeit selbst löschen.'],
            ]),
            ('Diese Website', [
                'Läuft auf GitHub Pages. Keine Cookies, kein Tracking, keine Schriften oder Skripte von Dritten. Für die Versionsnummer fragt dein Browser bei GitHub nach.',
            ]),
            ('Löschen', [
                'Unter Einstellungen › Daten oder durch Deinstallieren ist alles auf deinem Gerät weg. Sync-Daten löschst du unter «Sync».',
            ]),
            ('Deine Rechte', [
                'Du hast das Recht auf Auskunft, Berichtigung und Löschung (Schweizer Datenschutzgesetz, wo anwendbar DSGVO). Schreib uns, oder wende dich an den EDÖB.',
            ]),
            ('Änderungen', [
                'Wenn sich Wichtiges ändert, passen wir diese Seite an. Das Datum oben zeigt den Stand.',
            ]),
        ],
    },
    'en': {
        'title': 'Privacy policy',
        'intro': f'Applies to every version of {NAME}: Chrome, Firefox, Android, Windows, macOS, Linux, iPhone, sync and the website.',
        'summary': [
            'Your school data stays on your device.',
            'The app never sees or stores your password.',
            'No ads, no tracking, no account with us.',
            'Sync is optional and end-to-end encrypted.',
        ],
        'sections': [
            ('Who runs it', [
                'The project is run by students. It is unofficial and not made by your school.',
                CONTACT['en'],
            ]),
            ('What is stored', [
                'From the extranet the app loads the same data you see in the extranet: timetable, exams, grades, absences, rooms and your username. Plus your notes and settings.',
                'All of it stays on your device and is only used to show it to you. We get none of it, and nothing is analysed or sold.',
            ]),
            ('Signing in', [
                'You sign in on the official pages of your school and Microsoft. The app then uses the session like a browser and never gets your password.',
            ]),
            ('Connections', [
                'Each service sees technical data such as your IP address.',
                {'head': ['Service', 'What for'], 'rows': [
                    ["your school's extranet", 'your school data'],
                    ['Microsoft', 'signing in'],
                    ['modulbaukasten.ch, ictbb.crm17.dynamics.com', 'public module descriptions'],
                    ['GitHub (USA)', 'updates and the website'],
                    ['Render (Frankfurt)', 'only sync, if you turn it on'],
                ]},
            ]),
            ('Notifications', [
                'Reminders and new-grade alerts are worked out on your device. No server gets your data for them.',
            ]),
            ('Sync (optional)', [
                ['Off until you turn it on.',
                 'Only notes, exam corrections and some settings are transferred. Never grades, absences, timetable or login.',
                 'Everything is encrypted on your device. The server and the backup on GitHub only see encrypted data.',
                 'After 365 days without syncing, your account is deleted automatically. You can delete it yourself any time under "Sync".'],
            ]),
            ('The website', [
                'Runs on GitHub Pages. No cookies, no tracking, no third-party fonts or scripts. For the version number your browser asks GitHub.',
            ]),
            ('Deleting', [
                'Settings › Data or uninstalling removes everything on your device. Delete sync data under "Sync".',
            ]),
            ('Your rights', [
                'You have the right to access, correct and delete your data (Swiss data protection law, GDPR where it applies). Email us, or contact the FDPIC.',
            ]),
            ('Changes', [
                'If something important changes, we update this page. The date at the top shows the version.',
            ]),
        ],
    },
}

TERMS = {
    'de': {
        'title': 'Nutzungsbedingungen',
        'intro': f'Die Regeln für {NAME}, in allen Versionen.',
        'summary': [
            'Kostenlos, inoffiziell, nicht von deiner Schule.',
            'Massgebend ist immer das Extranet der Schule.',
            'Nur mit deinem eigenen Konto benutzen.',
            'Ohne Garantie, so gut wir können.',
        ],
        'sections': [
            ('Wer dahinter steht', [
                'Das Projekt wird von Lernenden betrieben. Nicht von deiner Schule und nicht von Microsoft.',
                CONTACT['de'],
            ]),
            ('Angaben ohne Gewähr', [
                ['Massgebend sind die offiziellen Angaben der Schule.',
                 'Geschätzte Prüfungstermine, Schnitt, Notenrechner und Fristen sind Hilfen. Prüf Wichtiges im Extranet.',
                 'Ändert die Schule das Extranet, kann die App zeitweise falsche oder keine Daten zeigen.'],
            ]),
            ('Faire Nutzung', [
                ['Nur mit deinem eigenen Schulkonto anmelden.',
                 'Die Regeln deiner Schule gelten auch hier.',
                 'Keine fremden Daten abrufen, keine Sicherheitsmassnahmen umgehen, die Systeme der Schule nicht überlasten.'],
            ]),
            ('Sync', [
                'Freiwillig und ohne Garantie. Bewahr deinen Wiederherstellungscode auf: Ohne ihn und ohne verbundenes Gerät kann niemand deine Sync-Daten wiederherstellen, auch wir nicht.',
            ]),
            ('Verfügbarkeit', [
                'Wir machen die App in unserer Freizeit. Funktionen können sich ändern oder wegfallen, und das Projekt kann jederzeit enden.',
            ]),
            ('Lizenz und Stores', [
                f'Der Code steht unter der MIT-Lizenz auf GitHub. Installierst du die App aus einem Store, gelten auch dessen Bedingungen.',
            ]),
            ('Haftung', [
                'Die App kommt ohne Garantie. Soweit gesetzlich erlaubt, haften wir nicht für Schäden durch ihre Nutzung, etwa verpasste Termine. Ausgenommen sind Absicht und grobe Fahrlässigkeit.',
            ]),
            ('Änderungen und Recht', [
                'Diese Bedingungen können angepasst werden; das Datum oben zeigt den Stand. Es gilt Schweizer Recht. Zum Datenschutz siehe die Datenschutzerklärung.',
            ]),
        ],
    },
    'en': {
        'title': 'Terms of use',
        'intro': f'The rules for {NAME}, in every version.',
        'summary': [
            'Free, unofficial, not made by your school.',
            'The school\'s extranet always has the final say.',
            'Only use it with your own account.',
            'No guarantee, but we do our best.',
        ],
        'sections': [
            ('Who runs it', [
                'The project is run by students. Not made by your school or by Microsoft.',
                CONTACT['en'],
            ]),
            ('No guarantee for the information', [
                ['The school\'s official information is what counts.',
                 'Estimated exam dates, averages, the grade calculator and deadlines are aids. Check anything important in the extranet.',
                 'When the school changes the extranet, the app may show wrong or no data for a while.'],
            ]),
            ('Fair use', [
                ['Only sign in with your own school account.',
                 'Your school\'s rules apply here too.',
                 'Don\'t access other people\'s data, get around security measures or overload the school\'s systems.'],
            ]),
            ('Sync', [
                'Optional and without guarantee. Keep your recovery code: without it and without a linked device, nobody can recover your sync data, not even us.',
            ]),
            ('Availability', [
                'We build the app in our free time. Features may change or go away, and the project may end at any time.',
            ]),
            ('Licence and stores', [
                'The code is under the MIT licence on GitHub. If you install the app from a store, that store\'s terms apply too.',
            ]),
            ('Liability', [
                'The app comes without a guarantee. As far as the law allows, we aren\'t liable for damage from using it, such as missed dates. Intent and gross negligence are excluded from this.',
            ]),
            ('Changes and law', [
                'These terms may be updated; the date at the top shows the version. Swiss law applies. For data protection, see the privacy policy.',
            ]),
        ],
    },
}

LINKS = {'de': ('Datenschutzerklärung', 'datenschutz'), 'en': ('privacy policy', 'datenschutz')}
URL_RE = re.compile(r'(https?://[^\s)]+)')


def md(doc, lang, other_lang_file, other_label):
    upd = 'Stand' if lang == 'de' else 'Last updated'
    out = [f'# {doc["title"]}: {NAME}', '', f'{upd}: {UPDATED[lang]}. {other_label}: [{other_lang_file}]({other_lang_file}).', '', doc['intro'], '']
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
    t = t.replace(MAIL, f'<a href="mailto:{MAIL}">{MAIL}</a>')
    return t.replace('die Datenschutzerklärung.', 'die <a href="#datenschutz" data-go="datenschutz">Datenschutzerklärung</a>.')


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
