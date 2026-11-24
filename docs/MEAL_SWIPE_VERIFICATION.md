# Meal-card glass actions

Today and History use the shared FoodEntryItem. The original card typography, emoji, calorie/time layout and nutrition expansion are retained. Edit/Delete appear in a trailing action rail after a left swipe.

## Follow-up: continuous material and merging during swipe

The installed Gesture Handler 2.24 Swipeable toggles its right-action ancestor opacity between zero and one. Fixed-size native glass therefore appeared with a full shadow as soon as a drag began. MealSwipeActions now consumes Swipeable's actual shared progress via Reanimated animated native props. No per-frame React state is used in the production reveal.

The iOS implementation uses two UIGlassEffect views inside one UIGlassContainerEffect. Their size and separation grow continuously from one right-edge seed; separation grows more slowly, retaining overlap until near the open position. A paused UIViewPropertyAnimator scrubs each material's effect between nil and glass. Only label content fades. The glass, its shadow and compositing ancestors retain full alpha within the native host. At zero progress the shape, material and shadow converge to zero before Swipeable's hidden state takes effect. Existing swipe threshold, Edit/Delete routing, delete confirmation, Tangerine accent and final full-height button layout remain. The previous shadow canvas and shadow-only hit-test exclusion remain. Memoized row/action components avoid unrelated React render updates during the gesture.

Validation: scoped ESLint and all 60 mobile Node tests pass; Release iOS simulator build passes. The native progress fixture showed a joined shape at progress0.5 (36pt element width), two complete actions at progress1 (72pt width), and no shape/shadow at progress0. The real food-card fixture observed10 distinct intermediate native progress samples on opening and20 across opening/closing; open settled at1 and closed at0. Native Edit callback was verified during implementation; final Delete opened its confirmation and Cancel retained all synthetic entries. At accessibility-large, controls were155pt wide, matched the wrapped row's174.3pt height and displayed complete25pt labels. Original text size `large` was restored.

The full-test-only `meal-swipe-check?motion=1` page pauses the actual native action component at controlled progress, without records or network calls. The regular fixture uses the actual FoodEntryItem. Direct computer drag input was attempted but registered as a tap, so pointer swipe physics and frame-rate performance are not claimed as measured; reveal/close were exercised through the existing accessibility action and native controls. No personal data was read, no screenshots exported and no physical iPhone operated.

