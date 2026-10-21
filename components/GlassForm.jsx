import { SafeScreenTopContext } from "@/components/SafeScreen";
import { SURFACES } from "@/constants/surfaces";
import { TYPOGRAPHY } from "@/constants/typography";
import { createContext, forwardRef, useCallback, useContext, useMemo, useRef, useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { Ionicons } from "@expo/vector-icons";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import OpenAILogo, { OPENAI_BLOSSOM_SYMBOL } from "./OpenAILogo";

const NativeButton = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "FormButton") : null;
const nativeEdgeSupported = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26;
const NativeHeaderEdge = nativeEdgeSupported ? requireNativeViewManager("CalmeraChatGPT", "HeaderScrollEdge") : null;
const HeaderScrollContext = createContext(null);

// Preserve the resting layout while letting the native scroll edge soften
// content moving underneath the actual header controls on iOS 26.
export function FormScreen({ children, style, onHeaderHeightChange, onEdgeStatus, ...props }) {
  const { fontScale } = useWindowDimensions();
  const safeTopInset = useContext(SafeScreenTopContext);
  const [measuredHeight, setMeasuredHeight] = useState(null);
  const [scrollTag, setScrollTag] = useState(0);
  const headerHeight = measuredHeight ?? Math.max(64, 40 * fontScale + 20);
  const reportHeaderHeight = useCallback(height => {
    setMeasuredHeight(previous => previous === height ? previous : height);
    onHeaderHeightChange?.(height + safeTopInset);
  }, [onHeaderHeightChange, safeTopInset]);
  const context = useMemo(() => ({ headerHeight, topInset: safeTopInset, scrollTag, setScrollTag, reportHeaderHeight, onEdgeStatus }),
    [headerHeight, safeTopInset, scrollTag, reportHeaderHeight, onEdgeStatus]);
  return <HeaderScrollContext.Provider value={context}>
    <View {...props} style={[formStyles.screen, style, safeTopInset ? { paddingTop: safeTopInset } : null]}>{children}</View>
  </HeaderScrollContext.Provider>;
}

export const FormScrollView = forwardRef(function FormScrollView({ keyboardAware = false, style,
  contentContainerStyle, scrollIndicatorInsets, onLayout, ...props }, forwardedRef) {
  const edge = useContext(HeaderScrollContext);
  const nodeRef = useRef(null);
  const register = edge?.setScrollTag;
  const updateTag = useCallback(() => {
    const node = nodeRef.current;
    const tag = node?.getScrollableNode?.() ?? node?.getScrollResponder?.()?.getScrollableNode?.() ?? 0;
    register?.(typeof tag === "number" ? tag : 0);
  }, [register]);
  const attach = useCallback(node => {
    nodeRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
    updateTag();
  }, [forwardedRef, updateTag]);
  const Component = keyboardAware ? KeyboardAwareScrollView : ScrollView;
  const overlap = NativeHeaderEdge && edge ? edge.headerHeight + edge.topInset : 0;
  const content = StyleSheet.flatten(contentContainerStyle) || {};
  const originalTop = content.paddingTop ?? content.paddingVertical ?? content.padding ?? 0;
  return <Component {...props} ref={attach} style={[{ flex: 1 }, style, overlap ? { marginTop: -overlap } : null]}
    contentContainerStyle={[contentContainerStyle, overlap ? { paddingTop: overlap + originalTop } : null]}
    contentInsetAdjustmentBehavior={props.contentInsetAdjustmentBehavior || "never"}
    scrollIndicatorInsets={{ ...scrollIndicatorInsets, top: (scrollIndicatorInsets?.top || 0) + overlap }}
    onLayout={event => { updateTag(); onLayout?.(event); }} />;
});
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
  style, accessibilityLabel, role = "default", onMetrics }) {
  const { fontScale } = useWindowDimensions();
  const requested = StyleSheet.flatten(style) || {};
  const minimumHeight = typeof requested.height === "number" ? requested.height
    : Math.max(requested.minHeight || 48, fontScale > 1.4 ? 40 * fontScale + 16 : 48);
  const buttonStyle = [styles.button, style, { minHeight: minimumHeight }];
  const navigation = role === "navigation" || role === "navigation-action";
  const neutral = role === "navigation";
  const foreground = role === "accent" ? COLORS.white : role === "destructive" ? "#C12D26"
    : neutral ? "#1C1C1E" : COLORS.primary;
  if (NativeButton) return <View style={buttonStyle}>
    <NativeButton style={StyleSheet.absoluteFill} title={title} symbol={symbol}
      buttonRole={role} buttonDisabled={Boolean(disabled || loading)} loading={loading}
      buttonLabel={accessibilityLabel || title} onPress={onPress} metricsEnabled={Boolean(onMetrics)} onMetrics={onMetrics} />
  </View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title}
    accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading}
    onPress={onPress} style={({ pressed }) => [buttonStyle, styles.fallback,
      role === "accent" && styles.accent, role === "destructive" && styles.destructive, navigation && styles.navigation, pressed && (navigation ? styles.navigationPressed : styles.pressed), (disabled || loading) && styles.disabled]}>
    {loading ? <ActivityIndicator color={foreground} /> : <>
      {!!symbol && (symbol === OPENAI_BLOSSOM_SYMBOL ? <OpenAILogo /> : <Ionicons name={fallbackSymbols[symbol] || "ellipse-outline"} size={20}
        color={foreground} />)}
      {!!title && <Text style={[styles.buttonText, role === "accent" && styles.accentText, role === "destructive" && styles.destructiveText, neutral && styles.navigationText]}>{title}</Text>}
    </>}
  </Pressable>;
}

// The app's SafeScreen already supplies the top inset. Keep navigation symmetric.
export function FormHeader({ title, titleContent, onBack, onSave, saving = false, saveDisabled = false, backDisabled = false, rightAction, onSaveMetrics }) {
  const { fontScale } = useWindowDimensions();
  const large = fontScale > 1.4;
  const edge = useContext(HeaderScrollContext);
  return <View collapsable={false} onLayout={event => edge?.reportHeaderHeight(event.nativeEvent.layout.height)}
    style={[styles.header, edge && { zIndex: 10 }, { minHeight: Math.max(64, 40 * fontScale + 20) }]}>
    {NativeHeaderEdge && edge && <NativeHeaderEdge pointerEvents="none" style={StyleSheet.absoluteFill}
      scrollViewTag={edge.scrollTag} topExtension={edge.topInset} reportStatus={Boolean(edge.onEdgeStatus)} onStatus={edge.onEdgeStatus} />}
    <View style={[styles.headerSide, large && styles.headerSideLarge]}>
      {onBack && <GlassButton symbol="chevron.left" role="navigation" onPress={onBack} disabled={backDisabled}
        accessibilityLabel="Back" style={styles.headerBack} />}
    </View>
    {titleContent ? <View style={{ flex: 1, alignItems: "center" }}>{titleContent}</View>
      : <Text accessibilityRole="header" style={styles.title}>{title}</Text>}
    <View style={[styles.headerSide, styles.headerTrailing, large && styles.headerSideLarge]}>
      {rightAction || (onSave && <GlassButton title={large ? "" : "Save"} symbol={large ? "checkmark" : ""}
        onPress={onSave} role="navigation-action" loading={saving} disabled={saveDisabled} accessibilityLabel="Save" onMetrics={onSaveMetrics}
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
  navigation: { paddingHorizontal: 0, backgroundColor: "#FFFFFF", borderColor: "#E5E5EA" },
  navigationText: { color: "#1C1C1E" },
  navigationPressed: { backgroundColor: "#F5F5F7" },
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
