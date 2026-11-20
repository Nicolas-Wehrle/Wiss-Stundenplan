# Privacy policy: WISS Stundenplan

Last updated: 20 November 2026. Deutsche Fassung: [PRIVACY-de.md](PRIVACY-de.md).

How WISS Stundenplan handles your data. It applies to every version: the browser extensions for Chrome and Firefox, the Android app, the desktop app for Windows, macOS and Linux, the iPhone script, the optional device sync and the website.

**In short**

- Your school data (timetable, grades, absences) stays on your device. We never see it.
- The app never sees or stores your password. You sign in directly with WISS and Microsoft.
- No ads, no tracking, no analytics, no account with us.
- Syncing between your devices is optional, off until you turn it on, and end-to-end encrypted.

## Who is responsible

Severin Wehrle, Switzerland, developer of WISS Stundenplan. Danylo Kovalenko works on the iPhone version. WISS Stundenplan is an independent, unofficial project by students and has no connection to WISS or Tocco.

Contact: through the issues of the public GitHub project (https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/issues). Please don't post login details or personal school data there. For anything that shouldn't be public, say in the issue that you'd like to talk privately and you'll get a private way to reach us.

## What the app stores on your device

When you sign in, the app loads exactly the data you can also see in the extranet, through wiss.tocco.ch: timetable, exams, grades, absences and attendance, room bookings and your username. It also keeps your own notes, corrections to exam dates and your settings.

All of it stays on your device:

- Browser extensions: in the extension's storage in your browser profile.
- Android app: in the app's private storage.
- Desktop app: in its data folder (Windows: %APPDATA%\ch.wisstools.stundenplan, macOS: ~/Library/Application Support/ch.wisstools.stundenplan, Linux: ~/.local/share/ch.wisstools.stundenplan).
- iPhone: in Safari's storage for wiss.tocco.ch; the sync key in the private storage of the Userscripts app.

The data is only used to show you your school day. It is not sent to us or anyone else, not analysed and not sold.

## Signing in

Signing in happens on the official WISS and Microsoft pages. The app then uses the signed-in session, like your browser does, to load your data from WISS. It never reads, stores or types your password. In the Android and desktop apps, sign-in happens in a hidden window; a visible window only appears when Microsoft really needs you.

Resetting the app doesn't end your WISS or Microsoft session. You can sign out on their pages at any time.

## Who the app connects to

With every connection, the operator sees technically necessary data such as your IP address and the time. What these services do with it is covered by their own privacy policies.

| Service | What for |
|---|---|
| wiss.tocco.ch (WISS / Tocco) | your school data, with your sign-in |
| login.microsoftonline.com (Microsoft) | signing in with your WISS account |
| modulbaukasten.ch and ictbb.crm17.dynamics.com (ICT-Berufsbildung Schweiz) | public descriptions of apprenticeships and modules, nothing about you |
| api.github.com and github.com (GitHub, USA) | checking for a new version and downloading updates |
| stundenplan.severinwehrle.dev (on GitHub Pages) | the website and the Linux package source |
| wiss-stundenplan-sync.onrender.com (Render, data centre in Frankfurt) | only if you turn on sync, see below |

On iPhone, the Userscripts app loads updates of the script from GitHub.

## Reminders and notifications

Lesson reminders, absence deadlines and new-grade alerts are worked out on your device from your stored data and shown as normal system notifications. There is no push service and no server that gets your data for this. New grades are reported as soon as the app refreshes your data from WISS.

## Syncing between your devices (optional)

Sync is off until you turn it on in the settings. Then notes, corrections to exam dates and some settings (such as your apprenticeship) are kept in step between your devices.

- The data is encrypted on your device before it leaves it. The key stays on your devices and in the recovery code, which only you have.
- The server (Render, Frankfurt) only stores the encrypted packages, random technical IDs and connection data. It can't read the content.
- The encrypted packages are also backed up in a private GitHub repository.
- Your timetable, grades, absences, username and login are never synced.
- You link a new device with a code that works once and for 10 minutes.

## The website

The website is hosted on GitHub Pages. GitHub keeps technically necessary access data such as your IP address to deliver the site and protect it from abuse. The website sets no cookies, uses no tracking and loads no fonts or scripts from third parties. To show the current version number and download links, your browser asks GitHub's public interface (api.github.com).

## How long data is kept

- On your device: until you delete it under Settings › Data, uninstall the app or remove your browser profile.
- Sync: under "Sync" you can have the data on the server deleted. Accounts that haven't synced for 365 days are deleted automatically. Only disconnecting or uninstalling doesn't delete the server data. After deletion, encrypted copies can stay in the version history of the GitHub backup for a while; without your key they can't be read.

## Transfers abroad

GitHub is a US service. When the app checks for updates or you visit the website, technical connection data goes to GitHub. The sync server runs in the EU (Frankfurt). No school data goes to any of these services.

## Your rights

Under the Swiss Federal Act on Data Protection (and the GDPR where it applies) you have the right to access, correct and delete your data. Because almost everything is only on your device, you can see and delete it there yourself. For questions, use the contact above. You can also complain to the Federal Data Protection and Information Commissioner (FDPIC).

## Demo account

The demo account creates invented data on your device. It needs no WISS account, loads no school data and can't sync. "End demo" deletes the invented data again; the demo never overwrites real data.

## Changes

If something important about the app changes, this policy is updated. The date at the top shows the current version. Earlier versions are in the history on GitHub.
