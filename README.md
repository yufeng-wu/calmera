### Calmera App (frontend)

Author: Yufeng Wu (yufengwu@mit.edu, yfwu02@gmail.com)

## License & Usage

This project is made public for demonstration purposes only.
© 2026 Yufeng Wu. All Rights Reserved.
No permission is granted to use, copy, modify, or distribute this code.

## chatgpt-inference-mvp

This branch saves the current Expo/iOS MVP while preserving Calmera's existing app interface, Clerk login and food-record backend. Text and selected-photo estimation use the user's connected ChatGPT plan through the local iOS module; voice is transcribed on-device before estimation. Gemini inference and paid app flows are not part of the current experience.

- `app/`, `components/`, `hooks/`, `constants/`: app screens, shared Liquid Glass controls, account-scoped data cache and typography.
- `modules/calmera-chatgpt/`: native iOS connection, photo and UIKit control implementation.
- `lib/chatgpt/`: inference protocol, authorization/callback handling, local voice flow and persistence helpers.
- `tests/`: synthetic protocol, persistence, voice, cache, goal-loading and unit-handling checks.
- `ios/`: source Xcode project and dependency lockfile for the current local build scripts. Pods, build products and machine-specific state are excluded.

Use `.env.chatgpt.example` as the public configuration template; supply your own Clerk project and backend URL locally. Native changes require a development/standalone iOS build, not stock Expo Go. Build helpers keep Calmera Test under its own bundle ID and do not install to a phone automatically.

Validation: run `node --test tests/*.test.mjs`. The current UI was reviewed on the dedicated iOS 26 simulator with local-only synthetic states; earlier text/photo subscription inference was also exercised on an iPhone 14 Pro. This baseline is an implementation checkpoint, not a claim of App Store approval or general distribution eligibility for the subscription integration.

Setup and verification:
- [MVP architecture](docs/CHATGPT_MVP.md)
- [Setup checklist](docs/SETUP_CHECKLIST.md)
- [Phone build instructions](docs/PHONE_TEST.md)
- [Full page audit](docs/LIQUID_GLASS_PAGE_AUDIT.md)
- [UI verification](docs/LIQUID_GLASS_PAGE_VERIFICATION.md)
- [Typography](docs/TYPOGRAPHY.md)

The API is maintained separately in [cal_backend](https://github.com/yufeng-wu/cal_backend). The older Dot/iMessage/Shortcuts experiments are outside this mobile repository. The license and author information above are unchanged.
