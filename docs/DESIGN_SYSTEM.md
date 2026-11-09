# Calmera design system

One page to check before adding a screen. Tokens live in `constants/`; the older notes in `TYPOGRAPHY.md`, `CONTENT_SURFACES.md`, `LIQUID_GLASS_UI.md` and `THEMES.md` explain how each part was tuned.

## Character

Fun, healthy, lively, lightweight. The mark and the orange period carry the brand. Screens stay quiet so food emoji and the person's own numbers supply the color.

## Color

| Token | Use |
| --- | --- |
| `COLORS.primary` | Actions, the selected state, and data that's final |
| `COLORS.soft` | The accent's lighter step: partial data, or the side being compared against |
| `COLORS.track` | The quiet fill behind data and unselected controls |
| `COLORS.text` / `COLORS.textLight` | Main and supporting text. Import from `constants/formTheme`, whose `textLight` passes contrast at small sizes |
| `COLORS.expense` | Destructive actions and errors only, never for eating more or less than a goal |

A hue means one thing on a screen. In Insights, calories are `primary`, and protein, carbs and fat keep the colors of their rings on Today's summary card (`NUTRIENT_COLORS`). Meals are the sky through the day (`MEAL_COLORS`): sun gold for breakfast, sky blue for lunch, dusk violet for dinner and mint for snacks. Each is chosen to sit apart from the nutrient colors, so a meal never borrows a nutrient's color. Other data uses one hue in two steps. Never color a nutrition number as good or bad.

## Type

Use `constants/typography.js`, never a local size.

| Role | Size | Where |
| --- | --- | --- |
| `pageTitle` | 18/600 | Page titles and page-level tabs |
| `sectionTitle` | 16/600 | Card titles |
| `metric` | 22/600 tabular | The headline number of a card, or of each row in a card about several things |
| `body`, `bodyMedium` | 14 | Sentences, row labels |
| `button` | 14/600 | Actions, and numbers inside a sentence |
| `caption` | 12 | Units, axes, footnotes |
| `eyebrow` | 12/600 caps | Section labels above grouped cards |

Text scales with the system setting. Labels locked to a chart grid set `maxFontSizeMultiplier`; everything else wraps.

## Surfaces and spacing

- Cards are `FormCard`: white, radius 24, a 0.5 pt outline. No nested cards.
- Pages have 20 pt side margins and 14 pt between cards. Card content has 18 pt padding.
- Floating controls keep their native Liquid Glass. Never fade an ancestor of a glass button.

## Choosing between controls

| Need | Use |
| --- | --- |
| Choose what a whole page shows | `PeriodTabs`: plain words where the title goes, with the orange period under the current one. Swiping left or right on the page moves between them |
| Change what one card shows | `Chips` |
| Choose a value inside a form | `SegmentedControl` (native) |
| Pick one of a list with explanations | `SettingsRow` with `accessibilityRole="radio"` |
| Go somewhere | `SettingsRow` with a chevron |
| Open more behind a card | `InsightCard` with `onPress`: the whole card is the target, with a chevron by the title |
| The one main action on a screen | `GlassButton role="accent"` |

Words, not abbreviations: "Month", not "M". Touch targets are at least 44 pt tall, or reach it with `hitSlop`.

## Charts

- Days with no log are gaps (a small dot or nothing), never zeros.
- Days before someone's first log are blank. They weren't missed.
- Only today, and on a year chart months that are still going or only partly covered, draw in a paler step of the same color. Today and days with one meal logged don't count toward averages.
- A goal is a thin dashed line, with its value labelled off the chart. Crossing it changes nothing.
- Every chart has a text label for VoiceOver with what it shows.
- On an overview, a chart beside its number is `compact`: no axis, no touch, just bars and the goal line. Earlier periods and reading single bars happen on the detail page, where the previous period sits on the left and this one on the right, as two matching charts in the same color with a divider between.
- Charts in a set share one scale, so their goal lines sit at the same height. Bars past twice the goal stop at the top of the chart.
- Parts of a whole are one thin bar per row, sliced in order, with a key under the title. The overview shows only the bars; the detail page shows the same bars, bigger, with each part's percent and amount in columns underneath.
- Times of day share one clock from 6 AM to midnight, widened to the hour when a meal falls outside it, with ticks every six hours. Every meal or snack is a dot in `primary`, fainter for longer periods so crowded times read darker, and the average is a dark line. Rows are told apart by their names, not colors. Snacks can have up to three averages, one for each time they're regularly eaten.

## Today's hill

- Food dots: every food logged on a day leaves one small dot on the hill. The dots climb to the orange, so the newest is at her feet; older ones run down the slope, 16 points apart, each a little fainter. The hill shows the newest eight. A day keeps its own gentle sway, seeded by its date.
- A dot is a 6-point circle in one soft mauve shade (`#7A4E62` at 30%) that reads as part of the hill on the gold day hill and the lavender night one alike.
- Dots stay on the hill, clear of the orange and her shadow, left of the Add button and above the tab bar, on every phone width (`tests/food-dots.test.mjs`).
- Motion is a single grow-in when a food arrives: the new dot grows from nothing with a small overshoot over 420 ms. Several foods at once arrive one after another, oldest first, up to three. The first food's dot follows the orange's landing. With Reduce Motion, dots just appear.
- Energy: nothing runs between meals. No timers or frame callbacks; the dots are plain native circles, and the grow-in runs on the native driver.

## Writing

Sentence case. Plain statements of what happened. No praise, scolding, streaks, scores or exclamation marks. Say "average day" for the middle day of a period, and "Half your days are between A and B" for a range. Progress against a goal is a plain percent, "99% of goal". Earlier periods live on the detail page, with the change as "↓ 11 points from previous 7 days". Points are the gap between two percents of goal, and are never colored. Patterns get a caveat: "A pattern, not a cause."

Overview cards are read at a glance: a short title and at most one line of text, with a number in it. Ranges and caveats live in the detail page behind the card.

Periods: "Past 7 days" for the period on screen and "Previous 7 days" for the one before it, everywhere. Spell out thresholds: "three days with two or more meals".

## Card anatomy

Every Insights card is an `InsightCard`, in this order: title with a chevron when it opens a detail page, a one-line answer if it has one, the key, the chart or rows, and at most a one-line footnote. A row's value sits on its right in `bodyMedium`, tabular, with any unit in `caption`; `metric` is only for headline numbers. Keys always sit above what they explain.

Empty and error states say what's going on and offer the next step. An error never replaces data already on screen.
