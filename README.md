### foodwrap. (frontend)

Author: Yufeng Wu (yufengwu@mit.edu, yfwu02@gmail.com)

## License & Usage

This project is made public for demonstration purposes only.
© 2026 Yufeng Wu. All Rights Reserved.
No permission is granted to use, copy, modify, or distribute this code.

## chatgpt-inference-mvp

calmera keeps every meal, goal and setting on the iPhone: there's no sign-in and no calmera server. Text and selected-photo estimation use the person's connected ChatGPT plan through the local iOS module; voice is transcribed on-device before estimation. The earlier server-backed version is saved as tag `cloud-v1` ([docs/CLOUD_VERSION.md](docs/CLOUD_VERSION.md)).

- `app/`, `components/`, `hooks/`, `constants/`: app screens, shared Liquid Glass controls, the in-memory data cache and typography.
- `lib/store/`: the one data module for meals, goals and the profile, kept in the iPhone's app storage.
- `modules/calmera-chatgpt/`: native iOS connection, photo and UIKit control implementation.
- `lib/chatgpt/`: inference protocol, authorization/callback handling and the local voice flow.
- `tests/`: synthetic protocol, data module, voice, cache, goal-loading and unit-handling checks.
- `ios/`: source Xcode project and dependency lockfile for the current local build scripts. Pods, build products and machine-specific state are excluded.

No build-time keys are needed. Native changes require a development/standalone iOS build, not stock Expo Go. Build helpers keep the foodwrap test app under its own bundle ID and do not install to a phone automatically.

Validation: run `node --test tests/*.test.mjs`. The current UI was reviewed on the dedicated iOS 26 simulator with local-only synthetic states; earlier text/photo subscription inference was also exercised on an iPhone 14 Pro. This baseline is an implementation checkpoint, not a claim of App Store approval or general distribution eligibility for the subscription integration.

## Photo and text logging

Photo Log and Text Log share the same editable meal review. Text Log accepts a natural-language description (a food or a whole meal); estimated portions appear in the review and can be corrected without a separate amount field at input.

The estimated total leads with calories, followed by protein, carbs and fat in grams. Each food is its own card, collapsed at first and showing its calories. Expanding a row edits its name, amount and four nutrients directly in the local draft; re-estimation is an explicit action. Rows fold open and closed in place, totals ease to edited values, and removing a food shows a short Undo toast. The selected photo opens a larger, zoomable preview. Numeric editing has Previous/Next/Done keyboard controls on iOS. The nutrient editor uses one compact row on standard phone widths, with additional rows for narrow screens or large text. "Add another item" reveals a new row above its button and allows one unfinished entry at a time.

Save opens a menu of meal types (Breakfast, Lunch, Dinner, Snack); choosing one validates every food and saves the reviewed meal under that type. Confirmed or uncertain saves cannot be repeated automatically. Each food shows an Apple emoji matched from its name, using dish and cuisine synonyms in English, Chinese and Korean; dishes without their own emoji use the nearest one (kimchi 🥬, bibimbap 🍚). The food icon picker groups icons by category and searches names and aliases. Icon choices are nonsecret, per-meal display preferences stored on this device.

Setup and verification:
- [Cloud version (`cloud-v1`), saved before the move to phone-only storage](docs/CLOUD_VERSION.md)
- [MVP architecture](docs/CHATGPT_MVP.md)
- [Setup checklist](docs/SETUP_CHECKLIST.md)
- [Phone build instructions](docs/PHONE_TEST.md)
- [Full page audit](docs/LIQUID_GLASS_PAGE_AUDIT.md)
- [UI verification](docs/LIQUID_GLASS_PAGE_VERIFICATION.md)
- [Typography](docs/TYPOGRAPHY.md)
- [foodwrap rename and iOS 26 checks](docs/FOODWRAP_RENAME_AND_IOS26_QA.md)

The cloud version's API is in [cal_backend](https://github.com/yufeng-wu/cal_backend) at tag `cloud-v1`; this app no longer uses it. The older Dot/iMessage/Shortcuts experiments are outside this mobile repository. The license and author information above are unchanged.
