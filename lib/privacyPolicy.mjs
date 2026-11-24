// The one source for calmera's privacy text: the in-app pages, the first-run consent
// sheet and the public web pages (scripts/build-privacy-site.mjs) all read from here.
// Bump PRIVACY_POLICY_VERSION for any material change; everyone is then asked again.

// 2026-11-08 described the cloud version (accounts and calmera servers, tag cloud-v1).
// Set both to the publish date when this version is released.
// 2026-11-09 named only OpenAI; 2026-11-20 adds Anthropic for Claude API keys; 2026-11-21 adds
// Online search (the provider's web search) and the usage record kept on the iPhone.
export const PRIVACY_POLICY_VERSION = "2026-11-23";
export const PRIVACY_EFFECTIVE_DATE = "November 23, 2026";

// Filled in before publishing; see placeholdersRemaining().
export const PRIVACY_CONTACT = {
  publisher: "Yufeng Wu",
  email: "calmeradev@gmail.com",
};

export const OPENAI_PRIVACY_URL = "https://openai.com/policies/privacy-policy/";
export const ANTHROPIC_PRIVACY_URL = "https://www.anthropic.com/legal/privacy";

// Who receives meals, in the words every page uses.
const PROVIDERS = "the AI provider you choose: OpenAI (through your ChatGPT account or your own OpenAI API key) or Anthropic (through your own Anthropic API key)";
// Online search, in the one sentence every page uses.
export const SEARCH_NOTICE = "Online search is on by default. Your AI provider may use details from your request, such as a restaurant or brand name, in a web search. You can turn it off in Settings → AI connection.";

const EARLIER_VERSION = "This policy covers the iPhone version that stores the journal on your device. If you used an earlier version with a Calmera account, contact calmeradev@gmail.com about that account or its records. Erasing this iPhone does not erase records held by an earlier service.";

const p = (text) => ({ type: "p", text });
const list = (...items) => ({ type: "list", items });
const terms = (...items) => ({ type: "terms", items: items.map(([term, text]) => ({ term, text })) });
const link = (text, url) => ({ type: "link", text, url });
const doc = (id) => ({ type: "doc", id });

const contactLine = () => `${PRIVACY_CONTACT.publisher}, ${PRIVACY_CONTACT.email}`;

