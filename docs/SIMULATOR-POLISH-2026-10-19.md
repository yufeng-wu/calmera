# Calmera simulator polish — October 19, 2026

## Window and scope

Requested by user: add Matcha Latte/Mocha and autonomously polish UI/UX with independent agents. The original three-hour window began October 19 at 10:08 PM EDT. The user later extended work to eight hours starting October 19 at 11:27:57 PM EDT: do not initiate new QA after October 20 at 7:27:57 AM EDT (2026-10-20 11:27:57 UTC). The platform is expected to remain open for the first three hours, approximately until 2:27:57 AM EDT. The existing thread heartbeat `calmera-simulator-polish` now runs every 30 minutes for sixteen follow-ups with the new deadline and final stop/report. Live simulator checks require the desktop/Mac to remain available; unavailable interaction is a limitation, not a passed check. Continue useful source/test work if possible. After UI work, polish concise instructions and natural form spacing while preserving approved typography. This extension supersedes the original 1:08 AM deadline below.

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

The first polish batch was committed and pushed as75e651e. Remaining QA should continue queued Photo/Edit/large-text/reduced-motion/pending/error cases. Do not redo fixed seam/layout work unless a new failure is observed. Keep all six themes, native Regular shadows, approved type/layout, and source-vs-simulator evidence distinctions.

## Heartbeat pass2 — Photo, async recovery and accessibility

Implemented small source-confirmed follow-ups, preserving visual styling/header materials:

- Photo now holds one synchronous operation ticket across selecting/logging, with distinct preparing-photo state, disabled conflicting actions/edge gesture, focus/owner cancellation, and guards against stale saves/alerts/navigation. Confirmed saves stay locked through navigation. Safe preview Reset releases the ticket. Known rejection/pre-dispatch failures remain retryable; partial/potential writes retain Check History protection.
- Manual/Edit writes use a20s deadline covering token acquisition, fetch AND response parsing. No automatic retry. Cancelled late tokens cannot dispatch a later POST; uncertain writes are not reported successful. Drafts remain on errors and History recovery is explicit. Inference and completion state are focus-scoped; Edit and session estimate scopes include item identity. Successful saves retain locks until navigation/focus cleanup.
- Goals Back now uses the shared one-exit-per-focus hook. Native sliders explicitly expose Not set until real value-change interaction; numeric zero origin and integer save semantics remain.
- Added pure synthetic request/focus-scope regression tests and test-only ui-goals-unset fixture. No new backend/account changes.

Validation:90/90 Node tests passed (`/tmp/calmera-pass2-tests.log`); final scoped lint and diff check clean. Independent agents cross-reviewed write timeout/cancellation/uncertainty and Photo locks; recommended entryId ownership and dispatch-exception unlocking were applied. Final Release simulator build succeeded (`/tmp/calmera-pass2-final-build.log`).

Simulator AX-only checks (no screenshot captures): Photo-selected preview processing→Reset repeated twice; processing/Back disabled while busy and re-enabled after reset; Back returned to safe review list. Photo-empty cannot process and camera/library access remain disabled. Large accessibility text preserved all Edit controls; Save showed Preview only/No meal updated. Unset goal sliders exposed native Details:Not set; changing text size kept synthetic profile-load count at1. Direct AX setValue altered raw slider value but did not emit a user UIControl event, so it was NOT treated as proof of real gesture semantics; text-size remount reset the synthetic state, and no goal save occurred. Original Large text size restored. Session editor Save validated only the synthetic item and confirmed no session update.

Limits: real camera/photo picker/inference/network writes, actual VoiceOver audio/slider gesture, live Reduce Motion toggle, pixel-level large-text layout and gesture animation were not exercised in this heartbeat. Source/pure tests cover those relevant guards, not a physical-device claim. No personal data, credentials, files/apps, or physical iPhone were accessed/changed. Keep remaining QA on safe fixtures; no need to repeat passed cases without new changes.


## Extended overnight pass — spacing and instructions

The user extended this work to eight hours from 11:27:57 PM EDT. The shared rhythm for this pass is 4 pt for a label/helper relationship, 8 pt for nearby controls, 12 pt within a local card, 16 pt between related sections, and the existing 20 pt page sides. These are app conventions, not an Apple-mandated numerical scale. Preserve approved type tokens, card radii, 44+ pt controls and bottom safe-area padding; remove duplicated spacing rather than globally compressing every page.

