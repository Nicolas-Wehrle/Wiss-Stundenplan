# WISS Stundenplan (Firefox)

The same add-on as the Chrome version, for Firefox on the computer and on Android.

Unofficial. Not made by or affiliated with WISS.

## Install
Firefox only keeps add-ons that Mozilla has signed.

**Signed version:** open `WISS-Stundenplan-Firefox.xpi` in Firefox (drag it into the window) and click "Hinzufügen". Then pin the W icon and follow the setup.

**Quick test without signing** (gone after a restart):
1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Temporäres Add-on laden…" and pick `manifest.json` in this folder.

**Getting the signed .xpi** (free, takes a few minutes per version):
1. Make an account on https://addons.mozilla.org/developers/
2. "Submit a New Add-on", then choose **On your own** (not listed publicly).
3. Upload `WISS-Stundenplan-Firefox.zip`, tick Firefox and Firefox for Android. After the automatic check you can download the signed `.xpi`.

**Firefox for Android (142 or newer):**
1. Copy the signed `.xpi` to your phone.
2. Firefox > Settings > About Firefox, tap the logo 5 times to turn on the debug menu.
3. Back in Settings, choose "Install extension from file" and pick the `.xpi`.
4. Open it from Menu > Add-ons > WISS Stundenplan. Sign in once in the tab it opens.

## What it does, privacy, files
Same as the Chrome version, see `chrome addon/README.md`.
Everything is loaded with your own WISS login and only stored in your browser.