export const PRIVACY_POLICY = {
  id: "privacy",
  title: "Privacy Policy",
  intro: [
    p(`calmera is a meal-logging app made by ${PRIVACY_CONTACT.publisher} (“calmera”, “we”, “us”). This policy explains what calmera keeps, where it keeps it, who receives information, and the choices you have.`),
    p(EARLIER_VERSION),
  ],
  sections: [
    { id: "summary", heading: "The short version", blocks: [list(
      "calmera keeps your meals, goals and settings on your iPhone. There’s no calmera account, and we don’t run servers that receive them.",
      `To estimate nutrition, calmera sends what you type, photos you choose and the text of what you say to ${PROVIDERS}. Your voice recording stays on your iPhone.`,
      SEARCH_NOTICE,
      "We don’t sell your information, use it for advertising, or track you across other companies’ apps and websites.",
      "You can export your meals and current goals or erase Calmera’s local data in Settings.",
    )] },
    { id: "collect", heading: "What calmera keeps on your iPhone", blocks: [
      terms(
        ["Meals", "For each meal you save: the food name, amount, calories, protein, carbohydrates, fat, meal type, and the date and time."],
        ["Goals", "Your daily calorie, protein, carbohydrate and fat goals, and the date each one starts."],
        ["Start date", "The day you started using calmera."],
        ["Preferences", "Settings such as theme, voice language and food icons."],
        ["Consent", "The version of this policy you agreed to, and when."],
        ["AI connection", "Your ChatGPT sign-in or API key, kept in the iPhone’s secure Keychain."],
        ["AI usage", "For each AI request in the last 7 days: when it was made, the provider and model, and how many tokens and web searches it used, so you can see what your AI use costs. Never what you logged."],
      ),
      p("Calmera excludes the journal from iCloud Backup. To keep a separate copy of your meals and current goals, use Settings → Export your data. You choose where the export goes. Your AI credentials are stored in the Keychain for this iPhone."),
    ] },
    { id: "device", heading: "Information calmera doesn’t keep", blocks: [list(
      "Voice recordings. Speech is turned into text on your iPhone; the recording isn’t saved or sent anywhere.",
      "Your goal survey answers, such as age, sex, height, weight and activity. Only the goals you choose to save are kept.",
      "Photos. Photos you choose to analyze go to your AI provider as described below; calmera doesn’t store them.",
    )] },
    { id: "ai", heading: "AI estimates by OpenAI or Anthropic", blocks: [
      p(`calmera uses AI models to estimate the nutrition in your meals. Meals you type or say and meal photos are sent to ${PROVIDERS}. Requests go from your iPhone directly to that provider under your account. calmera has no servers of its own, so nothing passes through us.`),
      p("What is sent:"),
      list(
        "The text you type about a meal.",
        "Photos you choose to analyze.",
        "The text of what you say when you log by voice.",
        "Food names and amounts you ask calmera to estimate, and instructions written by calmera.",
      ),
      p(SEARCH_NOTICE),
      p("The app sends the meal or food you ask about. Your full journal, goals and survey answers stay on the phone. Your provider authenticates each request under your account. When you sign in with ChatGPT, OpenAI also receives an identifier for this app installation. The app keeps the sign-in details it needs on this iPhone, including the email address OpenAI supplies to identify the connected account."),
      p("Calmera sets OpenAI’s response storage option to off. Providers may still retain inputs, outputs or request metadata. For OpenAI API keys, abuse-monitoring logs can contain content and are generally kept for up to 30 days. Anthropic normally deletes API inputs and outputs within 30 days. Account agreements, legal requirements and safety investigations can change those periods. For ChatGPT sign-in, your OpenAI account terms and applicable data controls govern processing."),
      link("OpenAI API data controls", "https://developers.openai.com/api/docs/guides/your-data"),
      link("ChatGPT plan usage and privacy", "https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites"),
      link("Anthropic API retention", "https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"),
      link("OpenAI Privacy Policy", OPENAI_PRIVACY_URL),
      link("Anthropic Privacy Policy", ANTHROPIC_PRIVACY_URL),
      p("You can disconnect your AI provider in Settings at any time. AI estimates then stop, and calmera forgets your ChatGPT sign-in or API key on that iPhone."),
    ] },
    { id: "use", heading: "How calmera uses information", blocks: [
      list(
        "To show your meals, goals and progress on your iPhone.",
        "To estimate nutrition when you ask.",
        "To answer you when you contact us.",
      ),
      p("We don’t use your information for advertising, we don’t sell it, and we don’t use it to train AI models."),
    ] },
    { id: "share", heading: "Who receives information", blocks: [
      p("Calmera has no journal server. The publisher cannot access your saved journal."),
      p("The AI provider you choose receives what you send for estimates, at your direction, as described above."),
      p("If you write to us, we may disclose what you send if the law requires it, to protect the rights, safety and security of our users, us or others, or as part of a merger, acquisition or sale of assets, in which case this policy keeps applying to it."),
    ] },
    { id: "retention", heading: "How long information stays", blocks: [list(
      "Your meals, goals and settings stay on your iPhone until you change or erase them, or delete calmera.",
      "The AI usage record keeps only the last 7 days.",
      "Exported copies remain wherever you saved or shared them until you delete them there.",
      "OpenAI and Anthropic keep what they receive as their privacy policies and your account settings describe.",
    )] },
    { id: "rights", heading: "Your choices and rights", blocks: [
      terms(
        ["Export", "Settings → Export your data."],
        ["Correct", "Edit or delete any meal or goal in the app."],
        ["Erase", "Settings → Erase all data removes the journal, preferences, consent and saved AI credentials from this iPhone. Erasing the app’s data does not delete requests already received by a provider. For those requests, use the provider’s privacy controls or contact the provider."],
        ["Withdraw consent", "Disconnect your AI provider to stop AI estimates, or erase all data. calmera needs your agreement to this policy to work."],
      ),
      p("Because your information stays on your iPhone, you can review the journal yourself, export meals and current goals, and erase the local data. Depending on your state, you may have other rights too. Contact us with any request; we’ll answer within the time the law allows and never treat you differently for using these rights."),
      p("We don’t sell or share personal information as California law defines those terms."),
    ] },
    { id: "health-data", heading: "Consumer health data", blocks: [
      p("Meals and nutrition goals may be consumer health data under laws such as Washington’s My Health My Data Act. calmera keeps them on your iPhone, shares them only as this policy describes, with your consent, and never sells them."),
      doc("health-data"),
    ] },
    { id: "security", heading: "Security", blocks: [
      p("Your information stays on your iPhone, protected by iOS, and your ChatGPT sign-in or API key stays in the iPhone Keychain. Requests to OpenAI and Anthropic are encrypted with HTTPS. No method is perfectly secure, so we can’t guarantee absolute security."),
    ] },
    { id: "children", heading: "Children", blocks: [
      p("calmera isn’t meant for children under 13. If you believe a child has sent us information, contact us and we’ll delete it."),
    ] },
    { id: "where", heading: "Where calmera is offered", blocks: [
      p("calmera is free and offered only in the United States. We’re based in the United States, and OpenAI and Anthropic may process what you send them in the United States and other countries."),
    ] },
    { id: "changes", heading: "Changes to this policy", blocks: [
      p("If we change this policy, we’ll update the date at the top. If a change is material, the app will ask for your agreement before it applies to you."),
    ] },
    { id: "contact", heading: "Contact us", blocks: [p(contactLine())] },
  ],
};

