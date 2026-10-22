# Native glass material comparison — 2026-10-19

The separate full-app test build offers Settings → Theme → Compare glass materials (`/glass-compare`). Production controls keep their existing material and animation. No new production appearance preference is introduced.

## What is compared

All samples are real UIKit controls in the Expo app, with the same 14 pt semibold Add label, SF Symbol, capsule geometry and Tangerine foreground:

- Regular Liquid Glass (`UIGlassEffect.regular`).
- Tinted Regular: the same effect with `tintColor` set to Tangerine at 10% alpha.
- Clear Liquid Glass (`UIGlassEffect.clear`).
- Apple system Ultra Thin, Thin and Standard blur materials (`UIBlurEffect`). These are classic blur materials rather than Liquid Glass.

Each has three shadow treatments. Native only adds no CALayer shadow, retaining any shadow provided by the system effect. Soft adds a fixed 7% black shadow with a 10 pt radius and a 3 pt downward offset. Lifted adds 14% black, 18 pt radius, and 7 pt offset. These extra shadows are app-defined comparison values, not named Apple presets.

The test page switches between all four saved background designs and can place invented colored shapes/text behind the samples. Its background choices use the isolated review theme key. It cannot access records, inference, microphone, photos or account credentials. Native press feedback comes from interactive UIGlassEffect; tap diagnostics report the public material family and sample size only. No screenshots are written to disk.

## Recommendation

1. **Regular + native-only shadow:** best overall. In the simulator it preserves a light, consistent navigation/control layer across the pastel backgrounds. Let the system adapt the material and shadow to underlying content.
2. **Lightly Tangerine-tinted Regular + native-only shadow:** second choice for the primary Add action. The warmer body adds emphasis without a dark fixed shadow. Keep other navigation controls neutral; avoid tinting every control.

The extra Soft shadow looked heavier than the native-only version; Lifted was especially heavy. Clear showed background lettering competing with the label in the detail test. Classic blur lacks Liquid Glass lensing and interaction, so it is a fallback rather than a preferred iOS 26 treatment.

Apple's guidance supports Regular for general controls, reserves Clear for suitable media contexts, and uses tint selectively for emphasis. See [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) and [UIGlassEffect](https://developer.apple.com/documentation/uikit/uiglasseffect).

## Verification

- All 67 JavaScript tests and scoped ESLint passed; git diff --check passed.
- Final Release iOS 26 simulator build succeeded. Log: `/tmp/calmera-materials-build.log`.
- Live native taps verified all six public material families and all three shadow treatments on Regular; callbacks reported 48 pt samples at the original Large text size.
- Both material families and all four comparison background selections worked. Theme-only and synthetic detail appearances were inspected live.
- Accessibility-large inspection found text measurement clipping during size changes. Remounting the comparison ScrollView for font-scale changes fixed the layout; the final accessibility-large view showed complete wrapping and one-column samples. Original simulator text size was restored to Large.
- Theme's comparison link and Back navigation were exercised in isolated UI review mode.
- Automation's scroll/drag operation was unavailable, so no claim is made about a completed manual scroll check. Family selection exposes all six materials without needing to scroll at the original text size.
- No physical iPhone, personal records, authentication changes, or backend changes. This is a simulator visual comparison, not a frame-rate benchmark or a physical-device accessibility audit.

## Final selected production treatment

The user selected Regular Liquid Glass with Apple's native shadow for all floating controls, including Add. The provisional additional Soft shadow for Add was removed. Production Add/Close, Photo/Manual/Voice, form controls, meal actions and the native tab bar continue using their existing native system material/shadow. No extra fixed shadow, material tint, layer, or animation change is applied to the iOS Add control. Content-card styling and typography are unchanged.

The material comparison remains available only in the full-app test build. Its Soft/Lifted samples are independent demonstrations and do not configure production controls.

Final verification: the Release build in `/tmp/calmera-default-glass-build.log` succeeded. The simulator was updated, and the actual Today components with invented meals showed the native Add capsule; opening exposed Photo/Manual/Voice, and closing restored the full Add label. The provisional custom-shadow class and its diagnostic code are absent. The physical iPhone was not used.
