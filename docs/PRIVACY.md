# Privacy Policy and consent

## Where the text lives

`lib/privacyPolicy.mjs` is the only copy of the Privacy Policy, the Consumer Health Data Privacy Policy (Washington's My Health My Data Act) and the first-run consent sheet's wording. Three places read it:

- **Settings → Privacy Policy** (`app/(root)/privacy.jsx`), which links to the health data policy.
- **The consent sheet's "Privacy Policy" link**, which opens the same text in a page sheet.
- **The public web pages**: `node scripts/build-privacy-site.mjs [outDir]` writes `privacy/index.html` and `privacy/health-data/index.html`. Host them and put the first URL in App Store Connect.

The policy is US-only (calmera ships only in the US App Store) and names Yufeng Wu, calmeradev@gmail.com, as publisher and contact. `placeholdersRemaining()` and the site script flag any bracketed placeholder that comes back.

## Consent

`components/PrivacyConsentGate.jsx` wraps everything signed in (`app/(root)/_layout.jsx`), ahead of account setup. Until the person agrees to the current version, nothing else opens, so nothing reaches our servers or OpenAI. One sheet (`components/PrivacyConsentSheet.jsx`) covers both the policy and sending meal text, chosen photos and voice transcripts to OpenAI. It names OpenAI and has no pre-checked box. Agreeing is required: **Sign Out** is the only other choice.

The record `{ version, acceptedAt, ai: "openai" }` (`lib/privacyConsent.mjs`) is kept in two places:

- **This phone** (`calmera.privacy-consent.<userId>` in app storage). It's written first, so launch checks it instantly and an offline agreement still opens the app. Deleting the account removes it with the person's other keys.
- **Clerk** (`unsafeMetadata.calmeraConsent`), so another phone or a reinstall doesn't ask again. If saving there fails or takes over 10 seconds, the next launch retries. Clerk's copy goes when the account is deleted.

**Changing the policy.** For a material change, set `PRIVACY_POLICY_VERSION` and `PRIVACY_EFFECTIVE_DATE` to the new date. Everyone with an older record then sees "We've updated our Privacy Policy" and must agree again. Fixing a typo needs no new version.

## Testing

- `tests/privacy-consent.test.mjs`: status for every mix of phone and Clerk records, saving offline or when stalled, Clerk metadata kept intact, deletion clearing the key, policy wording (OpenAI, each kind of data, providers) and the web pages.
- Review gallery: `privacy-consent`, `privacy-consent-updated`, `privacy-consent-error`, `privacy`, `privacy-health-data`.
- Simulator, 2026-11-08: a review build with the gate turned on. Checked: first launch shows the sheet, the link opens the policy, Agree opens the app and saves the record, relaunch skips the sheet, and an older record shows the update title.

## Still to do outside the code

- Host the web pages, then add the URL in App Store Connect (App Privacy → Privacy Policy URL).
- Make the App Store privacy label match the policy: email, user ID, meals and goals (health), and content sent to OpenAI. None of it is used for tracking.
- Have a lawyer review the text.