export const HEALTH_DATA_POLICY = {
  id: "health-data",
  title: "Consumer Health Data Privacy Policy",
  intro: [
    p("This policy adds to our Privacy Policy. It covers consumer health data as defined by Washington’s My Health My Data Act and similar state laws."),
    p(EARLIER_VERSION),
  ],
  sections: [
    { id: "categories", heading: "Health data calmera handles", blocks: [list(
      "Meals you log: food names, amounts, calories, protein, carbohydrates, fat, meal type, date and time. They stay on your iPhone.",
      "Your daily calorie, protein, carbohydrate and fat goals. They stay on your iPhone.",
      `Meal descriptions, photos and voice transcripts you send for AI estimates. These go from your iPhone to the AI provider you choose, OpenAI or Anthropic; calmera doesn’t store them. ${SEARCH_NOTICE}`,
    )] },
    { id: "purposes", heading: "Why calmera uses it", blocks: [
      p("To provide calmera: to show your meals, goals and progress, and to estimate nutrition when you ask. We don’t use it for advertising and don’t sell it."),
    ] },
    { id: "sources", heading: "Where it comes from", blocks: [p("Directly from you, through the app.")] },
    { id: "sharing", heading: "Who receives it", blocks: [
      p("When you request an estimate, the AI provider you connect receives the selected meal details under your account. Calmera’s publisher does not receive your journal or the estimate request."),
      terms(
        ["OpenAI", "At your direction, through your ChatGPT account or your own OpenAI API key, to estimate nutrition."],
        ["Anthropic", "At your direction, through your own Anthropic API key, to estimate nutrition."],
      ),
    ] },
    { id: "retention", heading: "Storage and deletion", blocks: [
      p("Your journal is excluded from iCloud Backup. You can export meals and current goals to a destination you choose. Erasing the journal leaves existing exports and provider records separate. Your provider’s retention and deletion terms apply to the requests it receives."),
      doc("privacy"),
    ] },
    { id: "rights", heading: "Your rights", blocks: [
      p("Your health data is on your iPhone: you can see it in calmera, export it from Settings, erase it with Settings → Erase all data, and withdraw your consent by disconnecting your AI provider or erasing all data. Contact us with any request. If we deny a request, you can appeal by replying to our decision, and if the appeal is denied you can contact the Washington State Attorney General."),
    ] },
    { id: "contact", heading: "Contact us", blocks: [p(contactLine())] },
  ],
};

export const PRIVACY_DOCS = { [PRIVACY_POLICY.id]: PRIVACY_POLICY, [HEALTH_DATA_POLICY.id]: HEALTH_DATA_POLICY };

// The first-run sheet. Agreeing covers the policy and sending to the chosen AI provider; without it,
// calmera stays on the sheet.
export const CONSENT_COPY = {
  title: "Before you start",
  updatedTitle: "We’ve updated our Privacy Policy",
  lead: "Calmera uses AI to estimate nutrition whenever you log a new meal.",
  updatedLead: "Please review how Calmera shares meal details for AI estimates before continuing.",
  data: {
    heading: "Your data",
    text: "Your saved meals, goals and settings stay on this iPhone. There’s no Calmera account.",
  },
  ai: {
    heading: "AI estimates by OpenAI or Anthropic",
    text: `When you request an estimate, Calmera sends the meal details you select to ${PROVIDERS}:`,
    items: ["What you type about a meal", "Photos you choose to analyze", "The text of what you say"],
    note: `Your voice recording stays on this iPhone. ${SEARCH_NOTICE} Each provider handles what it receives under its own privacy policy. An API key stays in this iPhone’s Keychain.`,
  },
  agreement: "Allow AI and Continue means you agree to the Privacy Policy and allow Calmera to share these meal details with the provider you choose, OpenAI or Anthropic.",
  agree: "Allow AI and Continue",
  decline: "Not Now",
  declined: "Calmera needs your permission to estimate meals. You can read the policy here and come back whenever you’re ready.",
  saveFailed: "We couldn’t save your answer. Please try again.",
};

// Text still waiting for real details; a release must have none.
export function placeholdersRemaining() {
  return Object.entries(PRIVACY_CONTACT).filter(([, value]) => /^\[.*\]$/.test(value)).map(([key]) => key);
}
