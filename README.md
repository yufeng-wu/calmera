<p align="center">
  <img src="app/assets/images/icon.png" width="128" alt="Calmera app icon">
</p>

<h1 align="center">Calmera – AI calorie and macro tracker</h1>

<p align="center">
  <a href="https://yufengwu.dev/calmera/">Website</a> ·
  <a href="mailto:calmeradev@gmail.com">Support: calmeradev@gmail.com</a>
</p>

Calmera is a 100% free calorie and macro tracker for iPhone, with its source code openly available. Contributions are welcome! Type, say or snap a photo of a meal, and your own AI estimates its calories, protein, carbs and fat.

## Core features

1. **Powered by your own AI.** Sign in with ChatGPT to use your existing plan, or use an OpenAI or Anthropic API key. Every estimate runs on your own AI, and Calmera itself is free, with no subscription fee.
2. **Pick your model,** such as Sonnet, Opus or Haiku, with optional online search for restaurants and brands.
3. **No account.** No sign-up, and all your data stays on your iPhone.
4. **Log by text, voice or photo.**

## Repo organization

| Folder | What's in it |
| --- | --- |
| `app/` | The Expo / React Native project: `package.json`, the Expo and EAS config, `ios/` (the Xcode project), `modules/calmera-chatgpt/` (Calmera's native code: ChatGPT sign-in, the Liquid Glass controls and tab bar, and the photo picker), `assets/`, `scripts/` and `tests/` |
| `app/src/app/` | The screens, one file per route ([Expo Router](https://docs.expo.dev/router/introduction/)) |
| `app/src/components/` | UI, with a folder for each feature: `today`, `meals`, `voice`, `insights`, `goals`, `settings`, `privacy` and `brand` |
| `app/src/lib/` | Logic without UI, most of it covered by `app/tests/`: AI connections and estimates, ChatGPT sign-in, storage on the iPhone, Insights statistics |
| `app/src/hooks/`, `app/src/constants/`, `app/src/context/` | React hooks, design tokens and app-wide state |
| `docs/` | Development, release, privacy and design notes |
| `archive/` | Features the app no longer uses, kept for reference |

## Contribute

Bug reports and ideas are welcome. Please email [calmeradev@gmail.com](mailto:calmeradev@gmail.com) for collaboration. 

## License

Calmera's source code is openly available under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). You may use, change and share it for noncommercial purposes, as long as you keep the license and its Required Notice. Any commercial use, including selling or redistributing Calmera or a modified version for profit, needs written permission from Yufeng Wu ([calmeradev@gmail.com](mailto:calmeradev@gmail.com)).

The Calmera name, logo and app icon are not licensed for any use.

Copyright (C) 2026 Yufeng Wu.
