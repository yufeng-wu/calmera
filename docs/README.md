# Calmera for iPhone

Calmera stores the journal on the iPhone. Every new meal starts with an AI estimate through the person’s ChatGPT plan, OpenAI API key or Anthropic API key. The person reviews and saves the result. Development requires no Calmera account, server or project API key.

`app/` holds the whole Expo / React Native project. Run every command below from `app/`. The folder map is in the [repository README](../README.md).

## Run locally

On macOS, install Node.js 22, CocoaPods 1.16 and Xcode 26.0.1. The first release uses the checked-in CocoaPods workspace. CocoaPods needs a UTF-8 locale (`export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`).

```sh
cd app
npm ci
(cd ios && pod install --deployment)
open ios/mobile.xcworkspace
```

In Xcode, select the **mobile** scheme and an iPhone simulator, then Run. For a Debug build, run `npm start` in `app/` to serve JavaScript. A Release build embeds the JavaScript bundle. The custom native photo picker and ChatGPT sign-in require the native app.

Calmera's own Swift lives in the local Expo module `modules/calmera-native/`. App code reaches it only through that folder's `index.js`. `ios/CalmeraNativeModule.swift` lists every native view and function; the code is in `ios/UI/` (one file per view), `ios/SignIn/` and `ios/Photos/`. After adding or renaming a Swift file there, run `pod install` in `ios/`.

## Verify changes

```sh
npm test
npm run lint
```

The automated suite uses synthetic inputs. For a live smoke test, connect a dedicated test provider in Settings → AI connection, analyze a sample meal, review and save it, then relaunch and check Today. Photo Log sends the selected photo when you request an estimate. Voice Log transcribes on the iPhone before you send the transcript.

## Archive the first release

1. Use the checked-in `ios/mobile.xcworkspace`, the **mobile** scheme and a generic iOS device destination. Leave `CALMERA_FULL_APP_TEST` and custom `ENTRY_FILE` overrides unset.
2. Choose **Product → Archive**. The scheme archives the Release configuration. Confirm the bundle identifier is `com.yfwu02.calmera` and the intended version and build number are available in App Store Connect.
3. In Organizer, inspect the archive’s privacy report and use **Validate App** with the distribution team. Verify the archive contains the app’s `PrivacyInfo.xcprivacy`, `main.jsbundle` and Release Hermes before distributing. If CocoaPods has just refreshed Hermes over an earlier Release build, run the `forget_hermes_configuration` helper before archiving and check the result with `require_release_hermes`, both in `scripts/release-hermes.sh`.

The EAS profiles upload source using `.easignore`, which excludes `ios/` and regenerates a native project. The first-release instructions above build the checked-in native project.

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/install-iphone.sh` | Builds the Release app, signed by Calmera’s team, and installs it on a connected iPhone. |
| `scripts/build-full-app-test.sh` | Builds the review variant (`CALMERA_FULL_APP_TEST=1`, with the UI gallery) under its own bundle ID. |
| `scripts/build-iphone-development.sh` | Builds a Debug app for a device under a separate bundle ID, without installing it. |
| `scripts/build-privacy-site.mjs` | Writes the public privacy pages from the app’s policy text ([PRIVACY.md](PRIVACY.md)). |
| `scripts/signing-team.sh`, `scripts/release-hermes.sh` | Helpers the build scripts load: the signing-team check and the Release Hermes check. |
| `scripts/motion-capture/` | Splits a simulator recording into frames to check an animation frame by frame. |

## More documentation

- [Privacy disclosures and the App Store privacy answers](PRIVACY.md)
- [Design system](DESIGN_SYSTEM.md) and [Settings design system](SETTINGS_DESIGN_SYSTEM.md)
- [Nutrition goal calculations and references](GOALS_METHOD.md)
- [Insights product brief](INSIGHTS_BRIEF.md)
- [Archived features, including the cloud version](../archive/README.md)
