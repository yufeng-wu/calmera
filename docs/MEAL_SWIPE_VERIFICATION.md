# Meal-card glass actions

Today and History use the shared FoodEntryItem. The original card typography, emoji, calorie/time layout and nutrition expansion are retained. Edit/Delete appear in a trailing action rail after a left swipe.

## Current reviewed design

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
