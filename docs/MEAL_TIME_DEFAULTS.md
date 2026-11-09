# Meal-time defaults

A text or voice log that doesn't name a meal is filed under the meal for the time of day it was logged (for voice,
when recording started), in the phone's local time. The person can pick another meal on the review page before
saving, and a meal named in what they type or say always wins, per item. Photo logs default to Snack.

| Meal | Hours |
| --- | --- |
| Breakfast | 05:00–11:00 |
| Lunch | 11:00–17:00 |
| Dinner | 17:00–22:00 |
| Snack | 22:00–05:00 next day |

Starts are inclusive and ends exclusive, so every minute of the day has exactly one meal (`lib/mealTimes.mjs`,
`tests/meal-times.test.mjs`). These are convenience defaults, not nutrition advice.

## History

From October 20 to November 8, 2026, Settings → Logging → Meal times let people move these starts in 15-minute steps.
It was removed on November 8, 2026; the hours above are now fixed. A schedule saved by that page stays in app storage
under `calmera.meal-times.<owner>` until Erase all data clears it, and nothing reads it.
