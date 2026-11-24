# Privacy and App Review

## Consent and data flow

The app and the two public policies share their wording in `lib/privacyPolicy.mjs`. The first-run screen names OpenAI and Anthropic, lists the data each estimate can send and explains optional web search. **Allow AI and Continue** records the policy version on the iPhone. **Not Now** keeps the consent screen open. Both policies can be read before deciding. A material change to the disclosures requires a new version and agreement.

Every new meal starts with a successful AI estimate. People can correct the result before saving and edit existing entries afterward. Disconnecting in Settings stops future estimates. Erase all data removes the journal, local consent and credentials. Exports already shared and records retained by the AI provider have separate lifecycles.

## Public pages

Generate both pages directly into the website checkout from the app repository root.

```sh
node scripts/build-privacy-site.mjs /path/to/website/calmera
```

After publishing, compare the HTML served at both URLs with the generated files. [Privacy Policy](https://yufengwu.dev/calmera/privacy/) · [Consumer Health Data Privacy Policy](https://yufengwu.dev/calmera/privacy/health-data/)

## App Privacy answers for this build

The selected provider receives requests on an identifiable account and can retain content beyond the request. The app declares the following categories as **linked to the user**, for **App Functionality**, with **Tracking** set to **No**. Review the archive’s aggregated privacy report and the provider terms when entering the answers in App Store Connect. [Apple’s definitions](https://developer.apple.com/app-store/app-privacy-details/)

| Data type | What leaves the phone |
| --- | --- |
| Health | Meal and nutrition details submitted for an estimate. Saved goals and goal-survey inputs are local. |
| Other User Content | Typed meal descriptions, voice transcripts, and food names and portions submitted for analysis. |
| Photos or Videos | The chosen meal photo when the person requests an estimate. |
| User ID | Requests authenticate to the person’s AI provider account or API project. |
| Device ID | ChatGPT registration sends OpenAI a persistent identifier generated for this installation. |

Voice audio is transcribed on the phone. The journal’s app storage is excluded from iCloud Backup. Provider retention depends on the service, account and any applicable exceptions. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data) · [ChatGPT plan controls](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites) · [Anthropic API retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)

## App Review access

Provide the dedicated reviewer credential privately in App Store Connect’s App Review Information. Verify it on the production build with sufficient model access and available credit throughout review. Keep the credential out of screenshots, source control and public metadata.

Suggested reviewer notes for the Anthropic path:

> Calmera is a free iPhone meal journal. New meals use AI to estimate nutrition. On first launch, read the disclosure and tap Allow AI and Continue. Open Settings → AI connection → Add API key and enter the Anthropic review key supplied privately with this submission. In Text Log, enter “one apple and one cup of plain yogurt,” tap Analyze Meal, review the foods and tap Save to choose a meal category. The result appears in Today and History. Photo Log and Voice Log use the same connection. An eligible ChatGPT plan is another connection option. No Calmera account is required.

The first release is intended for the US storefront. Record the actual privacy questionnaire, support and privacy URLs, reviewer access and build number in App Store Connect before submission. The public repository reserves reuse rights. Retain the basis for offering ChatGPT plan access in this distribution if Apple requests it. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [OpenAI plan-usage documentation](https://developers.openai.com/siwc/token-sharing-open-source)
