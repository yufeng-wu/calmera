# Insights and export: product brief

## The job

Help someone who logs food see their own patterns and spot one thing they could try, without being judged. Calmera already answers "what did I eat today?" Insights answers "what do I usually do?"

## What the research said, and what we did

| Finding | Decision |
| --- | --- |
| A UCL analysis of user posts linked lost streaks and missed targets to guilt and avoiding logging. INSEAD reports that broken streaks demotivate. | No streaks, scores, or colored misses. "Days logged" has no denominator. |
| MacroFactor describes its dashboard as "adherence-neutral", favoring sustainable process over short-term success or failure. | Comparisons are plain numbers ("Previous 30 days: 2,010 kcal"). The −17% style of change is gone, since a drop in calories would read as praise. |
| Lived-informatics work (Epstein et al.) treats lapsing and resuming as normal stages of tracking. | Blank before the first log, gaps instead of zeros, and no message about being away. |
| Reviews describe Cronometer's depth as overwhelming for beginners, and Yazio as light on analytics. | Each card asks one question, answers it in a sentence, then shows the chart. |
| Apple's guidance keeps segmented controls for closely related choices, and Health pairs them with full words. | Replaced W/M/Y letters with the words Week, Month and Year. |
| Cronometer exports CSV and JSON and users ask for spreadsheet-ready files. GDPR Article 20 asks for a structured, machine-readable format. MyFitnessPal's export is reported as paid and unreliable. | Free export in CSV and JSON with fixed, documented columns. |

These sources are mostly secondary and small-sample; none was a controlled study of this kind of screen.

## Cards

| Card | Question | Shows when |
| --- | --- | --- |
| Days logged | Have I been logging? | Always |
| A typical day | What does a normal day look like? | Chart always. Typical value after 3 days with 2+ meals |
| Your foods | What do I eat most, and what gives me protein? | Any food logged |
| Veg and fruit | What kinds have I had? | A checked food in the period |
| When you eat | What time do I usually have each meal? | A meal logged on 3+ days |
| How much at each meal | How do calories, protein, carbs and fat split across meals? | 3 days with 2+ meals |
| On days with X g of protein or more | What's different on days with more protein? | Month and Year, with 3+ days on each side |
| Weekdays and weekends | Are they different? | Month and Year, with 5+ weekdays and 3+ weekend days |

"Typical" is the median of finished days with two or more meals, so a forgotten dinner doesn't look like light eating and a holiday doesn't move the number.

Left out on purpose: AI commentary, scored reports, weight, Apple Health, and comparisons with other people. The weekly collage page stays on the roadmap and isn't built.

## Known limits

- A meal's time is usually when it was logged, unless edited. "When you eat" says so and rounds times to the nearest quarter hour.
- Food name merging is deliberately cautious. "White Rice" and "Steamed White Rice" merge; "Fried Rice" and "Rice" stay apart. Rewordings like "Rice with chicken" won't merge.
- Veg and fruit tags come from the AI at logging, on the person's own ChatGPT plan, and the Insights page itself does no AI work. Foods logged earlier or typed by hand have no tags (`ingredients` is null, meaning unchecked rather than none). Renaming a food clears its tags.
- Android gets the export as text in the share sheet rather than as a file, since the app has no Android file-sharing module.

## Export file formats

`Every food` (CSV): `date,time,meal,food,quantity,calories,protein_g,carbs_g,fat_g,vegetables,fruits`, one row per food.

`Daily totals` (CSV): `date,foods_logged,calories,protein_g,carbs_g,fat_g`, one row per day.

`Everything` (JSON): `{ app, format, exportedAt, goals, days: [{ date, foods: [...] }] }`.

CSV files are UTF-8 with a byte order mark so Excel reads Chinese names correctly. Cells that a spreadsheet would run as formulas are prefixed with an apostrophe. Account IDs are left out. History is always refetched before a file is made, and a failed fetch shares nothing.

## Sources

- [UCL: emotional strain of fitness and calorie counting apps](https://www.ucl.ac.uk/news/headlines/2025/oct/emotional-strain-fitness-and-calorie-counting-apps-revealed)
- [INSEAD: why the customer isn't always right](https://knowledge.insead.edu/strategy/why-customer-isnt-always-right)
- [MacroFactor: dashboard revamp](https://macrofactor.com/dashboard-revamp/)
- [A lived informatics model of personal informatics](https://library.selfresearch.org/research/a-lived-informatics-model-of-personal-informatics/)
- [Apple HIG: segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)
- [Macworld: Apple Activity Trends](https://www.macworld.com/article/3429077/ios-13-and-apple-watch-activity-trends-give-you-the-big-picture.html)
- [Cronometer export (community client)](https://github.com/jrmycanady/cronometer-export/blob/main/README.md)
- [Guide to exporting MyFitnessPal data](https://takeoutday.org/guides/how-to-export-myfitnesspal-data)
- [Nutrition app export options, including GDPR Article 20](https://nutriscan.app/blog/posts/nutrition-app-data-export-options-2026-6d34327efa)
- [Feast Good: Cronometer vs Lose It](https://feastgood.com/?p=26709)
