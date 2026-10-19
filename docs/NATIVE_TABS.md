# Native Music/Home-style tabs — 2026-10-18

The iOS tab bar now uses a real UIKit `UITabBarController`, rather than React Native buttons over a glass background. UIKit owns the SF Symbol icons, selected-item lens, highlighting and horizontal drag-to-select interaction. Expo Router / React Navigation still owns Dashboard, History and Settings and their data. The native controller hosts transparent placeholder pages only; it never receives meal data or ChatGPT credentials.

Implementation stays on Expo SDK 53 / React Native 0.79.2. The existing Calmera Expo module exports a separately named `SystemTabs` view. `components/SystemTabBar.jsx` translates its selected index into normal React Navigation `tabPress` and navigation events. Other platforms keep the existing React Navigation bottom bar. The rest of the original app UI is unchanged.

No SDK/package upgrade, new external UI dependency, private UIKit API or custom gesture recognizer was introduced. The system draws the iOS 26 selection effect. Current compiled SDK is Xcode 26 / iOS 26.

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
