# Calmera interface update — 2026-10-18

> Superseded: the user rejected all three palette directions and requested the original UI. Original colors, card/form styles, header arrangement, settings title and full-width bottom navigation have been restored. The user subsequently requested native Liquid Glass on the bottom bar only. A subsequent request for Music/Home-style dragging replaced the iOS bar with a genuine UIKit tab control connected to existing Expo routes; see NATIVE_TABS.md. The rest of the original UI remains restored. No framework upgrade or new dependency was needed. The temporary Add-menu fix, Live removal, local food icons and all ChatGPT/database functionality are retained. Concept posters remain as design archives only. The test-only design-preview route now mirrors the restored layout using synthetic data.

The following describes the earlier experiment, not the current selected design.

Scope: original Expo app, existing authentication, inference and meal persistence unchanged. Physical iPhone use/installation is paused at the user's request. All visual checks use the dedicated Mac simulator and synthetic preview.

## Design decisions

Apple recommends Liquid Glass for the navigation/control layer, with ordinary content surfaces beneath it. Calmera keeps a restrained warm palette and opaque meal/nutrition/form cards, with native regular glass on the tab bar, ChatGPT header action and Add controls. Existing Expo SDK 53 is retained. The existing local Expo module now hosts a decorative `UIVisualEffectView` using `UIGlassEffect(style: .regular)` on iOS 26+. Earlier iOS versions use system material; Reduce Transparency uses an opaque system surface. Android/web use an opaque fallback. This is custom React Native navigation backed by Apple's native material, not UIKit's system tab-bar implementation.

References:
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/documentation/uikit/uiglasseffect
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- https://developer.apple.com/design/human-interface-guidelines/tab-bars
- https://developer.apple.com/design/human-interface-guidelines/accessibility

## Interaction

- Removed Live Coming Soon from Dashboard's Add menu and Settings.
- Add now presents a shared temporary menu: Photo Log, Quick Add, Voice Log.
- Options use one positioning/animation system, avoiding the previous independently animated Photo option.
- Outside tap, close, selecting an input and leaving Dashboard dismiss the menu. Hidden actions do not accept touches or accessibility focus.
- Original press-and-hold voice callbacks, local transcription, ChatGPT estimation and database save are retained.
- Add-menu transition respects Reduce Motion. Glass responds to Reduce Transparency at runtime.

## Food icons

`lib/foodIcons.mjs` is the local, versioned icon catalog: 73 curated food/drink records with English and simplified/traditional Chinese aliases. Named dishes take precedence over ingredient names, with English word boundaries and a neutral unknown-food fallback. Both Dashboard and History use the same FoodEntryItem matcher. No remote image requests, model calls, new user permissions or database columns are needed. Icons update from the displayed meal name, including after editing it. Emoji artwork is rendered by the platform.

## Safe preview

`calmera-chatgpt-dev:///design-preview` is available only when `calmeraFullAppTest` is true. It renders synthetic banana/avocado-toast entries and fixed totals without requesting meal history or user goals. The preview voice action does not open the microphone. Normal builds redirect away from this route.

## Validation

- 27 synthetic JavaScript tests passed (22 existing ChatGPT/persistence/ASR checks, 5 catalog checks).
- Focused lint passed with no errors; Dashboard retains existing hook/import warnings.
- iOS 26 Release simulator build passed, including the new native glass view.
- Live synthetic simulator preview verified: no Photo option while closed; Add shows exactly Photo/Quick/Voice; outside tap dismisses all three; Photo opens the empty Photo Log screen; Back returns with the menu closed; banana/toast icons and native refraction render correctly.
- Secondary review corrected animated values on a non-animated view, large-text menu spacing, navigation-away recording cleanup and preview edit-action isolation.
- Large accessibility text checked in the synthetic simulator preview: menu rows grow and wrap without overlap. Restored simulator text size to its original `large` setting. Decorative food emoji retain a fixed size to fit their icon well.
- Actual live recording with the updated UI and iOS 27 rendering are not retested in this turn. The user reported that hold-to-record worked before these visual changes.
- No physical iPhone operations or account/database changes performed for this UI update.
