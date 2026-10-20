# Shared Save loading size — October 20, 2026

The user reported incorrect Save dimensions after tapping on multiple pages. Source tracing identified the shared FormHeader / GlassButton / CalmeraFormButtonView used by Manual, Edit Goals, Edit Meal, Edit Item and Scale display.

## Reproduction and fix

On the real native control in the isolated full-test motion-check route, idle Save was 68 × 44 pt with intrinsic content 56.67 × 33 pt. Loading previously retained the Save title alongside the activity indicator, increasing intrinsic content to 85 × 36.33 pt inside the same 68 pt outer width. Live visual inspection showed the title wrapping vertically beside the spinner.

For navigation buttons only, loading now temporarily removes title/image/padding and centers the native activity indicator. The button keeps its original bounds and Regular glass configuration. Navigation titles use one line. Existing save handlers, font sizes, native shadows and business logic are unchanged. Accessibility keeps the Save label, Processing value and disabled state while busy.

## Runtime evidence

Final Release build was installed in both dedicated simulators: Calmera Glass iOS 27 (iOS 27.0) and Calmera ChatGPT Test (iOS 26.0.1), bundle com.yfwu02.mobile.chatgptdev.

Both systems produced these same metrics using the actual shared native control:

| State | Standard bounds | Standard intrinsic | Compact bounds | Compact intrinsic |
| --- | --- | --- | --- | --- |
| Idle | 68 × 44 pt | 56.67 × 33 pt | 44 × 44 pt | 39.67 × 39.67 pt |
| Loading | 68 × 44 pt | 20.33 × 20.33 pt | 44 × 44 pt | 20.33 × 20.33 pt |
| Restored | 68 × 44 pt | 56.67 × 33 pt | 44 × 44 pt | 39.67 × 39.67 pt |

During the eight-second local fake save, title was absent, controls were disabled with Processing accessibility value, and native spinners were centered without wrapped letters. The original labels/icons and enabled states returned afterward. The synthetic route submits no data and clears its timer on unmount. Native metrics are opt-in, deduplicated and disabled on ordinary pages.

Validation: scoped ESLint passed (/tmp/calmera-save-size-final-lint.log), 12 existing safe-area/theme regression checks passed (/tmp/calmera-save-size-tests.log), git diff --check passed, and final Release native build passed (/tmp/calmera-save-size-final-build.log).

Limits: compact geometry was checked at the current text size; no new system Dynamic Type setting, physical-device or per-frame animation measurement was performed. Shared-control behavior was verified without submitting real forms or exercising backend persistence. No screenshots were saved/exported, real records changed, microphone/camera/inference invoked or physical iPhone operated. Separate pre-existing OpenAI-logo changes remain excluded from this commit.
