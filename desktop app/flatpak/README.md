# Flatpak / Flathub

The Linux desktop app as a Flatpak, for [Flathub](https://flathub.org). On Flathub it shows up in GNOME Software, KDE Discover, the Linux Mint software manager and on the Steam Deck, and updates come with the system updates.

- App ID: `dev.severinwehrle.stundenplan.Erix` (Flathub checks that you own `stundenplan.severinwehrle.dev`)
- Built from source, without internet: the Rust crates are listed in `cargo-sources.json`
- The app's own updater stays off (like the `.deb`/`.rpm`). "Mit dem Computer starten" in the tray menu goes through the desktop's Background portal (`gdbus` call in `set_autostart` in main.rs); the desktop may ask once. It starts with `--hidden`, so only the tray icon appears.
- Data lives in `~/.var/app/dev.severinwehrle.stundenplan.Erix/`, so people who switch from the `.deb`/`.rpm` sign in once again.

| File | What |
|---|---|
| `dev.severinwehrle.stundenplan.Erix.yml` | Build recipe (GNOME 51 runtime, Rust + Node 24 SDK extensions; Tauri needs Rust 1.90 or newer, GNOME 48 only has 1.89) |
| `dev.severinwehrle.stundenplan.Erix.metainfo.xml` | Store page: texts, screenshots (from `docs/screenshots/`), releases |
| `dev.severinwehrle.stundenplan.Erix.desktop` | App menu entry |
| `cargo-sources.json` | All Rust crates with checksums. Made by `scripts/flatpak-cargo-sources.py` |

## Test build

GitHub › Actions › **Flatpak test build** › Run workflow (it also runs when these files change). It builds this checkout and attaches `erix-stundenplan.flatpak` to the run. On a Linux computer:

```
flatpak install --user erix-stundenplan.flatpak
flatpak run dev.severinwehrle.stundenplan.Erix
```

## First submission to Flathub (once)

1. Fork https://github.com/flathub/flathub and clone the `new-pr` branch.
2. Copy into it: the `.yml`, `cargo-sources.json`, and add the shared modules: `git submodule add https://github.com/flathub/shared-modules.git`.
3. In the `.yml`, set the source to the release: `tag: v1.14.1` (or later) plus its `commit:`. The tag must contain this folder.
4. Open a pull request against `new-pr`, title "Add dev.severinwehrle.stundenplan.Erix". Flathub builds it and a reviewer answers, usually within days to a few weeks.
5. Domain check: Flathub gives you a token. Put it in `docs/.well-known/org.flathub.VerifiedApps.txt`, so it's served at `https://stundenplan.severinwehrle.dev/.well-known/org.flathub.VerifiedApps.txt`. `pages.yml` already publishes hidden folders like this one.

After the merge, Flathub creates the repository `flathub/dev.severinwehrle.stundenplan.Erix`, and you get write access.

## Each new release

1. If `Cargo.lock` changed: `python3 scripts/flatpak-cargo-sources.py`.
2. Add a `<release version="…" date="…">` at the top of `<releases>` in the metainfo (Flathub shows it).
3. In the Flathub repository: update `tag`/`commit` and `cargo-sources.json`, open a pull request. Flathub builds it; merge when green. (Flathub's bot can also open these pull requests by itself if you add `x-checker-data` to the source; optional.)
