import { useMemo, useState } from "react";
import { Platform, Share, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import RNFS from "react-native-fs";
import { FormHeader, FormScreen, FormScrollView, GlassButton } from "@/components/GlassForm";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection, settingsStyles } from "@/components/SettingsSection";
import { profileGoals, useNutritionData } from "@/hooks/useNutritionData";
import usePageExit from "@/hooks/usePageExit";
import { EXPORT_RANGES, exportFileName, exportJson, exportKeys, exportSummary, wellFormed } from "@/lib/dataExport.mjs";
import { formatNumber } from "@/lib/insights/stats.mjs";

const prettyDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const plural = (count, word) => `${formatNumber(count)} ${count === 1 ? word : `${word}s`}`;
const describe = (summary, id, loaded) => !loaded ? "Counting your meals…"
  : !summary.days ? "Nothing logged yet"
    : `${plural(summary.meals, "food")} on ${plural(summary.days, "day")}${id === "all" ? `, since ${prettyDate(summary.first)}` : ""}`;

// Makes the file on the phone, then hands it to the share sheet: Save to Files, AirDrop,
// Mail and the rest. Always reads the latest history first, so a file is never missing
// meals from a stale or partial load.
export default function ExportData() {
  const leave = usePageExit("/settings");
  const { store, loader, dataByDate, dateKey, snapshot, error, refresh } = useNutritionData(new Date(), true);
  const [range, setRange] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const today = useMemo(() => new Date(`${dateKey}T12:00:00`), [dateKey]);
  const summaries = useMemo(() => Object.fromEntries(EXPORT_RANGES.map(({ id }) =>
    [id, exportSummary(dataByDate, exportKeys(dataByDate, id, today))])), [dataByDate, today]);
  const loaded = Boolean(snapshot.historyLoaded);

  const choose = (id) => {
    if (id === range) return;
    Haptics.selectionAsync().catch(() => {});
    setRange(id);
  };
  const run = async () => {
    setExporting(true);
    setFailed(false);
    let path = null;
    try {
      await Promise.all([store.loadHistory(loader, { force: true }), store.loadProfile(loader, { force: true })]);
      const { days, profile } = store.getSnapshot();
      const content = wellFormed(exportJson(days, exportKeys(days, range, today), profileGoals(profile)));
      if (Platform.OS === "ios") {
        // The share sheet doesn't always report back after an action cancels, so
        // clear files from any earlier export and don't wait on it to free the screen.
        const earlier = await RNFS.readDir(RNFS.CachesDirectoryPath);
        await Promise.all(earlier.filter(({ name }) => name.startsWith("calmera-")).map(({ path: old }) => RNFS.unlink(old).catch(() => {})));
        path = `${RNFS.CachesDirectoryPath}/${exportFileName(dateKey)}`;
        await RNFS.writeFile(path, content, "utf8");
        setExporting(false);
        await Share.share({ url: `file://${path}` });
      } else {
        setExporting(false);
        await Share.share({ title: exportFileName(dateKey), message: content });
      }
    } catch {
      setFailed(true);
    } finally {
      setExporting(false);
      if (path) RNFS.unlink(path).catch(() => {});
    }
  };

  const nothing = loaded && !summaries[range].days;
  return <FormScreen>
    <FormHeader title="Export your data" onBack={leave} />
    <FormScrollView contentContainerStyle={settingsStyles.content} showsVerticalScrollIndicator={false}>
      <SettingsSection label="Range" footnote={!loaded && error
        ? <View style={styles.retry}>
          <Text style={settingsStyles.problem}>{"Couldn't load your meals. Check your connection and try again."}</Text>
          <GlassButton title="Try again" symbol="arrow.clockwise" onPress={() => refresh().catch(() => {})} />
        </View>
        : "One JSON file with every food: its meal, time, amount, calories, macros, vegetables and fruits. It also has each day's totals and your goals."}>
        {EXPORT_RANGES.map(({ id, label }, index) => <SettingsRow key={id} title={label} subtitle={describe(summaries[id], id, loaded)}
          divider={index > 0} accessibilityRole="radio" selected={id === range} disabled={exporting} onPress={() => choose(id)} />)}
      </SettingsSection>
      <View style={styles.action}>
        <GlassButton title="Export" symbol="square.and.arrow.up" role="accent" onPress={run} loading={exporting} disabled={!loaded || nothing} accessibilityLabel="Export file" />
        {failed && <Text accessibilityLiveRegion="assertive" style={settingsStyles.problem}>{"Couldn't make the file. Nothing was shared. Please try again."}</Text>}
        <Text style={settingsStyles.footnote}>The file is made on your phone. It goes only where you send it.</Text>
      </View>
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  retry: { gap: 10 },
  action: { gap: 10 },
});
