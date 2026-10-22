# ChatGPT-plan Fast capability check — October 20, 2026

## Observed result

One live, fixed non-personal request was made through Calmera's existing ChatGPT-plan OAuth connection in the original signed-in test simulator. No API-key account/billing path or model selection was changed.

| Field | Observed value |
| --- | --- |
| Model | `gpt-6-luna` (the existing selection) |
| Input | `Reply with exactly OK.` |
| Requested processing tier | `priority` (the documented Fast alias) |
| Required HTTP flags | `store: false`, `stream: true` |
| Final response status | `completed` |
| Actual server tier | `default` |
| Fast activated in Calmera | No |

The result was read from the validated `response.completed` object, not inferred from HTTP 200 or the outgoing parameter. The actual check page showed the model, requested tier, server tier `default`, and that Fast was not verified. It exposed no credentials or response text. Exactly one live inference request was attempted; no automatic or standard-tier retry occurred. No meal/goal record or account setting was written.

This establishes that this particular connection/model/request did **not** run in Fast mode. It does not establish that every ChatGPT-plan model rejects Fast. Server downgrades and different model/account availability remain possible. No latency A/B test was performed. Further models were not tested without a separate user choice.

## Retained diagnostic and unchanged production behavior

`completedResponse` returns text plus the server-reported tier only after the full stream is validated. Existing `completedText` retains its string contract. Missing/unknown tiers remain unknown and a reported downgrade remains `default`; failures never yield successful Fast metadata.

The plan client has a full-test-build-only `checkFastMode` helper using the fixed input above and the same existing authorization/endpoint. Production meal requests still omit `service_tier`, and no new preference reads, writes or Fast activation policy are retained. Safe error reporting exposes only a short HTTP/error code and whether the rejected parameter was `service_tier`.

The private `/fast-mode-check` route now requires an explicit one-shot button press: merely opening a URL cannot start inference. It uses the existing focus/task cancellation guard, never retries automatically, and cannot save meals or change models. The initial explicitly requested live check ran before this final manual-only diagnostic revision; rebuilding/inspecting the final page must not cause a second live inference.

Validation: 253/253 synthetic JavaScript tests, including eight new parser/client regressions, scoped ESLint and whitespace checks passed. Tests use fake native/storage/network adapters and verify request flags/auth headers, no production tier or storage change after a probe, downgrade handling, current connection use, and production-build gating. The final Release build log is `/tmp/calmera-fast-diagnostic-build.log`; the live check used the preceding tested Release build. The final page's ready state is checked without pressing its request button.

## Simulator display

Astra's UI fix is commit `711026f`. The iOS 27 display simulator is `Calmera Glass iOS 27`, UDID `C619B1C9-8AAE-49F6-A679-73BB47416A5E`, in Xcode Device Hub. It was reopened on `/background-compare`, the existing actual-component preview with explicitly labelled example meals. Its glass implementation was not edited. The separate original simulator `F3584334-39B2-46E4-9E17-3AE2D9945376` supplied the existing signed-in connection for the one Fast check; credentials were not copied between simulators or extracted into tools.

The Device Hub is returned to the iOS 27 simulator after checking the result. No physical iPhone, camera/microphone, real meal/photo inference, personal record inspection, screenshots saved/exported, sign-out/account switch or backend changes were involved. Existing separate OpenAI-logo edits remain uncommitted and excluded.

## Official sources checked

- [Fast mode](https://developers.openai.com/api/docs/guides/fast-mode): `fast` and `priority` select the Fast tier in supported API requests; the returned tier identifies what actually served the request. Ordinary API Fast usage has premium pricing, which is not proof of entitlement or billing behavior for this ChatGPT-plan connection.
- [ChatGPT-plan models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference): account-specific model catalog, public `/v1/responses` endpoint and required `store: false` / `stream: true` flags.
- [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations): restrictions for the subscription-authorized route. These docs do not specifically establish Fast entitlement for the current account/model.
