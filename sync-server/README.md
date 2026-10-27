# Encrypted WISS device sync

Server source is public and runs on Render. Only encrypted data goes into the separate private repository. No dependencies are installed: Node 22 or later supplies HTTP, crypto and fetch.

## Exact Render setup

First upload/commit the `sync-server/` folder to the public application source repository, `Nicolas-Wehrle/Wiss-Stundenplan`. Render must run this source, not the private data repository.

Create a **Web Service** using the public source repository and these values:

| Field | Value |
|---|---|
| Name | `wiss-stundenplan-sync` |
| Branch | `main` |
| Region | Frankfurt (EU Central) |
| Runtime | Node |
| Root directory | `sync-server` |
| Build command | `node --check server.mjs` |
| Start command | `node server.mjs` |
| Instance type | Free |
| Instances | Exactly 1 |
| Health check path | `/health` |
| Auto deploy | On commit, or manual during the pilot |

Environment variables:

| Name | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `SYNC_DATA_REPO` | `Nicolas-Wehrle/Wiss-Stundenplan-Data` |
| `SYNC_DATA_BRANCH` | `main` |
| `GITHUB_TOKEN` | A fine-grained GitHub token, set privately in Render |

Create the token for **only** the private data repository, with **Contents: read and write** and the automatically included Metadata access. Never put it in source code, the client, a screenshot or chat. Rotate it in Render before it expires. The private data repository must already have a `main` branch: create a README if it is empty. Confirm the repository is private in GitHub settings before enabling sync.

Expected service URL: `https://wiss-stundenplan-sync.onrender.com`. Render may allocate another name if it is unavailable. Enter the actual HTTPS URL in the app; recovery codes include it. The client accepts Render subdomains only and requests permission for the exact chosen origin.

Alternatively, create a Blueprint with `sync-server/render.yaml` as its blueprint path. It also configures a 120-second shutdown delay. If configuring manually, the default shutdown window is an extra safeguard only: data is never acknowledged before GitHub persistence.

After deployment, open `/health`: it should return `{"ok":true}`. This confirms startup access to the data repository, but use the pilot below to verify writes too.

## Data and durability

`data/<randomSyncId>.json` contains `{v, updated, seen, auth, blob}`. `auth` is a SHA-256 hash of a separate HKDF-derived bearer secret; `blob` contains an AES-256-GCM IV and ciphertext. The master key and the encryption key never reach this service. GitHub sees the service's requests; Render receives clients' network connections. Both providers may retain infrastructure logs. There is no application access log containing IDs, tokens or request bodies.

Mutations are batched after 15 seconds of inactivity, with a 20-second maximum wait. This leaves room for GitHub persistence before Chrome's 30-second service-worker fetch limit. The client aborts individual requests after 24 seconds and retries; a later GET recovers writes that completed after the connection was lost. HTTP success is returned only after the batch's ordinary Git commit and non-force branch update succeed. Repository operations are serialized within the process. Concurrent deployments retry against the latest head. Failed or uncertain client requests retain local data and credentials. A failed first creation that remains absent requires disconnecting and enabling sync again; this deliberately avoids automatic account resurrection.

DELETE bypasses the batching delay and removes the active file durably before returning success. GET never recreates an account. Accounts expire after 365 days without successful sync; activity is persisted at most once a day and expiration runs at startup and every six hours while the service is awake. Do not add a pinger: the service is allowed to sleep. Cold-start failures are retried without blocking the app.

Limits: 256 KB per encrypted request, 60 requests/account/minute, 120 requests/IP/minute, 5 creations/IP/minute, 10,000 active files. This GitHub-backed design is intended for a small student project, not high traffic. GitHub API limits, Render quotas and free-service suspension can temporarily stop syncing. Local features continue to work. No free Postgres or ephemeral local database is used.

## Monthly history compaction

In the **private data repository**, copy:

- `maintenance/compact.mjs` to `maintenance/compact.mjs`.
- `maintenance/monthly-compaction.yml` to `.github/workflows/monthly-compaction.yml`.

Enable Actions there. The workflow uses that repository's temporary `github.token`, not the Render token. It runs on the first day of each month and can be run manually. Branch protection must permit this administrative workflow to replace the data branch history. Routine server writes never force-push.

The script publishes a maintenance lock with an ordinary commit. Servers refuse new transactions against the locked head; older in-flight writes cannot fast-forward over it. It then creates a parentless snapshot with the current tree and replaces the branch. No notes are decrypted. The workflow and maintenance source remain in the snapshot. Concurrent maintenance runs are disabled.

If maintenance fails after publishing `.sync-maintenance`, writes fail safely. Inspect the workflow error, then remove **only** that marker with a normal GitHub commit to resume writes, or rerun after resolving the error. Never restore old account files from history to unlock it.

**Compaction is not guaranteed physical erasure.** GitHub may retain unreachable objects, backups or other references. Do not promise that encrypted copies disappear within 30 days. Keys can still exist on another device or in a saved recovery code after deletion. This implementation does not claim cryptographic erasure while those keys exist.

## Pilot and verification

From the project root: `node --test tests/sync/*.test.mjs`. The tests use synthetic data and a local server; no GitHub token or school account is needed.

Before a public release:

1. Confirm no server requests before opt-in.
2. Enable sync on a browser, save its recovery code and wait for Synced.
3. Inspect the private repo: one encrypted account file, no note text, email or encryption key.
4. Connect a second device, edit different notes offline and confirm they merge on reconnection.
5. Delete a note while the other device is offline; confirm it stays deleted when it returns.
6. Restart/redeploy Render, reconnect and confirm the last acknowledged changes survive.
7. Delete synced data and verify that returning devices stop rather than recreate the account.
8. Test Android WebView and real Safari/Userscripts, including private GM key storage. Browser simulations are not a substitute for these device checks.
9. Run monthly compaction once manually and confirm sync continues and the active branch has a single snapshot commit.

## Protocol

All account endpoints require `Authorization: Bearer <derivedAuthSecret>`. Credentials are never URL parameters. CORS allows the school HTTPS origin and browser extension origins; authentication is still required. The server does not use browser cookies.

| Method | Path | Body / result |
|---|---|---|
| GET | `/health` | Startup health, no account information |
| GET | `/privacy` | Short privacy summary |
| POST | `/v1/accounts/<id>` | `{blob}` creates a new account; 409 if present |
| GET | `/v1/accounts/<id>` | `{v, updated, blob}`; 404 if deleted/expired |
| PUT | `/v1/accounts/<id>` | `{v, blob}`; 409 if the expected version is stale |
| DELETE | `/v1/accounts/<id>` | 204 after durable removal |

Client format 1 uses HKDF-SHA-256, salt `wiss-sync-v1`, separate labels `id`, `auth`, `encryption`, AES-256-GCM, 12-byte random IVs and authenticated data `wiss-sync:1:<id>`. Recovery codes include the endpoint, random 32-byte master key and a checksum. QR generation is local. Per-record timestamps and device IDs determine merges; deletion markers are retained and losing non-empty notes have up to 50 local recoverable copies. There is no collaborative text editor or per-device key revocation: disconnect a device locally; migrate to a new account if a recovery code is exposed.
