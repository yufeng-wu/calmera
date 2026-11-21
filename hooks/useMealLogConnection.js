import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createPlanClient } from "@/lib/chatgpt/planClient";
import { readChatGPTConnection } from "@/lib/chatgpt/connectionOutcome.mjs";
import { connectionIssue } from "@/lib/chatgpt/connectionStatus.mjs";
import { aiConnection } from "@/lib/ai/mealAI";

// A fresh catalog request checks authorization and API reachability without
// sending a meal or starting an inference. Late checks cannot update a new focus.
export default function useMealLogConnection(userId, preview = false) {
  const [connection, setConnection] = useState({ state: "checking" });
  const active = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!active.current) return;
    const check = ++generation.current;
    const isCurrent = () => active.current && generation.current === check;
    setConnection({ state: "checking" });
    if (preview) { setConnection({ state: "ready" }); return; }
    try {
      // One AI connection. A key is checked when a meal is sent; ChatGPT is checked here.
      const current = await aiConnection(userId).read();
      if (!isCurrent()) return;
      if (!current) { setConnection({ state: "none" }); return; }
      if (current.type !== "chatgpt") { setConnection({ state: "ready", type: current.type, provider: current.provider }); return; }
      const result = await readChatGPTConnection(createPlanClient(userId), { isCurrent });
      if (isCurrent() && result) setConnection(result);
    } catch (error) {
      if (isCurrent()) setConnection({ state: "unavailable", issue: connectionIssue(error) });
    }
  }, [userId, preview]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    refresh();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active" && previous !== "active") refresh();
      previous = state;
    });
    return () => {
      active.current = false;
      generation.current += 1;
      subscription.remove();
    };
  }, [refresh]));
  return { connection, refresh };
}
