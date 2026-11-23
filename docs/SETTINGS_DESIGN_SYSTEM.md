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

One connection at a time, made one of two ways: signing in with ChatGPT, or an API key from
OpenAI or Anthropic. To change how it connects, a person disconnects and connects again; there
is no switch, check, change-account or replace-key row. The Settings row's value is Not
connected, ChatGPT Plan or API key. Signing in goes by "ChatGPT"; a key is "OpenAI API key" or
"Anthropic API key" on the AI connection page and just "API key" anywhere else. Models go by
their name alone. No prices on these pages. The text on them writes the brand "Calmera".

These pages (AI connection, the key page, Model, Usage) have a solid #FFF4EA page and #FFFBF9
cards, over whichever theme canvas is chosen (`AI_PAGE` in `constants/settingsTheme.js`). No
spinners: a button says "Signing in…" or "Checking…" while it works.

With nothing connected, `app/(root)/ai-connection.jsx` stacks two numbered cards with matching
orange buttons.

- **Option 1, ChatGPT Plan** explains that signing in uses the limits of the person's ChatGPT
  plan. **Sign in with ChatGPT** starts OpenAI's sign-in at once. If that fails, red text takes
  the description's place: "Couldn't reach ChatGPT. Check your connection and try again."
- **Option 2, API Key** lists plans that may qualify for free monthly API credits. The provider
  names in "Bring your own OpenAI or Anthropic API key." link to their credit guides in Safari.
  **Add API key** opens `ai-connect.jsx`, where Calmera identifies the provider of the pasted key.

Usage appears when there are requests in the last seven days, including after disconnecting. The
privacy line follows. Today's first voice, text or photo tap opens this same page and goes back
to the meal once connected.

Once connected, the page is about that connection:

1. **Status card:** its name (ChatGPT, or OpenAI / Anthropic API key), then the email or the
   masked key and what the last check found: Connected in green, or what's wrong in red. The
   note under it says who pays, or what to do ("Disconnect, then sign in with ChatGPT again.").
   The check runs on every visit and spends nothing (a key lists its provider's models;
   ChatGPT's model list is read). The last status shows at once and changes only when the
   result is different; not reaching the provider changes nothing.
2. **Model** (opens `ai-model.jsx`: the provider's list, names only, newest first) and **Online
   search** (one switch, on by default; the note says what it looks up).
3. **Usage:** Last 7 days, every connection together, kept after a disconnect. The row counts
   requests; the usage page (`ai-usage.jsx`) has the rest.
4. **Disconnect:** its own card, red and centred. It asks first; confirming goes back to the
   two options.

Underneath, one record names the connection (`lib/ai/connection.mjs`), one controller runs
connect, the check, disconnect and Online search for both (`lib/ai/connectionController.mjs`),
both report in one set of outcome words (`lib/ai/connectionMethods.mjs`) that
`lib/ai/connectionPresentation.mjs` turns into sentences, model lists come from
`lib/ai/modelCatalog.mjs`, preferences (and the last status) from `lib/ai/preferences.mjs`, and
the usage record and its prices from `lib/ai/usage.mjs` and `lib/ai/prices.mjs`.
