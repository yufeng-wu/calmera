# Full Calmera UI audit — 2026-10-19

## Inventory and scope

The audit inspected all 30 pre-existing route files (excluding layout files), their navigation links, default rendered components, and shared controls. There were 14 routes requiring visual updates, four already using the approved design, three redirect-only routes, and nine developer/test routes. The new ui-gallery is a tenth test route, not a product feature.

Current design: retain the original warm cream/coffee palette and Today/History meal structure, using native UIKit Liquid Glass for navigation and action controls. Readable content stays on grouped white surfaces. Preserve Clerk, ChatGPT subscription inference, food persistence, caches and native menus. No new Live entry points, backend changes, account changes or physical iPhone operations.

## Full list of pages requiring work

| Page / route | Initial issue | Implementation |
|---|---|---|
| Sign In — /(auth)/sign-in | Oversized poster, older fields/actions | Compact brand header, grouped labeled fields, glass Sign in, error/status notices |
| Sign Up — /(auth)/sign-up | Older registration + verification layout | Matching registration/email-code UI, scroll/keyboard handling and busy guards |
| Password Reset — /(auth)/forgot-password | Inconsistent request/code/new-password stages | Unified three-stage shell and glass actions |
| Settings — /(root)/(tabs)/settings | Separate shadowed buttons | Grouped settings rows and restrained matching header; existing actions preserved |
| ChatGPT — /chatgpt | Old header, solid actions, flat model/language lists | Glass connection controls and grouped status/model/language sections |
| Nutrition survey — /goals-survey | Old panels/chips, duplicated picker sheets, full-page save spinner | Grouped sections, adaptive selection controls, one consistent wheel-picker sheet, glass recommendation/save controls |
| Meal editor — /edit/[id] | Old header/loading shell around modern form | Shared glass header, stable loading/error/retry shell, existing form and save/estimate behavior |
| Session item editor — /session-log-edit/[id] | Old header/loading shell | Same modern editor; numeric scale storage retained |
| History — /(root)/(tabs)/history | Plain month controls and calendar chrome | Native glass month arrows, grouped calendar, full-date accessibility; existing data/meal layouts preserved |
| Tutorial — /calmera-guide | Overlay arrow/dots and full-screen cropped graphics | Preserved four tutorial images, contained paging and glass Next/Done controls |
| Welcome — /calmera-welcome | Older carousel and final calibration step | Shared tutorial chrome and grouped scale selector with glass actions |
| Scale calibration — /update-scale-type | Old selection cards/header, whole-page loader | Grouped accessible choices, stable glass header, Save/loading/error/retry states |
| Legacy camera fallback — /camera | Old fallback screen | Shared modern fallback, without exposing or launching the dormant camera flow |
| Legacy camera-loading fallback — /camera-loading | Same older fallback | Same shared glass navigation and readable content |

The session/welcome/tutorial/scale and camera fallback routes remain available where they previously were, but are not newly added to Settings/Add. The unavailable Live feature remains absent from those entry points.

## Already aligned; retain approved design

| Page | Treatment |
|---|---|
| Today — /dashboard | Preserve centered calmera, original date/card layout, native tab/Add/menu/motion/voice feedback |
| Manual — /create | Retain grouped form and native glass controls; add consistent cold-launch Back fallback |
| Photo — /photo-log | Retain selected/empty/processing states and glass controls; add consistent Back fallback |
| Edit Goals — /update-goals | Preserve compact integer-only sliders, native menus, loading/save/navigation fixes |

## Routes without independent shipping UI

- /index redirects to Today.
- /go-premium and /premium-plan redirect to ChatGPT. Dormant pricing exports are not reactivated or restyled as purchasable products.
- Developer routes: /(auth)/chatgpt-test, /design-preview, /native-tabs-check, /form-style-check, /meal-swipe-check, /performance-check, /summary-menu-check, /voice-feedback-check, /voice-test. These are not counted as user-facing pages to redesign.
- New /ui-gallery is a full-test-build-only runner that renders the actual screens with synthetic local state and blocked account/data actions. It is not a replacement mockup or part of normal app navigation.

## Parallel ownership and integration

1. Auth agent: sign in, registration/verification, password reset, AuthForm/auth styles.
2. Settings/guides agent: Settings, ChatGPT, welcome/tutorial, calibration and scoped shared rows/gallery/selector.
3. Survey/edit agent: survey sheets/recommendation, meal editor, session-item editor.
4. Integration: shared glass/header/Back behavior, native destructive action tint, History, legacy fallback, safe review route, navigation and verification.

## Review fixes

Cross-review identified and addressed inconsistent model selection after reconnect, explicit grams for scale-item inference, double-conversion of canonical kilograms in pounds mode, displayed picker defaults not being committed on Done, and auth Back/announcements during async states. These changes retain the underlying survey formula and do not assess its nutritional methodology.

## Validation plan

Run scoped lint, relevant existing data/inference/loading tests and focused new unit/default regressions, then one integrated Release simulator build. Exercise the actual pages in isolated UI review modes: auth validation/stages, settings links, local ChatGPT selection, survey wheel/default/recommendation/save, edit validation, calendar navigation, guide pagination, scale selection and legacy fallback Back. No test may change auth, credentials, personal goals/records, photo library, camera or microphone. Report visual checks separately from untested live service/device operations.


## Completion

All 14 identified routes have been updated. The 21 actual-component review states rendered; scoped lint, 60 automated tests and the final iOS 26 Release simulator build passed. Representative interactive and large-text checks are recorded in LIQUID_GLASS_PAGE_VERIFICATION.md. Live service/account/device operations were intentionally not repeated for this visual refresh.
