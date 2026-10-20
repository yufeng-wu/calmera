# Calmera simulator polish — October 19, 2026

## Window and scope

Requested by user: add Matcha Latte/Mocha and autonomously polish UI/UX for a few hours with independent agents. Three-hour window began October 19 at 10:08 PM EDT; do not initiate new QA after October 20 at 1:08 AM EDT (2026-10-20 05:08:09 UTC). A thread heartbeat `calmera-simulator-polish` is scheduled every 30 minutes for six follow-ups, with a deadline check and final stop/report.

Work in `/Users/yw/Projects/calmera/mobile`, branch `codex/chatgpt-inference-mvp`. Simulator: Calmera ChatGPT Test, UDID `F3584334-39B2-46E4-9E17-3AE2D9945376`, bundle `com.yfwu02.mobile.chatgptdev`. Use only safe review routes and synthetic data. Never use physical iPhone or inspect personal data, camera/microphone, real inference, credentials/messages, or write meal/goal records. No deletions/account/backend changes/screenshot exports. Keep the original typography/layout, Tangerine accent, thin neutral card edges and Apple Regular/native shadows on all controls including Add.

Unrelated dirty OpenAI-logo files predate this task: Settings/ChatGPT/GlassForm/SettingsRow/native FormButton + assets. Preserve them; stage only our mixed-file hunks. Do not claim the entire working tree clean.

## Initial findings and implementation

- Added Matcha Latte (pale oat-milk/green) and Mocha (pale milk/cocoa), retaining existing four themes. New light gradient endpoints preserve caption readability; Theme status uses neutral text. Existing preference test now loops over all six themes.
- Form busy states previously allowed edits during estimates and could apply stale results. Shared form now disables fields/chips while busy. Manual now has synchronous mutual save/estimate guards; editors match them. Food Next focuses Amount, Amount Done dismisses; drag dismisses keyboards.
- Survey recommendations now carry canonical-input signatures. Changed details invalidate Save/result; display-unit switches preserve results. New targeted regression tests cover each input and units.
- Back dispatch is locked per focus to prevent double pops and resets when a page regains focus.
- Native Add now tracks bottomInset/optionWidth changes, observes live Reduce Motion, and preserves/resumes recording width during geometry refreshes. Normal springs/material identities remain. Test-only diagnostic fields and `/motion-check` exercise synthetic state transitions with no audio/inference.
- Settings selected-theme values and calendar entry/goal states are accessible. Partial profile failures retain loaded meals and get a retry path.
- Short background bloom springs stop when app becomes inactive; the existing continuous background loop already did.

## Evidence and queue

Implementation/source review is not simulator verification. Fill this section with actual evidence before marking cases passed.

- [x] Initial integrated tests/lint/Release build:79 tests passed; scoped lint/diff check clean; `/tmp/calmera-polish-build.log` successful. Shared header build subsequently passed; final visual revision in progress.
- [x] Matcha and Mocha selected/saved in actual picker; Mocha restored after app restart; Settings AX value reports Mocha. Six thumbnails and pale backgrounds inspected live. No real preference key touched.
- [x] `/motion-check`: collapsed inset98→162 moved trigger top618→554. Synthetic recording+layout change→Processing→Add passed;26 voice-return samples,0 bad frames,0.00pt anchor drift, no missing/clipped material; trigger material assignment stayed1. Existing 20-cycle stress not repeated after latest header update.
- [x] Manual Food Next→Amount focus verified by synthetic text entering Amount after Return; batching keystrokes too quickly first raced focus, separate action/state boundaries confirmed correct behavior. Remaining macro/error/busy visual states queued. Shared header requires keyboard recheck.
- [x] Survey seeded preview: kg→lbs retained recommendation; changing Sex Female→Male removed Recommended macros/Use these goals and exposed recalculation message. Saving a11y lock source-reviewed; no real goals saved.
- [ ] History populated/empty dates and accessible statuses, cached navigation, partial profile retry through pure synthetic state tests.
- [ ] Photo empty/selected, Edit meal/session, Voice language, authentication previews, large text/error states.
- [ ] Independent cross-review findings resolved and only scoped changes committed/pushed.

