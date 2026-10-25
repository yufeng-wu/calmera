import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useNutritionData } from "@/hooks/useNutritionData";
import { nutritionClient } from "@/lib/chatgpt/nutrition";
import { weeklyDigest, digestMarkdown } from "@/lib/insights/digest.mjs";
import { instructions, localInsight, parseInsight, previewReply } from "@/lib/insights/harness.mjs";
import { sampleDays, SAMPLE_GOALS } from "@/lib/insights/sampleWeek.mjs";
import { useInsightPrefs } from "@/lib/insights/prefs";

// One place that turns history + prefs into a digest, a verdict and a chat responder.
export function useInsights({ report = true } = {}) {
  const { userId } = useAuth();
  const { dataByDate, goals } = useNutritionData(new Date(), true);
  const { prefs, save } = useInsightPrefs(userId);
  const real = useMemo(() => weeklyDigest(dataByDate, goals), [dataByDate, goals]);
  const sample = real.daysLogged < 3;
  const digest = useMemo(() => sample ? weeklyDigest(sampleDays(), SAMPLE_GOALS) : real, [sample, real]);
  const context = useMemo(() => digestMarkdown(digest, prefs), [digest, prefs]);
  const fallback = useMemo(() => localInsight(digest, prefs), [digest, prefs]);
  const [ai, setAI] = useState({ key: null, insight: null, status: "idle" });
  const requestKey = `${context}|${prefs.tone}`;
  const abortRef = useRef(null);

  const connection = useCallback(async () => {
    try { return userId ? await nutritionClient(userId) : null; } catch { return null; }
  }, [userId]);

  // The rules verdict paints instantly; ChatGPT, when connected, replaces it with a personal one.
  const refreshReport = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAI({ key: requestKey, insight: null, status: "loading" });
    const linked = await connection();
    if (!linked) { setAI({ key: requestKey, insight: null, status: "offline" }); return; }
    try {
      const text = await linked.client.respond({ model: linked.model, signal: controller.signal,
        instructions: instructions(prefs, context, { report: true }),
        messages: [{ role: "user", text: "Give me my weekly check-in." }] });
      setAI({ key: requestKey, insight: parseInsight(text), status: "done" });
    } catch {
      if (!controller.signal.aborted) setAI({ key: requestKey, insight: null, status: "offline" });
    }
  }, [connection, requestKey, prefs, context]);

  useEffect(() => {
    if (report && digest.daysLogged >= 3 && ai.key !== requestKey) refreshReport();
  }, [report, digest.daysLogged, ai.key, requestKey, refreshReport]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(async (messages, { signal } = {}) => {
    const linked = await connection();
    const question = messages[messages.length - 1]?.text || "";
    if (!linked) return { text: previewReply(question, digest, prefs), preview: true };
    const text = await linked.client.respond({ model: linked.model, signal, messages, instructions: instructions(prefs, context) });
    return { text: text.trim(), preview: false };
  }, [connection, digest, prefs, context]);

  const insight = ai.key === requestKey && ai.insight ? ai.insight : fallback;
  return { digest, sample, prefs, savePrefs: save, context, insight,
    personal: Boolean(ai.key === requestKey && ai.insight), reportStatus: ai.status, refreshReport, ask };
}
