# Nutrition summary long-press menu

The shared NutritionSummaryCard used by Today and History no longer has a top-right edit icon. Its nutrition typography, rings, spacing and card styling remain in place. Long-pressing the card presents one action, “Edit goals,” which opens the existing `/update-goals` route.

## Implementation

- Added a named `GoalsMenu` view to the existing Calmera Expo native module. A UIContextMenuInteraction attaches to the actual React card view, so UIKit owns its lift, preview, menu material and dismissal animations. The bridge stores no nutrition data. UIKit uses a transient in-memory card preview; no image is serialized, saved or exported.
- The existing card is the preview source, with its original rounded outline. Its rich preview uses a transient UIKit view snapshot, never an exported image. The edit event is dispatched once after menu dismissal; cancelling invokes no action.
- VoiceOver reads the nutrition values and exposes an Edit goals custom action. Android uses its standard long-press action dialog. No new dependency or Expo upgrade.
- Fixed the existing goal editor's `isFetching` declaration ordering: an effect dependency previously referenced that const before initialization. The goals API and save behavior were preserved.

## Verification

- Scoped project ESLint: no errors; update-goals retains its existing getToken effect-dependency warning.
- Release simulator build passed and was installed as the separate Calmera Test app, preserving application data and the original apps.
- A test-only `/summary-menu-check` route uses the actual shared summary component with fixed synthetic nutrition values and a selection counter; it does not load profile/meal history or call the database.
- Initial live native-menu check: the edit icon is absent, a 900 ms hold exposes Edit goals, selection dismisses the menu and increments the callback counter exactly once.
- Live cancellation check: dismissing the native menu retained selection count 0 and the unchanged synthetic summary. Final rich card-preview build passed and was installed; a 900 ms hold showed the complete, sharp summary card above the system backdrop with its Edit goals menu. Selecting the final menu dismissed it and produced exactly one callback (counter 1).
- No physical iPhone operations, real-goal modifications, database writes/deletions, credentials reads or backend deployment were performed.

Reference: https://developer.apple.com/documentation/uikit/adding-context-menus-in-your-app

## Dismissal color flash follow-up

Reproduced the user's report in the synthetic-only shared summary component: immediately after cancellation the card appeared cream like the page, then returned to white after the native transition. The rich preview controller had a white background while the targeted highlight/dismissal preview explicitly used `.clear`.

The shared targeted-preview factory now uses `.white`, matching both the rich preview and the React card, and reads the same stable `menuHost` used by the interaction. No temporary tint or additional delayed animation was added.

The Release simulator build passed and was installed. A physical click on blank space and a second cancellation through the native Dismiss context menu control were inspected in the same early-frame capture sequence that exposed the original issue. Both now showed a white card immediately after cancellation, and the settled card remained white. The selection counter stayed at 0 across both cancellations. Only synthetic values were observed, no screenshots were saved/exported, no database or real-goal changes were performed, and the physical iPhone was not used.

Apple preview-background reference: https://developer.apple.com/documentation/uikit/uipreviewparameters

## Native animation and size decision

A content-sized UIEditMenuInteraction experiment made the bubble smaller but changed the existing rich preview/backdrop behavior and omitted the visible slider icon. The user explicitly requested that all prior animations and the icon remain, then chose “completely retain the native animation and icon; restore the original size for now” after the public UIKit sizing limitation was explained.

The experiment has been fully removed from the active implementation. UIContextMenuInteraction, the original rich card preview, dimmed/blurred backdrop, slider.horizontal.3 icon, system menu typography and original system size are restored. The white targeted-dismissal background fix is retained. The reviewed meal-row Edit/Delete design is unchanged.

The Release simulator build passed and was installed. A 900 ms hold on the synthetic shared summary showed the restored rich preview and icon. Cancellation was inspected immediately: the card stayed white and the selection count stayed at 0. The simulator was then returned to actual Today without inspecting its records. The physical iPhone was not operated.
