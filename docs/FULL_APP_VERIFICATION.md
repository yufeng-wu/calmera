# Full Calmera app: ChatGPT inference and persistence

October 18, 2026. The user personally signed into an existing Calmera account in
the simulator and connected their own ChatGPT account. They explicitly approved
using that existing account. Only new synthetic test rows were inspected;
existing meal histories, account records, other messages and phone photos were
not browsed. No original app, certificate, file or meal was deleted.

## Observed simulator results

Separate full-UI app: Calmera Test, com.yfwu02.mobile.chatgptdev, running on the
dedicated Calmera ChatGPT Test simulator. It retains Dashboard, History, Settings,
Quick Add and the existing create/edit forms. The package main remains
expo-router/entry. The ChatGPT screen showed Connected with GPT-6-Luna selected.
No credentials were copied from the standalone AI probe.

1. Quick Add: Banana - CALMERA TEST 2026-10-18, 118 g. The original form's
   Estimate with ChatGPT returned 105 kcal / protein 1.29 g / carbs 26.95 g /
   fat 0.39 g. Save created Neon food entry 92 through the ordinary authenticated
   app API. A SQL query restricted to the exact synthetic name verified it.
2. Terminated and relaunched only Calmera Test. Opened only entry 92 via the app's
   edit route and observed the saved values restored. Changed the portion to
   59 g, re-estimated through ChatGPT and saved: 52.51 kcal / P0.64 / C13.48 /
   F0.19. This verifies connection reuse after restart, not forced token expiry.
3. Generated a clearly marked synthetic nutrition-label PNG. Native selected-photo
   input sent it through Photo Log. Its printed 180 kcal / P7 / C24 / F6, one
   50 g bar, was inferred and saved as entry 93. The model normalized the name
   to Oat Bar. Renamed only that new entry through the app to
   Oat Bar - CALMERA PHOTO TEST 2026-10-18, preserving its nutrient values.
4. Rechecked only entries 92 and 93 using exact synthetic names. Both remain in
   the existing database and are explicitly marked as test data. They were not
   deleted. No OpenAI tokens, raw photo or audio are sent to the food-save API.

The image fixture is /tmp/calmera-full-app-test/nutrition-label.png, not a personal
meal photo. Earlier standalone physical-device photo inference was user-confirmed;
this full-app simulator test also verifies the selected-photo-to-database path.
Nutrient estimates are not clinical or weighed nutrition validation.

## Backend publication

- PR 1: https://github.com/yufeng-wu/cal_backend/pull/1 — default bounded local
  rate limits; Redis no longer contacted by default. Merged and deployed.
- PR 2: https://github.com/yufeng-wu/cal_backend/pull/2 — expected signed-out
  Clerk errors return 401, not 500. Merged and deployed.
- Verified after these deployments: health 200, missing auth 401, synthetic
  invalid bearer token 401. No personal request bodies were retrieved.
- PR 3: https://github.com/yufeng-wu/cal_backend/pull/3 — server AI retired and
  billing dependencies optional. Merged and deployed as 9c9ad733c98e94fa244d0c1d07524a461727a114. Final probes returned health 200, unauthenticated account 401 and all four retired AI endpoints 410. Reopened only synthetic entry 93 in the app after deployment and observed its saved label and values. Existing meal schema preserved. No environment secrets changed.
- Seven synthetic backend checks passed; 21 mobile contract checks passed.

## Full-UI physical build

Signed with the existing authorized Personal Team; no new paid membership.
Separate app installed and launched successfully on the connected iPhone:
Calmera Test / com.yfwu02.mobile.chatgptdev. Original app and Calmera AI Test
remain installed. Embedded JS, code signature and separate provisioning profile
were verified. This full-UI profile expires October 25, 2026 at 16:05 EDT.

Artifacts:
- Simulator: /tmp/calmera-full-app-test/DerivedData/Build/Products/Release-iphonesimulator/mobile.app
- Phone: /tmp/calmera-full-app-phone/DerivedData/Build/Products/Release-iphoneos/mobile.app
- Build helper: scripts/build-full-app-test.sh, frozen before execution.

The user subsequently confirmed ChatGPT plan authorization in the full phone
app. Agent-operated physical text and image inference plus database saves passed
through iPhone Mirroring, as detailed below. The user later personally granted microphone permission. The synthetic on-device speech-to-ChatGPT-to-save test also passed, as detailed below. Neither App Store acceptance nor expiry-token refresh
or multi-day reliability is established by these checks.

## Test navigation

