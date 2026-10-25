import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useNutritionData } from "@/hooks/useNutritionData";
import { nutritionClient } from "@/lib/chatgpt/nutrition";
import { weeklyDigest, digestMarkdown } from "@/lib/insights/digest.mjs";
import { instructions, localInsight, parseInsight, previewReply } from "@/lib/insights/harness.mjs";
import { sampleDays, SAMPLE_GOALS } from "@/lib/insights/sampleWeek.mjs";
import { average, dateKeys, healthSeries, latest, nutritionSeries } from "@/lib/insights/series.mjs";
import { useInsightPrefs } from "@/lib/insights/prefs";
import { useHealth } from "@/lib/insights/health";
import { prefsSignature, readReport, saveReport, weekStart } from "@/lib/insights/reportCache";

function period(days, goals, health, span, today) {
  const keys = dateKeys(span, today), previousKeys = dateKeys(span, today, span);
  return {
    span, keys,
    digest: weeklyDigest(days, goals, { today, span }),
    nutrition: nutritionSeries(days, keys), previousNutrition: nutritionSeries(days, previousKeys),
    activity: healthSeries(health, keys), previousActivity: healthSeries(health, previousKeys),
  };
}

function activityContext(current, health) {
  if (!health?.available) return null;
  const weights = current.activity.weight.filter((value) => value != null);
  return {
    activeEnergy: average(current.activity.activeEnergy), steps: average(current.activity.steps),
    exerciseMinutes: average(current.activity.exerciseMinutes), sleepHours: average(current.activity.sleepHours),
    weight: latest(current.activity.weight), weightChange: weights.length > 1 ? weights[weights.length - 1] - weights[0] : null,
    age: health.profile?.age, sex: health.profile?.sex,
  };
}

// Turns history, Apple Health and prefs into dashboard periods, a weekly
// report (one ChatGPT call per week, cached) and a chat responder.
export function useInsights({ report = true } = {}) {
  const { userId } = useAuth();
  const { dataByDate, goals } = useNutritionData(new Date(), true);
  const { prefs, save } = useInsightPrefs(userId);
  const health = useHealth(userId);
  const today = useMemo(() => new Date(), []);
  const sample = useMemo(() => weeklyDigest(dataByDate, goals, { today }).daysLogged < 3, [dataByDate, goals, today]);
  const days = useMemo(() => sample ? sampleDays(today) : dataByDate, [sample, dataByDate, today]);
  const usedGoals = sample ? SAMPLE_GOALS : goals;
  const week = useMemo(() => period(days, usedGoals, health.summary, 7, today), [days, usedGoals, health.summary, today]);
  const month = useMemo(() => period(days, usedGoals, health.summary, 30, today), [days, usedGoals, health.summary, today]);
  const reportContext = useMemo(() => digestMarkdown(week.digest, prefs, activityContext(week, health.summary)),
    [week, prefs, health.summary]);
  const context = useMemo(() => `${reportContext}\n\n${digestMarkdown(month.digest, prefs, activityContext(month, health.summary))}`,
    [reportContext, month, prefs, health.summary]);
  const fallback = useMemo(() => localInsight(week.digest, prefs), [week.digest, prefs]);

  const weekKey = weekStart(today);
  const signature = `${prefsSignature(prefs)}|${sample ? "sample" : "own"}`;
  const [ai, setAI] = useState({ key: null, report: null, status: "idle" });
  const abortRef = useRef(null);

  const connection = useCallback(async () => {
    try { return userId ? await nutritionClient(userId) : null; } catch { return null; }
  }, [userId]);

  const generate = useCallback(async (key) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAI((current) => ({ key, report: current.key === key ? current.report : null, status: "loading" }));
    const linked = await connection();
    if (!linked) { setAI({ key, report: null, status: "offline" }); return; }
    try {
      const text = await linked.client.respond({ model: linked.model, signal: controller.signal,
        instructions: instructions(prefs, reportContext, { report: true }),
        messages: [{ role: "user", text: "Write my weekly report." }] });
      const saved = { week: weekKey, signature, createdAt: Date.now(), insight: parseInsight(text) };
      await saveReport(userId, saved);
      setAI({ key, report: saved, status: "done" });
    } catch {
      if (!controller.signal.aborted) setAI({ key, report: null, status: "offline" });
    }
  }, [connection, prefs, reportContext, weekKey, signature, userId]);

  const key = `${weekKey}|${signature}`;
  const startedRef = useRef(null);
  useEffect(() => {
    if (!report || week.digest.daysLogged < 3 || startedRef.current === key) return;
    startedRef.current = key;
    setAI({ key, report: null, status: "loading" });
    readReport(userId, weekKey, signature).then((cached) => {
      if (startedRef.current !== key) return;
      if (cached) setAI({ key, report: cached, status: "done" });
      else generate(key);
    });
  }, [report, week.digest.daysLogged, key, userId, weekKey, signature, generate]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(async (messages, { signal } = {}) => {
    const linked = await connection();
    const question = messages[messages.length - 1]?.text || "";
    if (!linked) return { text: previewReply(question, week.digest, prefs), preview: true };
    const text = await linked.client.respond({ model: linked.model, signal, messages, instructions: instructions(prefs, context) });
    return { text: text.trim(), preview: false };
  }, [connection, week.digest, prefs, context]);

  const personal = ai.key === key && ai.report ? ai.report : null;
  return {
    sample, goals: usedGoals, week, month, health, prefs, savePrefs: save, context,
    insight: personal?.insight || fallback, report: { personal: Boolean(personal), createdAt: personal?.createdAt, week: weekKey },
    reportStatus: ai.key === key ? ai.status : "idle", refreshReport: () => generate(key), ask,
  };
}
