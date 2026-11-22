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
every step. `app/(root)/ai-connection.jsx` lists both as rows that never move; the one in use
carries the check and the same card for either (Model, Check connection, Change account or
Replace key, Disconnect). Tapping a row opens `ai-connect.jsx?method=chatgpt|key`, one page for
both: what you connect with (the ChatGPT account box or the key field), one line under it (a
hint, whose key it is, or what went wrong), one button (Connect, Switch to…, Replace key), and a
note that the old connection stays until the new one works. A switch is said once afterwards in
green; there is no warning before. Disconnect is the only alert. Underneath, one record names the
connection (`lib/ai/connection.mjs`), one controller runs connect, check and disconnect for both
(`lib/ai/connectionController.mjs`), and both report in one set of outcome words
(`lib/ai/connectionMethods.mjs`) that `lib/ai/connectionPresentation.mjs` turns into sentences.
