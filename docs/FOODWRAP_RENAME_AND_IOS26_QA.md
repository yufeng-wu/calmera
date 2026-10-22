# foodwrap. — rename and continued iOS 26 QA

The user requested continued simulator testing and the new app name: **foodwrap.** as a standalone title, **foodwrap** within sentences. The user then explicitly excluded the Live AI pages.

## Rename scope

Updated the active Today and authentication wordmarks, Settings brand label, sign-in/sign-up/recovery copy, Theme and Meal times copy, ChatGPT connection/alerts, relevant developer previews and the README. Standalone titles use the trailing dot; sentence references have no internal brand dot. Ordinary sentence punctuation is retained. Existing user-tuned fonts, spacing, colors, native glass and animation code are unchanged.

Expo's display name, native CFBundleDisplayName / CFBundleName and all existing build helpers now use foodwrap. Permission-description copy uses foodwrap in sentences, rather than the old internal PRODUCT_NAME substitution. The generated Release app's display and bundle names were both confirmed as foodwrap.; its identifier remains com.yfwu02.mobile.chatgptdev. The simulator Home screen visibly showed the foodwrap. app label.

Future dynamically registered ChatGPT clients advertise foodwrap. in the existing agent_name_hint. The native localhost authorization response uses foodwrap in its text. No existing ChatGPT client registration, account, entitlement, permission or connection was changed or tested live.

Bundle IDs, URL schemes, storage/keychain namespaces, routes, native module/class names, repository paths and historical synthetic-record markers remain unchanged. This preserves existing installs and data. Old separately installed test/probe apps were not renamed in place or removed. Live AI / scale pages, related tutorial images and dormant premium flows were left unchanged at the user's request.

## Continued simulator evidence

Only Calmera ChatGPT Test, iOS 26.0.1, UDID F3584334-39B2-46E4-9E17-3AE2D9945376 and bundle com.yfwu02.mobile.chatgptdev were operated. No physical phone or iOS 27 runtime was used in this pass.

All meal-time writes below used the known isolated preview owner meal-times-preview:ready and the production AsyncStorage preference coordinator, never the real user's preference.

- Opened Dinner's actual native compact time picker. Changed 17:00→18:00, dismissed it, observed Dinner 18:00–22:00 and Lunch ending at 18:00. Save confirmed success and became disabled. This exercises the final render-current owner guards, resolving the preceding coordinate-input limitation.
- Installed the renamed Release build without deleting data. Its Meal times sentence read “foodwrap uses these times”; saved Dinner 18:00 remained, confirming preservation across the app update.
- Snack's native popup positioned above its low row. Changed 22:00→23:00 and observed Dinner ending at 23:00 / Snack 23:00→05:00 next day. Back returned to synthetic Settings. Reopening restored saved Snack 22:00 and disabled Save: the unsaved draft was discarded.
- Lunch's native hour wheel changed 11→12 and automatically changed AM→PM. Observed Lunch starting 12:00 PM and Breakfast ending at noon. Save confirmed success and disabled repeat submission.
- Restore defaults + Save returned all four starts to 05:00 / 11:00 / 17:00 / 22:00. Synthetic test preferences ended in their original state.
- Synthetic sign-in showed standalone foodwrap., “Sign in to your foodwrap account.” and “New to foodwrap?” without submitting authentication or filling credentials.
- Synthetic Settings showed the foodwrap. brand label. The synthetic Today preview showed the same centered foodwrap. wordmark with the approved typography and layout.
- Native simulator Home showed foodwrap. under the updated app icon. No other app was opened.

## Validation and limits

272/272 JavaScript checks passed (/tmp/foodwrap-rename-tests.log); scoped ESLint (/tmp/foodwrap-rename-lint.log), whitespace checks and the Release simulator build (/tmp/foodwrap-rename-build.log) passed. The existing OAuth URL regression now checks the new display hint while retaining the remaining protocol assertions. No tests were added solely to mirror copy changes.

These checks verify settled native views, wheel interaction, state, saved preference behavior, unsaved Back, metadata and visible naming. No per-frame animation/FPS measurement, live model classification, microphone/camera, real food/goal write, account/backend setting change, personal record/credential inspection, physical-phone operation, or screenshot save/export occurred. The separate dirty OpenAI-logo work was preserved and excluded from this commit.
