# Voice feedback and cached navigation

## October 19: anchored Voice release spring

The native menu no longer copies a glass layer's entire presentation frame into its UIView frame when interrupting recording growth. It captures only the current width, clamps it to the menu, clears the old growth animation/transform and reconstructs placement from the Voice slot's own right/top anchor. Release uses a 0.38 s damped spring (damping 0.80), starting from that anchored model frame without asking beginFromCurrentState to reuse an unrelated presentation coordinate space. Recording/Processing changes also retain the existing glass effect instance instead of rematerializing it. Processing text and its activity indicator remain; inference, recording and persistence logic are unchanged.

The synthetic native-tabs-check route reuses the production menu but replaces voice callbacks with local state. Its optional motion diagnostics sample presentation layers converted into the menu's coordinate space; raw CALayer presentation.frame is not a comparable UIView-superview coordinate. Diagnostics are disabled in production use and contain only geometry.

Validation: scoped ESLint and the 60 existing mobile Node tests passed; Release simulator build passed and was installed. A 10 s synthetic held press produced start/end, shrank from about 215.7 pt to the readable 150 pt Processing capsule and retained the spinner. 25 return samples stayed localized, with a maximum 5.86 pt presentation-anchor displacement including native interactive settling. An approximately 650 ms held press interrupted initial growth, returned from about 160.1 pt, and showed 7.18 pt maximum local displacement over 25 samples. These measurements are not claims of zero visual movement; small local elastic settling remains intentional. Neither case showed the screen-corner flight, and Processing completion restored addTitleVisible=1.

No microphone, speech/transcript, inference, account data, database record or physical iPhone was used in these animation checks; screenshots were inspected live without export.

## Earlier verified pipeline result

Revision 3 was verified through an actual user-controlled microphone recording in the Mac simulator, using the requested fictional-food phrase. The user confirmed that Processing appeared. The metadata-only trace showed: recording at 136 ms; release/Processing at 5392 ms; expo-av status duration 0 ms; actual finalized media duration 5293 ms; transcription at 5424 ms; estimation at 11139 ms; saving at 19408 ms; completion at 19795 ms; idle at 19866 ms. The real save adapter resolved successfully. No transcript, model output, meal records or credentials were inspected for this verification.

This confirms the original early exit: the installed expo-av recorder reported zero duration for a valid 5.3-second file. Validating actual media duration allows the normal local transcription → ChatGPT inference → existing database-save pipeline to complete. Processing remained the application state throughout the roughly 14.4-second asynchronous pipeline. The native metadata-fixture check and all 45 regression tests also passed. Physical iPhone operations were not performed.

## Changes

- Add keeps its title mounted with an explicit width constraint. It no longer animates UIStackView `isHidden`, which could leave a collapsed title after interrupted recording/menu animations. Idle settlement restores title width/alpha.
- Release immediately enters Processing before awaiting audio finalization. UIKit cancels growth at its presentation frame, shrinks to a readable processing width and shows a native activity indicator. Success closes the menu and restores `+ Add`; recording cleanup also runs on failures/short clips. No false completion percentage is shown.
- Today and History share one memory-only store scoped to the authenticated Clerk user. Sign-out/account changes dispose it; no new meal cache files are written.
- Daily freshness: two minutes. History/profile freshness: five minutes. Own saves/deletes/goal changes invalidate immediately. Concurrent requests are joined; late responses cannot overwrite newer data/mutations. Failed automatic refreshes back off 15 seconds; manual refresh bypasses that delay.
- History prefetches after Today is ready. Both screens retain cached content while updating. Initial Today shows a content skeleton with usable controls; initial History keeps its calendar visible with inline progress. Both support pull-to-refresh and retain content on network failure.
- Native tab selection always dispatches the latest tap rather than comparing against stale React props. The UIKit child controller remains attached across temporary window detachment and is removed when its React view is actually unmounted.

## Verification

