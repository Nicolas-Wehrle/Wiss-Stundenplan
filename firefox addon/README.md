# WISS Stundenplan (Firefox)

The same add-on as the Chrome version, for Firefox on the computer and on Android.

Unofficial. Not made by or affiliated with WISS.

## Which file do I need?
**`WISS-Stundenplan-Firefox.xpi`** from the [Releases](https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/releases/latest) page.

That is the version signed by Mozilla. Firefox only installs signed add-ons, so the `.zip` and the files in this folder won't work for a normal install. They are only for signing and testing.

## Install on the computer
1. Open the [Releases](https://github.com/Nicolas-Wehrle/Wiss-Stundenplan/releases/latest) page in Firefox.
2. Click `WISS-Stundenplan-Firefox.xpi`. Firefox asks if you want to add it; click "Hinzufügen" / "Add".
   If it just downloads instead, drag the downloaded file into a Firefox window.
3. Pin the W icon in the toolbar and follow the setup.

Updates come in on their own after that.

## Install on Android (Firefox 142 or newer)
1. Download `WISS-Stundenplan-Firefox.xpi` on your phone.
2. Firefox > Settings > About Firefox, tap the Firefox logo 5 times. This turns on the debug menu.
3. Go back to Settings and choose "Install extension from file", then pick the `.xpi`.
4. Open it from Menu > Add-ons > WISS Stundenplan and sign in once in the tab that opens.

## Problems
- **"This add-on could not be installed because it appears to be corrupt"** or **"could not be verified"**: you picked the `.zip` or an unsigned file. Download the `.xpi` from Releases.
- **Nothing happens after clicking the `.xpi`:** check the puzzle icon in the toolbar, Firefox sometimes shows the install question there.

## For developers
**Quick test without signing** (removed when Firefox restarts):
1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Temporäres Add-on laden…" / "Load Temporary Add-on…" and pick `manifest.json` in this folder.

**Signing a new version** (free, a few minutes):
1. Raise the version number. Mozilla never signs the same version twice.
2. On the [Developer Hub](https://addons.mozilla.org/developers/addons) upload `WISS-Stundenplan-Firefox.zip` as a new version and choose **On your own** (not listed on the store). Tick Firefox and Firefox for Android.
3. After the automatic check, download the signed `.xpi`, rename it to `WISS-Stundenplan-Firefox.xpi` and continue with "Publishing a release" in the main README.

## Privacy
Same as the Chrome version: everything is loaded with your own WISS login and only stored in your browser.
