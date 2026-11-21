# Privacy Policy and consent

## Where the text lives

`lib/privacyPolicy.mjs` is the only copy of the Privacy Policy, the Consumer Health Data Privacy Policy (Washington's My Health My Data Act) and the first-run consent sheet's wording. Three places read it:

- **Settings → Privacy Policy** (`app/(root)/privacy.jsx`), which links to the health data policy.
- **The consent sheet's "Privacy Policy" link**, which opens the same text in a page sheet.
- **The public web pages**: `node scripts/build-privacy-site.mjs [outDir]` writes `privacy/index.html` and `privacy/health-data/index.html`. Host them and put the first URL in App Store Connect.

The policy is US-only (calmera ships only in the US App Store) and names Yufeng Wu, calmeradev@gmail.com, as publisher and contact. `placeholdersRemaining()` and the site script flag any bracketed placeholder that comes back.

## Consent

`components/PrivacyConsentGate.jsx` wraps the whole app (`app/(root)/_layout.jsx`). Until the person agrees to the current version, nothing else opens, so nothing reaches an AI provider. One sheet (`components/PrivacyConsentSheet.jsx`) covers both the policy and sending meal text, chosen photos and voice transcripts to the AI provider the person chooses. It names OpenAI (ChatGPT account or OpenAI API key) and Anthropic (Claude API key) and has no pre-checked box. Agreeing is required: **Not Now** explains that calmera can't open without it and keeps the sheet up.

The record `{ version, acceptedAt, ai: ["openai", "anthropic"] }` (`lib/privacyConsent.mjs`) is kept only on this iPhone (`calmera.privacy-consent.local` in app storage), so launch checks it instantly. Settings → Erase all data removes it with everything else, and calmera then asks again.

**Changing the policy.** For a material change, set `PRIVACY_POLICY_VERSION` and `PRIVACY_EFFECTIVE_DATE` to the new date. Everyone with an older record then sees "We've updated our Privacy Policy" and must agree again. Fixing a typo needs no new version. The phone-only text was version 2026-11-09; 2026-11-20 adds Anthropic for Claude API keys, so earlier agreements are asked again; set both to the real publish date before release.

## Testing

- `tests/privacy-consent.test.mjs`: status for missing, older and current records, saving and reading on the phone, a save that fails, erasing removing the record, policy wording (OpenAI and Anthropic with both links, each kind of data, no account or calmera servers, Erase all data) and the web pages.
- Review gallery: `privacy-consent`, `privacy-consent-updated`, `privacy-consent-error`, `privacy`, `privacy-health-data`.

## Still to do outside the code

- Host the web pages, then add the URL in App Store Connect (App Privacy → Privacy Policy URL).
- Make the App Store privacy label match the policy: meals, goals and settings stay on the iPhone, and meal text, photos and voice text go to the AI provider the person connects: OpenAI (ChatGPT account or OpenAI API key) or Anthropic (Claude API key). `ios/mobile/PrivacyInfo.xcprivacy` declares this as Other User Content and Photos, for app functionality. None of it is used for tracking.
- Have a lawyer review the text.
