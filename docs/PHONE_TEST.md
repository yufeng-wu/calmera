# Test ChatGPT inference on your own iPhone

The dedicated app is **Calmera AI Test**, bundle ID
`com.yfwu02.calmera.chatgpttest`. It is separate from the installed Calmera app.
The goal is to test the real iPhone browser OAuth flow and direct text/photo
inference before connecting the rest of the product.

## Current verified outcome

Standalone simulator authorization, supplied-photo inference, synthetic text
inference and credential reuse after app restart have **passed**. The selected
model was GPT-6.1-Sol. See [SIMULATOR_VERIFICATION.md](SIMULATOR_VERIFICATION.md).
Earlier timeout notes below describe historical failed attempts. Physical-iPhone
inference and refresh after expiry remain unverified.

## What this test app does

- Launches directly into ChatGPT inference testing, with no Clerk sign-in or
  database dependency.
- Opens the OpenAI authorization page from inside the app. The user signs in and
  grants use of their own ChatGPT plan; the official ChatGPT app is not required.
- Keeps Calmera's own credentials in this app's device-only Keychain namespace.
  It does not reuse credentials/cookies from ChatGPT, Codex, or another app.
- Sends only entered test text or explicitly selected photos directly to OpenAI.
- Displays estimated food/macros without saving a meal to the backend.
- Embeds its JS bundle in a Release build, so installation/testing does not need
  a running Mac, Metro server, Expo Go, or a LAN connection to the Mac.
- Excludes the simulator Mac-browser handoff from this standalone UI. Its normal
  phone OAuth route remains the route being tested.

No production authentication guard is disabled. `package.json` still points to
`expo-router/entry`. `phone-test-entry.jsx` is selected only by explicit test
build profiles or the local build script. The original app UI remains intact.

## Installation status and necessary setup

**Installed on the user's physical iPhone on October 18, 2026.** The user
personally trusted the new developer certificate and confirmed that ChatGPT
connection, text inference and photo inference passed. This is a user-confirmed
hardware result; no phone content was read by the agent to inspect those tests.

Local signing used the new free Personal Team, with no paid membership purchase
or Expo account. The separate bundle preserves the existing Calmera app/data.
The development profile expires **October 25, 2026 at 15:24 EDT**; rebuild/sign
and reinstall after it expires. No TestFlight upload or App Store submission
has occurred.

For phone-only installation, use one of these after account setup:

1. **TestFlight:** an active paid Apple Developer account, App Store Connect
   access, an app record for the separate test bundle ID, and a distribution
   signing/provisioning setup. No phone UDID registration is required by the
   TestFlight path. Uploading/testing is a separate step; app review/distribution
   eligibility is not established by a successful local build.
2. **Expo internal distribution:** sign in to the owning Expo account and active
   Apple Developer account, register this iPhone through the generated device
   enrollment link, and build an ad hoc package including its UDID.

An Expo account is required only for the EAS build/distribution path. A local
Xcode build can use Apple signing without Expo login, but local installation
normally needs access to the Mac and paired phone. Do not send passwords, OTPs,
private keys or certificates in chat.

## Phone test sequence after installation

1. Open **Calmera AI Test**. Confirm it says no meal is saved.
2. Tap **Continue with ChatGPT**, sign into the intended account and approve plan
   use. This is Calmera's own grant, separate from an existing ChatGPT app login.
3. Tap **Run text test** with the prefilled fictional banana description. Expect a
   completed food/macro estimate; values are estimates, not measured ground truth.
4. Tap **Choose test photo**, explicitly select a test image, then **Run photo
   test**. Do not grant or upload unrelated images.
5. Close/reopen the app and repeat the text test to check retained authorization.
6. If authorization is cancelled or times out, cancel the pending attempt and
   retry later. No successful inference should be reported from partial output.

