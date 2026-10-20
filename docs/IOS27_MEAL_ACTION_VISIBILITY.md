# iOS 27 meal-action visibility — October 20, 2026

The user reported that Edit / Delete sometimes fail to appear on iOS 27. Treat this as a visibility bug, not a request to restyle glass. The report includes complete nonappearance; the concrete variant reproduced during this investigation was loss of the glass surfaces while text and open-row geometry remained.

## Reproduction and isolation

Used only the full-test /meal-swipe-check route with its fictional meals, and its ?motion=1 controlled native comparison. On iOS 27, normal reveal initially exposed both actions. After repeated Edit/reopen cycles and handoff through Banana → Matcha → Rice Bowl → Matcha, the actual FoodEntryItem showed bare Edit / Delete text without the glass capsules. AX still exposed both buttons; the fixture reported open, progress 1 and approximately 72 × 71 pt. This demonstrates why accessible buttons and a successful native-glass flag alone cannot establish a visual pass.

The same native renderer had visible rims in the isolated controlled-progress comparison outside ReanimatedSwipeable. A first candidate kept the material effect assigned instead of scrubbing nil→Regular with a paused UIViewPropertyAnimator. That change alone did **not** solve the disappearing surfaces inside the swipe row; it was not reported as a successful fix.

Installed react-native-gesture-handler's ReanimatedSwipeable wraps right actions in an Animated.View that switches opacity between 0 and 1 and applies overflow: hidden. Its reset() implementation also clears left progress and card translation without explicitly clearing right progress. No dependency code was patched. Apple warns that changing a UIVisualEffectView ancestor's alpha can cause effects not to render; this supports the compositing diagnosis but does not independently prove the exact iOS 27 rendering internals.

Reference: [Apple UIVisualEffectView documentation](https://developer.apple.com/documentation/uikit/uivisualeffectview/).

## Final change

For iOS, the library's right-action subtree now reserves only the original rail width. Actual native glass lives in an absolute sibling outside the library's opacity/cropping subtree. Its original 40 pt material canvas, full-card height, Edit/Delete widths, 12 pt card gap, 8 pt button gap, fonts, colors, labels, native Regular glass and native shadows are retained.

A UI-thread reaction derives the reveal from the card's actual translation divided by the same rail width. This keeps droplet geometry attached to the card and avoids relying on a separate right-progress value after resets. Existing card spring parameters, gesture thresholds, overshoot, long press, edit/delete callbacks, one-open-row coordination and details animation are unchanged. Reset/focus cleanup explicitly clears the sibling's reveal. Only the existing label fade remains; no material/ancestor alpha animation or custom shadow was introduced.

Regular materials remain assigned while their geometry grows/shrinks to zero. Reduce Transparency still uses the existing opaque fallback and other platforms keep the original in-rail rendering. Native diagnostics now expose effect-assignment and on-window visible-view counts only when the existing test callback opts in. These counts describe view state, not pixel-rendering guarantees.

## Verification

The same final Release binary was installed in the dedicated iOS 27 and iOS 26 test simulators, bundle com.yfwu02.mobile.chatgptdev.

On iOS 27:
- First reveal showed complete capsules/rims, approximately 72 × 71 pt, 14 pt labels, zero icons; open assignment/visible counts 2/2.
- Six consecutive native Edit clicks and reopen actions retained both accessible controls; settled live in-memory views retained both glass surfaces.
- Banana → Matcha → Rice Bowl → Matcha handoffs exposed exactly two accessible actions, with complete surfaces still visible afterward. This sequence had exposed bare labels before the fix.
- Native Delete opened the explicitly synthetic confirmation; Cancel returned to closed, progress 0, assigned 2 / visible 0, with no ghost surfaces or record mutation.
- Actual mouse-drag left swipe opened the first card with the corrected surfaces and hit targets.
- A vertical-drag start closed open actions. Dragging in the non-card synthetic scroll area moved the list to its bottom; status-bar tap returned to the top. A vertical drag starting on a card did not visibly advance the list in this tool, both before and after this candidate; this is unresolved gesture/tool behavior, not a claimed card-origin scrolling pass.
- Home → same safe route retained the open row, action controls and visible glass surfaces.
- Navigating through /motion-check and back reopened the fixture closed; the next reveal again displayed both full surfaces. This reopened fixture was a fresh instance, so it is not a claim of a retained-instance focus test.

On iOS 26.0.1:
- Opened both full-height glass actions and checked the settled appearance.
- Two native Edit/reopen cycles retained both actions and effect counts 2/2; the older OS's native frosted appearance remains intentional.

Validation: scoped ESLint (/tmp/foodwrap-ios27-meal-overlay-lint.log), whitespace checks and final Release build (/tmp/foodwrap-ios27-meal-overlay-build.log) pass. Existing JavaScript suite: 272/272 (/tmp/foodwrap-ios27-meal-actions-tests.log). No mirror tests were added for UIKit pixel rendering. The last source adjustment after the build changes comments only.

## Remaining limits

The user's complete loss of text **and** buttons was not separately reproduced. The fix removes both the problematic material ancestry and dependence on the swipe library's independently animated right-progress value, but universal elimination of an intermittent report is not proven by this test sample. Physical-device frame pacing, long-duration stress, retained-screen focus, all seven theme combinations, live Reduce Transparency/Reduce Motion and VoiceOver audio were not exercised in this pass.

No real microphone/camera/inference, meal/goal/account/backend write, physical iPhone operation or screenshot save/export was performed. All interaction tests used known synthetic routes. An early simulator-selection refresh unexpectedly exposed the user's real Today AX tree; it was not used as test data, transcribed into this document or operated. Further checks stayed on synthetic routes. Separate OpenAI-logo edits/assets remain excluded from the scoped commit.

If the complete-disappearance variant persists, use [the targeted Astra handoff prompt](ASTRA_MEAL_ACTION_VISIBILITY_PROMPT.md).
