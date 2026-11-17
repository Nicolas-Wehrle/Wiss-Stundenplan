# WISS Stundenplan (iPhone)

On iPhone, WISS Stundenplan runs in Safari with the free app **Userscripts**.
You sign in with your own WISS account, and your data stays on your iPhone.

Unofficial, not made by WISS.

There's also a step-by-step guide with pictures on the website: https://stundenplan.severinwehrle.dev/#download/iphone

## Setup
1. Install **Userscripts** (by Justin Wasack) from the App Store.
2. Open Userscripts and tap **Set Userscripts Directory**. Pick a folder, for example *On My iPhone > Userscripts*.
3. Save `WISS-Stundenplan.user.js` into that folder: tap the file, then **Share > Save to Files**, and pick the folder.
4. In *Settings > Apps > Safari > Extensions > Userscripts*, turn the extension on and choose **Allow** for *wiss.tocco.ch*.
5. In Safari, open **https://wiss.tocco.ch/extranet/?stundenplan** and tap **Sign in** ("Anmelden" in German). After signing in, you're taken back to the timetable by itself.

## Open it faster
- Save it as a favourite: Share > Add to Favourites.
- As an icon on the home screen: in the *Shortcuts* app, create a shortcut with **Open URLs** and the address above, then **Add to Home Screen**.
  Safari's own "Add to Home Screen" doesn't work, because extensions don't run there.
- Every extranet page has a **Stundenplan** button in the bottom right.

## What works
- Week, exams, grades with calculator, absences, rooms with floor plans, notes, teachers
- All styles, light and dark, German and English
- When the sign-in expires, it goes through the WISS sign-in for a moment and then comes back

No notifications and no widget. Apple only allows those for apps from the App Store.

## Updating
The Userscripts app updates the script by itself. To update by hand, put the new `WISS-Stundenplan.user.js` in the same folder and replace the old one. Your data stays.

## Problems
- **You see the normal extranet:** Userscripts isn't allowed on wiss.tocco.ch yet. In Safari, tap **aA > Manage Extensions**, turn Userscripts on and choose **Always Allow**.
- **It always says "Sign-in needed":** tap **Sign in** and choose "Stay signed in" at Microsoft.

## For developers
`build-ios.py` builds the file from the Chrome add-on: `python3 iphone/build-ios.py "chrome addon" iphone`
