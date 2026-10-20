import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { FormHeader } from "@/components/GlassForm";
import { APPEARANCE_THEMES } from "@/constants/appearance.mjs";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { useTheme } from "@/context/ThemeContext";

const NativeSample = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "MaterialSample") : null;
const MATERIALS = [
  { id: "regular", name: "Regular Liquid Glass", note: "Adaptive light, rim and shadow" },
  { id: "tinted", name: "Tinted Regular", note: "The same glass · 10% Tangerine tint" },
  { id: "clear", name: "Clear Liquid Glass", note: "More transparent · best over rich media" },
  { id: "ultraThin", name: "Ultra Thin Material", note: "Apple blur · no liquid lensing" },
  { id: "thin", name: "Thin Material", note: "More frost · no liquid lensing" },
  { id: "standard", name: "Standard Material", note: "Strongest frost · no liquid lensing" },
];
const SHADOWS = [
  { id: "native", label: "Native only" },
  { id: "soft", label: "+ Soft" },
  { id: "lifted", label: "+ Lifted" },
];

function Choice({ label, selected, onPress, disabled = false }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}
    accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.choice, selected && styles.selected, pressed && styles.pressed]}>
    <Text style={[styles.choiceLabel, selected && styles.selectedLabel]}>{label}</Text>
  </Pressable>;
}

// Real UIKit materials, mounted with identical shapes and text. This test-only
// route cannot read records, call inference, or change production glass styles.
export default function GlassCompare() {
  const router = useRouter();
  const { themeId, selectTheme, ready } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [detail, setDetail] = useState(false);
  const [family, setFamily] = useState("liquid");
  const [status, setStatus] = useState("Tap any Add to feel its native press response.");
  const large = fontScale > 1.35;
  if (Constants.expoConfig?.extra?.calmeraFullAppTest !== true) return <Redirect href="/dashboard" />;
  const report = (name, event) => {
    const value = event.nativeEvent;
    setStatus(`Last tap: ${name} · ${value.material} · ${value.shadow} shadow · ${Math.round(value.height)} pt. Tap received.`);
  };
  return <View style={styles.page}>
    <FormHeader title={large ? "Glass" : "Glass materials"} onBack={() => router.canGoBack() ? router.back() : router.replace("/theme")} />
    <ScrollView key={`glass-text-${fontScale}`} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Apple materials, on your foodwrap backgrounds.</Text>
      <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Comparison background">
        {APPEARANCE_THEMES.map(theme => <Choice key={theme.id} label={theme.label} selected={theme.id === themeId}
          disabled={!ready} onPress={() => selectTheme(theme.id).catch(() => setStatus("Couldn’t save the review background. Try again."))} />)}
      </View>
      <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Background detail">
        <Choice label="Theme only" selected={!detail} onPress={() => setDetail(false)} />
        <Choice label="Over detail" selected={detail} onPress={() => setDetail(true)} />
      </View>
      <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Material family">
        <Choice label="Liquid Glass" selected={family === "liquid"} onPress={() => setFamily("liquid")} />
        <Choice label="Classic blur" selected={family === "blur"} onPress={() => setFamily("blur")} />
      </View>
      <Text style={styles.note}>Same native material · three shadow treatments</Text>
      {!large && <View style={styles.columns}>{SHADOWS.map(shadow => <Text key={shadow.id} style={styles.column}>{shadow.label}</Text>)}</View>}
      {(family === "liquid" ? MATERIALS.slice(0, 3) : MATERIALS.slice(3)).map(material => <View key={material.id} style={styles.material}>
        <Text accessibilityRole="header" style={styles.name}>{material.name}</Text>
        <Text style={styles.note}>{material.note}</Text>
        <View style={[styles.samples, large && styles.samplesLarge]}>
          {SHADOWS.map(shadow => <View key={shadow.id} style={[styles.cell, large && styles.cellLarge]}>
            {large && <Text style={styles.note}>{shadow.label}</Text>}
            {detail && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.detail}>
              <View style={styles.peach} /><View style={styles.mint} />
              <Text style={styles.detailText}>OATS 320 · BOWL 540</Text>
            </View>}
            {NativeSample ? <NativeSample style={[styles.sample, { height: Math.max(48, 32 * fontScale + 12) }]}
              materialStyle={material.id} shadowStyle={shadow.id} sampleLabel={`${material.name}, ${shadow.label}, Add`}
              onPress={event => report(material.name, event)} /> : <Text style={styles.note}>iOS comparison</Text>}
          </View>)}
        </View>
      </View>)}
      <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
      <Text style={styles.note}>Native only keeps Apple’s own shadow. Soft adds 7% black, 10 pt blur, 3 pt offset. Lifted adds 14% black, 18 pt blur, 7 pt offset.</Text>
      <Text style={styles.note}>Comparison only. Your saved app material is unchanged. Background choices use the isolated review preference.</Text>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 12 },
  intro: { ...TYPOGRAPHY.body, color: COLORS.text },
  choices: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  choice: { flexGrow: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, alignItems: "center", justifyContent: "center",
    borderRadius: 16, borderWidth: 0.5, borderColor: "#DCD6D2", backgroundColor: "#FFFFFF" },
  selected: { borderColor: COLORS.primary, backgroundColor: "#FFF0E5" },
  pressed: { backgroundColor: "#F5F5F7" },
  choiceLabel: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  selectedLabel: { color: COLORS.primary },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  columns: { flexDirection: "row", gap: 12, paddingHorizontal: 4 },
  column: { ...TYPOGRAPHY.captionMedium, color: COLORS.textLight, textAlign: "center", flex: 1 },
  material: { gap: 3, paddingTop: 4 },
  name: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  samples: { flexDirection: "row", gap: 12, paddingHorizontal: 4, paddingTop: 9, paddingBottom: 15 },
  samplesLarge: { flexDirection: "column", gap: 24 },
  cell: { flex: 1, justifyContent: "center" },
  cellLarge: { flex: 0, gap: 9 },
  sample: { width: "100%" },
  detail: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", overflow: "hidden", borderRadius: 24 },
  peach: { position: "absolute", width: 55, height: 55, borderRadius: 28, left: 4, backgroundColor: "#FAA783" },
  mint: { position: "absolute", width: 55, height: 55, borderRadius: 28, right: 1, backgroundColor: "#92D7BD" },
  detailText: { fontSize: 11, fontWeight: "600", color: "#4C392C" },
  status: { ...TYPOGRAPHY.captionMedium, color: COLORS.primary },
});
