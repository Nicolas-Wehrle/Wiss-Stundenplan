# Privacy policy: WISS Stundenplan

Last updated: 4 November 2026. Applies to the WISS Stundenplan browser extension. A German version is in [PRIVACY-de.md](PRIVACY-de.md).

## Provider and contact
Severin Wehrle, WISS Stundenplan project. Contact through the public GitHub project: https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/issues. Please don't post login details or personal school data there. This is an independent student project with no connection to WISS or Tocco.

## Local processing
When you ask it to, the extension loads your timetable, grades, absences, attendance, room data and your username from wiss.tocco.ch. This data, together with your own notes, exam corrections and settings, is stored in the local extension storage of your browser profile. It is only used to show and manage your school day. The extension does not send this school data to the project provider and uses no advertising or analytics tools.

Signing in happens on the official WISS and Microsoft sign-in pages. The extension uses the existing signed-in browser session for requests to WISS. It does not read, capture or store your password. Resetting the extension does not end your WISS or Microsoft browser session automatically; you can sign out on those pages.

## External connections
wiss.tocco.ch provides the school data. www.modulbaukasten.ch and ictbb.crm17.dynamics.com provide public information about apprenticeships and modules. api.github.com provides version information. For any network connection, the operator receives technically required connection data such as the IP address. For signing in, WISS and Microsoft may process further data under their own privacy policies. No general browsing history is collected.

## Optional device sync
Sync is off by default. Only after you turn it on and grant the permission does the extension connect to a sync server on onrender.com (by default wiss-stundenplan-sync.onrender.com). It transfers notes, exam corrections and selected settings, including your chosen apprenticeship, in end-to-end encrypted packages. The server receives the encrypted packages, random technical IDs and connection data, but never the decryption key, your WISS password, or your timetable, grades or absences. Packages may be backed up in a private GitHub repository. Without your devices or the recovery code, the contents cannot be restored. How the server is run: https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/blob/main/sync-server/README.md.

## Retention and deletion
Local data stays stored until you reset it in the settings or remove the browser profile or the extension. Under "Sync" you can ask for the active server data to be deleted. Just disconnecting or uninstalling does not delete existing server data. After a confirmed server deletion, encrypted backup copies can remain in the GitHub history; immediate deletion of every backup is not promised.

## Demo account
The demo account creates invented data locally. It needs no WISS account, loads no school data and does not allow device sync. Ending the demo removes the generated demo data and demo notes. Existing real account data is never replaced by the demo.

## Use of data
Data is not sold, not used for personalised advertising and not used to assess creditworthiness. It is only used for the features described here. This policy will be updated if anything important changes.
