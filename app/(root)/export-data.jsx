import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Share, StyleSheet, Text, View } from "react-native";
import RNFS from "react-native-fs";
import { FormCard, FormHeader, FormScreen, FormScrollView, GlassButton, formStyles } from "@/components/GlassForm";
import SegmentedControl from "@/components/SegmentedControl";
import SettingsRow from "@/components/SettingsRow";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { profileGoals, useNutritionData } from "@/hooks/useNutritionData";
import usePageExit from "@/hooks/usePageExit";
import { EXPORT_FORMATS, EXPORT_RANGES, exportFileName, exportKeys, exportSummary, wellFormed } from "@/lib/dataExport.mjs";
import { formatNumber } from "@/lib/insights/stats.mjs";

const prettyDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Makes the file on the phone, then hands it to the share sheet: Save to Files, AirDrop,
// Mail and the rest. Always reads the latest history first, so a file is never missing
// meals from a stale or partial load.
export default function ExportData() {
  const leave = usePageExit("/settings");
  const { store, loader, dataByDate, dateKey, snapshot, error, refresh } = useNutritionData(new Date(), true);
  const [range, setRange] = useState(EXPORT_RANGES[0]);
  const [formatId, setFormatId] = useState(EXPORT_FORMATS[0].id);
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const today = useMemo(() => new Date(`${dateKey}T12:00:00`), [dateKey]);
  const summary = useMemo(() => exportSummary(dataByDate, exportKeys(dataByDate, range, today)), [dataByDate, range, today]);
  const loaded = Boolean(snapshot.historyLoaded);

  const run = async () => {
    setExporting(true);
    setFailed(false);
    let path = null;
    try {
      const format = EXPORT_FORMATS.find(({ id }) => id === formatId);
      await Promise.all([store.loadHistory(loader, { force: true }), format.id === "everything" ? store.loadProfile(loader, { force: true }) : null]);
      const { days, profile } = store.getSnapshot();
      const content = wellFormed(format.build(days, exportKeys(days, range, today), profileGoals(profile)));
      if (Platform.OS === "ios") {
        // The share sheet doesn't always report back after an action cancels, so
        // clear files from any earlier export and don't wait on it to free the screen.
        const earlier = await RNFS.readDir(RNFS.CachesDirectoryPath);
        await Promise.all(earlier.filter(({ name }) => name.startsWith("calmera-")).map(({ path: old }) => RNFS.unlink(old).catch(() => {})));
        path = `${RNFS.CachesDirectoryPath}/${exportFileName(format, dateKey)}`;
        await RNFS.writeFile(path, content, "utf8");
        setExporting(false);
        await Share.share({ url: `file://${path}` });
      } else {
        setExporting(false);
        await Share.share({ title: exportFileName(format, dateKey), message: content });
      }
    } catch {
      setFailed(true);
    } finally {
      setExporting(false);
      if (path) RNFS.unlink(path).catch(() => {});
    }
  };

  const nothing = loaded && !summary.days;
  return <FormScreen>
    <FormHeader title="Export your data" onBack={leave} />
    <FormScrollView contentContainerStyle={formStyles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.block}>
        <Text style={styles.section}>RANGE</Text>
        <SegmentedControl accessibilityLabel="Range" options={EXPORT_RANGES} value={range} onChange={setRange} disabled={exporting} />
        {!loaded && !error ? <ActivityIndicator color={COLORS.primary} style={styles.loading} />
          : !loaded ? <>
            <Text style={styles.problem}>{"Couldn't load your meals. Check your connection and try again."}</Text>
            <GlassButton title="Try again" onPress={() => refresh().catch(() => {})} />
          </>
            : <Text accessibilityLiveRegion="polite" style={formStyles.caption}>
              {summary.days ? `${formatNumber(summary.meals)} ${summary.meals === 1 ? "food" : "foods"} on ${formatNumber(summary.days)} ${summary.days === 1 ? "day" : "days"}, ${prettyDate(summary.first)} to ${prettyDate(summary.last)}.` : "Nothing logged in this range."}
            </Text>}
      </View>
      <View style={styles.block}>
        <Text style={styles.section}>FILE</Text>
        <FormCard variant="grouped" style={styles.group}>
          {EXPORT_FORMATS.map((format, index) => <SettingsRow key={format.id} title={format.title} subtitle={format.subtitle} divider={index > 0}
            accessibilityRole="radio" selected={format.id === formatId} disabled={exporting} onPress={() => setFormatId(format.id)} />)}
        </FormCard>
      </View>
      <GlassButton title="Export" role="accent" onPress={run} loading={exporting} disabled={!loaded || nothing} accessibilityLabel="Export file" />
      {failed && <Text accessibilityLiveRegion="assertive" style={styles.problem}>{"Couldn't make the file. Nothing was shared. Please try again."}</Text>}
      <Text style={formStyles.caption}>The file is made on your phone. It goes only where you send it.</Text>
    </FormScrollView>
  </FormScreen>;
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  section: { ...TYPOGRAPHY.eyebrow, color: COLORS.textLight, marginLeft: 4 },
  group: { padding: 0, gap: 0, overflow: "hidden" },
  loading: { alignSelf: "flex-start", marginLeft: 4 },
  problem: { ...TYPOGRAPHY.caption, color: COLORS.expense },
});
