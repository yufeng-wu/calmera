import { forwardRef, useEffect, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { styles } from "@/assets/styles/auth.styles";
import { FormHeader, FormScreen, FormScrollView } from "@/components/GlassForm";
import useInputFontGeometry from "@/hooks/useInputFontGeometry";

export function AuthScreen({ title, subtitle, onBack, backDisabled = false, children, footer }) {
  const { fontScale } = useWindowDimensions();
  const contentStyle = onBack ? styles.content : StyleSheet.flatten([styles.content, { paddingTop: 0 }]);
  const nativeHeaderEdge = Boolean(onBack) && Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26;
  const Screen = nativeHeaderEdge ? FormScreen : View;
  const Scroll = nativeHeaderEdge ? FormScrollView : KeyboardAwareScrollView;
  return <Screen style={styles.screen}>
    {onBack && <FormHeader title="calmera" onBack={onBack} backDisabled={backDisabled} />}
    <Scroll {...(nativeHeaderEdge ? { keyboardAware: true } : {})}
      key={`auth-text-${fontScale}`} style={styles.scroll} contentContainerStyle={contentStyle}
      enableOnAndroid enableAutomaticScroll extraScrollHeight={Platform.OS === "ios" ? 20 : 0}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {!onBack && <Text key={`brand-${fontScale}`} style={styles.wordmark}>foodwrap.</Text>}
      <View style={[styles.column, !onBack && { marginTop: 12 }]}>
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
        {footer}
      </View>
    </Scroll>
  </Screen>;
}

export const AuthField = forwardRef(function AuthField({ label, error = false, code = false, hint, style, calmeraPreview = false, ...props }, ref) {
  const inputGeometry = useInputFontGeometry([styles.input, code && styles.codeInput, error && styles.errorInput, style], props);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput ref={ref} accessibilityLabel={label} placeholderTextColor={COLORS.textLight}
      style={inputGeometry.style}
      autoCorrect={false} {...props}
      allowFontScaling={inputGeometry.allowFontScaling}
      autoComplete={calmeraPreview ? "off" : props.autoComplete}
      textContentType={calmeraPreview ? "none" : props.textContentType} />
    {hint && <Text style={styles.hint}>{hint}</Text>}
  </View>;
});

// Android uses the live region below; iOS needs an explicit announcement.
// Delay until the message is laid out, and cancel stale/unmounted messages.
function useAuthAnnouncement(message) {
  const lastAnnounced = useRef("");
  const text = typeof message === "string" ? message.trim() : "";
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!text) { lastAnnounced.current = ""; return; }
    if (lastAnnounced.current === text) return;
    const timer = setTimeout(() => {
      lastAnnounced.current = text;
      if (AccessibilityInfo.announceForAccessibilityWithOptions) {
        AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
      } else AccessibilityInfo.announceForAccessibility(text);
    }, 150);
    return () => clearTimeout(timer);
  }, [text]);
}

export function AuthNotice({ children, error = false }) {
  useAuthAnnouncement(children);
  if (!children) return null;
  return <View accessibilityLiveRegion="polite" style={[styles.notice, error && styles.errorNotice]}>
    <Ionicons name={error ? "alert-circle-outline" : "information-circle-outline"}
      size={20} color={error ? COLORS.expense : COLORS.primary} />
    <Text style={styles.noticeText}>{children}</Text>
  </View>;
}

export function AuthLink({ children, onPress, style, disabled = false }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link"
    accessibilityState={{ disabled }} style={[styles.link, style]}>
    <Text style={styles.linkText}>{children}</Text>
  </Pressable>;
}

export function AuthBusy({ children }) {
  useAuthAnnouncement(children);
  return <View accessibilityLiveRegion="polite" style={styles.busy}>
    <ActivityIndicator color={COLORS.primary} />
    <Text style={[styles.subtitle, { flex: 1 }]}>{children}</Text>
  </View>;
}

export function isAuthEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
