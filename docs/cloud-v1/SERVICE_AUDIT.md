# Calmera full-app migration and service audit

> Current status after this audit: the backend fixes are deployed and the full
> simulator app has passed text/photo inference, save, restart and edit checks.
> See [FULL_APP_VERIFICATION.md](FULL_APP_VERIFICATION.md) and the current
> [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md). The earlier login/pending-deployment
> statements below describe the initial inspection snapshot, not current blockers.

Verified October 18, 2026. This is the original Expo app, with its existing UI,
Clerk identity and Neon meal storage. The standalone phone probe has passed
ChatGPT authorization, text and photo inference according to the user. Full-app
account creation, voice capture and real database saves still need an isolated
test account. No existing food rows or other phone messages were inspected.

## Target architecture

- Calmera account: existing Clerk login.
- AI account: a separately authorized ChatGPT connection scoped to that Calmera
  user in device-only Keychain storage. Users reconnect from the full app; no
  credentials are copied from the standalone probe or any other app.
- Text/quantity estimates and selected photos: phone -> official OpenAI Responses
  API, using the user's own grant, with store:false and stream:true.
- Voice: newly recorded local clip -> on-device speech recognition -> text to
  the same ChatGPT client. This grant does not support audio/transcription API.
- Persistence: phone -> existing Clerk-authenticated Calmera API -> Neon. Only
  allowlisted meal fields are saved, not ChatGPT tokens, photos or voice clips.
- Dashboard/history aggregate existing meal fields. The current goals survey
  already uses a local formula, so it does not need a model request.
- Live remains Coming soon. No iMessage, Shortcut, user Mac relay or ngrok.

## Actual service inventory

| Service | Purpose | Fresh result | What the developer needs to do |
| --- | --- | --- | --- |
| OpenAI / ChatGPT | User-owned AI inference | Standalone physical iPhone test passed, user-confirmed | No shared OpenAI API key; each user authorizes in the full app. Public distribution eligibility still needs separate confirmation. |
| Clerk | Calmera account and API authentication | Public JWKS 200; backend secret accepted with 200; backend/mobile signing keys match; development instance | Already logged in in Chrome. Keep this instance for internal tests. Later configure production instance for release; do not change test keys prematurely. |
| Neon Postgres | users, food_entries, user_goals | SELECT 1 succeeded; all required columns present | No schema migration or database recreation needed for replacing the inference provider. Console currently needs login, but not required to fix the current outage. |
| Render | Hosted Express API for accounts and meals | /api/health and unauthenticated /api/users/get-user both 500 | Signed in and inspected service logs/settings. Repeated Upstash DNS ENOTFOUND plus the deployed middleware next(error) path explains API 500s. Prepare the isolated Redis-only recovery patch before the full migration. |
| Upstash Redis | Shared API rate limits | PING unreachable or unauthorized | Console needs login. Optional for a single backend instance after prepared fallback is deployed. Restore correct credentials for shared multi-instance limits; do not rotate working credentials merely to test. |
| Expo / EAS | App build and distribution | Native local builds/signing already work | Expo login is optional for local simulator/USB builds. EAS cloud/TestFlight later requires project access; no cloud upload performed. |
| Apple Developer | iOS signing/distribution | Free Personal Team signed standalone probe; profile expires October 25 at 15:24 EDT | Current phone test works. Paid distribution setup is a later step. Old paid team's agreement issue only matters if reusing that team. |
| Google AI Studio / Gemini | Former inference | No reachable current-app inference path requires it | No new Gemini key/billing/login required. Old source retained, backend routes retired. No Google account/key deletion performed. |
| Stripe | Former Calmera premium/payment | Unmounted in current free app; removed from both resolved Expo variant configs | No Stripe or Apple Pay credentials needed. Historical payment data and original source remain intact. |
| ngrok | Former local tunneling | Not used by this architecture | No action. |
| Drive / Colab / model training | Legacy local scale/Live research assets | Not required by text/photo logging | No action; no files read or modified for this audit. |

The Chrome inspection opened only project provider consoles. No Clerk Users
page or Neon table-row browser was opened. Clerk's landing overview contains a
user-table container; no user details were extracted. Render initially showed login; the developer then logged in and only service settings and Redis-filtered error logs were inspected. Neon and Upstash resolved to login. No account settings changed.

## Database decision

Replacing Gemini with device-side ChatGPT does not change the meal DTO or tables.
Keep existing users, food_entries and user_goals. Required columns are present.
Do not add a ChatGPT credential column or token table. Existing payments tables
can remain untouched; billing is off. This audit checked column presence, not
all constraints, indexes, historical rows or every write permission.

## Render configuration to review after login

Do not paste secret values into chat. Compare/update inside the service's
Environment panel only when ready to apply the reviewed deployment.

