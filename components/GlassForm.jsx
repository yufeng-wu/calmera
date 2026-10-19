import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { Ionicons } from "@expo/vector-icons";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const NativeButton = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "FormButton") : null;
const fallbackSymbols = {
  "chevron.left": "chevron-back", checkmark: "checkmark", sparkles: "sparkles-outline",
  camera: "camera-outline", "camera.fill": "camera", photo: "image-outline", "photo.on.rectangle": "images-outline",
  pencil: "pencil", "slider.horizontal.3": "options-outline", "arrow.right": "arrow-forward",
  "plus": "add", "keyboard": "keypad-outline", "arrow.up.right": "open-outline",
  "chevron.right": "chevron-forward", "arrow.clockwise": "refresh-outline",
  "arrow.counterclockwise": "refresh-outline", xmark: "close", clock: "time-outline",
  "rectangle.portrait.and.arrow.right": "log-out-outline", "gearshape": "settings-outline",
  "checkmark.circle": "checkmark-circle-outline", "book": "book-outline", "lock": "lock-closed-outline",
};

// UIKit owns the glass material and press response. Never fade an effect ancestor.
export function GlassButton({ title = "", symbol = "", onPress, disabled = false, loading = false,
  style, accessibilityLabel, role = "default" }) {
  const { fontScale } = useWindowDimensions();
  const requested = StyleSheet.flatten(style) || {};
  const minimumHeight = typeof requested.height === "number" ? requested.height
    : Math.max(requested.minHeight || 48, fontScale > 1.4 ? 40 * fontScale + 16 : 48);
  const buttonStyle = [styles.button, style, { minHeight: minimumHeight }];
  if (NativeButton) return <View style={buttonStyle}>
    <NativeButton style={StyleSheet.absoluteFill} title={title} symbol={symbol}
      buttonRole={role} buttonDisabled={Boolean(disabled || loading)} loading={loading}
      buttonLabel={accessibilityLabel || title} onPress={onPress} />
  </View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title}
    accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading}
    onPress={onPress} style={({ pressed }) => [buttonStyle, styles.fallback,
      role === "accent" && styles.accent, role === "destructive" && styles.destructive, pressed && styles.pressed, (disabled || loading) && styles.disabled]}>
    {loading ? <ActivityIndicator color={role === "accent" ? COLORS.white : role === "destructive" ? "#C12D26" : COLORS.primary} /> : <>
      {!!symbol && <Ionicons name={fallbackSymbols[symbol] || "ellipse-outline"} size={20}
        color={role === "accent" ? COLORS.white : role === "destructive" ? "#C12D26" : COLORS.primary} />}
      {!!title && <Text style={[styles.buttonText, role === "accent" && styles.accentText, role === "destructive" && styles.destructiveText]}>{title}</Text>}
    </>}
  </Pressable>;
}

// The app's SafeScreen already supplies the top inset. Keep navigation symmetric.
export function FormHeader({ title, onBack, onSave, saving = false, saveDisabled = false, backDisabled = false, rightAction }) {
  const { fontScale } = useWindowDimensions();
  const large = fontScale > 1.4;
  return <View style={[styles.header, { minHeight: Math.max(64, 40 * fontScale + 20) }]}>
    <View style={[styles.headerSide, large && styles.headerSideLarge]}>
      {onBack && <GlassButton symbol="chevron.left" onPress={onBack} disabled={backDisabled}
        accessibilityLabel="Back" style={styles.headerBack} />}
    </View>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <View style={[styles.headerSide, styles.headerTrailing, large && styles.headerSideLarge]}>
      {rightAction || (onSave && <GlassButton title={large ? "" : "Save"} symbol={large ? "checkmark" : ""}
        onPress={onSave} loading={saving} disabled={saveDisabled} accessibilityLabel="Save"
        style={large ? styles.headerBack : styles.headerSave} />)}
    </View>
  </View>;
}

export function FormCard({ children, style, variant = "content" }) {
  return <View style={[styles.card, variant === "grouped" && styles.groupedCard, style]}>{children}</View>;
}

export const formStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 18 },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
});
const styles = StyleSheet.create({
  button: { minHeight: 48, justifyContent: "center", minWidth: 44 },
  fallback: { flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 18,
    borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: "#E8DFD6", backgroundColor: "#FFFCF8" },
  accent: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  buttonText: { ...TYPOGRAPHY.button, color: COLORS.primary, textAlign: "center"},
  accentText: { color: COLORS.white },
  destructive: { borderColor: "#ECD7D3" },
  destructiveText: { color: "#C12D26" },
  pressed: { backgroundColor: "#EDE3DA" },
  disabled: { opacity: 0.5 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  headerSide: { width: 72, alignItems: "flex-start", justifyContent: "center" },
  headerSideLarge: { width: 48 },
  headerTrailing: { alignItems: "flex-end" },
  headerBack: { width: 44, minHeight: 44, height: 44 },
  headerSave: { width: 68, minHeight: 44, height: 44 },
  title: { ...TYPOGRAPHY.pageTitle, flex: 1, color: COLORS.text, textAlign: "center"},
  card: { backgroundColor: SURFACES.content, borderRadius: 24, padding: 20, gap: 14,
    ...SURFACES.edge },
  groupedCard: { backgroundColor: SURFACES.grouped },
});
