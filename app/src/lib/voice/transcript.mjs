// Builds one voice log's words from expo-speech-recognition events. Pure, so tests stay synthetic.
//
// On iOS 18 and later, continuous recognition marks the end of each spoken phrase with a
// final result (isFinal: true), then starts the next phrase from empty: later results hold only
// the new words. Older iOS versions instead repeat everything heard so far in every result.
// This keeps every phrase either way, so nothing said before a pause is lost.
//
// state: committed — words from earlier listening runs (before Pause, or edited by hand)
//        finals    — finished phrases of the current run
//        interim   — the phrase being spoken now, which iOS may still revise

export function emptyTranscript() {
  return { committed: "", finals: [], interim: "" };
}

// Chinese and Japanese are written without spaces between words or phrases.
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯]/u;

// Joins two stretches of speech with one space, or none between Chinese or Japanese text.
export function joinTranscript(committed, segment) {
  const before = String(committed ?? "").trim();
  const after = String(segment ?? "").trim();
  if (!before) return after;
  if (!after) return before;
  const gap = UNSPACED.test(before[before.length - 1]) && UNSPACED.test(after[0]) ? "" : " ";
  return `${before}${gap}${after}`;
}

const normalChar = char => char.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const normal = text => Array.from(String(text ?? ""), normalChar).join("");

// When a result repeats the words already kept and goes on past them (ignoring case, spacing
// and punctuation, which iOS often revises), returns only the new words; otherwise the text
// unchanged. A phrase that merely equals the kept words may really have been said twice.
function afterRepeat(text, kept) {
  const target = normal(kept);
  if (!target) return text;
  let seen = "";
  const chars = Array.from(text);
  for (let index = 0; index < chars.length; index += 1) {
    seen += normalChar(chars[index]);
    if (seen.length >= target.length) {
      if (seen !== target) return text;
      const rest = chars.slice(index + 1).join("").replace(/^[^\p{L}\p{N}]+/u, "");
      return normal(rest) ? rest : text;
    }
  }
  return text;
}

// iOS revises a phrase as it hears more, but keeps its start. A shorter result that begins
// differently is a new phrase whose end-of-phrase marker never arrived.
function startsNewPhrase(previous, next) {
  const before = normal(previous);
  const after = normal(next);
  return before.length >= 6 && after.length > 0 && after.length < before.length && before.slice(0, 2) !== after.slice(0, 2);
}

function settleInterim(state) {
  if (!state.interim) return state;
  return { ...state, finals: [...state.finals, state.interim], interim: "" };
}

export function transcriptReducer(state, event) {
  switch (event?.type) {
    case "result": {
      let text = String(event.text ?? "").trim();
      const isFinal = event.isFinal === true;
      // An end-of-phrase marker with no words closes the phrase being spoken.
      if (!text) return isFinal ? settleInterim(state) : state;
      text = afterRepeat(text, state.finals.join(" ")).trim();
      const last = state.finals.at(-1);
      // iOS sometimes sends a finished phrase twice, the second time with nothing said between.
      if (isFinal && !state.interim && last && normal(text) === normal(last)) return state;
      const base = state.interim && text && startsNewPhrase(state.interim, text) ? settleInterim(state) : state;
      if (!isFinal) return { ...base, interim: text };
      return { ...base, finals: [...base.finals, text], interim: "" };
    }
    // A listening run ended (Pause, a long silence, an error, or Send): keep every word heard.
    case "end":
      return { committed: transcriptText(state), finals: [], interim: "" };
    // Hand edits while paused replace the kept words; the next run's words follow them.
    case "edit":
      return { committed: String(event.text ?? ""), finals: [], interim: "" };
    case "reset":
      return emptyTranscript();
    // Errors such as no-speech end the run (an "end" follows) but never take words away.
    default:
      return state;
  }
}

export function transcriptText(state) {
  return [state.committed, ...state.finals, state.interim].reduce(joinTranscript, "");
}
