### foodwrap. (frontend)

Author: Yufeng Wu (yufengwu@mit.edu, yfwu02@gmail.com)

## License & Usage

This project is made public for demonstration purposes only.
© 2026 Yufeng Wu. All Rights Reserved.
No permission is granted to use, copy, modify, or distribute this code.

## chatgpt-inference-mvp

This branch saves the current Expo/iOS MVP while preserving foodwrap's existing app interface, Clerk login and food-record backend. Text and selected-photo estimation use the user's connected ChatGPT plan through the local iOS module; voice is transcribed on-device before estimation. Gemini inference and paid app flows are not part of the current experience.

- `app/`, `components/`, `hooks/`, `constants/`: app screens, shared Liquid Glass controls, account-scoped data cache and typography.
- `modules/calmera-chatgpt/`: native iOS connection, photo and UIKit control implementation.
- `lib/chatgpt/`: inference protocol, authorization/callback handling, local voice flow and persistence helpers.
- `tests/`: synthetic protocol, persistence, voice, cache, goal-loading and unit-handling checks.
- `ios/`: source Xcode project and dependency lockfile for the current local build scripts. Pods, build products and machine-specific state are excluded.

Use `.env.chatgpt.example` as the public configuration template; supply your own Clerk project and backend URL locally. Native changes require a development/standalone iOS build, not stock Expo Go. Build helpers keep the foodwrap test app under its own bundle ID and do not install to a phone automatically.

Validation: run `node --test tests/*.test.mjs`. The current UI was reviewed on the dedicated iOS 26 simulator with local-only synthetic states; earlier text/photo subscription inference was also exercised on an iPhone 14 Pro. This baseline is an implementation checkpoint, not a claim of App Store approval or general distribution eligibility for the subscription integration.

## Photo and text logging

Photo Log and Text Log share the same editable meal review. Text Log accepts a natural-language description (a food or a whole meal); estimated portions appear in the review and can be corrected without a separate amount field at input.

Food rows start collapsed and show each food's calories. Expanding a row edits its name, amount and four nutrients directly in the local draft; re-estimation is an explicit action. Rows fold open and closed in place, totals ease to edited values, and removing a food shows a short Undo toast. The selected photo opens a larger, zoomable preview. Numeric editing has Previous/Next/Done keyboard controls on iOS. The nutrient editor uses one compact row on standard phone widths, with additional rows for narrow screens or large text. Add food reveals a new row above its button and allows one unfinished entry at a time.

The meal type (Breakfast, Lunch, Dinner or Snack) is chosen inline, starting from the estimate. Save validates every food and saves the reviewed meal under that type. Confirmed or uncertain saves cannot be repeated automatically. The emoji picker groups icons by food category and searches English names, Chinese aliases and emoji. Emoji choices are nonsecret, per-account, per-record display preferences stored on this device; the food-record API is unchanged.

Setup and verification:
- [MVP architecture](docs/CHATGPT_MVP.md)
- [Setup checklist](docs/SETUP_CHECKLIST.md)
- [Phone build instructions](docs/PHONE_TEST.md)
- [Full page audit](docs/LIQUID_GLASS_PAGE_AUDIT.md)
- [UI verification](docs/LIQUID_GLASS_PAGE_VERIFICATION.md)
- [Typography](docs/TYPOGRAPHY.md)
- [Meal-time defaults](docs/MEAL_TIME_DEFAULTS.md)
- [foodwrap rename and iOS 26 checks](docs/FOODWRAP_RENAME_AND_IOS26_QA.md)

The API is maintained separately in [cal_backend](https://github.com/yufeng-wu/cal_backend). The older Dot/iMessage/Shortcuts experiments are outside this mobile repository. The license and author information above are unchanged.
