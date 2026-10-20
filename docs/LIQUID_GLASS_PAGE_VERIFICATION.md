# Calmera UI verification

## Current checkpoint — October 20, 2026

This checkpoint supersedes the initial palette, test/review-state counts and Git notes in the dated October 19 record below. Detailed reproductions, individual build/test logs and limitations are in [the overnight polish log](SIMULATOR-POLISH-2026-10-19.md). A passed synthetic preview verifies the actual shared screen component and its isolated handlers; it does not verify the corresponding live service.

The approved design now uses Tangerine `#BC5A19`, Apple Regular Liquid Glass with native shadows for controls including Add, and six saved backgrounds: Soft Tangerine (50%), Dawn, Glow, Aura, Matcha Latte and Mocha. Content cards retain the lighter surface treatment. The user-tuned standard typography and layout on Today, History and Settings are preserved; targeted accessibility fallbacks let content grow without capping text size.

The test-only gallery contains 38 states, supplemented by the explicit synthetic Goals and native motion/tab routes. Coverage accumulated across the overnight passes; the entries below do not imply every case was rerun at this checkpoint.

| Screen / shared flow | Verified evidence | Limits |
|---|---|---|
| Today / Add / Voice feedback | Shared native controls, isolated recording-return geometry/material checks, Increase Contrast adaptation, independent source review | No real microphone, transcription, inference or Voice meal writes; geometry checks are not an FPS benchmark |
| History / meal cards | Synthetic month/day selection, cached loading/error/retry states, measured detail-height animation, maximum-text row/metadata layout, accessible Edit/Delete reveal | Current automated drag/scroll tooling is unreliable; no new physical-gesture claim or real deletion |
| Settings | Grouped rows, separate Voice language and Theme entries, maximum-text top-row wrapping | No sign-out or account actions; not every offscreen row/landscape case checked |
| Manual / Photo | Actual shared forms, isolated empty/selected/processing/error states, text-size remeasurement and draft preservation; Manual input Small → maximum → Large and local numeric feedback; source/deferred write guards | Camera/library/inference and real saves blocked in preview |
| Edit Goals | Compact integer-only sliders, no keyboard on value tap, bounded loading/retry/save fixtures, stale alert-navigation guards, maximum-text wrapping | No real goal writes; actual slider drag not established by AX setValue |
| Goal Survey | Canonical unit/default regressions, optional picker Clear/Done, recommendation/save validation, bounded token/response/rejection fixtures; picker geometry at standard and accessibility sizes; contained Work/Exercise choice layouts, and conditional equation-assumption disclosure before calculation/save | Existing nutrition methodology unchanged and not validated; the unspecified-sex assumption is now disclosed, not redesigned; backend write atomicity unchanged |
| Meal editor | Fake credential/JSON timeout and explicit retry, local-only Save validation including overflow/correction, consistent Food/Amount notices; deferred owner/task guards in shared persistence | No record access, actual updates or account switching |
| ChatGPT connection | Fake connection/catalog recovery and model selection; source/deferred outcome and mutex tests | No authorization, provider, Keychain or live model calls; separate local logo work excluded from polish commits |
| Voice language | Fake load failure/read retry, commit-then-reject reconciliation, later selection; deferred cross-mount write ordering | No real preference writes or Voice invocation; native storage promises remain uncancellable |
| Theme | Six choices and test-only preference isolation, maximum-text first-tile wrapping and safe Back; source review of ordering/ready guards | No reproduced ordering bug; an unbounded native storage stall remains unverified |
| Sign In / Sign Up / Password Reset | Local validation/stages, Email Next to Password, reset-completed/activation-failed recovery fixture, signup setup outcome tests; sign-in Small → maximum → Large retained a fictional draft and corrected native placeholder/caret sizing; registration/reset native header edges and Back with the software keyboard | No credentials, email, reset, activation or account creation; SDK operations are not globally bounded/cancellable |
| Session editor / tutorial / welcome / scale / Live fallback | Earlier actual-component synthetic rendering, local navigation/validation and contained guide paging | These remain legacy-adjacent/dormant from current Settings/Add; raw legacy scale/welcome requests were not expanded or exercised |

