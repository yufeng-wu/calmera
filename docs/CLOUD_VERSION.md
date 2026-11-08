# The cloud version (`cloud-v1`)

`cloud-v1` is the last version of calmera that keeps meals and goals on its own server. It was saved on November 8, 2026, just before calmera started moving to storing everything on the iPhone. Nothing was deleted. Check out the tag to read, run or reuse any part of it.

## What was saved

| Repository | Tag | What it holds |
| --- | --- | --- |
| [cal_mobile](https://github.com/yufeng-wu/cal_mobile) | `cloud-v1` | The app: everything on `main` (goals survey, Insights), plus account deletion ([#20](https://github.com/yufeng-wu/cal_mobile/pull/20)) and the Privacy Policy with its consent sheet (branch `claude/more-bug-fix-4`). |
| [cal_backend](https://github.com/yufeng-wu/cal_backend) | `cloud-v1` | The server running on Render on November 8, 2026 (`78b3d3d`, including account deletion from [cal_backend#5](https://github.com/yufeng-wu/cal_backend/pull/5)). |

The two tags go together: the app at `cloud-v1` expects the server at `cloud-v1`.

## How it works

```
iPhone ── sign-in ──────────────────────────────▶ Clerk
   │
   ├── meals, goals, profile (with Clerk token) ─▶ calmera API (Express on Render) ──▶ Neon Postgres
   │
   └── meal text, chosen photos, voice text ────▶ OpenAI, through the person's own ChatGPT account
```

- People sign in with email and password through Clerk. Their first launch creates their row in `users`.
- Meals and goals are read from and saved to the server. The phone keeps a copy so the app opens quickly.
- AI estimates never pass through the server. The phone calls OpenAI directly with the person's ChatGPT sign-in, with `store: false`. Voice is turned into text on the iPhone first.
- Before anything else opens, people agree to the Privacy Policy and to sending meal text, photos and voice text to OpenAI ([PRIVACY.md](PRIVACY.md)).
- Settings → Delete account removes the person's rows and closes their Clerk account ([ACCOUNT_DELETION.md](ACCOUNT_DELETION.md)).

### What is stored where

| Place | What |
| --- | --- |
| Neon `users` | Clerk user ID, email, username, join date, and the old `scale_type` |
| Neon `food_entries` | One row per food: name, quantity, calories, protein, carbs, fat, meal type, local date and time, and ingredients (JSON) |
| Neon `user_goals` | Calorie, protein, carb and fat goals, each with the date it starts |
| Clerk | The account and sign-in, plus the consent record in `unsafeMetadata.calmeraConsent` |
| iPhone app storage | A copy of recent meals, plus theme, meal times, food icons, voice settings and the consent record |
| iPhone Keychain | The ChatGPT sign-in, saved for this device only, so on a new iPhone people have to reconnect ChatGPT |

The server creates the tables when it starts (`src/server.js` in cal_backend). There are no migration files.

### Server routes the app uses

All of them need a Clerk token. The base URL is `EXPO_PUBLIC_API_BASE_URL`, which defaults to `https://react-app-api-mos5.onrender.com/api`.

| Route | Used for |
| --- | --- |
| `POST /users/create-user`, `GET /users/get-user`, `PUT /users/update-user` | Profile and goals |
| `DELETE /users/delete-account` | Deleting an account |
| `POST /food-entries`, `GET` / `PUT` / `DELETE /food-entries/:id` | Meals |
| `GET /food-entries/summaries`, `GET /food-entries/summary-by-date/:date` | Today and History |
| `GET /health` | Uptime check (no token) |

The old server AI routes (`/food-entries/estimate`, `/users/recommend-goals`, voice and vision) answer 410. Payment routes exist only with `CALMERA_ENABLE_BILLING=true`. `PUT /users/update-scale-type` belongs to the old scale flow.

### Where the app talks to the server

`constants/api.js` builds every server URL. These files use those URLs, so they're the list to change when moving storage to the phone:

- **Screens:** `app/(auth)/sign-up.jsx`, `app/(root)/edit/[id].jsx`, `app/(root)/goals-survey.jsx`, `app/(root)/update-goals.jsx`
- **Components:** `components/AccountProfileGate.jsx`, `components/FoodwrapStartupGate.jsx`, `components/MealLogScreen.jsx`, `components/voice/VoiceLogSheet.jsx`
- **Hooks:** `hooks/useNutritionData.js` (meals, and the copy kept on the phone), `hooks/useProfile.js`
- **Request helpers:** `lib/mealRequest.mjs`, `lib/nutritionRequest.mjs`, `lib/nutritionDelete.mjs`, `lib/accountSetup.mjs`, `lib/goalProfile.mjs`, `lib/accountDeletion.mjs`, `lib/accountDeletionDevice.js`, `lib/chatgpt/entryPersistence.mjs`

Some older screens also call the server, but nothing in the current app links to them. They're the scale camera, payments and a voice test: `app/(root)/camera.jsx`, `calmera-welcome.jsx`, `update-scale-type.jsx`, `go-premium.jsx`, `voice-test.jsx`, `context/PremiumContext.js` and `hooks/useCookingSession.js`.

35 files import Clerk (`@clerk/clerk-expo`).

## Running it again

**App**, from your cal_mobile checkout:

```bash
git worktree add ../mobile-cloud-v1 cloud-v1
cd ../mobile-cloud-v1 && npm install
node --test tests/*.test.mjs
```

Next, create `.env` with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_BASE_URL`, using `.env.chatgpt.example` as the template. Then build with `npm run ios`. Signing and phone builds are covered in [PHONE_TEST.md](PHONE_TEST.md) and [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md).

**Server**, from your cal_backend checkout:

```bash
git worktree add ../backend-cloud-v1 cloud-v1
cd ../backend-cloud-v1 && npm install
npm test
```

`npm start` needs `DATABASE_URL` and `CLERK_SECRET_KEY` (see `.env.free.example` and the cal_backend README). The `.env` in your existing backend checkout may point at the live database. For local runs, use a separate Neon branch.

## Live services on November 8, 2026

| Service | Role | Notes |
| --- | --- | --- |
| Render | Runs the API, deploying from cal_backend `main` | A keep-alive job calls `API_URL` |
| Neon | Postgres database | Holds every account's meals and goals |
| Clerk | Accounts and sign-in (development instance) | |
| Upstash | Shared rate limits, optional | Off by default; the server uses local limits |
| OpenAI | AI estimates, through each person's ChatGPT account | Stays in the phone-only version |

Keep Render, Neon and Clerk running until two things are true: the phone-only version is released, and everyone using the cloud version, you included, has exported their data. Export is Settings → Export your data, which saves `calmera-data-YYYY-MM-DD.json`. The phone-only version's Import is meant to read that file.

## Privacy text for this version

At `cloud-v1`, `lib/privacyPolicy.mjs` (policy version 2026-11-08) describes this version. It names Clerk, Neon, Render and Upstash and describes data kept in an account. The phone-only version needs a new policy version; see [PRIVACY.md](PRIVACY.md).

## Next: keeping everything on the iPhone

Plan as of November 8, 2026:

1. **Save this version.** Done: this page and the `cloud-v1` tags.
2. **One entry point.** Send every meal, goal and profile read and write through one module, still backed by the server. Nothing looks different.
3. **Phone storage.** Replace the server behind that module with a database on the iPhone. There's no on/off switch; this tag is the way back.
4. **No sign-in.** Remove Clerk sign-in and account setup. Delete account becomes "Erase all data". Connecting ChatGPT and agreeing to send data to OpenAI both stay.
5. **Release.** Add Import for the export file, publish the updated Privacy Policy, then release.

Things to know:

- iCloud Backup and Quick Start (setting up a new iPhone from the old one) both copy the app's data, including the database on the phone. People who use neither can move their data with Export and Import.
- The ChatGPT sign-in is saved for this device only, so on a new iPhone people reconnect ChatGPT once. Their meals come across either way.
- An export holds the current goals but not the history of goal changes. Importing one restores meals and the current goals.
