# Firefox AMO Release Checklist — v1.2.3

## 已完成於本 Release Kit

- [x] Version: `1.2.3`
- [x] Extension ID: `video-timeline-marker@erttyouo`
- [x] Firefox minimum version: `140.0`
- [x] `data_collection_permissions.required = ["none"]` + optional Google Drive sync categories declared
- [x] Author identity prepared: 貳緹 (erttyouo)
- [x] Support Email prepared: Eric208311@gmail.com
- [x] Support website prepared: https://github.com/ErttyOuO
- [x] MPL-2.0 license file included
- [x] Traditional Chinese listing prepared
- [x] English listing prepared
- [x] Privacy policy prepared
- [x] Reviewer notes prepared
- [x] Release notes prepared
- [x] Store screenshot plan prepared
- [x] Runtime package excludes development docs and large unused source artwork
- [x] No remote code or developer backend; Google OAuth/Drive network calls are isolated to optional sync source
- [x] UTF-8 / JSON / JavaScript / ZIP integrity checks prepared

## 你在 AMO 網站需要完成

- [ ] 登入 Firefox Add-ons Developer Hub。
- [ ] 建立新擴充功能並選擇「On this site / AMO」發佈。
- [ ] 上傳 `video-timeline-marker-firefox-v1.2.3-amo-upload.xpi`。
- [ ] 讓 AMO Validator 跑完；若出現 warning，先確認再繼續。
- [ ] Name：使用 AMO_LISTING_ZH-TW / EN 中的正式名稱。
- [ ] Preferred slug：`video-timeline-marker-youtube-twitch`（若已被使用，AMO 會要求改名）。
- [ ] Summary：貼對應語言的 Summary。
- [ ] Description：貼對應語言的 Description。
- [ ] Categories：優先選 Photos, Music & Videos；第二分類可選 Bookmarks。
- [ ] Support Email：Eric208311@gmail.com
- [ ] Support Website：https://github.com/ErttyOuO
- [ ] License：Mozilla Public License 2.0
- [ ] Privacy Policy：貼 `PRIVACY_POLICY.md` 內容或之後公開的政策頁 URL。
- [ ] Reviewer Notes：貼 `REVIEWER_NOTES.md`。
- [ ] Release Notes：貼 `RELEASE_NOTES.md`。
- [ ] 上傳 4～5 張商店截圖。
- [ ] 若建立公開 GitHub repo，建議名稱：`video-timeline-marker`，並放入 v1.2.3 source + LICENSE + PRIVACY_POLICY。
- [ ] 正式送審前用乾淨 Firefox profile 再測一次 YouTube / Twitch / Popup / TXT 匯出。

## 建議公開 GitHub Repo（尚未假設已存在）

建議建立：`https://github.com/ErttyOuO/video-timeline-marker`

建立完成後，再把 AMO Homepage / Source Code URL 指向該 repo；目前 manifest 的 homepage 只指向你的 GitHub profile，避免引用尚未存在的網址。


## v1.1.0 feature checks

- [ ] Import one TXT exported by v1.0.0/v1.1.0 and verify timestamps/notes restore.
- [ ] Import multiple TXT files in one picker operation.
- [ ] Re-import same TXT and verify no duplicate markers are added.
- [ ] Delete one whole media group with confirmation.
- [ ] Select multiple groups and delete selected with confirmation.
- [ ] Verify Add-on ID remains `video-timeline-marker@erttyouo`.
- [ ] Verify `vtm_markers_v1` remains unchanged.


## v1.1.7 feature checks

- [ ] Import a current-format TXT and verify the persistent result card appears.
- [ ] Re-import the same TXT and verify `added 0 / duplicates N` is shown instead of silent no-op.
- [ ] Import a legacy v0.1.x–v0.2.1 TXT with `[暫定 ...]` / `[Estimated ...]`; legacy metadata must not be merged into notes.
- [ ] Import an invalid TXT and verify a per-file failure reason is visible after reopening the popup.
- [ ] YouTube Open: first click with no matching media tab opens a tab; a second marker from the same video reuses that tab and updates the `t=` URL.
- [ ] Twitch VOD Open reuses the same `/videos/{id}` tab.
- [ ] Twitch live Open reuses the same channel tab.
- [ ] Verify manifest still has no broad `tabs` permission; Google hosts are present only for optional Drive sync.
- [ ] Verify Add-on ID remains `video-timeline-marker@erttyouo` and marker storage key remains `vtm_markers_v1`.


## v1.2.3 Google Drive sync checks

- [ ] Create/enable a Google Drive API project and OAuth Desktop client.
- [ ] Connect from the popup and verify Firefox optional data-transmission consent appears before Google OAuth.
- [ ] Verify only `drive.appdata` is requested from Google.
- [ ] Verify first sync creates `video-timeline-marker-sync.json` in `appDataFolder`.
- [ ] Verify independent markers from two Firefox profiles merge both ways.
- [ ] Delete a marker on profile A, sync both profiles, and verify the marker does not reappear.
- [ ] Disconnect and verify local `vtm_markers_v1` remains intact.
- [ ] Revoke optional data_collection permission in about:addons and verify automatic sync stops.
- [ ] Verify invalid cloud JSON does not overwrite local markers.
- [ ] Verify Add-on ID and `vtm_markers_v1` are unchanged.

- [x] Production OAuth Desktop Client ID is embedded; popup has no Client ID input.
- [x] No API key / service-account key / user token is bundled.
- [x] Refresh token from a different development Client ID is not reused.
