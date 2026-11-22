// The one source for calmera's privacy text: the in-app pages, the first-run consent
// sheet and the public web pages (scripts/build-privacy-site.mjs) all read from here.
// Bump PRIVACY_POLICY_VERSION for any material change; everyone is then asked again.

// 2026-11-08 described the cloud version (accounts and calmera servers, tag cloud-v1).
// Set both to the publish date when this version is released.
// 2026-11-09 named only OpenAI; 2026-11-20 adds Anthropic for Claude API keys; 2026-11-21 adds
// Look up online (the provider's web search) and the usage record kept on the iPhone.
export const PRIVACY_POLICY_VERSION = "2026-11-21";
export const PRIVACY_EFFECTIVE_DATE = "November 21, 2026";

// Filled in before publishing; see placeholdersRemaining().
export const PRIVACY_CONTACT = {
  publisher: "Yufeng Wu",
  email: "calmeradev@gmail.com",
};

export const OPENAI_PRIVACY_URL = "https://openai.com/policies/privacy-policy/";
export const ANTHROPIC_PRIVACY_URL = "https://www.anthropic.com/legal/privacy";

// Who receives meals, in the words every page uses.
const PROVIDERS = "the AI provider you choose: OpenAI (through your ChatGPT account or your own OpenAI API key) or Anthropic (through your own Claude API key)";
// Look up online, in the one sentence every page uses.
export const LOOKUP_NOTICE = "When Look up online is on, which it is unless you turn it off in Settings, your AI provider may also search the web with what you log, such as a restaurant or brand name, using its own web search.";

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
  ],
  sections: [
    { id: "summary", heading: "The short version", blocks: [list(
      "calmera keeps your meals, goals and settings on your iPhone. There’s no calmera account, and we don’t run servers that receive them.",
      `To estimate nutrition, calmera sends what you type, photos you choose and the text of what you say to ${PROVIDERS}. Your voice recording stays on your iPhone.`,
      LOOKUP_NOTICE,
      "We don’t sell your information, use it for advertising, or track you across other companies’ apps and websites.",
      "You can export or erase everything from Settings at any time.",
    )] },
    { id: "collect", heading: "What calmera keeps on your iPhone", blocks: [
      terms(
        ["Meals", "For each meal you save: the food name, amount, calories, protein, carbohydrates, fat, meal type, and the date and time."],
        ["Goals", "Your daily calorie, protein, carbohydrate and fat goals, and the date each one starts."],
        ["Start date", "The day you started using calmera."],
        ["Preferences", "Settings such as theme, voice language and food icons."],
        ["Consent", "The version of this policy you agreed to, and when."],
        ["AI connection", "Your ChatGPT sign-in or API key, kept in the iPhone’s secure Keychain."],
      ),
      p("This information stays on your iPhone, and we can’t see it. If you use iCloud Backup, or set up a new iPhone with Quick Start, Apple copies it along with your other app data under your Apple account’s settings and Apple’s privacy policy."),
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
      p(LOOKUP_NOTICE),
      p("Your saved meal history, goals and survey answers are not sent. calmera asks OpenAI not to store these requests for later use. Each provider handles them under its own privacy policy and the terms of your account with it, which calmera doesn’t control."),
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
      p("calmera doesn’t send your meals, goals or settings to us or to any service provider."),
      p("The AI provider you choose receives what you send for estimates, at your direction, as described above."),
      p("If you write to us, we may disclose what you send if the law requires it, to protect the rights, safety and security of our users, us or others, or as part of a merger, acquisition or sale of assets, in which case this policy keeps applying to it."),
    ] },
    { id: "retention", heading: "How long information stays", blocks: [list(
      "Your meals, goals and settings stay on your iPhone until you change or erase them, or delete calmera.",
      "Copies in iCloud backups follow your backup settings.",
      "OpenAI and Anthropic keep what they receive as their privacy policies and your account settings describe.",
    )] },
    { id: "rights", heading: "Your choices and rights", blocks: [
      terms(
        ["Export", "Settings → Export your data."],
        ["Correct", "Edit or delete any meal or goal in the app."],
        ["Erase", "Settings → Erase all data, or delete calmera from your iPhone."],
        ["Withdraw consent", "Disconnect your AI provider to stop AI estimates, or erase all data. calmera needs your agreement to this policy to work."],
      ),
      p("Because your information stays on your iPhone, you can see, export and erase all of it yourself. Depending on your state, you may have other rights too. Contact us with any request; we’ll answer within the time the law allows and never treat you differently for using these rights."),
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
  ],
  sections: [
    { id: "categories", heading: "Health data calmera handles", blocks: [list(
      "Meals you log: food names, amounts, calories, protein, carbohydrates, fat, meal type, date and time. They stay on your iPhone.",
      "Your daily calorie, protein, carbohydrate and fat goals. They stay on your iPhone.",
      `Meal descriptions, photos and voice transcripts you send for AI estimates. These go from your iPhone to the AI provider you choose, OpenAI or Anthropic; calmera doesn’t store them. ${LOOKUP_NOTICE}`,
    )] },
    { id: "purposes", heading: "Why calmera uses it", blocks: [
      p("To provide calmera: to show your meals, goals and progress, and to estimate nutrition when you ask. We don’t use it for advertising and don’t sell it."),
    ] },
    { id: "sources", heading: "Where it comes from", blocks: [p("Directly from you, through the app.")] },
    { id: "sharing", heading: "Who receives it", blocks: [
      p("We don’t receive it, and calmera doesn’t send it to any service provider."),
      terms(
        ["OpenAI", "At your direction, through your ChatGPT account or your own OpenAI API key, to estimate nutrition."],
        ["Anthropic", "At your direction, through your own Claude API key, to estimate nutrition."],
      ),
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
  lead: "Here’s how calmera handles your information.",
  updatedLead: "Please review how calmera handles your information.",
  data: {
    heading: "Your data",
    text: "Your meals, goals and settings stay on this iPhone. There’s no account, and we never see them, sell them or use them for ads.",
  },
  ai: {
    heading: "AI estimates by OpenAI or Anthropic",
    text: `To estimate nutrition, calmera sends these to ${PROVIDERS}:`,
    items: ["What you type about a meal", "Photos you choose to analyze", "The text of what you say"],
    note: `Your voice recording stays on this iPhone. ${LOOKUP_NOTICE} Each provider handles what it receives under its own privacy policy. An API key stays in this iPhone’s Keychain.`,
  },
  agreement: "By tapping Agree and Continue, you agree to the Privacy Policy and allow calmera to send this information to the AI provider you choose, OpenAI or Anthropic. You need to agree to use calmera.",
  agree: "Agree and Continue",
  decline: "Not Now",
  declined: "calmera can’t open without your agreement. Nothing has been saved or sent. Agree whenever you’re ready.",
  saveFailed: "We couldn’t save your answer. Please try again.",
};

// Text still waiting for real details; a release must have none.
export function placeholdersRemaining() {
  return Object.entries(PRIVACY_CONTACT).filter(([, value]) => /^\[.*\]$/.test(value)).map(([key]) => key);
}