Root is sole simulator controller. Source agents: glass_independent_review (motion/Back), component_surface_audit (forms), boundary_accessibility_review (History/Settings/survey accessibility). They did not access GUI/data. Preserve honest limits: source-only and actual simulator observations must be distinguished. Do not repeat passed checks unless a new change/failure justifies it. Future runs should pick untested cases and small concrete fixes, not broad redesigns/new features.

## Latest user steering — abrupt header cutoff

User screenshot10:25PM shows Survey card cut flat under fixed header. Actual cause: clipped sibling ScrollView starts below custom header; scrollToEnd also lands mid-result. A shared FormScreen/FormScrollView now preserves resting spacing while letting content extend behind measured header on iOS26. Native HeaderScrollEdge binds explicit RN scroll tag to UIScrollView.topEdgeEffect.soft + UIScrollEdgeElementContainerInteraction on real header. Motion fixture runtime verified bound1/overlap64pt. No glass ancestor masks.

Survey now reveals recommendation START via measured cardY minus header height/gap, not timed scrollToEnd; pending reveal is consumed once, with stale-Y guard and Reduce Motion respected. First runtime showed the heading correctly but an orange Get recommendation button could still show through behind the title. This is NOT accepted/final: native agent is adding an isolated fading native blur backdrop inside HeaderScrollEdge (direct mask only on its own decorative effect view). Rebuild and inspect before calling cutoff fixed.

Pages adopted: Survey,Theme,Manual,both editors,EditGoals,Photo,ChatGPT,VoiceLanguage,Scale,Live fallback, plus motion fixture. Settings/Auth custom headers not yet migrated; assess separately after verifying shared host.

Independent cross-review found no remaining source blockers in shared refs/layout/preview routing after stale-Y guard. Header build compiled. Confirmed installed Expo53 uses RCTBridgeProxy path for Fabric lookup; runtime binding succeeded, so no resolver workaround needed.

## Header revision verified

The final `/tmp/calmera-header-backdrop-build.log` Release build passed. Motion fixture reported native header edge bound1 with64pt overlap. In the exact Survey recommendation preview, the complete Recommended macros heading/card begins below the header, and the title remains legible through the separate fading native-material backdrop. The earlier overlap failure is superseded. A direct gradient mask is applied only to the decorative backdrop, never to any ancestor of glass controls.

Manual was rechecked after the shared scroll-host migration: Food Next focused Amount, synthetic QA suffix entered Amount, Done dismissed, and Save before entering macros showed the correct Need Macros explanation. No network write was reached. Form controls/spacing remained intact.

Remaining follow-up cases: large text on shared headers and both new palettes; Photo empty/selected, edit/session flows, error/pending states; live Reduce Motion setting changes (not yet toggled); cached tab switching/partial retry UI fixture; exact native 20-cycle stress after shared-header changes. Prior Node tests cover partial profile errors/targeted retry; real backend requests were not tested. Settings/Auth custom header adoption remains an assessment item. The top safe-area seam was subsequently reported and fixed as described below.

## Final safe-area seam fix verified

User10:42PM screenshot exposed a real color boundary between status safe area and Manual header, especially under an alert dimmer. The final `/tmp/calmera-continuous-header-build.log` build passed. Root/auth navigator frames now stay full-screen on iOS26; ordinary scenes spend safeTop via native scene content padding, adopted FormScreen pages own it internally, and gallery previews spend it locally only for non-adopted pages. The scroll viewport extends through safeTop+header while resting content positions remain. HeaderScrollEdge backdrop extends upward through safeTop, yielding one continuous material. Scene-local inset ownership avoids moving inactive tabs during form navigation.

Live checks on final build: Manual status/header has no visible seam at rest OR beneath Need Macros alert dimming; alert was dismissed. Safe Settings preview kept original inset, Theme row opened the new full-bleed Theme page, Back returned correctly, and saved Mocha remained selected. Independent source review found no double-inset/root-frame blocker. Final pure suite82/82 passed (`/tmp/calmera-safe-header-tests.log`); scoped lint and diff checks clean. This is not a per-frame transition benchmark or physical-iPhone test.

The first polish batch is ready to commit. Remaining QA should continue queued Photo/Edit/large-text/reduced-motion/pending/error cases. Do not redo fixed seam/layout work unless a new failure is observed. Keep all six themes, native Regular shadows, approved type/layout, and source-vs-simulator evidence distinctions.
