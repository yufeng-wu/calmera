import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { LOCAL_OWNER } from "@/lib/owner.mjs";
import { useRouter } from "expo-router";
import { FormScreen, FormScrollView, FormHeader, FormCard, GlassButton, formStyles } from "@/components/GlassForm";
import MealTimePicker from "@/components/MealTimePicker";
import { DEFAULT_MEAL_TIMES, MEAL_TYPES, validMealTimes, sameMealTimes, mealTimeRange } from "@/lib/mealTimes.mjs";
import { createMealTimePreferences } from "@/lib/mealTimePreferences.mjs";
import { mealTimePreferences } from "@/lib/mealTimeSettings";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { SURFACES } from "@/constants/surfaces";
import useFormTaskScope from "@/hooks/useFormTaskScope";
import usePageExit from "@/hooks/usePageExit";

const previewValues = new Map();
export default function MealTimes({ calmeraPreview = false, calmeraPreviewState = "ready" }) {
  const userId = LOCAL_OWNER;
  const router = useRouter();
  const leave = usePageExit("/settings");
  const focused = useIsFocused();
  const { fontScale } = useWindowDimensions();
  const owner = calmeraPreview ? `meal-times-preview:${calmeraPreviewState}` : userId;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const preferences = useMemo(() => {
    if (!calmeraPreview || calmeraPreviewState === "ready") return mealTimePreferences;
    let reads = 0, writes = 0;
    return createMealTimePreferences({
      getItem: async key => {
        if (++reads === 1 && calmeraPreviewState === "load-error") throw Error("synthetic_read_failure");
        return previewValues.get(key) ?? null;
      },
      setItem: async (key, value) => {
        if (++writes === 1 && calmeraPreviewState === "save-error") throw Error("synthetic_write_failure");
        previewValues.set(key, value);
      },
    });
  }, [calmeraPreview, calmeraPreviewState]);
  const [draft, setDraft] = useState({ ...DEFAULT_MEAL_TIMES });
  const [confirmed, setConfirmed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const operation = useRef(null);
  const scope = useFormTaskScope(owner, () => {
    operation.current = null; setConfirmed(null); setLoading(true); setSaving(false); setSaved(false);
  });
  useEffect(() => {
    if (!focused) return;
    const task = scope.start();
    if (!task) return;
    let active = true;
    const current = () => active && task.isCurrent() && ownerRef.current === owner;
    operation.current = task; setLoading(true); setError(null); setConfirmed(null); setSaved(false);
    preferences.load(owner, { signal: task.signal, isActive: current }).then(times => {
      if (current()) { setDraft(times); setConfirmed({ owner, times }); }
    }).catch(() => { if (current()) setError("load"); }).finally(() => {
      task.finish();
      if (operation.current === task) { operation.current = null; if (current()) setLoading(false); }
    });
    return () => { active = false; task.finish(); };
  }, [focused, owner, preferences, retry, scope]);

  const ready = confirmed?.owner === owner && !loading && !error;
  const valid = validMealTimes(draft);
  const dirty = ready && !sameMealTimes(draft, confirmed.times);
  const update = (meal, minutes) => {
    if (ownerRef.current !== owner || !ready || saving || operation.current || !scope.isActive()) return;
    setSaved(false); setDraft(previous => ({ ...previous, [meal]: minutes }));
  };
  const reload = () => {
    if (ownerRef.current !== owner || !scope.isActive() || operation.current) return;
    setLoading(true); setConfirmed(null); setRetry(value => value + 1);
  };
  const save = async () => {
    if (ownerRef.current !== owner || !ready || !dirty || !valid || saving || operation.current || !scope.isActive()) return;
    const task = scope.start();
    if (!task) return;
    const current = () => task.isCurrent() && ownerRef.current === owner;
    operation.current = task; setSaving(true); setSaved(false);
    const snapshot = { ...draft };
    try {
      await preferences.save(owner, snapshot);
      if (current()) { setConfirmed({ owner, times: snapshot }); setSaved(true); }
    } catch { if (current()) { setConfirmed(null); setError("save"); } }
    finally {
      task.finish();
      if (operation.current === task) { operation.current = null; if (current()) setSaving(false); }
    }
  };
  const back = () => calmeraPreview
    ? router.replace({ pathname: "/ui-gallery", params: { page: "settings" } }) : leave();
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Meal times" onBack={back} onSave={save} saving={saving} saveDisabled={!ready || !dirty || !valid} />
    <FormScrollView key={`meal-times-text-${fontScale}`} contentContainerStyle={formStyles.content}>
      <Text style={styles.intro}>When you don’t name a meal in a voice log, calmera uses these times.</Text>
      {loading ? <FormCard style={styles.feedback}><ActivityIndicator color={COLORS.primary} />
        <Text style={formStyles.caption}>Loading your meal times…</Text></FormCard>
        : error ? <FormCard><Text style={formStyles.sectionTitle}>
          {error === "save" ? "Couldn’t confirm your changes" : "Couldn’t load your meal times"}</Text>
          <Text style={formStyles.caption}>Reload your saved times before making changes.</Text>
          <GlassButton title="Reload saved times" onPress={reload} />
        </FormCard> : <>
          <Text style={styles.eyebrow}>START TIMES</Text>
          <FormCard variant="grouped" style={styles.group}>
            {MEAL_TYPES.map((meal, index) => <View key={meal} style={[styles.row, index > 0 && styles.divider]}>
              <View style={styles.label}><Text style={styles.meal}>{meal}</Text>
                <Text style={formStyles.caption}>{valid ? mealTimeRange(meal, draft) : "Choose a start time"}</Text></View>
              <MealTimePicker value={draft[meal]} label={`${meal} starts at`} disabled={!ready || saving}
                onChange={minutes => update(meal, minutes)} />
            </View>)}
          </FormCard>
          <Text style={[formStyles.caption, !valid && styles.error]} accessibilityLiveRegion="polite">
            {valid ? "Each meal ends when the next begins. Snack continues overnight. Times use your phone’s local time when recording starts."
              : "Keep start times in order: Breakfast, Lunch, Dinner, then Snack."}
          </Text>
          <GlassButton title="Restore defaults" symbol="arrow.counterclockwise" disabled={!ready || saving || sameMealTimes(draft, DEFAULT_MEAL_TIMES)}
            onPress={() => { if (ownerRef.current === owner && scope.isActive() && ready && !saving && !operation.current) { setDraft({ ...DEFAULT_MEAL_TIMES }); setSaved(false); } }} />
          <Text style={formStyles.caption}>Saying “for lunch” or naming another meal always overrides these defaults.</Text>
          <Text style={formStyles.caption} accessibilityLiveRegion="polite">
            {saving ? "Saving…" : saved ? "Saved." : dirty ? "Tap Save to apply your changes." : "Applies to voice logs on this device."}
            {calmeraPreview ? " Preview only · your settings are unchanged." : ""}
          </Text>
        </>}
    </FormScrollView>
  </FormScreen>;
}
const styles = StyleSheet.create({
  intro: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  eyebrow: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight },
  group: { padding: 0, gap: 0 },
  row: { minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  label: { flexGrow: 1, flexShrink: 1, minWidth: 130, gap: 4 },
  meal: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SURFACES.outline },
  feedback: { minHeight: 130, alignItems: "center", justifyContent: "center" },
  error: { color: COLORS.expense },
});
