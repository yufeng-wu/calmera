# Meal-time defaults — October 20, 2026

Settings → Meal times now controls the fallback category for voice logs that do not name a meal. Initial wall-clock ranges are:

| Meal | Default hours |
| --- | --- |
| Breakfast | 05:00–11:00 |
| Lunch | 11:00–17:00 |
| Dinner | 17:00–22:00 |
| Snack | 22:00–05:00 next day |

Each editable start ends the preceding period. Start boundaries are inclusive, end boundaries exclusive, and all 24 hours have exactly one category. The four starts must remain in Breakfast / Lunch / Dinner / Snack order within the day, with 15-minute increments. These are convenience defaults, not nutrition recommendations. Restore defaults changes the draft; Save applies it. The page preserves the shared typography, native header controls, themed scene and compact grouped spacing. The iOS compact UIDatePicker owns its popup, wheel tracking and dismissal; no custom glass material or shadow was added. Time controls expose their current accessibility value and adapt their layout to text scale.

## Data and voice behavior

Nonsecret preferences use AsyncStorage under `calmera.meal-times.<Calmera user id>` on this device. They are independent of ChatGPT connection, model and voice language. Missing or malformed stored values use a fresh copy of the defaults without a background write. Invalid drafts cannot save. Writes are serialized per owner; a deadline or departed page cannot release an actual pending write. Reopened reads wait for pending writes and reject stale snapshots. Read/write failures have an explicit reload UI; a failed save never displays success or retries silently.

The recorder captures its start time before starting native capture. The existing voice pipeline reads the current owner's saved schedule before inference, resolves the recording's local hour/minute, and passes only the trusted category to the inference prompt. An explicitly named meal, in any language, takes priority per item; the original transcript remains intact and one recording may name different meals. Food type alone must not override the fallback. A schedule read failure stops the flow. Activity is checked before and after schedule/model lookup; the existing pipeline still guards saving inactive results. Existing photo estimate callers retain Snack, and Manual remains unchanged. No new API tier, model, backend endpoint or record schema was introduced.

Classification of an explicit meal remains the existing model's responsibility. Automated request tests verify the outbound conditional instructions and trusted category; they do not claim live-model semantic accuracy.

## Verification

- Full JavaScript suite: 272/272 passed (`/tmp/calmera-meal-times-full-tests.log`). The affected protocol/client/schedule/preference tests were rerun after the final prompt changes: 37/37 passed (`/tmp/calmera-meal-times-final-targeted-tests.log`).
- Behavioral coverage: every minute of the default day; exact boundaries; custom quarter-hour starts; overnight Snack; invalid/overlapping schedules; device-zone and repeated DST hours; recording-start fallback; unchanged explicit transcript/result; read failure; cancellation; owner isolation; defaults/corrupt storage; write snapshots/serialization; stale reads; abort/timeout; pending-write barriers and lost acknowledgement.
- Scoped ESLint and whitespace checks passed; final Release simulator build passed (`/tmp/calmera-meal-times-verified-build.log`).
- In Calmera ChatGPT Test (iOS 26.0.1), actual shared components showed the four compact native controls and default ranges. Picker selections changed Breakfast from 05:00 to 06:00, updated the overnight Snack end, enabled Save, confirmed success and retained the value on reopening.
- An invalid 18:00 Breakfast showed the ordering explanation and disabled Save. Restore defaults returned to valid ranges; Save confirmed the restored schedule.
- Separate synthetic read/write failure pages showed truthful errors, disabled Save, and recovered by reloading confirmed values. The synthetic failure cases use memory-only storage.
- Final ready-preview uses the real preference coordinator and AsyncStorage, isolated under owner `meal-times-preview:ready`. Changed Breakfast to 06:15 with the native wheels, saved, terminated and relaunched only the test app: 06:15 and its matching Snack end persisted. Restored and saved the synthetic defaults afterward. No real user's preference was written during QA.
- Actual Settings → Meal times opened with 05:00 / 11:00 / 17:00 / 22:00, Save disabled with no draft change; native Back returned to Settings. This path read only the new nonsecret preference key, without opening meal/goal/account records.
- Installed final build in both dedicated test simulators. Runtime interaction evidence above is from iOS 26.0.1; iOS 27 installation alone is not claimed as a second runtime pass.

No real microphone/camera/inference, meal/goal/backend/account write, physical iPhone operation, personal record/credential inspection or screenshot save/export was performed. The final bundle adds render-current owner checks to the page action handlers; it was installed and its default values/native popup open and dismissal were rechecked. CUA coordinate clicks then began returning noWindowsAvailable, although AX actions remained available; wheel-edit/save/cold-restart evidence above comes from the preceding otherwise identical bundle. Native VoiceOver audio, actual accessibility text-size changes, physical-device timing and live inference semantics remain untested. Separate pre-existing OpenAI-logo changes/assets were preserved and excluded from the scoped commit.

Native picker reference: [Apple UIDatePicker documentation](https://developer.apple.com/documentation/uikit/uidatepicker), [minuteInterval](https://developer.apple.com/documentation/uikit/uidatepicker/minuteinterval).
