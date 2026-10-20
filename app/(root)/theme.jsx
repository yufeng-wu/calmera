import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { FormHeader, GlassButton, FormScreen, FormScrollView, formStyles } from "@/components/GlassForm";
import ThemeCanvas from "@/components/ThemeCanvas";
import { APPEARANCE_THEMES } from "@/constants/appearance.mjs";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { SURFACES } from "@/constants/surfaces";
import { useTheme } from "@/context/ThemeContext";
import usePageExit from "@/hooks/usePageExit";

export default function ThemeSettings({ calmeraPreview = false }) {
  const router = useRouter();
  const leave = usePageExit("/settings");
  const { fontScale } = useWindowDimensions();
  const { themeId, theme, selectTheme, ready, saving, error, reload, review } = useTheme();
  const back = () => calmeraPreview
    ? router.replace({ pathname: "/ui-gallery", params: { page: "settings" } }) : leave();
  const choose = id => {
    if (!ready || (id === themeId && !error)) return;
    Haptics.selectionAsync().catch(() => {});
    selectTheme(id).catch(() => {});
  };
  return <FormScreen style={formStyles.screen}>
    <FormHeader title="Theme" onBack={back} />
    <FormScrollView key={`theme-text-${fontScale}`} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Choose your foodwrap mood.</Text>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="App theme">
        {APPEARANCE_THEMES.map(item => <Pressable key={item.id} accessibilityRole="radio"
          accessibilityLabel={`${item.name}. ${item.description}.`}
          accessibilityState={{ checked: item.id === themeId, disabled: !ready }} disabled={!ready}
          onPress={() => choose(item.id)} style={({ pressed }) => [styles.option,
            { width: fontScale > 1.35 ? "100%" : "48%" }, item.id === themeId && styles.selected,
            pressed && styles.pressed]}>
          <View style={styles.swatch} pointerEvents="none">
            <ThemeCanvas variant={item.id} motionEnabled={false} />
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <Ionicons name={item.id === themeId ? "checkmark-circle" : "ellipse-outline"} size={21}
              color={item.id === themeId ? COLORS.primary : COLORS.textLight} />
          </View>
          <Text style={styles.description}>{item.description}</Text>
        </Pressable>)}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {!ready ? "Loading your theme…" : saving ? "Saving…" : error === "save" ? "Couldn’t save this theme. Please try again."
          : error === "load" ? "Couldn’t load your saved theme. You can choose a theme or retry."
          : `${theme.name} · saved on this device`}
      </Text>
      {!!error && <GlassButton title="Try again" symbol="arrow.clockwise" onPress={() => error === "load" ? reload() : selectTheme(themeId).catch(() => {})} />}
      <Text style={styles.description}>Glow and Aura move gently. They stay still when Reduce Motion is enabled.</Text>
      {review && <Text style={styles.description}>UI review · this choice is saved only in the test preference.</Text>}
    </FormScrollView>
  </FormScreen>;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 12, paddingBottom: 44, gap: 18 },
  intro: { ...TYPOGRAPHY.body, color: COLORS.textLight },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  option: { padding: 12, gap: 10, borderRadius: 22, backgroundColor: COLORS.card,
    borderWidth: 1.5, borderColor: SURFACES.outline },
  selected: { borderColor: COLORS.primary },
  pressed: { backgroundColor: SURFACES.pressed },
  swatch: { height: 100, borderRadius: 14, overflow: "hidden" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, flex: 1 },
  description: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  status: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
});
