# Calmera for iPhone

Calmera stores the journal on the iPhone. Every new meal starts with an AI estimate through the person’s ChatGPT plan, OpenAI API key or Anthropic API key. The person reviews and saves the result. Development requires no Calmera account, server or project API key.

## Run locally

From the repository root on macOS, install Node.js 22, CocoaPods 1.16 and Xcode. The first release uses Xcode 26.0.1 and the checked-in CocoaPods workspace.

```sh
npm ci
(cd ios && pod install --deployment)
open ios/mobile.xcworkspace
```

In Xcode, select the **mobile** scheme and an iPhone simulator, then Run. For a Debug build, run `npm start` in the repository root to serve JavaScript. A Release build embeds the JavaScript bundle. The custom native photo picker and ChatGPT sign-in require the native app.

## Verify changes

```sh
node --test tests/*.test.mjs
```

The automated suite uses synthetic inputs. For a live smoke test, connect a dedicated test provider in Settings → AI connection, analyze a sample meal, review and save it, then relaunch and check History. Photo Log sends the selected photo when you request an estimate. Voice Log transcribes on the iPhone before you send the transcript.

## Archive the first release

1. Use the checked-in `ios/mobile.xcworkspace`, the **mobile** scheme and a generic iOS device destination. Leave `CALMERA_FULL_APP_TEST` and custom `ENTRY_FILE` overrides unset.
2. Choose **Product → Archive**. The scheme archives the Release configuration. Confirm the bundle identifier is `com.yfwu02.calmera` and the intended version and build number are available in App Store Connect.
3. In Organizer, inspect the archive’s privacy report and use **Validate App** with the distribution team. Verify the archive contains the app’s `PrivacyInfo.xcprivacy`, `main.jsbundle` and Release Hermes before distributing. If CocoaPods has just refreshed Hermes over an earlier Release build, run the repository’s `forget_hermes_configuration` helper before archiving and check the result with `require_release_hermes` from `scripts/release-hermes.sh`.

The EAS profiles upload source using `.easignore`, which excludes `ios/` and regenerates a native project. The first-release instructions above build the checked-in native project.

## More documentation

- [Privacy disclosures and the App Store privacy answers](PRIVACY.md)
- [Design system](DESIGN_SYSTEM.md)
- [Nutrition goal calculations and references](GOALS_METHOD.md)
- [Archived features, including the cloud version](../archive/README.md)
