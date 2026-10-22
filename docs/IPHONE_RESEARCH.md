# iPhone ChatGPT-plan integration: cases and test evidence

Checked 2026-10-18. Research only; third-party apps/libraries were not installed or executed.

## Primary-source examples

| Case | What its own documentation establishes | Limits for Calmera |
| --- | --- | --- |
| [VoiceClaw Realtime — App Store](https://apps.apple.com/us/app/voiceclaw-realtime/id6769243723) | An actual App Store listing advertises direct ChatGPT subscription sign-in, including a July 31 update saying no API key is needed. | Developer claims, not our runtime verification. July 7 release notes also describe a temporary sign-in outage and API-key requirement. This does not establish our app's eligibility or review outcome; its audio claims are not capabilities of our documented OSS grant. |
| [PiDurableKit](https://github.com/finnvoor/PiDurableKit#signing-in-with-a-subscription-oauth) | Swift API describes iOS browser-sheet OAuth, Network.framework loopback capture, Keychain and refresh. | README explicitly warns about first-party OAuth clients. Borrow the engineering pattern, not another app's client identity. No public App Store acceptance proved. |
| [CodingPlanKit](https://github.com/atom2ueki/CodingPlanKit) | Swift iOS/macOS OAuth + PKCE + Keychain and plan-backed Codex calls; local listener plus a custom scheme to close the authentication sheet. | Its Codex provider/backend is different from Calmera's independently registered client and official public Responses endpoint. No library was added. |
| [Vault Scout](https://github.com/floorianmb/vault-scout) | Author reports iOS Obsidian testing using the same official OSS dynamic registration and ChatGPT plan API, without a running computer. | Its documented iOS workaround requires manually pasting a localhost callback URL, because the plugin cannot run a native listener. This is not the desired Calmera UX and not an independently installed/tested case. |
| [Oriveo iOS](https://github.com/oriveo/oriveo/blob/main/ios/README.md) | Open-source native client documentation says ChatGPT subscription login goes directly to the provider and credentials are kept on device. | Not evidence of the exact official OSS grant, App Store approval or successful Calmera execution. |

Official contract: [overview](https://developers.openai.com/siwc/token-sharing-open-source),
[registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).
Calmera keeps its own dynamically issued client ID, stable opaque host ID, PKCE,
state, nonce and signed ID-token validation. It does not borrow Codex credentials
or client IDs. Inference uses https://api.openai.com/v1/responses with store:false
and stream:true, not an undocumented subscription backend.

## Verified locally in the iOS simulator

- Existing dedicated simulator: Calmera ChatGPT Test / iOS 26.0.
- Native app builds and launches; synthetic Keychain write/read succeeds.
- Added a development-only real browser round-trip diagnostic. It opens a local
  URL with a fictional code, receives it through the native 127.0.0.1 listener,
  validates the state/registration shape and dismisses the browser.
- The simulator visibly displayed **Browser callback passed · no account used**.
  No OpenAI request, credential exchange, account or database is involved in this
  diagnostic. This proves the browser/listener bridge in this simulator, not
  real OAuth or physical-iPhone background behavior.
- 16 protocol/persistence/ASR contract checks pass; focused lint passes.
- Real text/photo inference previously passed on the Mac using Calmera's own
  approved grant. No grant was transferred to the mobile app.

## Still pending

1. Human completion of fresh Calmera OAuth inside the simulator/app.
2. Native iPhone signing/install, text + photo inference, restart/refresh and
   cancellation/rejection tests on hardware.
3. Distribution applicability confirmation and an actual App Store review.

At this check Xcode reports the physical iPhone unavailable. The user is away
from the Mac. Do not repeatedly ask them to interact with the Mac or infer that
an existing ChatGPT mobile login authorizes Calmera.

## Safe local phone build preparation

`scripts/build-iphone-development.sh` builds locally after the developer supplies
CALMERA_APPLE_TEAM_ID. It stages Info.plist and empty app-specific entitlements
under /tmp, uses bundle ID **com.yfwu02.mobile.chatgptdev**, display name
**Calmera Test**, and unique URL schemes. No original app/data is replaced; the
script does not install, upload, create provisioning resources or auto-login.
The normal Xcode signing/provisioning configuration must already be available.
Its empty entitlements remove the old app's unused Apple Pay merchant dependency
for this development probe; Xcode still adds normal signed application/Keychain
entitlements from the selected provisioning profile.

The test script is not yet a complete release/TestFlight variant. In particular,
the existing Clerk redirect configuration must be aligned before testing the
full authenticated app. The development ChatGPT probe uses no Clerk/database.

A simulator binary cannot be installed on a physical iPhone. Expo Go cannot load
our custom native module. Installing the official ChatGPT app is unnecessary:
Calmera performs its own OpenAI browser consent flow. TestFlight can eventually
provide phone-only installation and testing once Apple signing and distribution
configuration are completed; no TestFlight build has been uploaded.

## Physical-iPhone target compile result

The local unsigned **iphoneos / arm64** Debug build completed successfully,
using bundle ID `com.yfwu02.mobile.chatgptdev`. Built Info.plist metadata confirms
`DTPlatformName=iphoneos` and `CFBundleSupportedPlatforms=[iPhoneOS]`. This is a
hardware-target compiler check, not a signed install or a real-phone runtime test.
No Apple account, signing credential, provisioning resource or source upload was
used. The output is under `/tmp/calmera-iphone-compile`; build log is
`/tmp/calmera-iphone-compile.log`.

## Earlier authorized simulator OAuth attempt

The user explicitly approved basic-profile access, ChatGPT plan inference and
Calmera-owned refreshable credentials in the test simulator. No further consent
is needed to retry the same requested scope during this test session.

The simulator's Google flow offered a passkey requiring unavailable Bluetooth;
its alternate route entered account recovery. No recovery information was
submitted, password/OTP read, or account/security setting changed.

A development-only handoff then opened the simulator's own fresh OAuth request
in a new Mac Chrome tab, using the exact account the user specified and its
existing OpenAI session. PKCE and eventual tokens remained the simulator's
responsibility; no installed-app credentials or cookies were extracted. This
method is a simulator test aid, not proof of an on-phone browser workflow.

The OpenAI permission page was submitted after explicit user approval. It
returned **Operation timed out**. A bounded retry and a fresh page traversal
reproduced the timeout before any callback reached Calmera. The underlying
service/account cause is not established; there was no explicit eligibility
denial. We cannot determine whether the provider partially recorded a grant.
The mobile app received no usable token result, and mobile inference did not run.

Cancellation recovery was implemented and verified visibly: **Cancel pending
authorization** cleared the in-progress state and restored enabled controls.
An Expo browser-dismissal hang was fixed by tracking whether Safari had already
closed. Five regression checks cover browser cancellation, callback success,
timeout cleanup, development handoff cancellation and release-build exclusion.
All **21** ChatGPT-related JS checks and focused lint pass.

Only the unfinished local attempt was cancelled; no provider grant was revoked
or deleted. No database meal write, personal-message read, photo upload or new
inference occurred in this attempt. Text/photo tests remain pending until
OpenAI completes a fresh authorization.

## Current outcome: simulator success

After the user returned to the laptop and completed interactive verification in
the standalone app, authorization and supplied-photo inference succeeded. The
agent verified synthetic pineapple text inference and persistence of the
connection/model catalog after app restart. See
[SIMULATOR_VERIFICATION.md](SIMULATOR_VERIFICATION.md). This supersedes the
earlier timeout as the current simulator result, while retaining the historical
failure evidence. Physical-phone, token-expiry refresh and distribution checks
remain pending.

## Physical-device follow-up

The separate Release test app was later signed and installed using an explicitly
approved new free Personal Team. After personally trusting the developer, the
user confirmed the physical iPhone opened the app, connected ChatGPT and passed
text/photo tests. See [PHONE_TEST.md](PHONE_TEST.md) for evidence boundaries and
profile expiry. This is now a hardware proof of the core workflow for this user;
public-distribution eligibility and token-expiry refresh remain unverified.
