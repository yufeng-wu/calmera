# Archive

Features that the App Store app (version 1.0.0, build 10) no longer reaches. Nothing here is built, linted or tested with the app. To see a feature working, check out the commit where it last worked.

| Folder | What it was | Last worked |
| --- | --- | --- |
| [`live-ai/`](live-ai/) | Live AI: during a cooking session the camera watched a kitchen scale, read its weight with an on-device TensorFlow model, and logged each food added once the weight settled. The JavaScript is copied from `d936721`, at the paths it had in the app: the camera and model-loading screens, the welcome and scale-type pages, the cooking-session hook and `lib/scale/`. The tutorial (`calmera-guide.jsx` with `GuideGallery.jsx`) and `constants/statusBar.js` are the later versions that were still in the app, though no button opened them. The TensorFlow model and the scale and tutorial images aren't copied. | `d936721` (February 9, 2026) has the full version, model and images included. On October 19, 2026 (`572f3dc`) its screen became "Coming soon", and the code was removed on November 8 (`2c65fd0`). |
| [`voice-recording/`](voice-recording/) | Hold-to-record voice logging: while the person pressed and held Voice, the app recorded a clip, turned it into text on the iPhone, then asked the AI for an estimate and saved the meal. `voiceCapture.mjs` ran those steps, and `clip.js` with `transcription.mjs` transcribed the clip. The tests cover both. | `5b2a1c3` (November 4, 2026). The next day `89fe282` replaced it with live on-device speech recognition. |
| [`cloud-v1/`](cloud-v1/) | Accounts and server storage: people signed in and their meals and goals were saved on Calmera's own server. The folder holds the notes on how it worked and how to run it again. The code is at the `cloud-v1` tag in this repository and in cal_backend. | Tag `cloud-v1` (`a56021b`, November 8, 2026). |

The archived voice tests run on their own: `node --test archive/voice-recording/*.test.mjs`.
