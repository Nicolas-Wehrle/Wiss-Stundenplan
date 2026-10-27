# Push and deploy the encrypted-sync pilot

The source is version 1.11.0, an unreleased pilot. This folder tracks `main` from:

`https://github.com/Nicolas-Wehrle/Wiss-Stundenplan.git`

The sync source, generated platform web code, public synthetic tests and documentation are prepared in a local commit. To publish that commit, run from this folder:

```powershell
git push origin main
```

This pushes source code. It does not create a GitHub Release, change the Firefox update manifest, upload an APK or publish private test data. Existing icon differences from the supplied folder are left outside the sync commit. Do not use `git add .` just to push: the prepared commit already contains the reviewed sync changes.

After pushing, create the Render Web Service:

| Setting | Value |
|---|---|
| Source repo | `Nicolas-Wehrle/Wiss-Stundenplan` |
| Branch | `main` |
| Name | `wiss-stundenplan-sync` |
| Region | Frankfurt |
| Runtime / plan | Node / Free |
| Root directory | `sync-server` |
| Build | `node --check server.mjs` |
| Start | `node server.mjs` |
| Health check | `/health` |
| Instances | 1 |

Set these Render environment variables:

```text
NODE_VERSION=22
SYNC_DATA_REPO=Nicolas-Wehrle/Wiss-Stundenplan-Data
SYNC_DATA_BRANCH=main
GITHUB_TOKEN=<set this privately in Render>
```

The data repository must be private and initialized with a `main` branch. Use a fine-grained token with Contents read/write on **only** that repository. Do not commit the token.

The expected service URL is `https://wiss-stundenplan-sync.onrender.com`. Use the actual URL Render allocates if it differs. Open `/health`, then enter that server URL in the app's device-sync settings. Save the recovery code before linking another device.

Install the monthly maintenance templates in the private data repo as described in [sync-server/README.md](sync-server/README.md). The full guide also lists the two-device pilot checks and the limits of deleting encrypted GitHub history.

## Verification completed locally

- Node crypto, merge, HTTP, durability and GitHub persistence tests: `node --test tests/sync/*.test.mjs`.
- Browser integration using the built Android and iPhone adapters, private GM storage, QR codes, linking, merging, appearance, English and deletion.
- Actual Chrome extension loading, background imports, settings and persisted edits via Chrome's extension-debugging API.
- Existing private Android and iPhone web regression suites.
- Firefox, Android web assets and iPhone userscript rebuilt from shared source.

The native Android build stops at **SDK location not found**. Set `ANDROID_HOME` or an ignored `android app/local.properties` with `sdk.dir`, then build with JDK 17+ and the project wrapper. A release APK needs the original signing key. Firefox 1.11.0 still needs Mozilla signing. Neither signing key nor private fixtures are in the prepared commit.

Real Render/GitHub persistence, monthly compaction and real Android/Safari checks remain part of the deployment pilot. Publish release binaries only after those pass.