Local changes under verification:
- Shared food forms now own a single 12 pt card gap. Removed title/divider/helper margin stacking; grouped Nutrition heading/caption with 4 pt separation. Food/Amount structural divider whitespace is 24 pt rather than 56 pt. Editors remove their second top inset only in the loaded form; loading/error retain the original 12 pt.
- Survey fields stop stacking their own vertical padding with card gaps. Result rows share one wrapper, removing roughly 58 pt of redundant gap/padding at normal layout while keeping intrinsic text wrapping and the measured reveal wrapper.
- Photo empty placeholder uses a 216 pt minimum instead of 280 pt, so large text still grows the card. Section gaps are 16 pt; the selected-photo aspect ratio is unchanged.
- Clearer Manual validation follows Food/Amount/Nutrition labels. Voice help consistently describes hold, timer, description and release. Stale Quick Add text now says Manual. Photo selection/processing/uncertain-save messages are shorter; uncertainty protection is unchanged.
- Reproduced a real live Dynamic Type defect: Photo retained large intro text after returning to Large, and Manual labels clipped after increasing to accessibility-large. Reopening the route corrected it. Both pages now remount only their scroll/content subtree on fontScale change, matching existing Theme/Survey/editor behavior. Parent drafts/photo/operation state remain mounted. Final installed-build retest pending.
- Independent review found Today Voice's shared error handler falsely called every meal-save failure uncertain. A pure classifier now distinguishes explicit known non-writes from partial/uncertain/legacy-unknown outcomes; positive write evidence always wins, no retry is automated. Nine synthetic regression cases exercise real persistence failures; auth/usage branches are unchanged.
- Native source follow-ups align Photo/Manual disabled accessibility state with the recording touch lock, and make the Reduce Transparency meal-action fill distinct from the white card. Normal Regular glass, default shadows, geometry and all animation constants remain.

Evidence so far: 99/99 pure tests passed; scoped lint clean. Initial spacing Release build succeeded (`/tmp/calmera-spacing-build.log`). Live, in-memory simulator views confirmed the compact editor and recommendation result remain legible at normal text size. Manual Save without nutrition shows the new Add nutrition explanation and a continuous dimmed header. Photo's empty/selected layouts remain legible at normal size. Accessibility-large Photo text wraps/grows, but automated scroll/drag did not move the viewport: this remains a gesture-verification limitation, not proof of scroll failure or success. Large text size was restored. No screenshot files exported/saved.

History's untouched synthetic preview passed populated/empty date states, disabled future dates, signup-month boundary and selected-day restoration after month navigation. No actual meal records or backend reads were used.

Next queue: finish installed-build Dynamic Type retest and auth layout/empty validation; inspect native mock-recording disabled traits/motion. Later targeted work: source-confirmed expanded meal detail height jumps on remeasurement (reproduce before changing); bounded post-verification account setup (no real account requests); concise Survey method copy without changing nutritional claims; remaining Guide/Welcome/Scale/connection copy; large text and reduced-motion cases still unverified. Existing profile partial-error/cache tests remain source/pure evidence; avoid real account History loads.


Auth follow-up: shared account forms now use 12 pt top/16 pt section/8 pt hero gaps without changing fonts or 52 pt inputs. Email Next focuses Password through a forwarded TextInput ref. Local errors mark only the relevant field; explicit provider identifier/password errors match that field and generic network errors stay neutral. Reset's generic verification failure no longer falsely asserts an invalid code. All local-only preview return guards and final autofill exclusions were independently source-reviewed; no real authentication request was exercised. Minor queued improvement: correcting a field clears its red outline but the prior banner remains until submission.

Copy review queue (source-only, not accepted changes): concise connection/model/language retry messages; avoid duplicate Checking connection status; Scale display describes decimal formatting better than calibration; Survey method paragraphs can be shortened while preserving the actual formula/adjustment and uncertainty. Keep Theme's playful mood framing unless there is a concrete comprehension issue—the user explicitly wants a lively app. Guide/Welcome are legacy: guide PNGs teach live scale recognition, and Welcome currently routes to a Live Coming Soon fallback. Do not make these promise working live mode; inspect reachability and label/gate legacy content separately.


### Extended pass installed-build verification

Final Release build succeeded (`/tmp/calmera-overnight-build.log`); installed over the dedicated simulator test app with data preserved. Final pure suite99/99 (`/tmp/calmera-overnight-final-tests.log`), scoped lint and diff whitespace checks pass. Independent source reviews accepted form spacing, auth refs/validation, save-outcome priority and Dynamic Type state/header ownership.

Live simulator checks on this final build:
- Manual: typed fictional Synthetic banana QA through actual keyboard events, changed Large→accessibility-large→Large while keeping the page open. Meal labels/chips grew without the previous clipping; all restored to the original typography and the draft/amount persisted. No estimate/save request used.
- Photo selected: bundled test oat-bar image stayed selected across accessibility-large→Large; title/helper/privacy text all restored consistently without reopening. The earlier stale-text failure is fixed. No camera/Photos picker was opened.
- Sign-in local preview: normal spacing inspected unfocused; empty Sign in shows Enter a valid email address and only Email's outline turns red, Password remains neutral. No passwords/autofill suggestions/authentication requests touched. Email Next and other provider-error paths have independent source evidence, not real-login runtime evidence.
- Native `/motion-check`: during synthetic recording, Photo and Manual were reported disabled in the live AX tree. Final result Passed;25 return samples,0 bad,0.00 pt anchor drift,0 missing/clipped materials,1 trigger material assignment, header bound1/overlap64pt. No microphone/inference used. Reduce Transparency fill is source/build verified only; that system toggle was not exercised.

All text-size overrides restored to Large. Automated scroll/drag limitations remain; do not call large-text scrolling, actual horizontal gestures, VoiceOver audio or every per-frame transition fully tested. No physical iPhone/personal records/account/backend changes or saved screenshots. The session continues through the extended deadline with the documented untested queue; this is a verified batch, not a claim the entire app is complete.
