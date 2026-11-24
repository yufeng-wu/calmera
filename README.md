# Calmera

Calmera is a free meal journal for iPhone. You log a meal by typing it, taking or choosing a photo, or saying it out loud, and Calmera estimates its calories, protein, carbs and fat. You check the estimate, fix anything that's off and save it. You can set daily nutrition goals yourself or answer a short survey for suggested ones, and Insights shows your eating patterns over a week, a month or a year.

Everything you save stays on your iPhone. There's no Calmera account and no Calmera server. Settings can export your data to a file or erase all of it.

Website: [yufengwu.dev/calmera](https://yufengwu.dev/calmera/) · [Privacy Policy](https://yufengwu.dev/calmera/privacy/) · Support: [calmeradev@gmail.com](mailto:calmeradev@gmail.com)

## How Calmera uses AI

Estimates come from an AI service you connect in Settings → AI connection. Your iPhone sends each request straight to that service:

- **Sign in with ChatGPT** to use your ChatGPT plan. Estimates count toward the plan's limits.
- **Add your own API key** from OpenAI or Anthropic. The provider bills you for what you use, and Calmera shows an estimate of the last 7 days' cost.

A meal's text, or the photo you chose, is sent only when you ask for an estimate. Voice is turned into text on the iPhone, and only the words are sent.

## Folders

| Folder | What's in it |
| --- | --- |
| `app/` | The Expo / React Native project: `package.json`, the Expo and EAS config, `ios/` (the Xcode project), `modules/calmera-chatgpt/` (Calmera's native code: ChatGPT sign-in, the Liquid Glass controls and tab bar, and the photo picker), `assets/`, `scripts/` and `tests/` |
| `app/src/app/` | The screens, one file per route ([Expo Router](https://docs.expo.dev/router/introduction/)) |
| `app/src/components/` | UI, with a folder for each feature: `today`, `meals`, `voice`, `insights`, `goals`, `settings`, `privacy` and `brand` |
| `app/src/lib/` | Logic without UI, most of it covered by `app/tests/`: AI connections and estimates, ChatGPT sign-in, storage on the iPhone, Insights statistics |
| `app/src/hooks/`, `app/src/constants/`, `app/src/context/` | React hooks, design tokens and app-wide state |
| `docs/` | Development, release, privacy and design notes |
| `archive/` | Features the app no longer uses, kept for reference |

## Building

Setup, tests and the App Store release steps are in [docs/README.md](docs/README.md). You need a Mac with Node.js 22, CocoaPods and Xcode 26. Every command runs from `app/`.

## Source and permissions

The source code is publicly available for reference.

© 2026 Yufeng Wu. All rights reserved.

Except as permitted by applicable law or GitHub’s Terms of Service, you may not use, copy, modify, or redistribute Calmera’s original source code without prior written consent from Yufeng Wu.
