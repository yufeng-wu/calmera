# Settings design system

The Settings tab and every page it opens share one list style. Tokens live in
`constants/settingsTheme.js`; the parts are `SettingsSection`, `SettingsTile` and
`settingsStyles` in `components/SettingsSection.jsx`, and `components/SettingsRow.jsx`.

## Rules

- **Show the value, not a description.** A row shows its current value on the right
  (English, Soft Tangerine, Connected) instead of a subtitle that explains the row.
  With large text the value moves under the title.
- **Every page has the same shape:** header, an optional one-line intro
  (`settingsStyles.lead`), then sections of label, white card and optional note, then one
  main button.
- **Cards:** white, radius 24, a 0.5 pt warm edge. Rows are at least 56 pt tall with
  16 pt padding. Dividers start where the title starts, not at the card edge.
- **Icon tiles:** 30 pt, radius 9, a pale fill with a darker icon, in these tints:
  cocoa for ChatGPT, sky for voice, plum for theme and model, tangerine for export,
  leaf for privacy and goal suggestions, rose for erasing.
- **Goals** always use the nutrient ring colors from `NUTRIENT_COLORS`, on the dots and
  on each slider's track. No goal can go below 1.
- **Saving** pages name their button for what it does (Update) and keep it off until
  something changed. Leaving with unsaved changes asks: Update, Discard Changes, or Keep
  Editing.
- **Menus** of commands open from their button (a "•••" pull-down), not as a sheet.
- The app is light only, so system menus, sheets and alerts stay light at night too.

## Motion

- A touched row or card shows the pressed color a moment after touch-down (so scrolling
  doesn't flash it) and fades it out over 260 ms on release (`usePressHighlight`).
- A chosen row's check springs in from 0.6 scale in about 200 ms; a check that's no
  longer chosen disappears at once. The theme ring and badge use the same spring.
- A value that arrives or changes after the page appears fades in over 180 ms. Values
  already there on first render just show (`LayoutAnimationConfig skipEntering`).
- Choosing gives a selection haptic; saving goals gives a success haptic and closes the
  page with no alert.
- With Reduce Motion on, the pops and fades happen at once.

## Layout of the Settings tab

1. Daily goals: four targets. Tap to edit.
2. Logging: AI connection, Voice language.
3. App: Theme, Export your data, Privacy policy, Erase all data (rose icon, plain title; its page lists
   what goes and asks again).
4. The wordmark and version.

Export always writes one JSON file with everything (`exportJson` in
`lib/dataExport.mjs`). The only choice is the last 30 days or all history.

## AI connection

Signing in to ChatGPT and pasting an API key are two ways of doing one thing, so they share
every step. The Settings row's value says which is in use: Not connected, ChatGPT, OpenAI key
or Anthropic key. Keys go by their company (OpenAI, Anthropic), signing in by the product
(ChatGPT), and models by their name alone.

With nothing connected, `app/(root)/ai-connection.jsx` shows "Choose one" and two cards of the
same width with "or" between. Your ChatGPT account says it uses the plan's limits and suits
ChatGPT Go, Plus or Pro; its filled **Sign in with ChatGPT** starts OpenAI's sign-in at once, and
a sign-in that fails says so in red in place of that text. An API key says it is from OpenAI or
Anthropic and which plans include monthly API credits, then "How to get credits: OpenAI ·
Anthropic" (links in the accent colour that open each company's help page in Safari); its
outlined **Paste a key** opens the key page. No prices, no intro and no recommendation; the
privacy line sits under both. Today's first voice, text or photo tap opens this same page and goes back to the
meal once connected.

Once connected, the one in use is a card of its own (its name, who or which key, a green
check and Connected; red with "Tap to …" when it needs connecting again), and the other way
folds into one row under it: Switch to an API key, or Switch to ChatGPT. Then, for either:

- **Estimates:** Model (opens `ai-model.jsx`: the provider's live list, names only, newest
  first; no model is singled out, the default is simply the one checked) and Online search (one
  switch, on by default; the note says what it does and costs).
- **The connection:** Check connection, Change account or Replace key, Disconnect, and who is
  billed.
- **Usage:** Last 7 days (opens `ai-usage.jsx`: estimated cost, requests, tokens and searches;
  one bar per day; each company and its models). With nothing connected it shows only if the
  last 7 days had requests.

Paste a key, a switch, Change account and Replace key open `ai-connect.jsx?method=chatgpt|key`,
one page for both: what you connect with (the ChatGPT account box or the key field), one line
under it (a hint, whose key it is, or what went wrong), one button (Connect, Switch to…,
Replace key), and a note that the old connection stays until the new one works. A switch is
said once afterwards in green; there is no warning before. Disconnect is the only alert. Model
names leave out the maker (Haiku 5.5, Sol 6.2), since the page already says whose they are.

Underneath, one record names the connection (`lib/ai/connection.mjs`), one controller runs
connect, check, disconnect and Online search for both (`lib/ai/connectionController.mjs`),
both report in one set of outcome words (`lib/ai/connectionMethods.mjs`) that
`lib/ai/connectionPresentation.mjs` turns into sentences, model lists come from
`lib/ai/modelCatalog.mjs`, preferences from `lib/ai/preferences.mjs`, and the usage record and
its prices from `lib/ai/usage.mjs` and `lib/ai/prices.mjs`.
