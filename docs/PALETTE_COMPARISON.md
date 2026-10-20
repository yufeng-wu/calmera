# Palette comparison

The user requested a Sweetgreen-inspired alternative to the existing Tangerine palette, with both versions shown before choosing. This is a local comparison, not an app-wide palette selection.

## Decision — keep Tangerine

The user chose to keep Tangerine as the main app palette, then requested only a darker Sweetgreen-inspired calorie-progress indicator. The brand accent remains #BC5A19. The normal calorie ring now uses the independently defined #355C45 herb green; the over-goal red state, other macro ring colors, calendar status dots, saved backgrounds and all typography/layout remain unchanged. The green/off-white proposals stay available only in the isolated review route and are not applied globally. Scoped lint and the Release build passed (/tmp/foodwrap-calorie-progress-lint.log and /tmp/foodwrap-calorie-progress-build.log); the updated app was installed in the iOS 27 test simulator. The final live pixel check was unavailable because ScreenCaptureKit returned SCStreamErrorDomain -3811, so no visual-verification claim is made for this last color-only change.

## Current comparison revision — Green & Ivory

After reviewing the first comparison, the user asked for green as the main color with an off-white background. The green proposal is now **Green & Ivory**: accent #355C45, neutral ivory canvas #FCFBF7, white cards #FFFFFF, border #E3E5DE and restrained sage highlight #EBF0E1. The original green-washed Basil & Oat study is preserved in commit bb5a597; it is no longer the current second button.

The visible choices are Tangerine / Green & Ivory. The internal preview ID remains basil, so all native green tint handling and interactions are unchanged. This is still a local comparison, not an applied global palette or saved preference.

The refined screen was built and shown live on iOS 27. Native AX reported Green & Ivory selected, and the in-memory view confirmed neutral off-white behind white cards with green wordmark, amounts, Add and Today accents. Typography, layout and data were unchanged. Scoped lint, whitespace checks and Release build passed (/tmp/foodwrap-green-ivory-lint.log and /tmp/foodwrap-green-ivory-build.log). Only palette constants changed; no redundant full-suite rerun was added. No screenshot was saved/exported or real preference changed.

## Original proposals

| Token | Tangerine | Basil & Oat |
| --- | --- | --- |
| Accent | #BC5A19 | #355C45 |
| Canvas | #FFFBF9 | #F5F6EC |
| Main text | #4A3428 | #263A2D |
| Secondary text | #9A8478 | #63705E |
| Card | #FFFFFF | #FEFFFA |
| Soft highlight | #F5F5F5 | #E7EDCF |

Basil & Oat uses our own herb-green/oat/sage combination. [Sweetgreen's official site](https://www.sweetgreen.com/) was used as a directional reference; no brand artwork, typography or exact color specification was copied. Numeric proposal values above are original design choices, not Sweetgreen brand tokens.

## Review screen

Full-test app only: `calmera-chatgpt-dev:///palette-compare`, optionally `?variant=basil` for initial selection. The two radio choices switch local presentation immediately. Example meal data, goals, typography, layout, spring parameters and native Regular glass/shadows remain the same across both variants.

This route reuses the actual NutritionSummaryCard, FoodEntryItem, AddMealMenu and native SystemTabs components. Optional palette overrides default to the existing presentation everywhere else. Native opt-in tint handling is limited to the separate test bundle. Normal tabs explicitly use Tangerine. The comparison changes the wordmark, text/amounts, background, card borders/badges, native Add menu, selected Today tint and Edit accent; semantic red Delete and existing macro ring colors remain stable.

No saved appearance/palette preference is written. The original global COLORS and all seven saved background definitions are unchanged. Review routing uses the established isolated appearance scope; its canvas is fully covered by the selected comparison background. Mock meal actions show a local preview explanation. Voice long press/release are no-ops, never recorder access. Tab chrome is display-only, as in the existing background comparison route.

## Evidence

- Final native Release build passed: /tmp/foodwrap-palette-compare-final-build.log.
- Scoped ESLint and whitespace checks passed: /tmp/foodwrap-palette-compare-final-lint.log.
- Existing JavaScript suite passed 272/272: /tmp/foodwrap-palette-compare-tests.log. No tests were added just to mirror this reversible color study.
- On the dedicated iOS 27 simulator, both radio choices rendered the same complete Today layout and sample totals. Switched Tangerine → Basil & Oat through the actual native app and inspected both live.
- Basil's Add button, selected Today tab, and Photo/Manual/Voice menu labels/icons all rendered green with the existing native glass. The synthetic Greek Yogurt row exposed green Edit and red Delete, with both glass surfaces visible.
- In-memory phone-sized views of both variants were shown in the conversation. No screenshots were saved/exported.
- The main app is not switched to a new palette until the user chooses. Final preview build additionally makes the ordinary tab tint explicit; the comparison visuals are otherwise unchanged from the inspected build.

Calculated text contrast on the proposed oat canvas (#F5F6EC): accent 6.96:1, main text 11.17:1, secondary text 4.81:1. These are static token calculations, not a full accessibility audit of adaptive glass over every background.

No real meal/goal/account/backend write, microphone/camera/inference, credential/personal-record inspection, physical iPhone operation or Live AI work was performed. iOS 26, VoiceOver audio, accessibility text-size changes and all saved background combinations were not part of this color-choice review. Separate dirty OpenAI-logo edits/assets remain preserved and excluded from the scoped commit.