Latest complete JavaScript suite: **237 passed, 0 failed**, recorded in `/tmp/calmera-survey-layout-tests.log`. This includes eight exact-conversion nutrition-validation regressions, five safe-area routing checks and seven Survey consistency tests. The shared input/validation, auth-edge and Survey batches also passed scoped ESLint, whitespace checks, installed Release builds and targeted synthetic size/error/keyboard/correction checks. Prior geometry-only passes used scoped validation rather than repeating the complete suite. There is no new dependency, framework upgrade, backend/schema change or deployment in this overnight polish work.

Sign-in’s branding-only wordmark now scrolls with the fields, preserving normal resting positions. iOS auth and shared food input font geometry follows the live system scale exactly once, fixing the reproduced stale-placeholder issues; Android behavior was preserved by source review only. Back-header auth pages on iOS26 now use the same native scroll-edge treatment as other adopted forms, with per-screen safe-area ownership. Registration and reset-code keyboard-visible checks passed at maximum text and normal resting positions were preserved; production auth-stack transitions remain source/inset-test evidence only.

Live views remain in memory; no screenshots were saved/exported. The dedicated simulator is `F3584334-39B2-46E4-9E17-3AE2D9945376`, bundle `com.yfwu02.mobile.chatgptdev`. Original Large text and disabled Increase Contrast are restored after each accessibility pass. Physical iPhone behavior, personal records, real service integration, VoiceOver audio, live Reduce Motion/Transparency, smaller devices/tablets and comprehensive landscape/frame pacing remain unverified.

Polish commits are tracked on `codex/chatgpt-inference-mvp` in the existing `cal_mobile` repository. Intentionally separate OpenAI-logo source/assets remain dirty and excluded; a dirty working tree therefore does not mean the committed polish is unsynced. Remote synchronization must be checked explicitly; the historical log does not contain a remote-status snapshot for every commit.

## Historical initial refresh — October 19, 2026

The following dated evidence is retained as history. Its 60-test/21-state counts, earlier colors, connection-page language section and pre-baseline Git status describe that initial pass, not the current app.

## Result

All 14 routes identified in LIQUID_GLASS_PAGE_AUDIT.md now use the established warm grouped-content/native-glass style. Three implementation agents owned auth, settings/guides, and survey/editors; integration handled shared controls, History, legacy fallbacks, navigation and safe QA. The earlier approved Today, Manual, Photo and compact integer-only Edit Goals design remains in place. Live is not reintroduced into Add or Settings. Redirect-only pricing pages remain redirects.

## Automated validation

- 60 JavaScript tests passed, zero failed: /tmp/calmera-page-audit-tests.log. This includes existing ChatGPT protocol/persistence/voice, nutrition-store cache, food icons, Goals request/integer tests and four new survey unit/default regression checks.
- Scoped ESLint passed for all updated page and shared-component files with no errors/warnings. Git diff --check passed.
- Full Release iOS 26 simulator build succeeded. Final log: /tmp/calmera-full-ui-accessible-final-build.log. Installed only com.yfwu02.mobile.chatgptdev in the dedicated Mac simulator.
- No new package dependency, Expo/RN upgrade, backend schema change or backend deployment.

## Actual-component UI review

The gated /ui-gallery?page=... route mounts the same default screen components used by production. calmeraPreview is supplied by this test-only parent; URL parameters cannot turn production screens into a preview. Profile/token/storage/inference/auth/session writes are bypassed in these preview handlers. Review navigation uses a non-reserved page query key and always returns to the gallery, never into an account-backed screen underneath it.

All 21 review states rendered:

| States | Checks observed |
|---|---|
| Sign In | New layout reviewed visually; empty email validation; complete invented credentials produced local-only success |
| Sign Up + verification | Email/password form advanced to code entry; invented code produced local-only completion, no account/email request |
| Password reset request, code, new password | Traversed all three stages using invented input; completion explicitly reported no password/session change |
| Settings | Grouped sections rendered; connection row produced a preview-only result; no signout performed |
| ChatGPT connected/disconnected | Connection/status/model/language sections reviewed; synthetic fast-model selection survived reconnect; Chinese language selected locally; disconnected preview connected locally |
| Survey form/recommendation | Incomplete input blocked; shared weight sheet opened; Done without turning the wheel committed 70.0 kg; synthetic recommendation remained identical after switching to lbs; Save produced no goal write |
| Edit Meal + Edit Item | Stable glass header and shared form rendered; Save validated locally without record/session updates; editor horizontal padding corrected to match Manual |
| History | Full-date labels and selected/disabled states; selecting an empty day and returning restored meals; previous/next month restored the remembered October day; no history API calls in preview |
| Tutorial | All four original images rendered within the contained gallery; Next advanced 1/4→4/4; Done returned safely |
| Welcome | Advanced through 1/5→5/5, selected integer scale, Start stayed local with camera closed |
| Calibration | Selected one-decimal type; Save reported preview-only success |
| Legacy Live fallback | Matching shared glass header/readable scroll content; no capture started |
| Manual + Photo empty/selected | Previously approved forms still rendered; photo camera/library operations disabled in review |