References: [Apple UIKit Liquid Glass material and container example](https://developer.apple.com/videos/play/wwdc2025/284/), [Gesture Handler Swipeable progress](https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated_swipeable/), and installed Reanimated3/Expo53 sources for native animated props.

## Follow-up: clipped glass shadow

A grouped meal card exposed a rectangular cutoff below the native glass controls. The native host now includes a real 40 pt compositing inset on each side, with buttons inset inside that canvas. Swipeable reserves the matching effect area, while the gesture rail width, 12 pt card-to-control gap, 70 pt collapsed button height and text-only appearance stay unchanged. Only button frames participate in native hit testing; the transparent inset cannot intercept neighboring-row taps.

The Release simulator build and scoped ESLint passed. Live checks in the synthetic meal fixture confirmed 72 × 70 pt native glass controls and no symbols. The actual History component's local-only preview confirmed a naturally fading shadow at the Breakfast/Lunch group boundary; native Edit still invoked the preview callback and dismissed the rail. No real records or physical device were accessed.

## October 19 update: full-height text actions

This update supersedes the older fixed 60 × 52 pt, icon-and-label specification below. Edit / Delete now use text only (14 pt medium at standard size), equal widths and the card's actual full height, with 28 pt continuous rounded corners. The rail's vertical margins remove only the existing 20 pt effect-bleed inset. UIKit native glass, swipe thresholds, edit callbacks and delete confirmation remain.

Food details remain mounted and measured; one 260 ms Reanimated progress drives height, opacity and chevron rotation. This replaces the competing LayoutAnimation, row layout spring and mount/unmount fades. Rapid toggles reverse from the current progress; Reduce Motion uses zero duration. Existing typography and accent colors stay unchanged.

Release simulator build passed after regenerating locked Pods metadata for the renamed mobile checkout. Scoped ESLint and all 60 mobile Node tests passed. Live synthetic-component checks showed 72 × 70 pt native controls at standard size, symbol size 0, native glass enabled; expanding the first row changed its measured height to about 99.3 pt. Edit invoked its callback, Delete requested confirmation, and Cancel preserved all synthetic entries. Repeated taps returned to the collapsed state.

At accessibility-large, after reopening the fixture to refresh React Native text measurement, controls were 155 pt wide and matched the naturally wrapped card height (about 174.3 pt); labels were 25 pt and complete. Original content size `large` was restored. The actual History component was visually checked using its local-only preview: white canvas, no History heading, month/year accessible heading preserved, expansion and surrounding layout intact. Native actions were exposed via the existing accessibility action; direct pointer swipe physics and frame-rate performance were not separately benchmarked. No screenshots were saved/exported, personal meals read, account records changed, or physical iPhone operated.

## Earlier reviewed design

- The iOS controls are real UIButton instances with UIButton.Configuration.glass() on iOS 26, inside a clear native host. UIKit owns the glass background and press feedback. Native UIImageView/UILabel content supplies SF Symbols pencil/trash, exact symbol sizing, medium labels and matching semantic foreground colors.
- Standard size: equal 60 × 52 pt controls, 19 pt symbols, 12 pt medium labels, 8 pt between controls and 12 pt from the translated card. Edit retains Calmera brown; Delete uses UIColor.systemRed. Labels remain explicit.
- Removed per-button parent opacity animation, staggered movement, nonuniform scaling and text stretch. The existing Gesture Handler/Reanimated row retains direct tracking (friction 1), its user-verified 22 pt opening threshold and resistance beyond the rail. Settlement damping increased from 27 to 34 for a restrained response. Spring configuration remains stable between ordinary renders.
- The swipe wrapper reserves 20 pt of effect bleed space with compensating negative margins, preserving the visible card size and row spacing. Native controls offset back to the original card edge. This prevents rounded native shadows from being visibly cut into a rectangular tray. Shadow-only gutter areas use box-none hit testing.
- One row remains open at a time. Tab changes reset controls; beginning list scrolling closes the active row. Long press and VoiceOver actions remain available. Full swipes never invoke deletion. Existing edit routing and delete confirmation are retained.
- Dynamic Type uses UIFontMetrics and uncapped native labels. Control width/height grow with text size, with width constrained to the screen. A text-size/width change closes the old offset so the next reveal measures the new rail. The original 1.5 label-scaling cap was removed.
- Reduce Motion changes are observed: extra row overshoot is disabled, system/reduced-motion spring settings are used, and layout transforms are suppressed. Reduce Transparency selects an opaque native button configuration; system contrast changes update the native controls. Android retains a straightforward labeled-control fallback. No new dependency or Expo SDK upgrade.

## Verification

- Scoped project ESLint: no errors; History retains its pre-existing unused getStartOfWeek warning. Release simulator build passed and was installed as the separate Calmera Test app, preserving application data and original apps.
- `/meal-swipe-check` is a full-test-build-only route using the actual shared card component with fixed synthetic fixtures and local action callbacks. Diagnostic text stays fixed-size to leave room for inspecting the real card's accessibility controls. It loads no profile or meal history and calls no database API.
- Live standard-size inspection: 60 × 52 pt, label size 12, symbol size 19, native glass enabled. Both labels are fully displayed; SF Symbol and label colors match; shadows have no visible rectangular clipping footprint. Closed card layout remains unchanged.
- Native Edit activation invoked the Edit callback and closed the row. Native Delete activation opened the existing confirmation; cancelling preserved all cards and recorded Delete cancelled. No database mutation occurred.
- Actual simulator settings were changed to accessibility-large and Increase Contrast enabled. Live metrics: controls 129 × 112 pt, labels 24 pt, symbols approximately 34.67 pt. The labels were complete and readable, with system high-contrast outlines. This checks 200% enlargement of the 12 pt labels.
- Simulator settings were restored to their original values (content_size large; increase_contrast disabled). Live metrics returned to 60 × 52 pt, label 12, symbol 19, and the exposed row reset closed.
- The user had already manually confirmed that the 22 pt version latches open after a left drag and Edit/Delete can be tapped. That threshold is retained. In this reviewed revision, automated coordinate input returned noWindowsAvailable; reveal and native-button callbacks were verified through accessibility actions. Direct pointer dragging was not rerun successfully through automation.
- Reduce Motion/Reduce Transparency adaptations are implemented using system APIs; those OS toggles were not exercised in this revision. Normal text, accessibility-large text and Increase Contrast were exercised.
- No physical iPhone operations, real-meal/goal reads, database writes/deletions, credential changes or backend deployment. Screenshots were inspected live without saving or exporting files.

## References

- Native glass button: https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct/glass()
- Apple's effect-alpha guidance: https://developer.apple.com/documentation/uikit/uivisualeffectview
- Buttons and hit regions: https://developer.apple.com/design/human-interface-guidelines/buttons
- Installed Gesture Handler 2.24 source was used for its 2.x prop names and system Reduce Motion behavior; current online docs target 3.x.