Required:
- DATABASE_URL: keep existing working Neon connection, subject to verifying the
  deployed value matches the intended project.
- CLERK_SECRET_KEY: same Clerk instance as the app's publishable key. The local
  secret passed a public-key-only backend API check; remote configuration is
  not yet inspected.
- NODE_ENV=production.
- PORT: Render's injected port; server already reads process.env.PORT.
- CALMERA_ENABLE_BILLING=false.

Optional:
- UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN as a matched pair.
- API_URL: the existing production keep-alive cron uses this URL. Inspect the
  deployed setting and logs before changing it.

No model secret is needed. GEMINI_API_KEY, OPENAI_API_KEY and Stripe secrets are
not required for the free current path. Existing values have not been removed.
CALMERA_ENABLE_LEGACY_AI is ignored by current routing and cannot reactivate AI.

Deployment details to inspect, not guess:
- Linked repository and branch; local mobile and backend are separate Git repos.
- Service root directory, package installation, npm start command and health path.
- Current revision/logs, then reviewed diff and deployment.
- Existing startup creates missing schema/indexes with IF NOT EXISTS. No server
  was started in this audit and no startup DDL ran. Review that behavior before
  deploying; this report does not authorize destructive migrations.

## Mobile configuration

- EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: current development key matches local backend.
- EXPO_PUBLIC_API_BASE_URL: existing Render /api base, or an explicit test service.
- Resolved normal and standalone Expo configs omit Stripe; original bundle IDs,
  Clerk config and Expo project association remain unchanged.
- Existing generated native iOS project may retain old Apple Pay entitlements;
  synchronize only the required free-app signing configuration before the next
  full-app native build. Do not run prebuild --clean or uninstall the old app.
- The normal package main remains expo-router/entry; standalone probe is separate.

## Prepared code / verification

- Existing Voice Log, Photo Log and create/edit estimates use the mobile ChatGPT
  client. Quantity/transcript prompts retain the former Gemini business rules.
- Backend routes for /api/voice, /api/vision, macro estimation and AI goal
  recommendation now return 410 before body parsing or upload handling. Existing
  data APIs remain available; active controllers no longer import Gemini services.
- Local rate limits survive Redis failure; billing startup and payment lookup
  remain optional. These changes are not yet deployed to Render.
- 21 mobile synthetic checks passed. Four backend checks passed, including a
  local HTTP test proving retired inference/upload routes never reach downstream
  work while the ordinary food route remains available.
- Focused ESLint, syntax checks and git diff whitespace checks passed. The full original iOS Expo app exported successfully to dist/chatgpt-migration-20261018 (no cloud upload).
- Full runtime save/history/voice verification remains pending restoration of
  Render and use of a dedicated synthetic test Calmera account.

Official OpenAI reference, checked today:
https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

## Next sequence

1. Developer logs into Render in the already-open Chrome project tab.
2. Inspect project service logs/environment, establish cause of 500s and prepare
   the existing backend changes for an explicit reviewed deployment.
3. Verify health 200 and unauthenticated data endpoints rejected with 401/403,
   without reading any food rows.
4. Build a separately identified full-UI test app; use a dedicated test Calmera
   account and its own ChatGPT consent. Do not transfer probe credentials.
5. Use synthetic text/voice and the permitted photo to test save, edit and history
   only within that test account. No personal histories or original app deletion.

## Render follow-up: confirmed outage and isolated recovery

After the developer signed in, inspected cal_backend in the existing Render
workspace. Repository is yufeng-wu/cal_backend, main, deployed revision b8b818c,
which matches the local backend base. Root directory is blank (repository root),
build command npm install, start command npm run start. Health-check path is
currently blank. Secret values and deploy hook remained masked; no changes.

Redis-filtered logs repeatedly show getaddrinfo ENOTFOUND for the configured
Upstash hostname. The deployed middleware forwards any Redis exception via
next(error), ahead of all routes including health. This establishes the outage
path rather than merely assuming the database expired. Whether the Redis
resource was deleted, suspended or otherwise lost requires a separate Upstash
console check, which is not necessary for initial API recovery.

Prepared /tmp/calmera-redis-recovery.patch, limited to four files:
- src/config/upstash.js
- src/middleware/rateLimiter.js
- src/middleware/rateLimiterCore.js
- tests/rateLimiter.test.js

The patch makes shared Redis optional and preserves bounded local rate limits
when Redis fails. It does not deploy the full ChatGPT migration, change AI
routes, billing, database schema or secrets. It applies cleanly to the exact
deployed revision; three synthetic rate-limit tests pass. No commit, push,
production deployment or environment edit has been performed.

This first recovery preserves compatibility with the old installed app while
preparing the separate full-app ChatGPT transition. Source publication and
production rollout need an explicit final approval. No Redis purchase, new
account or credential rotation is required from the developer at this stage.
