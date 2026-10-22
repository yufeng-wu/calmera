# Liquid Glass reference review — 2026-10-20

## Reference and diagnosis

The supplied ChatGPT screenshot was taken on iOS 27.0 (confirmed by the user). The original dedicated simulator, `F3584334-39B2-46E4-9E17-3AE2D9945376`, runs iOS 26.0.1 (23A8464), using Xcode 26.0.1.

The reference has a fine shaded edge, bright rim highlights, a nearly white interior with subtle shading, and a restrained shadow. On iOS 26.0.1, both Calmera and a temporary pure-UIKit comparison render Regular glass with a flatter white interior and broader shadow.

The investigation inspected the React button wrapper, shared and navigation theme canvases, the native control configuration, and the scroll-edge host. The wrappers are transparent; there is no extra header material at rest. The fading `systemThinMaterial` backdrop activates while content scrolls beneath the header. Theme canvas animation does not fade the glass's ancestors.

Temporary comparison builds tested default `UIButton.Configuration.glass()`, clearing background/base colors, disabling `UIBackgroundConfiguration`'s additional shadow, the old fixed outline, and standalone `UIGlassEffect(.regular)`. A full-screen UIKit controller reproduced the heavy appearance without React Native wrappers or the header backdrop. Transparent fill overrides did not reproduce the reference and were discarded. All diagnostic code was removed from the final source.

Apple documents that iOS 27 adds a darker edge and brighter specular highlights, plus a user-adjustable Liquid Glass setting. Existing Liquid Glass apps receive these changes when running on iOS 27 without recompilation. This establishes an OS-level difference, but does not prove pixel parity with ChatGPT or identify its exact material settings.

Sources:
- [Platforms State of the Union, WWDC26, design updates around 22:26](https://developer.apple.com/videos/play/wwdc2026/102/)
- [Meet Liquid Glass, WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [UIButton.Configuration.glass](https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct/glass())

## Scoped implementation

Keep `.glass()` for Regular controls and `.prominentGlass()` for accent controls. Remove the fixed 0.5 pt gray navigation outline so UIKit owns the optical rim. Assign `baseBackgroundColor` only for the Tangerine prominent style or the existing opaque fallback; avoid reading and explicitly reassigning the default Regular fill.

No custom glass gradient, blur replacement, shadow, alpha, or press transform is introduced. Header scroll-edge behavior, hit targets, accessibility fallback, typography, all seven themes, navigation scenes, and Add/Voice materials are unchanged. The separate uncommitted OpenAI-logo integration is excluded from this change.

## iOS 26.0.1 validation

- Real Release app built and installed as `com.yfwu02.mobile.chatgptdev` on the dedicated simulator.
- White and Aura inspected at rest; Aura inspected with content under the header. The native material still looks frostier than the iOS 27 reference. This is not a visual-match pass.
- Held Back activation and return to synthetic Settings verified. A timed simulator screenshot was captured during the hold; this is not a frame-rate benchmark.
- `/motion-check`: header bound, overlap 64 pt, backdrop 0 at rest → 1 while scrolled → 0 on return to top.
- Synthetic Voice → Processing → Add layout check passed: 25 return frames, 0 bad samples, 0.00 pt anchor drift, no missing or clipped materials.
- `/background-compare`: actual Today components with invented meals; Add expands to Photo/Manual/Voice and closes again. No meal actions were invoked.
- Existing header-layout and theme-preference tests: 12 passed. `git diff --check` passed.
- No physical-device operations, microphone/camera/inference use, record writes, or account-setting changes were performed. Review theme choices use the isolated review preference.

## iOS 27 validation

With user authorization, installed Xcode 27.1 (27A9275) through the App Store and Apple's iOS 27.0 runtime (24A434). Xcode 26.0.1 is preserved at `/Applications/Xcode-26.0.1.app`. The original simulator remains available and successfully rebooted/launched Calmera after the toolchain update. Only the two explicitly approved regenerable cache locations were cleared for space: `~/Library/Developer/Xcode/DerivedData` and `/tmp/calmera-iphone-compile`.

Created `Calmera Glass iOS 27`, UDID `C619B1C9-8AAE-49F6-A679-73BB47416A5E`, using iPhone 15 Pro Max for the reference's 1290 × 2796 resolution. Installed the **same Release binary** used for iOS 26 testing, without recompiling against the new SDK. Xcode 27 displays simulators in Device Hub.

Direct inspection of `/background-compare` and `/motion-check` on White and Aura confirmed the thin shaded rim, brighter highlights, lightly shaded/translucent-looking center, and restrained shadow that were absent on iOS 26. The code remains on Regular glass; no system Liquid Glass setting was changed. The major visual improvement comes from the iOS 27 renderer, while the source cleanup removes an unnecessary fixed outline and redundant default-fill assignment.

- White and Aura inspected at rest and with content scrolling beneath the header; labels remained readable. Native header status: bound 1, overlap 64 pt, backdrop 0 → 1 → 0 on White.
- Native Back held/released on White; timed actual-simulator screenshot captured during the hold. Activation navigates away. On this fresh signed-out simulator, its gallery destination correctly redirects to sign-in; no sign-in was performed. The original simulator separately verified Theme → Back → synthetic Settings.
- Synthetic Voice → Processing → Add scenario passed on iOS 27: 25 return frames, 0 bad samples, 0.00 pt anchor drift, and no missing or clipped materials.
- Actual Add menu opened on Aura with Photo/Manual/Voice visible. No microphone, camera, inference, or meal action was invoked.
- The authenticated `/ui-gallery` route was not made public to accommodate the new simulator. Top-level synthetic routes allowed verification of the same production components without copying credentials or changing auth guards.

Local evidence is in `/tmp/calmera-glass-review/`: `before-white.png`, `pure-uikit-white.png`, `final-white.png`, `final-aura.png`, `ios27-white-today.png`, `ios27-white-rest.png`, `ios27-white-pressed.png`, `ios27-white-scrolled.png`, `ios27-aura-rest.png`, and `ios27-aura-add.png`. Build and runtime-install logs are in the same directory.

The material is a close qualitative match to the reference's defining optical features on iOS 27. Exact pixel parity with ChatGPT is not claimed: Calmera retains its own symbols, typography, dimensions and layout, and the reference's system transparency setting is unknown. iOS 26 continues to use its older, heavier native rendering. Physical-device performance was not tested.
