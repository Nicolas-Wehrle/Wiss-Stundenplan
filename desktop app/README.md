# WISS Stundenplan for Windows, macOS and Linux

A small native app built with [Tauri 2](https://tauri.app): the logic around it is Rust, and the window shows the same web code as the add-on (`chrome addon/`). The system's own web engine draws it: Edge WebView2 on Windows, WebKit on macOS, WebKitGTK on Linux. No browser is bundled, so the installer is only a few MB.

## What it does differently from the add-on

- **Own window**, always in the full-page layout. Closing the window keeps the app in the tray (Windows notification area, macOS menu bar, Linux tray). Quit with the tray menu.
- **Sign-in stays out of sight.** The extranet and Microsoft's page run in hidden windows. A window only appears when Microsoft really needs you (password, new device), titled "Mit WISS-Konto anmelden", and closes itself when you're done. The app never sees or types a password.
- **Requests to wiss.tocco.ch** run inside a hidden wiss.tocco.ch page. That way they carry the sign-in cookies exactly like in a browser, and nothing about the school login ends up in the app's own code. The page is closed after a quiet minute.
- **Reminders and notifications** (lessons, absence deadlines, new grades) come as system notifications while the app runs, also with the window closed.
- **Tray menu:** next lesson and room, Open, Refresh, Mini window, Start with the computer, Quit. The mini window is a small always-on-top card with the next lesson and room (the desktop version of the Android widget). Drag it anywhere.
- **Updates** install themselves. Windows, macOS and the Linux AppImage: the update banner's "Installieren" downloads the new version from the GitHub release, checks its signature, installs it and restarts. Linux with `.deb`/`.rpm`: the app comes from its own package source and updates together with the rest of the system (GNOME Software, KDE Discover, `dnf upgrade`, `apt upgrade`), so the app shows no update banner there.

## Files

```
desktop app/
  build-desktop-web.mjs   copies chrome addon/ into web/ (Tauri runs it before every build)
  web-src/desktop-shim.js chrome.* APIs for the add-on code, talking to the Rust side
  web-src/mini.html       the mini window
  src-tauri/
    src/main.rs           window, hidden pages, tray, reminders, updates, requests
    src/store.rs          storage: one JSON file in the app's data folder
    capabilities/         which window may call what (pages on wiss.tocco.ch: only "here is the result")
    tauri.conf.json       name, version (copied from manifest.json), bundles, updater key
    icons/                made from icon-source.png with `npm run icons`
```

Data lives in the app's data folder: `%APPDATA%\ch.wisstools.stundenplan` on Windows, `~/Library/Application Support/ch.wisstools.stundenplan` on macOS, `~/.local/share/ch.wisstools.stundenplan` on Linux.

## Building it yourself

Needs [Rust](https://rustup.rs) and Node 18+. On Linux also: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`.

```
cd "desktop app"
npm ci
npm run dev        # starts the app with a debug build
npm run build      # installers in src-tauri/target/release/bundle/
```

`npm run build` signs the update files and needs the updater key for that: set `TAURI_SIGNING_PRIVATE_KEY` to the content of `wiss-desktop-updater.key` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to an empty string). Without it, the installers are still built, only the last step reports an error.

## Releases

GitHub builds the app for all three systems by itself (`.github/workflows/desktop.yml`) as soon as a release is published, and adds the installers plus `latest.json` (what the in-app updater reads) to that release. It needs two secrets, once (GitHub › the repository › Settings › Secrets and variables › Actions › New repository secret):

| Name | Value | What for |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | the whole content of `wiss-desktop-updater.key` | signs the updates for Windows, macOS and the AppImage |
| `LINUX_REPO_GPG_KEY` | the whole content of `wiss-linux-repo.private.asc` | signs the Linux package sources |

And GitHub Pages has to publish with Actions: Settings › Pages › Source: **GitHub Actions**.

**Never commit or share the two key files.** They prove updates come from you. If one is lost, a new key means everyone on that system has to reinstall once.

What users download from the release page:

| System | File |
|---|---|
| Windows | the file ending in `_x64-setup.exe` (installs for the current user, no admin needed) |
| macOS | the file ending in `_universal.dmg` |
| Linux | the one command below (best), or `.deb` / `.rpm` / `.AppImage` from the release page |

### Linux: one command, then automatic updates

```
wget -qO- https://stundenplan.severinwehrle.dev/linux.sh | sh
```

It works on Fedora, openSUSE, Ubuntu, Debian, Mint and the like: it adds the app's package source (signed with the repository key), then installs the app. After that, new versions arrive with the normal system updates. Without the command, the `.rpm`/`.deb` from the release page work too, but then every update is a manual download. Everything else: the `.AppImage`, which updates itself like the Windows app.

The package sources live next to the website on GitHub Pages and are rebuilt after every release by `.github/workflows/pages.yml` with `linux-repos.sh`: a dnf/zypper repository in `rpm/` (signed packages, signed metadata) and an apt repository in `apt/` (signed `InRelease`). Only the newest version is kept there.

## Things to know

- **Windows** shows "Windows protected your PC" the first time, because the installer isn't signed with a paid certificate: "More info" › "Run anyway". WebView2 is part of Windows 10/11; if it's ever missing, the installer fetches it.
- **macOS** without an Apple developer account (€99/year) blocks the first start: System Settings › Privacy & Security › "Open Anyway".
- **Linux:** the tray icon needs a desktop with tray support (KDE, Cinnamon, Ubuntu's GNOME; on plain GNOME the "AppIndicator" extension). Without one, the app still keeps running when you close the window: start it again (app menu or desktop icon) and the window comes back.
