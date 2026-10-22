# Saved Calmera themes

Settings → Theme offers seven permanent choices:

| Theme | Background |
| --- | --- |
| Soft Tangerine | The accepted 50% wash, #FFFBF9; initial default |
| White | Pure #FFFFFF, without a tint or gradient |
| Dawn | Peach-to-rose gradient |
| Glow | Warm, slowly drifting ambient light |
| Aura | Lavender, peach and mint ambient light |
| Matcha Latte | Pale matcha green and creamy oat milk |
| Mocha | Light cocoa and warm milk |

Choices apply immediately throughout the app and save as a nonsecret theme ID in local AsyncStorage, separately for each Calmera account (with a separate guest key). No backend schema, inference, login, or database changes are required. Writes serialize per key, invalid/old IDs fall back to Soft Tangerine, and account/read/write generations guard stale completions. Save errors retain the visible choice and offer retry.

The root supplies a fallback canvas, and each native-stack scene carries its own opaque theme canvas for push/pop transitions. Content cards, form inputs, picker sheets and other solid surfaces remain opaque. SafeScreen retains the established inset ownership. Original fonts and card/menu layouts remain. White uses #FFFFFF in both the global and native-scene canvases; the existing six palette IDs and initial default are preserved. Opening Add changes only the native menu: it does not recolor, scale or restart the background.

Dawn/Soft Tangerine are static. Glow/Aura use native-driver opacity/transform motion on static vector gradients, with no per-frame React/SVG updates. Reduce Motion keeps them still. The continuous loop stops when the app is inactive. The former right-side Add bloom and its shared state were removed after it reproduced as a moving shadow/color wash behind the menu. Theme thumbnails never animate, and each canvas has unique SVG gradient IDs.

## Verification — 2026-10-19

- All 67 existing/new JavaScript tests passed; seven appearance tests cover all four IDs, stale values, rapid write ordering, failed-write recovery, key isolation, validation and read failure. The independent reviewer reran all seven successfully.
- Scoped ESLint, git diff --check and full Release iOS simulator build passed. Build log: /tmp/calmera-themes-build.log. Test log: /tmp/calmera-theme-tests.log.
- In the actual picker with the isolated review preference: all four choices updated their radio states and save labels; Dawn/Aura global backgrounds were inspected live. Aura restored after app termination and installation of the final build.
- Back returned to the actual Settings component in review mode; its Theme row displayed Aura and reopened the picker correctly. The same saved theme appeared on the synthetic Today view, including the native Add menu and background glow response.
- Accessibility-large reflowed the picker to one column with complete labels and retained Aura. Simulator text size was restored to Large.
- Independent source/persistence review found no blocking issues. No physical iPhone operation, personal meal/model/credential inspection, microphone/photo access, real inference, food/goal write, or screenshot export occurred. No frame-rate benchmark or OS-level Reduce Motion toggle was performed.

Test builds isolate `/ui-gallery` and `/background-compare` appearance choices under `calmera.theme.review.v1`; they never write the real user's theme key. Normal Settings → Theme uses the real per-account local preference. No review-only control appears in production.
