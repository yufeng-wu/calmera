# Content surface hierarchy

The page canvas stays white and Tangerine remains the primary accent. Content cards use neutral boundaries; existing floating UIKit glass controls keep their own materials and animations. Typography, radii and spacing values are unchanged.

| Role | Appearance |
| --- | --- |
| Content card | White fill, 0.5 pt #E5E5EA outline |
| Grouped calendar / Settings | White fill, same fine outline, no shadow |
| Nutrition summary / meal | White fill, same outline; black shadow at 0.04 opacity, radius 6, offset (0,2) |
| Settings row separator | #E2E2E7 at one physical pixel |
| Settings pressed state | #F5F5F7 |
| iOS Increase Contrast | Outline and separator adapt to #8E8E93 |

These are Calmera palette choices. The outline communicates grouping; the default color is not a blanket claim that every control has 3:1 non-text contrast.

`constants/surfaces.js` centralizes the shared styles and uses React Native DynamicColorIOS for native contrast adaptation. FormCard defaults to the content appearance and accepts `variant="grouped"`; History calendar and Settings groups select that variant. All existing FormCard consumers receive the clearer default edge. Summary and food styles share the restrained elevation treatment. Summary remains white, matching its existing native context-menu preview.

## Softer visual revision

The stronger 1 pt outline and pale gray grouped fill were rejected as too conspicuous. The current revision returns grouped cards to white, uses a lighter 0.5 pt neutral edge and reduces elevated shadow opacity to 0.04. Existing typography, layout values, radii, accent and motion stay intact. Increase Contrast still uses the stronger native dynamic color.

## Verification

Scoped ESLint, diff checks and the Release simulator build passed for the current softer revision. Its isolated Settings and History components were inspected live at the original normal contrast setting. Actual production components were inspected with synthetic preview props in the Mac simulator: History calendar, summary and food cards; Settings groups and separators; and Manual form cards. Normal and Increase Contrast behavior were verified in the preceding revision; the native contrast mapping is retained. The simulator remains at its original disabled contrast setting. The summary native Edit goals context menu opened and dismissed correctly. The shared typography file and native animation module were unchanged.

This was a surface styling change; no inference, account or persistence behavior changed. No personal records, authentication actions or physical iPhone were used for inspection. Screenshots were viewed live without saving/exporting them.
