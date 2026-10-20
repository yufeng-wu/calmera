# Native Music/Home-style tabs — 2026-10-18

The iOS tab bar now uses a real UIKit `UITabBarController`, rather than React Native buttons over a glass background. UIKit owns the SF Symbol icons, selected-item lens, highlighting and horizontal drag-to-select interaction. Expo Router / React Navigation still owns Dashboard, History and Settings and their data. The native controller hosts transparent placeholder pages only; it never receives meal data or ChatGPT credentials.

Implementation stays on Expo SDK 53 / React Native 0.79.2. The existing Calmera Expo module exports a separately named `SystemTabs` view. `components/SystemTabBar.jsx` translates its selected index into normal React Navigation `tabPress` and navigation events. Other platforms keep the existing React Navigation bottom bar. The rest of the original app UI is unchanged.

No SDK/package upgrade, new external UI dependency, private UIKit API or custom gesture recognizer was introduced. The system draws the iOS 26 selection effect. Current compiled SDK is Xcode 26 / iOS 26.

## October 19: material clarity and optical edges

The tab bar remains the system UITabBarController with its system selection lens. The overlay now explicitly keeps the tab bar and placeholder controllers translucent/nonopaque, extends their clear content beneath the bar, and avoids a replacement custom bar background. Existing React Navigation ownership, tap dispatch and scroll padding remain.

Add/Close and Photo/Manual/Voice now all use native UIGlassEffect.regular. The previous clear Add material lost its visible boundary on empty white pages. UIKit owns the adaptive optical rim and shadow; there is no extra border/shadow layer. Reduce Transparency uses an opaque secondarySystemBackground fill so the silhouette remains distinct from the white canvas. On iOS 26, native cornerConfiguration.capsule owns the rim, and material/clipping hosts allow it outside the capsule. Earlier iOS keeps the rounded material fallback. Existing spring parameters, equal option widths and anchored Voice return are retained.

Scoped ESLint, all 60 existing mobile tests and the Release simulator build passed. Synthetic text/color rows were inspected behind the actual UIKit controls; blurred text was visible through the tab material. Native center-tab activation selected History and dispatched one event. Add expanded normally and a 2.5 s synthetic Voice hold produced start/end, Processing and an idle Add title. Voice-return diagnostics sampled 25 frames with a 4.73 pt maximum local settling displacement. The last-row check reached offset 1449 with the final row above both floating controls. These checks use local synthetic callbacks, with no microphone, account records, inference or phone operations.

Increase Contrast was enabled for visual inspection of stronger system outlines and then restored to its original disabled value. No screenshot was saved/exported. Free-finger scrubbing was not newly measured; UIKit still owns that gesture.

References: https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass and https://developer.apple.com/documentation/uikit/uitabbar/istranslucent

## Floating-content correction and selected icon

- Today now uses the selected **Meal** SF Symbol (`fork.knife`) in UIKit, with a matching restaurant icon in the non-iOS fallback.
- The native bar host is now an **absolute transparent overlay**; it no longer reserves an opaque rectangular footer that cuts off content.
- Today and History read the actual tab-bar height for bottom padding and scroll-indicator insets. Today offsets Add/Voice controls above that same height. Native layout reports height changes back to React Navigation.
- The UIKit host restricts hit testing to its own bounds and the actual tab bar. Outside the capsule, touch input can reach the underlying page.
- Release simulator build and focused lint passed. Visual check with alternating test rows confirms content extends behind/alongside the native glass instead of disappearing at a solid footer boundary. The user manually swiped and confirmed scrolling; diagnostic offset reached 720 with 89 touch-move events while the bar remained visible. The end-position check reached offset 867, with the entire last row above both Add and the tab bar.

## Validation

- Release iOS simulator build and focused ESLint passed.
- Same native control exercised in a test-build-only interaction screen, without loading account/meal data: selection events and selected indices were confirmed. **Correction:** the earlier automated drag checks do not establish continuous finger scrubbing: the scrolling diagnostic later reported touch starts without move events even when the tab bar was completely removed. Native selection is verified; a true continuous swipe needs a manual simulator/device check.
- Returned to the **actual app's Settings screen**, verified the native bar and selected Settings lens. No personal meal screen inspected. No physical iPhone operations or installation.
- `native-tabs-check` redirects away in normal builds.

The scope is horizontal scrubbing across the tab bar. Vertical page scrolling does not currently minimize this native host, since the existing React Native scroll views remain outside its placeholder pages. Expo Router's ready-made NativeTabs is a supported future migration path if upgrading Expo is desired; it is not available in this installed SDK 53 version.

Official references:
- https://developer.apple.com/documentation/uikit/uitabbarcontroller
- https://developer.apple.com/videos/play/wwdc2025/284/
- https://docs.expo.dev/router/advanced/native-tabs/
- https://expo.dev/changelog/sdk-54


## Add controls

Add and its three options now reuse the existing native `UIGlassEffect` background. Text/icons retain Calmera's warm accent. Photo Log, Quick Add and Voice Log share `ADD_MENU_OPTION_WIDTH = 156`; Voice explicitly uses that width while idle, and its recorder animation starts/resets to the same constant. Only recording changes its width. Simulator on-layout measurements confirmed photo=156, text=156 and voice=156. No audio recording was performed for this visual change.

