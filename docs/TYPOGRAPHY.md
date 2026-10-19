# Calmera typography

The user-tuned Today, History and original Settings typography is the reference. Use the platform system font (SF on iOS), keeping system text scaling enabled. New pages use constants/typography.js instead of unrelated per-screen sizes.

| Role | Base size / weight | Purpose |
|---|---|---|
| Brand | 22 / 600 | Existing calmera wordmark; retain the home implementation |
| Authentication title | 22 / 600 | Compact welcome/account headings, replacing 30/700 |
| Page title | 18 / 600 | Navigation and page headings, aligned with the home date/month hierarchy |
| Section title | 16 / 600 | Grouped form/card sections, aligned with home meal groups |
| Body / action | 14 / 400–600 | Prose, rows and buttons; medium for labels, semibold for actions |
| Caption | 12 / 400–600 | Supporting text, units and section eyebrows |
| Input value | 16 / 400 | Editable form values |
| Important value | 18 / 600 | Goal/estimated numeric values, with tabular digits |
| OTP / native wheel | 22 | Code entry and platform picker controls |

Sizes are logical points, not screenshot pixels. Text scales with the user's system settings. Native form buttons use UIFontMetrics.subheadline at 14pt, matching the already approved Add controls. No custom typeface or fixed global font-scale override is introduced.

## Protected home design

Today, History, home.styles, NutritionSummaryCard, FoodEntryItem, SystemTabBar and AddMealMenu are unchanged by this typography pass. Existing home metrics, timestamps, icons and native tab/Add/swipe/context-menu animation implementations remain untouched. Their deliberate numeric hierarchy is not globally rewritten.

Settings' title and row text are restored to the original 18/600 and 14/500 after the prior UI refresh increased them to 20/600 and 16/500. The added supporting row text follows the 12pt caption role. Existing glass/grouped layout is retained.

## Implementation and review

All new authentication, ChatGPT, photo, manual/edit, survey, goals, welcome, calibration, guide chrome and fallback text uses the shared role definitions. Tutorial images retain their original embedded artwork. Normal font sizes remain compact; large text retains the previously implemented wrapping, scrolling and remeasurement behavior. Changes are typography only: no account, inference, database, navigation or gesture behavior is altered.


## Verification — 2026-10-19

- Scoped ESLint passed for all changed typography consumers.
- Release iOS 26 simulator build passed: /tmp/calmera-typography-build.log.
- Live synthetic review confirmed original Settings 18/14 sizing, the smaller 22pt auth heading, matched ChatGPT section/row/button/caption hierarchy, and the survey's 18/16/14/12 hierarchy.
- The survey was enlarged live to accessibility-large: headings, body text and native glass labels reflowed without clipping. Simulator text size was restored to its original Large setting.
- Hash comparisons confirmed seven protected Today/History/home-component files and the existing native tab/Add/swipe/context-menu implementation ranges were byte-for-byte unchanged. Settings is the intentional restoration exception described above.
- This was a typography-only check; no business-flow retesting or new tests mirroring style constants were added. No physical iPhone, account/record mutation, credential inspection, screenshot export or Git history change.
