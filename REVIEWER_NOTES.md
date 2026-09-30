# AMO Reviewer Notes — Version 1.2.3

## Overview

Video Timeline Marker for YouTube & Twitch is a Firefox WebExtension for creating timestamp markers and notes on supported YouTube and Twitch playback pages, managing them in a popup, and importing/exporting TXT timelines.

Version 1.2.3 includes an **optional** Google Drive synchronization feature. The core marker functionality remains local-first and fully usable without a Google account.

## Google Drive synchronization

The optional sync implementation is plain JavaScript in:

- `src/sync/google-auth.js`
- `src/sync/google-drive.js`
- `src/sync/sync-engine.js`

Authentication uses Firefox `browser.identity.launchWebAuthFlow()` and Google OAuth 2.0 Desktop-app authorization with PKCE. The extension requests only the Google Drive scope:

`https://www.googleapis.com/auth/drive.appdata`

The cloud file is stored in the user's hidden Google Drive `appDataFolder` as `video-timeline-marker-sync.json`.

There is no developer-operated backend, analytics service, tracking endpoint, remote JavaScript, or third-party JavaScript dependency.

The bundled OAuth Client ID and client secret belong to a Google Desktop/Installed-app client. Google documents that installed-app secrets are not confidential and the flow is protected by PKCE. No API key, service-account private key, access token, or refresh token is bundled.

## Optional Firefox data-transmission consent

The core feature remains:

`browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`

Google Drive synchronization declares these optional types:

- `authenticationInfo`
- `websiteActivity`
- `websiteContent`

The popup calls `browser.permissions.request({ data_collection: [...] })` only in response to the user's **Connect Google Drive** action. If permission is denied or later removed, synchronization stays/stops disabled and local marker functionality remains available.

## Sync safety model

- `vtm_markers_v1` remains the canonical local marker key.
- Local marker writes never wait for network I/O.
- A separate `vtm_sync_meta_v1` tracks per-marker update versions and deletion tombstones.
- Newer per-marker versions win during two-way merge.
- Newer tombstones win over older live records so deletion does not reappear from another device.
- If two devices create the first appData sync file concurrently, every same-name file is merged before the newest file is used as the primary write target; duplicate files are not auto-deleted.
- Cloud JSON/schema is validated before local markers are changed.
- Drive updates use `If-Match` when an ETag is available; a 412 precondition failure causes a fresh read/merge retry.
- Invalid cloud JSON, unsupported schema, OAuth failure, or network failure does not overwrite local markers.

## Automatic sync triggers

When the user enables auto-sync, sync may run:

- after local marker changes (debounced via `alarms`),
- on Firefox startup,
- when the popup opens and the prior sync is stale,
- every 15 minutes,
- on explicit **Sync now**.

## Permissions rationale

- `storage`: local marker/note storage, sync metadata, OAuth refresh token, and settings.
- `downloads`: user-initiated TXT export.
- `identity`: Firefox OAuth flow for the optional Google Drive connection.
- `alarms`: low-frequency automatic synchronization scheduling.
- YouTube/Twitch host permissions: read media metadata/playback position and insert marker UI.
- `https://www.googleapis.com/*`: optional Google Drive API synchronization after consent.
- `https://oauth2.googleapis.com/*`: OAuth token exchange/refresh/revoke after consent.

No broad `tabs` permission is requested.

## Basic YouTube test

1. Open a regular YouTube watch page.
2. Use the VTM marker button in the action row or the popup **＋ Add marker** action.
3. Verify the marker is stored immediately and the note editor opens.
4. Enter a note, adjust ±5 seconds if desired, then close the panel.
5. Verify the popup lists the marker and TXT export still works.
6. In fullscreen, typing inside VTM must not trigger YouTube J/K/L, number, space, or arrow shortcuts.

## Google Drive sync test

1. Open the popup.
2. Click **Connect Google Drive**. The production OAuth Desktop Client ID is already embedded as a public application identifier.
3. Grant Firefox's optional data-transmission permission and Google `drive.appdata` consent.
4. Confirm the popup reports **Connected** and a successful last-sync time.
5. Add/edit/delete markers; press **Sync now** and verify no local UI operation waits for network I/O.
6. On a second Firefox profile using the same OAuth client/account, connect and sync; independent markers merge and deletions remain deleted.
7. Disconnect and verify local markers remain available.

Detailed setup: `docs/GOOGLE_DRIVE_SYNC_SETUP.md`.

## Build information

There is no build step. The extension ships readable HTML, CSS, JSON, PNG, and JavaScript source directly. No minifier, transpiler, bundler, source generator, remote code, or vendored dependency is used.

## Stable identifiers

- Add-on ID: `video-timeline-marker@erttyouo`
- Marker storage key: `vtm_markers_v1`

Both remain unchanged from the previous release.

## Contact

Developer: 貳緹 (erttyouo)  
Support: Eric208311@gmail.com  
Website: https://github.com/ErttyOuO

## webNavigation permission (v1.2.6)

`webNavigation` is used only as an OAuth compatibility fallback for Firefox derivatives (including observed Zen builds) that complete Google consent but fail to hand the special loopback callback back to `identity.launchWebAuthFlow()`. The normal path uses only `launchWebAuthFlow({url, interactive})`. The fallback listener is registered only during an interactive Google Drive connection retry, filtered to `http://127.0.0.1/mozoauth2/...`, restricted to the temporary authorization tab and top-level frame, and removed immediately after success, cancellation, or timeout. It is not used to monitor general browsing.
### Google OAuth request (v1.2.9)

The extension uses a Google OAuth **Desktop/Installed App** public client ID with PKCE. The authorization URL does not use incremental authorization (`include_granted_scopes` is intentionally absent), because Google documents incremental authorization as unsupported for installed apps. Only `https://www.googleapis.com/auth/drive.appdata` is requested.
### `scripting` permission (v1.2.10)
Used only from the popup when the user presses Add marker on an already-open YouTube/Twitch tab and the declared content script is not reachable (commonly after an extension update without a page reload). The extension reinjects its own bundled content-script files into that supported host-permission tab, then captures the current playback time. No remote code is loaded or executed.

