# Publishing 1.12.0

1. **Push the code.** From the repo folder: `git push origin main` (after merging the `redesign-1.12.0` branch). Render redeploys the sync server from `main` by itself. Check `https://wiss-stundenplan-sync.onrender.com/health` afterwards. The new server sends a `Strict-Transport-Security` header; the old one doesn't.
2. **Android APK.** Build with your signing key: `cd "android app"` and `./gradlew assembleRelease` (needs `keystore.properties` and the `.jks`, which never go into git). Put the APK in the main folder as `WISS-Stundenplan.apk`.
3. **Firefox.** Upload `release/v1.12.0/WISS-Stundenplan-Firefox.zip` to addons.mozilla.org ("On your own") for signing. Save the signed file as `WISS-Stundenplan-Firefox.xpi` in the main folder.
4. **Collect.** Run `python release.py`. It puts everything into `release/v1.12.0/` and updates `updates.json` once the signed `.xpi` is there.
5. **GitHub release.** New release with the tag `v1.12.0`, text from `release-notes-1.12.0.txt`, files from `release/v1.12.0/`.
6. **Push again.** Commit and push `updates.json` and `iphone/WISS-Stundenplan.user.js`, so Firefox and iPhone update by themselves.

Never commit `android app/wiss-stundenplan.jks`, `android app/keystore.properties` or `tests-private/`.
