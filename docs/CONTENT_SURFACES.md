# Content surface hierarchy

The page canvas stays white and Tangerine remains the primary accent. Content cards use neutral boundaries; existing floating UIKit glass controls keep their own materials and animations. Typography, radii and spacing values are unchanged.

| Role | Appearance |
| --- | --- |
| Content card | White fill, 1 pt #D1D1D6 outline |
| Grouped calendar / Settings | #F7F7F9 fill, same outline, no shadow |
| Nutrition summary / meal | White fill, same outline; black shadow at 0.05 opacity, radius 6, offset (0,2) |
| Settings row separator | #E2E2E7 at one physical pixel |
| Settings pressed state | #EEEEF1 |
| iOS Increase Contrast | Outline and separator adapt to #8E8E93 |

These are Calmera palette choices. The outline communicates grouping; the default color is not a blanket claim that every control has 3:1 non-text contrast.

`constants/surfaces.js` centralizes the shared styles and uses React Native DynamicColorIOS for native contrast adaptation. FormCard defaults to the content appearance and accepts `variant="grouped"`; History calendar and Settings groups select that variant. All existing FormCard consumers receive the clearer default edge. Summary and food styles share the restrained elevation treatment. Summary remains white, matching its existing native context-menu preview.

## Verification

Scoped ESLint, diff checks and the Release simulator build passed. Actual production components were inspected with synthetic preview props in the Mac simulator: History calendar, summary and food cards; Settings groups and separators; and Manual form cards. Normal and Increase Contrast appearances were verified live, then the original disabled contrast setting was restored. The summary native Edit goals context menu opened and dismissed correctly. The shared typography file and native animation module were unchanged.

This was a surface styling change; no inference, account or persistence behavior changed. No personal records, authentication actions or physical iPhone were used for inspection. Screenshots were viewed live without saving/exporting them.
