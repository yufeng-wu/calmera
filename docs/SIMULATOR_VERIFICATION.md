# Verified: standalone iOS simulator ChatGPT inference

Verified October 18, 2026, after the user completed interactive OpenAI identity
verification in the standalone Calmera AI Test app. This supersedes the earlier
provider consent timeouts as the current simulator status. The later physical-iPhone result is recorded below; App Store distribution
eligibility remains unverified.

## Physical-iPhone follow-up — user confirmed

On October 18, 2026, the separate Release test app was signed with a new free
Personal Team and installed on the connected physical iPhone. Signature and
provisioning checks passed. After personally trusting the developer certificate,
the user reported that the app opened, connected to ChatGPT, and passed both
text and photo tests. The agent did not inspect phone test contents or other
phone data. These are user-confirmed hardware results, distinct from the
agent-observed simulator checks below. See [PHONE_TEST.md](PHONE_TEST.md).

Physical-device restart persistence, refresh after token expiry, disconnected
USB operation and public distribution remain separate checks.

## Environment and scope

- Dedicated iPhone 17 Pro / iOS 26.0 simulator: Calmera ChatGPT Test.
- Standalone Release app: `com.yfwu02.calmera.chatgpttest`, embedded JS bundle.
- App entry: `phone-test-entry.jsx`; no Clerk session or backend save path.
- UI showed **Connected · GPT-6.1-Sol** and **Secure storage ready**.
- The configured client directly uses its own OAuth grant against OpenAI's public
  model catalog and Responses endpoint. No credentials were extracted, printed,
  transferred from ChatGPT/Codex, or sent to the Calmera backend.
- No personal messages, unrelated phone content or database food rows were read.
  No database meal was written. No screenshot was saved by the agent.

## Observed results

| Check | Evidence | Result |
| --- | --- | --- |
| In-app authorization | User completed interactive verification; standalone app displayed Connected and an authenticated model selection | Passed in simulator |
| Supplied meal photo | User screenshot and live app UI both showed Completed, not saved, with three food entries | Passed in simulator |
| Synthetic text | Agent tapped Run text test with the user's fictional pineapple description, 400 g edible portion; UI displayed Completed, not saved, Pineapple 400 g, 200 kcal, P 2.2 g, C 52.5 g, F 0.5 g | Passed in simulator |
| Restart persistence | Agent terminated/relaunched only the standalone test bundle; UI again showed Secure storage ready and Connected · GPT-6.1-Sol, with model catalog loaded | Passed in simulator |

The photo result identified a grilled fish sandwich, fries and dipping sauce.
These observations verify working inference, stream completion and display of
validated food records. They do **not** validate true portion sizes, ingredients
or nutrient accuracy. The supplied image was an explicitly authorized test.

Restart persistence confirms Calmera could reuse its own protected credentials
and reload the model catalog. It does **not** prove refresh-token rotation after
expiry; no expiry was forced and no credential was edited. Multi-day use, quota
exhaustion and revocation/reconnect remain outstanding. Later physical-iPhone
authorization/text/photo success was reported by the user.

## Next boundary

The separate physical-phone test app is now installed and user-confirmed for
ChatGPT connection and text/photo inference. Next validate physical-device
restart persistence and refresh after expiry, then restore the existing backend
for full Calmera account/meal-save testing. No cloud build, TestFlight upload or
public App Store submission has been performed.
