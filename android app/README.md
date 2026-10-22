# WISS Stundenplan (Android)

The same app as the browser add-on, as a normal Android app. It also has reminders and a home-screen widget.

Unofficial. Not made by or affiliated with WISS.

## Install (Android 8 or newer)
1. Get `WISS-Stundenplan.apk` onto your phone (Drive, WhatsApp to yourself, USB) and open it.
2. Allow installing apps from that source when Android asks.
3. If Play Protect warns you, tap "Details" and "Trotzdem installieren". It only warns because the app isn't from the Play Store.
4. Open **Stundenplan**, tap "Anmelden" and sign in with your WISS account once.

To update, install the new APK over the old one. Your data and login stay.

## Widget
Long-press the home screen, go to Widgets and pick Stundenplan. It shows your current or next lesson with room and teacher.
Long-press the widget > settings to change the style, background, light/dark and transparency.

## Reminders
In Einstellungen > Benachrichtigungen you can turn on:
- a reminder before each lesson (5 to 30 minutes before)
- a reminder 2 days before an absence has to be excused
- a message when a new grade shows up

Lesson and absence reminders also come when the app is closed. New grades show up once the app refreshes.

## How it works
- The add-on's interface runs inside the app (`app/src/main/assets/web`).
- The app serves it under `https://wiss.tocco.ch/__wissapp/`, so requests to Tocco use your login. Your login stays inside this app.
- If your login expired, the app shows the WISS sign-in for a moment. Microsoft usually signs you in again by itself.
- Module descriptions from modulbaukasten.ch go through a small proxy inside the app (`/__wissapp/proxy`).
- Your data is stored in the app's private storage and nowhere else.

## Building
You need JDK 17 or newer and the Android SDK (easiest: install Android Studio).
```
python3 build-android-web.py "../chrome addon" .   # copies the add-on into the app
./gradlew assembleRelease                           # app/build/outputs/apk/release/app-release.apk
```

## Signing key
`wiss-stundenplan.jks` and `keystore.properties` sign the app. Android only installs an update over the old app if it was signed with the same key.
Don't share these two files, don't upload them anywhere, and don't lose them. They're excluded in `.gitignore`.
