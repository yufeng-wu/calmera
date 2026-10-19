# Calmera iOS: use the user's ChatGPT plan

Current full-app evidence and deployed backend status: [FULL_APP_VERIFICATION.md](FULL_APP_VERIFICATION.md).

## Current product decision

The existing Calmera iOS app is the product. Keep its Dashboard / History /
Settings tabs, visual design, Clerk login, food database, existing forms and
Voice Log interaction. Calmera is intended to be free; its AI features require
an eligible user-authorized ChatGPT plan. There is no Gemini fallback. Live
remains Coming soon. iMessage and Shortcuts are retired directions and are not
part of this app's build, runtime or test plan.

The earlier chat-screen redesign was rejected and removed from app navigation.
Only source files created for that experiment are moved to the temporary
working area; the user's original files, photos and apps are not deleted.

## Minimal app changes

- The existing header action and one Settings row open ChatGPT connection.
- Voice Log keeps its original hold-to-record button and animations. Only the
  newly recorded app-owned clip is transcribed with on-device speech recognition,
  then text goes directly to OpenAI under the user's own authorized grant.
- Quick Add and both existing edit forms retain their UI. Estimate calls the
  mobile ChatGPT client with the original quantity prompt.
- One Photo Log action is added to the existing Add menu. Its page uses the
  existing create-screen styles and a system camera/selected-photo picker.
  Only the selected image is resized/re-encoded and sent to OpenAI. No library
  scan, image metadata forwarding, photo-library writes or backend image upload.
- Original Gemini transcript and quantity prompts are ported into
  `lib/chatgpt/prompts.mjs`. Their per-food JSON array, explicit nutrient priority,
  numeric/fractional portions, language rules, default Snack and no-food `[]`
  behavior are retained. A separate single-photo adapter replaces neither prompt
  with the old Live before/after scale comparison.
- Validated estimates use the same authenticated food-entry database endpoint.
  The whole batch is validated before the first write. Only Clerk authorization
  and allowlisted meal fields cross that boundary; ChatGPT tokens, audio and
  images never do. Uncertain/partial saves are not blindly retried.
- Calmera's Premium gate and reachable payment flow are disabled for this free
  variant. Original billing code is preserved in legacy components, not mounted
  by their routes. No backend billing records or payment accounts are modified.

## Direct ChatGPT connection

OpenAI's published local/open-source flow uses PKCE/state/nonce and a temporary
HTTP loopback callback. `modules/calmera-chatgpt` supplies a 127.0.0.1-only native
listener, RSA/ECDSA-signed ID-token validation and selected-photo input. It does
not substitute an unsupported custom-scheme callback. Credentials are stored
in SecureStore, scoped to the current Calmera user, with
WHEN_UNLOCKED_THIS_DEVICE_ONLY. Each installation has an opaque stable host ID.
Refresh rotation is serialized and saved together. Disconnect removes only
Calmera's own items; credentials from installed ChatGPT/Codex apps are never read.

Requests go to the public Responses endpoint with store:false and stream:true.
Only response.completed yields validated entries; partial output, unsupported
images, failures, usage limits and interrupted streams cannot become meals.
Account-specific models are selectable. Settings explains plan use and links to
ChatGPT usage management. Audio input/transcription is not supported by this
ChatGPT-plan grant, hence local transcription rather than an API-key fallback.

See [the verified setup checklist](SETUP_CHECKLIST.md) for the exact developer
actions still needed. Existing provider credentials are never printed.

## Running the development app

This native callback requires an Expo **development build**, not Expo Go.
From `mobile/`:

```sh
npm run test:chatgpt
npm run lint
npx expo start --dev-client
npx expo run:ios
```

A generated `ios/mobile.xcworkspace` and installed CocoaPods dependencies are
available. The full iOS simulator build succeeded. Use Xcode's normal local simulator
signing: the initial unsigned build could not store Keychain items. The normal
signed build now runs and the development probe verified secure storage.
The separate Release phone probe is signed and installed; the user confirmed authorization, text and photo inference on their physical iPhone. A simulator .app cannot be installed on a phone. Native module changes require rebuilding the client.
Do not use prebuild --clean, uninstall an existing app, alter account settings,
or inspect personal phone data for testing. Prefer a fresh simulator/test account.

## Verification and remaining acceptance

- 21 synthetic protocol, persistence, local-transcription and browser orchestration tests.
- 20 native identity/loopback checks including generated RSA/ECDSA signatures,
  forged identities, wrong audience/nonce/expiry and callback state/replay.
- Native iOS simulator type checking and complete Xcode build succeeded.
- The original transcript prompt was tested with real authorized ChatGPT
  inference using an invented lunch: salad retained the supplied 600 kcal, half
  a bagel became 0.5 bagels, and two food entries were returned. A generated
  label returned 200 kcal / 10 g protein / 25 g carbs / 7 g fat. The actual mobile
  SSE parser and existing backend validator accepted both tests. No database
  write occurred. This Mac test does not prove mobile OAuth.
- The restored UI bundles successfully and the normal signed app runs on the
  fresh Calmera test simulator. New inference/test files pass focused ESLint;
  the complete legacy project currently has zero lint errors and 70 warnings.
- A development-only **Test ChatGPT connection** link on Sign In opens an isolated
  direct-inference probe. It requires no Calmera account, reads/writes no backend
  data and redirects away in release builds. Secure storage self-check passed.
  The later standalone probe passed ChatGPT consent/inference on simulator and physical iPhone; the phone result is user-confirmed.
- The supplied food photo was used with the actual image-only request and returned
  valid food entries. An earlier request with extra test instructions returned
  no entries, so testing now matches the app request exactly. Food identity and
  portion estimates have no weighed ground truth and were not saved as meals.
- Read-only setup checks found Neon and required schema healthy, Clerk's public
  instance reachable, deployed API returning 500 and Redis unavailable. Local
  backend fixes remove Gemini/Stripe startup requirements, disable their legacy
  routes by default and preserve bounded local rate limits during Redis failure.
  Four backend tests passed; server AI routing is now permanently retired. These fixes have not been deployed.
- Still needed for the full regular app: Calmera test-account login, its own ChatGPT connection, voice capture/transcription and a dedicated test-account database save. Do not read existing personal food history to test this.

## App Store distribution

The goal is a free App Store app, not a Calmera subscription or API-key product.
Free distribution does not by itself prove eligibility for the dynamic
local/open-source OAuth flow. The inherited README reserves all rights; its
licence is not silently changed. Public iOS integration eligibility remains to
be confirmed with OpenAI. The official client-ID page currently describes
selected commercial partners and an interest form; the public plan-sharing docs
explicitly cover open-source/local apps. No application has been submitted and
no App Store approval is claimed. Publishing and signing are separate from a
working local simulator build.

Official sources checked October 18, 2026:
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/request-client-id
- https://developers.openai.com/siwc/ui-ux-guidelines

Current service status and login actions: [SERVICE_AUDIT.md](SERVICE_AUDIT.md).