Use path-only URLs with the test scheme, for example
calmera-chatgpt-dev:///edit/92 or calmera-chatgpt-dev:///chatgpt. A test attempt
using //edit/92 treated edit as the hostname and opened an unmatched /92 route;
using ///edit/92 resolved it. This was a test-navigation error, not a lost record.
The new food entries were reopened only by their exact IDs, avoiding historical
meal browsing. The simulator was returned to the ChatGPT settings screen.

## Physical full-app follow-up

- The user authorized use of their ChatGPT plan in the installed full Calmera Test.
- Mirroring keyboard/paste synchronization was unreliable. No estimate or save
  was submitted from the incorrect unsaved input; the agent-created form was
  reset. No clipboard contents were recorded in project files or sent to the
  model/backend.
- Added fixed synthetic prefills behind extra.calmeraFullAppTest, which is true
  only for CALMERA_FULL_APP_TEST=1. Normal builds remove that flag. No prefill
  launches inference or saving automatically; original UI buttons are used.
- Text: Banana - CALMERA PHONE TEST 2026-10-18, 118 g. Physical UI returned
  105 kcal / P1.29 / C26.95 / F0.39. Clicking Save created synthetic row 97;
  an exact-name-only Neon query verified it.
- Image: the generated label was embedded in the isolated test build, avoiding
  the phone Photos library entirely. Clicking the ordinary Log photo action
  created row 98: Calmera Test Oat Bar - CALMERA PHONE PHOTO TEST 2026-10-18,
  1 bar (50 g), 180 kcal / P7 / C24 / F6. Exact synthetic-marker query verified it.
  This confirms physical image-to-save processing; it does not add a new claim
  about physical camera capture or picker use in this full build.
- Multiple same-bundle updates preserved Calmera login and ChatGPT authorization;
  no credentials were copied/exported. A restart and exact /edit/97 deep link
  restored the physical synthetic record and its nutrient values.
- One generic inference error was seen before a later valid estimate appeared.
  It was not diagnosed as a specific provider or Keychain failure. Added bounded
  code-only test diagnostics; no provider bodies, tokens or food text are exposed.
- Fixed post-save navigation for a cold app link: go back when available,
  otherwise replace with Dashboard, preventing an ambiguous unchanged form.
- Five agent-created synthetic rows now exist (92, 93, 97, 98, 99), all explicitly
  marked as tests. They were not deleted. No old food rows were changed.

## Synthetic voice test boundary

A hidden /voice-test route is available only in the separate full-test build.
It uses one locally generated AIFF file in the app's cache, never microphone
capture, then calls the existing local transcription, ChatGPT and food-save
functions. The ordinary app redirects this route to Dashboard. The sample is
fictional banana speech, not a personal recording. The resulting real-device speech test passed after the user personally granted permission.

The installed expo-speech-recognition native module currently checks microphone
permission even when audioSource.uri names a file. Its combined permission
request showed Speech Recognition and Microphone dialogs. Speech permission
was allowed for this authorized project test. Automatic approval rejected the
microphone grant because the user had not specifically approved it and the file
fixture does not intrinsically need recording. No microphone grant was made,
no microphone recording started and no native permission guard was patched.
Explicit user approval was requested. The user then stated that they had
personally allowed the permission. No rejected grant was retried by the agent.
The completed test below verifies on-device file transcription, not live
microphone capture or the hold-to-record gesture.

Latest verification: 22 mobile tests including code-only diagnostic redaction
passed; seven backend tests passed. Full phone Release rebuilds and signatures
passed. The current phone app preserves the normal original UI and credentials.

## Physical synthetic voice result, after user permission

The user personally granted microphone permission and confirmed it in chat.
Reopened only the fixed /voice-test route and clicked its explicit run button.
The iPhone UI showed:

- Completed and saved.
- Synthetic transcript: For breakfast I had 118 g of banana.
- Banana - CALMERA PHONE VOICE TEST 2026-10-18, 118 g, 105.00 kcal.

The ordinary local ASR wrapper ran with requiresOnDeviceRecognition=true,
audioSource.uri pointing to the generated app-owned AIFF file, and recording
persistence disabled. The native library's file path reads AVAudioFile buffers;
it does not start its microphone-recognition path for this fixture. Only the
synthetic transcript went to the user's ChatGPT plan. Existing Clerk-authenticated
save code created food entry 99. A Neon query restricted to the explicit voice-test
marker verified 105 kcal / P1.29 / C26.95 / F0.39. No personal audio was read,
no environment audio recorded and no other rows queried for this check.

Core physical workflows now passed: text estimate/save, fixed-image infer/save,
and generated-audio local transcription -> ChatGPT -> save. App restart restored
a newly saved entry. Live microphone capture/hold gesture, physical camera capture,
forced token expiry and multi-day reliability remain separate acceptance checks.
The phone was returned to the normal Dashboard without inspecting its contents.
