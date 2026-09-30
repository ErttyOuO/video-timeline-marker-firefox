# AMO Listing — English

## Name

Video Timeline Marker for YouTube & Twitch

## Preferred AMO URL slug

`video-timeline-marker-youtube-twitch`

> Final availability must be confirmed by AMO when the listing is created.

## Summary

Mark YouTube/Twitch moments, add notes, fine-tune timestamps, optionally sync timelines through your own Google Drive, and export or re-import UTF-8 TXT files.

## Description

**A timeline note-taking tool for video editors, highlight creators, stream archivists, researchers, and anyone who needs precise video timestamps.**

While watching YouTube or Twitch, click the marker button to immediately save the current position together with the media title and creator information. No second Save action is required.

### Fast marker workflow

After a marker is created, the note field is focused automatically and notes are saved as you type.

Keyboard workflow:

- `Enter` — confirm and close the marker panel
- `Shift + Enter` — insert a new line in the note
- `+` — move the current marker forward by 5 seconds
- `-` — move the current marker backward by 5 seconds

The `+` and `-` shortcuts also work while the note field is focused, while IME composition is protected from accidental shortcut handling.

### Supported media

- YouTube videos
- YouTube live streams / DVR playback
- Twitch VODs
- Twitch live streams

Twitch VODs use the media player's actual playback position. Twitch Live markers use the elapsed-live timer visible on Twitch together with player-relative calibration and are labeled accordingly.

### Timeline management

Markers within each video or stream are displayed from the earliest media position at the top to the latest at the bottom, regardless of the order in which you created them.

### TXT exports

Export options include:

- one marker;
- one video or stream;
- multiple selected videos/streams as a batch;
- all saved media.

Each video or stream is exported to its own TXT file. Files use UTF-8 with BOM and CRLF line endings for reliable Windows and CJK text compatibility.

### TXT re-import and batch deletion

TXT files exported by the extension can be imported back into the popup so timestamps and notes can be restored and edited again. The popup can also delete multiple selected video/stream groups at once, or remove every marker belonging to one media group. Import now reports per-file success/failure details and supports legacy VTM TXT exports. The Open button also reuses an existing tab for the same YouTube/Twitch media when available, so moving between saved timestamps does not create unnecessary duplicate tabs.

### Responsive YouTube integration

On regular YouTube watch pages, the marker button automatically switches between full, compact, and micro presentations according to available action-row space, helping it remain accessible across browser zoom levels and window sizes. A separate marker button is used for true YouTube fullscreen mode.

### Languages

The interface follows the Firefox UI language and currently includes Traditional Chinese, Simplified Chinese, and English.

### Optional Google Drive synchronization

Version 1.2.1 can optionally synchronize timelines between Firefox installations through the user's own Google Drive `appDataFolder`. Sync is local-first, uses per-marker versions and deletion tombstones, and can be disabled at any time without deleting local markers. Google Drive is not contacted until the user explicitly opts in.

### Privacy

Without Google Drive sync, markers and notes stay in `browser.storage.local`. The extension uses no analytics, telemetry, advertising SDK, tracker, developer backend, or remote JavaScript library. If the user enables Google Drive sync, marker/media metadata and notes are sent only to that user's Google OAuth/Drive account for the requested synchronization; the developer does not receive the sync content.

### Permissions

- **Storage** — stores markers, notes, sync versions, and local sync settings.
- **Downloads** — creates TXT files only when the user explicitly exports them.
- **Identity** — handles the optional Google OAuth flow.
- **Alarms** — schedules low-frequency automatic sync after the user enables it.
- **YouTube / Twitch host access** — reads page metadata/playback position and inserts the marker UI.
- **Google API host access** — used only after the user enables Google Drive sync.

Firefox data-transmission consent for Google Drive sync is optional (`authenticationInfo`, `websiteActivity`, `websiteContent`).

### Current limitations

- YouTube Shorts-specific UI is intentionally unsupported.
- Twitch Live timing is calibrated from Twitch's live elapsed-time UI rather than the direct VOD-style `currentTime` model.
- Twitch OAuth / Helix automatic Live-to-VOD resolution is not included in version 1.0.0.

This is an independent extension and is not affiliated with or endorsed by YouTube, Google, or Twitch.

## Developer

貳緹 (erttyouo)

## Support Email

Eric208311@gmail.com

## Support Website

https://github.com/ErttyOuO

## License

Mozilla Public License 2.0 (MPL-2.0)
