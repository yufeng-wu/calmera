// The one source for calmera's privacy text: the in-app pages, the first-run consent
// sheet and the public web pages (scripts/build-privacy-site.mjs) all read from here.
// Bump PRIVACY_POLICY_VERSION for any material change; everyone is then asked again.

export const PRIVACY_POLICY_VERSION = "2026-11-08";
export const PRIVACY_EFFECTIVE_DATE = "November 8, 2026";

// Filled in before publishing; see placeholdersRemaining().
export const PRIVACY_CONTACT = {
  publisher: "Yufeng Wu",
  email: "calmeradev@gmail.com",
};

export const OPENAI_PRIVACY_URL = "https://openai.com/policies/privacy-policy/";

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
    p(`calmera is a meal-logging app made by ${PRIVACY_CONTACT.publisher} (“calmera”, “we”, “us”). This policy explains what we collect, why, who receives it, and the choices you have. It covers the calmera app and the servers it uses.`),
  ],
  sections: [
    { id: "summary", heading: "The short version", blocks: [list(
      "We collect what calmera needs to work: your email, the meals you log and your daily goals.",
      "To estimate nutrition, calmera sends what you type, photos you choose and the text of what you say to OpenAI, through your own ChatGPT account. Your voice recording stays on your iPhone.",
      "We don’t sell your information, use it for advertising, or track you across other companies’ apps and websites.",
      "You can export or delete everything from Settings at any time.",
    )] },
    { id: "collect", heading: "Information we collect", blocks: [terms(
      ["Account", "Your email address, a username based on it, and the date you joined. Sign-in is handled by Clerk; we never see your password."],
      ["Meals", "For each meal you save: the food name, amount, calories, protein, carbohydrates, fat, meal type, and the date and time."],
      ["Goals", "Your daily calorie, protein, carbohydrate and fat goals, and the date each one starts."],
      ["Preferences", "Settings you save to your account."],
      ["Consent", "The version of this policy you agreed to, and when."],
      ["Technical", "When the app connects, our servers and providers receive your IP address and basic device and request details. We use them to keep calmera secure and to limit abuse."],
    )] },
    { id: "device", heading: "Information that stays on your iPhone", blocks: [list(
      "Voice recordings. Speech is turned into text on your iPhone; the recording isn’t saved or sent anywhere.",
      "Your goal survey answers, such as age, sex, height, weight and activity. Only the goals you save are sent to us.",
      "Photos, unless you choose to analyze them. Photos you analyze go to OpenAI as described below; we don’t store them.",
      "Your ChatGPT sign-in, kept in the iPhone’s secure Keychain.",
      "App settings such as theme, voice language and meal times, and a copy of recent data so the app opens quickly.",
    )] },
    { id: "ai", heading: "AI estimates by OpenAI", blocks: [
      p("calmera uses OpenAI’s models to estimate the nutrition in your meals. You connect your own ChatGPT account, and requests go from your iPhone directly to OpenAI under that account. They don’t pass through our servers."),
      p("What is sent:"),
      list(
        "The text you type about a meal.",
        "Photos you choose to analyze.",
        "The text of what you say when you log by voice.",
        "Food names and amounts you ask calmera to estimate, and instructions written by calmera.",
      ),
      p("Your email, saved meal history, goals and survey answers are not sent. calmera asks OpenAI not to store these requests for later use. OpenAI handles them under its own privacy policy and the terms of your ChatGPT account, which calmera doesn’t control."),
      link("OpenAI Privacy Policy", OPENAI_PRIVACY_URL),
      p("You can disconnect ChatGPT in Settings at any time. AI estimates then stop, and calmera forgets your ChatGPT sign-in on that iPhone."),
    ] },
    { id: "use", heading: "How we use information", blocks: [
      list(
        "To run calmera: save and show your meals, goals and progress on any iPhone you sign in on.",
        "To estimate nutrition when you ask.",
        "To keep calmera secure, prevent abuse and fix problems.",
        "To send account messages, such as sign-in codes, and to answer your requests.",
        "To meet legal obligations.",
      ),
      p("We don’t use your information for advertising, we don’t sell it, and we don’t use it to train AI models."),
    ] },
    { id: "share", heading: "Who receives information", blocks: [
      p("Service providers that run calmera for us, whose terms limit how they may use it:"),
      terms(
        ["Clerk", "Sign-in, account security and sign-in emails."],
        ["Neon", "Database hosting for your account, meals and goals."],
        ["Render", "Hosting for calmera’s servers."],
        ["Upstash", "Rate limiting, which briefly keeps IP addresses."],
      ),
      p("OpenAI, at your direction, as described above."),
      p("We may also disclose information if the law requires it, to protect the rights, safety and security of our users, us or others, or as part of a merger, acquisition or sale of assets, in which case this policy keeps applying to it."),
    ] },
    { id: "retention", heading: "How long we keep information", blocks: [list(
      "Your account, meals and goals stay until you delete them or your account.",
      "When you delete your account in the app, we delete your meals, goals and profile from our database right away and close your sign-in account. Copies in our providers’ backups and logs are removed on their regular schedules.",
    )] },
    { id: "rights", heading: "Your choices and rights", blocks: [
      terms(
        ["Export", "Settings → Export your data."],
        ["Correct", "Edit or delete any meal or goal in the app."],
        ["Delete", "Settings → your email → Delete account."],
        ["Withdraw consent", "Disconnect ChatGPT to stop AI estimates, or delete your account. calmera needs your agreement to this policy to work."],
      ),
      p("Depending on your state, you may also have the right to access, correct or delete your information, get a copy of it, and appeal our decision on a request. Contact us to make a request. We’ll confirm it comes from you, answer within the time the law allows, and never treat you differently for using these rights."),
      p("We don’t sell or share personal information as California law defines those terms."),
    ] },
    { id: "health-data", heading: "Consumer health data", blocks: [
      p("Meals and nutrition goals may be consumer health data under laws such as Washington’s My Health My Data Act. We collect and share them only as this policy describes, with your consent, and we never sell them."),
      doc("health-data"),
    ] },
    { id: "security", heading: "Security", blocks: [
      p("Information travels to and from calmera encrypted with HTTPS, your ChatGPT sign-in stays in the iPhone Keychain, and access to our systems is limited. No method is perfectly secure, so we can’t guarantee absolute security."),
    ] },
    { id: "children", heading: "Children", blocks: [
      p("calmera isn’t meant for children under 13, and we don’t knowingly collect their information. If you believe a child has given us information, contact us and we’ll delete it."),
    ] },
    { id: "where", heading: "Where calmera is offered", blocks: [
      p("calmera is free and offered only in the United States. We’re based in the United States, and our providers may process information in the United States and other countries."),
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
    { id: "categories", heading: "Health data we collect", blocks: [list(
      "Meals you log: food names, amounts, calories, protein, carbohydrates, fat, meal type, date and time.",
      "Your daily calorie, protein, carbohydrate and fat goals.",
      "Meal descriptions, photos and voice transcripts you send for AI estimates. These go from your iPhone to OpenAI; we don’t store them.",
    )] },
    { id: "purposes", heading: "Why we collect it and how we use it", blocks: [
      p("To provide calmera: to save and show your meals, goals and progress, and to estimate nutrition when you ask. We don’t use it for advertising and don’t sell it."),
    ] },
    { id: "sources", heading: "Where it comes from", blocks: [p("Directly from you, through the app.")] },
    { id: "sharing", heading: "Who we share it with", blocks: [terms(
      ["Service providers", "Neon (database hosting) and Render (server hosting), which store and process it only to run calmera."],
      ["OpenAI", "At your direction, through your ChatGPT account, to estimate nutrition."],
    )] },
    { id: "rights", heading: "Your rights", blocks: [
      p("You can confirm whether we collect your consumer health data, see it and a list of everyone we’ve shared it with, delete it, and withdraw your consent. Export your data and delete your account from Settings, or contact us. If we deny a request, you can appeal by replying to our decision, and if the appeal is denied you can contact the Washington State Attorney General."),
    ] },
    { id: "contact", heading: "Contact us", blocks: [p(contactLine())] },
  ],
};

export const PRIVACY_DOCS = { [PRIVACY_POLICY.id]: PRIVACY_POLICY, [HEALTH_DATA_POLICY.id]: HEALTH_DATA_POLICY };

// The first-run sheet. Agreeing covers the policy and sending to OpenAI; declining signs out.
export const CONSENT_COPY = {
  title: "Before you start",
  updatedTitle: "We’ve updated our Privacy Policy",
  lead: "Here’s how calmera handles your information.",
  updatedLead: "Please review how calmera handles your information.",
  data: {
    heading: "Your data",
    text: "We keep your email, meals and goals so calmera works wherever you sign in. We never sell them or use them for ads.",
  },
  ai: {
    heading: "AI estimates by OpenAI",
    text: "To estimate nutrition, calmera sends these to OpenAI through your ChatGPT account:",
    items: ["What you type about a meal", "Photos you choose to analyze", "The text of what you say"],
    note: "Your voice recording stays on this iPhone. OpenAI handles what it receives under its own privacy policy.",
  },
  agreement: "By tapping Agree and Continue, you agree to the Privacy Policy and allow calmera to send this information to OpenAI. You need to agree to use calmera.",
  agree: "Agree and Continue",
  decline: "Sign Out",
  saveFailed: "We couldn’t save your answer. Check your connection and try again.",
};

// Text still waiting for real details; a release must have none.
export function placeholdersRemaining() {
  return Object.entries(PRIVACY_CONTACT).filter(([, value]) => /^\[.*\]$/.test(value)).map(([key]) => key);
}