Screenshots were inspected live through CUA; none were serialized or exported. CUA accessibility sometimes retains stale native field-role labels while moving between pages; visual screenshots showed ordinary food fields as plain text, and auth-specific password fields remained protected.

## Large text and behavior safeguards

- Actual editor and survey pages remeasure scroll content on font-size changes, while screen-owned draft state remains.
- Meal choices switch from two columns to full-width rows at accessibility sizes so Breakfast does not split mid-word.
- History maintains seven readable calendar columns, uses short weekday labels at large sizes, and supplies complete date labels to accessibility. Previous/next month behavior passed at accessibility-large.
- Auth errors/status changes have explicit iOS announcements; Back/footer navigation is disabled during pending auth operations.
- Tutorial Next/Done expands at large sizes, and gallery page state survives size changes.
- Normal simulator text size was restored to Large; contrast remains disabled.

## Review corrections

- Reconnect now displays the model actually retained by the client.
- Scale-item inference receives explicit grams while in-memory storage remains numeric.
- Survey calculations use canonical kg, avoiding an extra lbs conversion; the original activity/formula factors and goal offsets remain. BMR explanation follows the selected original formula.
- Picker Done commits the visible default, preserves existing values, and optional body-fat Clear remains unset.

This verifies UI behavior and software unit consistency, not the nutritional methodology of the existing survey formula. Live service authentication/password reset, inference, account saving, physical-device behavior and dormant capture/model execution were not exercised again during this visual refresh.

## Scope and Git

No physical iPhone use, personal record/credential inspection, real authentication action, goal/meal/session mutation, photo/microphone access, screenshot export, deletion, account change or backend deployment occurred. The simulator was returned to actual Today without observing personal records.

The user selected keeping cal_mobile and cal_backend as the two Git repositories. That structure is recorded; this UI pass made no Git branch/index/history changes or pushes. Existing local modifications and untracked source remain intact for the reviewed baseline step.


## October 19: native navigation buttons

Shared FormHeader controls now distinguish neutral navigation from the primary text action. Back uses a deep neutral SF chevron in a 44 × 44 pt circle; Save retains Tangerine text in its existing 68 × 44 pt capsule. Existing title/body typography, symmetric header layout, disabled/loading states, and navigation/save handlers are retained. All pages using FormHeader inherit these changes, including Manual, Photo, Goals, ChatGPT, Voice language, editors, authentication back headers and guides.

Both roles use UIButton.Configuration.glass() on iOS 26, with native corner configuration and press feedback. Regular glass preserves a visible boundary on white pages. There is no custom border, shadow or surrounding opacity/scale animation for these native buttons. Earlier iOS and Reduce Transparency retain the existing filled fallback. At accessibility text sizes, the existing Save checkmark substitution remains; navigation symbols grow from 20 to at most 24 pt so they fit inside the compact touch target, while titles retain Dynamic Type. Save symbols explicitly retain the action tint. Non-iOS navigation fallbacks use a white surface and neutral pressed state.

Validation: scoped ESLint, all 60 existing JavaScript checks, git diff --check and the final Release iOS simulator build passed. Log: /tmp/calmera-header-glass-build.log. Installed only the dedicated com.yfwu02.mobile.chatgptdev simulator app. The actual Goals editor with ui-goals synthetic values rendered circular Back/capsule Save; Save reported "Test goals updated locally. Your account was not changed.", and Back returned to the form-check route. Manual and Photo preview components displayed the same header; photo-library actions stayed disabled. Accessibility-large was inspected, symbol oversizing corrected, and final standard/accessibility sizes reviewed. Simulator text size was restored to Large.

No physical iPhone operation, personal record/credential inspection, real goal save, camera/microphone access, screenshot export or backend change occurred. Native press response is supplied by UIKit; no frame-rate benchmark was performed.

Reference: https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct/glass()
