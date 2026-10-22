# Calmera development setup checklist

Updated October 18, 2026 after deployment and full-app simulator verification.
Detailed evidence: [FULL_APP_VERIFICATION.md](FULL_APP_VERIFICATION.md).

## Working now

- Existing UI: Dashboard / History / Settings and existing create/edit forms retained.
- Complete simulator app: user personally signed into Calmera and connected their
  ChatGPT account. The user explicitly allowed using an existing Calmera account.
- Text/quantity inference -> ordinary authenticated meal save -> Neon verified.
- App restart -> reopen only the new synthetic record -> re-estimate/edit/save verified.
- Selected synthetic image -> ChatGPT -> saved exact printed nutrition values verified.
- Five agent-created rows are clearly labeled as simulator or physical phone tests (92, 93, 97, 98, 99). No existing
  meal was deleted or edited, and old records were not browsed or queried.
- Backend fixes published and deployed: local rate limits, correct signed-out
  status, server AI retired and free-app billing dependencies optional.
- Final live probes: health 200; unauthenticated account 401; old macro estimate,
  voice, vision and AI-goal endpoints 410. Data APIs remain Clerk-authenticated.
- Seven backend synthetic tests and 22 mobile contract/diagnostic tests passed. Complete
  simulator and signed physical Release builds succeeded.

## What the developer needs to do

| Area | Current action |
| --- | --- |
| Physical full app | Calmera Test login, own-plan ChatGPT text/image inference and synthetic database saves now passed on the physical phone. Credentials are separate and were not copied. The user personally granted microphone permission. Generated audio -> actual on-device transcription -> ChatGPT -> database save also passed. Live microphone capture/hold gesture and camera capture have not been tested. |
| Redis | Nothing required now. Bounded local rate limits are the default; stale Redis settings are not contacted. Shared Redis can be restored later with CALMERA_RATE_LIMIT_MODE=shared and a matched valid URL/token. |
| Neon | Connection and core columns healthy; new synthetic saves verified. Keep the existing database. No inference-provider schema migration or credential table is needed. |
| Clerk | Existing development instance and matched keys work. No key update required for current tests. Configure a production instance only when preparing public release. |
| Render | Logged in, fixes deployed. No new model secret required; existing environment values were not changed. |
| Signing | Full Calmera Test profile expires October 25, 2026 at 16:05 EDT. The earlier standalone AI Test has its own profile/expiry. Re-sign when needed; no paid membership was purchased. |
| Expo / EAS | No login required for the local USB/simulator builds already completed. Cloud distribution is optional and has not been started. |
| Public release | Apple paid distribution setup and eligibility of the exact OpenAI integration still require separate confirmation. No App Store approval is claimed. |

## Configuration to retain

Mobile public build settings:
- EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
- EXPO_PUBLIC_API_BASE_URL

Backend only:
- DATABASE_URL
- CLERK_SECRET_KEY
- PORT (Render-managed), NODE_ENV
- Existing API_URL for the production keep-alive job
- CALMERA_RATE_LIMIT_MODE defaults to local; shared is explicit opt-in
- CALMERA_ENABLE_BILLING defaults off

Gemini/OpenAI API keys, Stripe credentials, ngrok and an always-on user Mac are
not required by the current inference path. Do not delete old credentials or
payment records merely to migrate. Server AI cannot be reenabled with the old
CALMERA_ENABLE_LEGACY_AI flag. Audio uses local transcription before text inference;
physical on-device file recognition passed after the user personally granted the permission required by the native library. No environment microphone capture occurred during the synthetic test.

## Code and deployment references

- PR 1: https://github.com/yufeng-wu/cal_backend/pull/1
- PR 2: https://github.com/yufeng-wu/cal_backend/pull/2
- PR 3: https://github.com/yufeng-wu/cal_backend/pull/3
- Full test build: scripts/build-full-app-test.sh; standalone: scripts/build-phone-test.sh.
- Regular main remains expo-router/entry. CALMERA_FULL_APP_TEST=1 selects only a
  separate name/scheme/app identifier; original app and probe are preserved.
- Source configuration omits Stripe. Local full-test builds override inherited
  native Apple Pay entitlements without deleting or regenerating the original project.
- The original startup's idempotent schema/index initialization remains. There
  was no destructive migration, personal meal deletion, source cloud-build upload
  or public app submission.
