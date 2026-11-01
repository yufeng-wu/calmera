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

Data uses one hue in two steps. Don't add colors to tell meals or nutrients apart; label them instead. Never color a nutrition number as good or bad.

## Type

Use `constants/typography.js`, never a local size.

| Role | Size | Where |
| --- | --- | --- |
| `pageTitle` | 18/600 | Page titles and page-level tabs |
| `sectionTitle` | 16/600 | Card titles |
| `metric` | 22/600 tabular | The one number a card is about |
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
| Choose what a whole page shows | `PeriodTabs`: plain words where the title goes, with the orange period under the current one |
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
- Today and days with one meal logged draw in `soft`, and don't count toward typical values.
- A goal is a thin dashed line, with its value labelled off the chart. Crossing it changes nothing.
- Every chart has a text label for VoiceOver with what it shows.
- On an overview, a chart beside its number is `compact`: no axis, no touch. Reading single bars happens on the detail page.

## Writing

Sentence case. Plain statements of what happened. No praise, scolding, streaks, scores or exclamation marks. Say "typical day" for a median, and "Half your days are between A and B" for a range. Patterns get a caveat: "A pattern, not a cause."

Overview cards are read at a glance: a title of three words or fewer, at most one line of body text with a number in it, and no footnotes. Ranges, comparisons and caveats live in the detail page behind the card.

Empty and error states say what's going on and offer the next step. An error never replaces data already on screen.