- 37 synthetic JavaScript tests passed: 27 existing protocol/persistence/ASR/icon checks plus 10 cache tests covering deduplication, valid empty history, stale responses, confirmed-add deduplication, background failure/retry, overlapping deletion rollback, account disposal, Strict Mode lifetime and failure backoff.
- Full Release iOS simulator build passed. Scoped lint: no errors; History retains its existing unused-helper warning.
- Mock-only UI hold of seven seconds: start/end events observed; release showed a native spinner and `Processing…` in a 150 pt bubble; completion showed full `+ Add` and `addTitleVisible=1`. No microphone or inference was used for this state test.
- Actual authenticated app tested using the real native bottom-tab controls, observing only a counters-only diagnostic page. Eight initial taps: dayRequests=1, historyRequests=1, profileRequests=1, deduplicated=10, pendingRequests=0, profileReady=1, historyReady=1, errorCount=0.
- Eight more warm-cache native taps: request counts remained 1/1/1; cacheHits rose to 20; pendingRequests=0 and errorCount=0. No meal/profile contents were inspected.
- An overly aggressive test-only top-level route timer exposed a transition stall. That driver was removed; the final verification used actual native tabs after correcting controller containment. No such driver is present in the app.
- No physical iPhone operations, production deployment, database writes/deletions or account configuration changes were performed. Existing records and credentials are retained.

First uncached reads still depend on network/server response time. Cache navigation does not make that first request instantaneous. The full real microphone-to-inference/save path was not rerun in this UI/cache revision; its existing recording/inference functions and synthetic regression tests remain in place.

## References

- https://developer.apple.com/design/human-interface-guidelines/loading
- https://developer.apple.com/design/human-interface-guidelines/progress-indicators
- https://react.dev/reference/react/useSyncExternalStore

## Follow-up: real release feedback (revision 2)

The user reported an immediate return to Voice/Add on real recording release. The previous 7-second UI check used only a mock recording state and did not establish that the real recorder followed the same path. The installed executable and JS bundle matched the previous build; its process started after that build.

- Release now switches to Processing even while native recorder initialization is pending. Starting is guarded against duplicate holds, and the UI timer starts only after the recorder starts. Releasing before startup completes cancels that start with an explicit explanation.
- A clip under one second now reports “Nothing recorded yet” instead of silently returning. Duration is read before unloading because the current expo-av iOS implementation resets its duration clock on stop. No elapsed wall-clock duration is substituted for missing audio.
- The real release path uses `processRecordedMeal`, which keeps the same local transcription, ChatGPT estimation, and authenticated meal-save adapters. Six additional tests cover pending phases, short clips, duration ordering, account cancellation, cleanup and diagnostic privacy. All 43 regression tests pass; scoped lint passes.
- The full-test build has a hidden `/voice-feedback-check` route showing only the last attempt's allowlisted state names, elapsed milliseconds and native clip duration. It is bounded to 20 events, lives only in memory, and receives no transcript/audio/meal/account/credential data. It opens no microphone and reads no meal history.
- The exact cause of the user's earlier real recording exit remains unconfirmed until a deliberate recording is repeated with this diagnostic present. No ambient microphone capture or physical iPhone testing was performed for this follow-up.

Revision 2 Release simulator build passed and was installed after terminating only the test app process. The live simulator displayed `Voice feedback check · revision 2` and `No recording attempted in this app session.` before returning to actual Today without inspecting its meals. The user has been asked to deliberately record one fictional phrase; that result is pending.

## Revision 3: observed zero native recording duration

The user deliberately repeated the fictional-food recording. Metadata-only trace: recording began at 42 ms, release at 3891 ms, and the live recorder's pre-unload duration was 0 ms at 3901 ms. It reached `too_short` at 3912 ms and never reached transcription/inference/save. This establishes why Processing disappeared immediately; it does not establish whether the audio file itself was empty.

The real release pipeline now inspects the finalized recording's media duration using AVURLAsset. The native method restricts access to one explicit URI inside this app's AV cache; it never enumerates files or returns audio/transcripts. Actual file duration takes precedence over the recorder's status counter. Zero/invalid/short file duration is rejected; wall-clock holding time is never used to fabricate valid audio. Two additional regression tests cover zero-status recovery from a valid file and rejection of a truly empty file. All 45 tests and scoped lint pass. Release simulator revision 3 built and installed successfully. Live metadata-fixture and subsequent deliberate-recording checks remain pending.

Revision 3 live simulator metadata-fixture check passed: the explicit generated app-owned AIFF was read as 3111 ms and 141292 bytes. No microphone, ASR, inference, database write, or personal recording was used for this check. The actual Today page was then opened for the user to repeat the deliberate fictional-food recording.
