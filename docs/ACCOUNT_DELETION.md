# Deleting an account

In Settings, tapping your email card opens Account, and its Delete account row opens a page that lists what goes, offers Export first, and asks once more in an alert. Apple requires in-app deletion for any app that lets people create an account (App Store Review Guideline 5.1.1(v)).

## What is deleted, in order

1. **Backend** (`DELETE /api/users/delete-account`, backend repo `src/service/accountDeletion.js`):
   1. The person's `user_goals`, `food_entries` and `users` rows, in one transaction. A failure leaves all of them, and the answer is `500 { code: "data_delete_failed", dataDeleted: false }`.
   2. Their Clerk user, with the backend's secret key. A Clerk failure or a 15-second stall answers `502 { code: "account_close_failed", dataDeleted: true }`. A Clerk 404 counts as already closed.
   3. A second sweep of the same rows, for any write signed just before the account closed. Its failure is only logged.
   4. `200 { deleted: true }`.
2. **This phone** (`lib/accountDeletion.mjs`, wired in `lib/accountDeletionDevice.js`), only after the backend confirms:
   1. Sign out of Clerk (failures ignored: the session may already be gone).
   2. Disconnect ChatGPT, which revokes its refresh token with OpenAI (8-second limit), then delete every SecureStore key for the person: `calmera.chatgpt.<id>` and its `.registration`, `.pending-registration`, `.model`, `.welcome`, plus `calmera.voice.<id>`.
   3. Remove every app-storage key that starts with `calmera.` and carries the person's ID (Today cache, food icons, meal times, theme, account-ready). Other people's keys on the phone stay.
   4. Sign In shows "Your account has been deleted."

The client never deletes the Clerk user itself. If it did and the data request then failed, the person could no longer sign in to retry, and their data would be orphaned.

Payments rows (legacy billing, off by default) are kept as financial records.

## Failures and retrying

Every step is safe to repeat, so the page always offers **Try again**, and each message says whether anything was deleted.

| What happened | Code | Message says |
| --- | --- | --- |
| No token: network down | `offline` | Nothing was deleted |
| Token refused before sending, or 401 | `sign_in_required` | Nothing was deleted; sign in again |
| 404 (backend without the route) | `unavailable` | Nothing was deleted |
| 429 rate limit | `busy` | Nothing was deleted |
| 500 `data_delete_failed` | `failed` | Nothing was deleted |
| 502 `account_close_failed` | `account_close_failed` | Data deleted, account not closed yet |
| Connection lost, timeout (60 s), other 5xx | `unknown` | Couldn't confirm; safe to repeat |

A retry asks Clerk for a fresh token. After an `unknown` or `account_close_failed` attempt, if Clerk says the session no longer exists, the account was most likely deleted: the phone signs out and clears, and Sign In says "If you can still sign in, your account wasn't deleted; try again from Settings."

A marker, `calmera.account-deletion.v1` in app storage, records `{ userId, stage }` (`requested` before the request, `deleted` once confirmed) and is removed when the phone is clean. `components/AccountDeletionResume.jsx` checks it at launch and whenever who's signed in changes:

- `deleted`, or the session has ended: finish signing out and clearing, then remove it.
- `requested` and the same person is still signed in: leave everything; the account may still exist.

## Testing without deleting a real account

- **Unit tests.** `tests/account-deletion.test.mjs` (app) covers every answer and failure, retries, the marker, launch resume, which keys are removed and which stay. `tests/accountDeletion.test.js` (backend) covers the transaction, Clerk failure and timeout, already-closed accounts, the second sweep, and a missing user, with a fake database and a fake Clerk.
- **App against a stand-in backend.** Build the review app with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5199/api` and run a local Express server that mounts the backend's real `deleteAccount` service and `requireSession` gate, with an in-memory database and a fake Clerk that can fail, stall or drop the answer on cue. Seed `calmera.*` keys for two users in the simulator's `RCTAsyncLocalStorage_V1/manifest.json`, delete one, and check that only that user's keys and the marker are gone. Verified on 2026-11-07: Clerk failure then retry, lost answer then retry, database failure, Clerk stall, bad token, and all three launch-resume cases.
- **Review gallery.** `delete-account`, `-deleting`, `-partial`, `-unknown`, `-offline`, `-unavailable` and `-done` show each state with nothing sent.
- **Against real services, once the backend is deployed.** Create a throwaway account (an email alias you own), log a meal, set goals, connect ChatGPT if you like, then delete it from Settings. Check that Clerk no longer lists the user, and that your own account still signs in with its data. Never test on an account you want to keep.

## Limits

- ChatGPT credentials saved on another phone stay on that phone (iOS keeps keychain items even after the app is removed). Only the phone that deletes revokes and forgets its own, so disconnect ChatGPT on other phones first.
- A request signed in the last minute before the account closed could still write after the second sweep. The person is signed out at once, so in practice nothing does.