## Native action-menu revision

The Today date was restored to the original `dateText` style (18 pt, 600 weight, original color and spacing). The 22 pt calmera wordmark is centered.

On iOS, Add now uses the existing Expo module's named `ActionMenu` view. UIKit owns a single `UIGlassContainerEffect` containing four interactive glass surfaces. The surfaces stay mounted, animate their effects/frames together with native spring transitions, and merge/split around the Add control. The plus rotates continuously into a close mark, and the Add title collapses with its native stack layout. Reduce Motion and Reduce Transparency remain honored; earlier iOS versions use system material. No framework/dependency upgrade was required.

Each icon-and-label stack is centered as one group. Simulator metrics at rest: all widths 156 pt; Photo left/right 29/29, Quick Add 28/28, Voice 30/30. The short-tap event and a timed 900 ms mock voice hold were checked: `start end tap`, without opening the microphone. Interrupted close/open toggles and outside-tap dismissal were exercised. Actual audio/inference behavior was not rerun for this UI-only change; the original recording callbacks are retained through native events. Native voice-bubble growth runs in UIKit while recording.

Reference: https://developer.apple.com/documentation/uikit/uiglasscontainereffect

Latest compact sizing: Photo, Manual and Voice now start at 120 × 48 pt (previously 156 × 56). The Add/close control keeps its existing size. Equal-width simulator measurements were 120/120/120, with balanced icon-and-label margins; larger accessibility text can expand the common width to remain readable. Native merging/spring transitions and voice recording expansion remain in place.


## October 19: Add/Close boundary and interruption verification

The current material policy above fixes the bare + Add / X appearance on white. Superseded animation completions no longer settle the title during a newer transition. Voice-return sampling has independent cleanup even when Close interrupts Processing. Content-size updates coalesce after traits settle and measure the rendered UIFont; geometry refresh preserves mounted glass effects. Heights fit font line height plus padding rather than multiplying the entire control footprint. Original default dimensions remain Photo/Manual/Voice 120 × 48 pt, Add 84 × 56 pt, Close 56 × 56 pt.

The test-build-only native-tabs-check screen mounts the production controls with synthetic callbacks. It now provides a genuinely empty white backdrop, a content backdrop, and 20 interrupted open/close cycles (90 ms per state). Diagnostics use public UIView/material state, with Voice padding keys separated from canvas-anchor keys. Timer cleanup prevents a departed fixture from continuing its scripted state changes.

Checks completed in the dedicated iOS 26 Mac simulator:

- Empty white backdrop: collapsed Add capsule and expanded Close circle retained a visible native rim/shadow; all three option silhouettes remained visible. The native tab bar stayed distinguishable. No custom outline was added.
- Repeated 20-cycle stress runs settled to the latest generation with zero missing/non-glass materials or clipped surfaces/hosts. Trigger material assignment remained 1 across ordinary open/close/Voice/font transitions; the material was not recreated per toggle.
- Five-second synthetic Voice hold showed Processing with a native spinner, then restored Add. Closing during Processing also completed normally and retained the Processing feedback until the local mock finished. The final functional run sampled 25 return frames, maximum 4.88 pt local elastic settling, and restored the Add title. A 700 ms early release was also checked (25 samples; maximum 7.46 pt). These are geometry diagnostics, not a frame-rate benchmark or zero-displacement assertion.
- Options over dense colored text retained legibility and native blur. Last-row positioning was reached by the fixture's Check last row control; automation did not establish free-finger scrolling.
- Increase Contrast enabled while expanded produced native stronger outlines; disabled restored the default. No global app/user appearance preference was changed outside this dedicated simulator.
- Accessibility-large displayed complete labels with equal 145 pt option widths. Maximum accessibility size displayed complete labels with equal 198 pt option widths and a 132 × 73 pt collapsed Add. Returning to normal restored equal 120 pt options and an 84 × 56 pt Add without replacing the material. Simulator content size and contrast were restored to their original Large / disabled settings.
- Final Release simulator build succeeded (/tmp/calmera-add-glass-build.log), focused ESLint and git diff --check passed, and all 60 existing JavaScript tests passed (/tmp/calmera-add-glass-tests.log). Only com.yfwu02.mobile.chatgptdev was installed in the simulator.

An independent agent inspected the source and the live settled blank-white expanded state. Review: approved with no blocking issues; the native rim/shadow was clearly visible while remaining restrained, so no heavier border was recommended. The review caught an interrupted diagnostic-cleanup issue, which was corrected before delivery. The primary agent performed the transition and text-size checks.

Scope and limits: no physical iPhone use, personal records/credential inspection, microphone/photo access, real inference, data writes, screenshot export, backend change, or dependency upgrade. Reduce Transparency's opaque fill was source-reviewed; an OS-level Reduce Transparency toggle was not exercised. Some coordinate-based simulator gestures returned noWindowsAvailable, so no new outside-tap or free-finger gesture claim is made. Native shadow opacity remains adaptive to content/interaction; the tests verify visible boundaries and stable material state, not constant pixel opacity.

Official reference: https://developer.apple.com/design/human-interface-guidelines/materials
