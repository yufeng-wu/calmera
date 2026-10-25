import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { requireNativeViewManager } from "expo-modules-core";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

const nativeView = (name) => {
  if (Platform.OS !== "ios") return null;
  try { return requireNativeViewManager("CalmeraChatGPT", name); } catch { return null; }
};
const NativeSegmented = nativeView("Segmented");
const NativeGlassMenu = nativeView("GlassMenu");
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

// Shrinks a little on touch and springs back, so every tap feels answered.
export function PressScale({ children, style, onPress, disabled, scaleTo = 0.96, ...props }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Pressable {...props} disabled={disabled} onPress={onPress}
    onPressIn={() => { scale.value = withSpring(scaleTo, SPRING); }}
    onPressOut={() => { scale.value = withSpring(1, SPRING); }}>
    <Animated.View style={[style, animated]}>{children}</Animated.View>
  </Pressable>;
}

// System segmented control (Liquid Glass on iOS 26). Falls back to pills elsewhere.
export function Segmented({ items, index, onChange, style }) {
  if (NativeSegmented) {
    return <NativeSegmented items={items} selectedIndex={index} style={[styles.segmented, style]}
      onChange={({ nativeEvent }) => Number.isInteger(nativeEvent.index) && onChange(nativeEvent.index)} />;
  }
  return <View style={[styles.fallbackTrack, style]}>
    {items.map((item, position) => <Pressable key={item} onPress={() => onChange(position)}
      style={[styles.fallbackSegment, position === index && styles.fallbackSelected]}>
      <Text style={[styles.fallbackText, position === index && styles.fallbackTextSelected]}>{item}</Text>
    </Pressable>)}
  </View>;
}

// Round glass button with a native pop-up menu. items: [{ id, title, symbol, checked }]
export function GlassMenu({ symbol, icon, label, items, onSelect, size = 40 }) {
  if (NativeGlassMenu) {
    return <NativeGlassMenu symbol={symbol} label={label} style={{ width: size, height: size }}
      items={items.map(({ id, title, symbol: itemSymbol, checked }) => ({ id, title, symbol: itemSymbol || "", checked: checked ? "1" : "0" }))}
      onSelect={({ nativeEvent }) => onSelect(nativeEvent.id)} />;
  }
  const open = () => {
    const titles = items.map((item) => `${item.title}${item.checked ? "  ✓" : ""}`);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...titles, "Cancel"], cancelButtonIndex: titles.length },
        (position) => { if (position < items.length) onSelect(items[position].id); });
    } else {
      Alert.alert(label, undefined, [...items.map((item, position) => ({ text: titles[position], onPress: () => onSelect(item.id) })), { text: "Cancel", style: "cancel" }]);
    }
  };
  return <PressScale accessibilityRole="button" accessibilityLabel={label} onPress={open}
    style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]}>
    <Ionicons name={icon} size={22} color={COLORS.text} />
  </PressScale>;
}

const styles = StyleSheet.create({
  segmented: { height: 36, width: 300, alignSelf: "center" },
  fallbackTrack: { flexDirection: "row", alignSelf: "center", padding: 3, borderRadius: 20, backgroundColor: "#EFE7E0" },
  fallbackSegment: { minWidth: 92, alignItems: "center", paddingVertical: 7, borderRadius: 17 },
  fallbackSelected: { backgroundColor: "#FFFFFF" },
  fallbackText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textLight },
  fallbackTextSelected: { color: COLORS.text, fontWeight: "600" },
  round: { alignItems: "center", justifyContent: "center" },
});