Earlier simulator registration attempts returned **Operation timed out**.
The later standalone simulator attempt completed authorization and both inference
tests successfully. Physical-phone OAuth/text/photo success was later confirmed by the user;
refresh after expiry and App Store distribution remain unverified. See [IPHONE_RESEARCH.md](IPHONE_RESEARCH.md).

## Build commands

All commands below are preparation instructions, not evidence that a signed app
has been uploaded or installed.

```sh
# Local Release simulator build; embedded bundle, no Metro dependency.
bash scripts/build-phone-test.sh --simulator

# Local hardware-target compiler check, not installable.
bash scripts/build-phone-test.sh --unsigned-check

# Local signed build. Always signed by calmera's team 2G2578H6DX
# (scripts/signing-team.sh refuses any other team).
bash scripts/build-phone-test.sh

# The real app on a plugged-in, unlocked iPhone.
CALMERA_IPHONE_UDID=<udid> bash scripts/install-iphone.sh

# EAS account/signing/device setup must be completed first.
eas build --platform ios --profile chatgpt-phone-test

# Alternatively build for TestFlight, then complete submission separately.
eas build --platform ios --profile chatgpt-testflight
```

`app.config.js` changes the app name, scheme, bundle ID and unused billing plugin
only when `CALMERA_PHONE_TEST=1`. Both EAS test profiles select this variant and
`phone-test-entry.jsx`. `.easignore` excludes environment files, credentials and
the generated local iOS project so EAS regenerates the correct variant from Expo
configuration. The custom native module remains included under `modules/`.

Official references:
- [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/)
- [Expo app variants](https://docs.expo.dev/build-reference/variants/)
- [OpenAI authorization requirements](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)

## Standalone simulator verification

The Release / arm64 simulator build succeeded and contains `main.jsbundle`. It
was installed under the separate test bundle ID in the dedicated simulator. The
UI visibly showed **Calmera · ChatGPT test**, **Secure storage ready**, the
fictional text field and photo test control. Continue with ChatGPT opened the
official `auth.openai.com` login sheet. Dismissing the sheet returned to an
enabled Continue button and **Connection cancelled. You can try again.**
No account login, grant or inference was completed in this standalone check.

Artifact: `/tmp/calmera-phone-test/DerivedData/Build/Products/Release-iphonesimulator/mobile.app`.
This simulator artifact cannot be installed on an iPhone. A separate hardware Release build was subsequently signed and installed;
its current result is documented below.

The cloud-build variant was also resolved through Expo's real configuration
loader and prebuilt in a credential-free temporary source copy with no package
installation. Generated native metadata used the separate test name/bundle ID
and omitted the unused Apple Pay merchant entitlement. No cloud build or source
upload was performed.

## Current physical-iPhone installation result

- Pairing, Developer Mode and developer disk-image services passed.
- Standalone Release hardware build and embedded-bundle validation passed.
- Xcode automatic signing, configured only in the temporary test project,
  generated a development certificate/profile for the explicitly approved new
  free Personal Team. The original source project's team settings were preserved.
- `codesign --verify --deep --strict` passed. The profile was checked against the
  intended Personal Team, exact test bundle ID and connected iPhone.
- `devicectl` confirmed installation of `com.yfwu02.calmera.chatgpttest`.
- Initial launch required explicit developer trust. The user completed that step
  on the phone, then reported the app opened and ChatGPT connection plus text
  and photo tests passed.
- The agent did not inspect the phone's messages, photo library, credentials or
  test meal contents. The isolated test app has no database meal-save action.

No existing certificate was revoked, no private key exported, and no original
app replaced. The paid team's earlier PLA issue was avoided by using a separate
free Personal Team; the old account was retained.

The physical test report establishes the core device workflow for this account
and installation. It does not establish token-expiry refresh, multi-day
reliability, all accounts/models, nutrition accuracy or App Store eligibility.
Physical restart/USB-disconnected tests and a future expiry refresh test remain
useful. The profile's recorded expiry is **2026-10-25 15:24 EDT**.
