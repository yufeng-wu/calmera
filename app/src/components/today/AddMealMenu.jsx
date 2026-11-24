import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import GlassSurface from "../GlassSurface";
import { requireCalmeraNativeView } from "../../../modules/calmera-native";

export const ADD_MENU_OPTION_WIDTH = 120;

function FallbackAddMealMenu({ expanded, onToggle, onClose, onText, onPhoto,
  onVoicePress, bottomInset = 0, onOptionLayout }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0, duration: reduceMotion ? 0 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, progress, reduceMotion]);

  useEffect(() => {
    if (!expanded) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => listener.remove();
  }, [expanded, onClose]);
  const dismiss = () => onClose();
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}
      accessibilityViewIsModal={expanded} onAccessibilityEscape={dismiss}>
      {expanded && <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}
        accessibilityRole="button" accessibilityLabel="Dismiss add meal menu" />}
      {expanded && <Animated.View style={[styles.stack, {
        bottom: 108 + bottomInset,
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Log a meal from a photo" onPress={onPhoto}
            onLayout={onOptionLayout ? ({ nativeEvent }) => onOptionLayout("photo", nativeEvent.layout.width) : undefined}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <GlassSurface />
            <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
            <Text style={styles.label}>Photo</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Add a meal with text" onPress={onText}
            onLayout={onOptionLayout ? ({ nativeEvent }) => onOptionLayout("text", nativeEvent.layout.width) : undefined}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <GlassSurface />
            <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
            <Text style={styles.label}>Text</Text>
          </Pressable>
          <Pressable onPress={onVoicePress} accessibilityRole="button" accessibilityLabel="Log a meal by voice"
            onLayout={onOptionLayout ? ({ nativeEvent }) => onOptionLayout("voice", nativeEvent.layout.width) : undefined}
            accessibilityHint="Opens a voice panel to describe your meal."
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <GlassSurface />
            <Ionicons name="mic-outline" size={20} color={COLORS.primary} />
            <Text style={styles.label}>Voice</Text>
          </Pressable>
      </Animated.View>}
      <Pressable onPress={onToggle} accessibilityRole="button"
        accessibilityLabel={expanded ? "Close add meal menu" : "Add a meal"}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.trigger, { bottom: 40 + bottomInset, width: expanded ? 56 : 80 }, pressed && styles.pressed]}>
        <GlassSurface />
        <Ionicons name={expanded ? "close" : "add"} size={20} color={COLORS.primary} />
        {!expanded && <Text style={[styles.label, { color: COLORS.primary }]}>Add</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: "absolute", bottom: 108, right: 20, left: 20, alignItems: "flex-end", gap: 12 },
  // Each option's content starts at the same inset, so the icons share one column and the titles one left edge.
  option: { width: ADD_MENU_OPTION_WIDTH, maxWidth: "100%", minHeight: 48, paddingVertical: 12, paddingLeft: 28, paddingRight: 16,
    borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 10,
    backgroundColor: "transparent", shadowColor: COLORS.shadow, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  label: { fontSize: 14, fontWeight: "600", color: COLORS.text, flexShrink: 1 },
  trigger: { position: "absolute", bottom: 40, right: 20, minHeight: 56,
    minWidth: 56, paddingHorizontal: 12, borderRadius: 28, gap: 4,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent", shadowColor: COLORS.shadow, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  pressed: { opacity: 0.7 },
});


const NativeMenu = Platform.OS === "ios"
  ? requireCalmeraNativeView("ActionMenu")
  : null;

export default function AddMealMenu(props) {
  if (!NativeMenu) return <FallbackAddMealMenu {...props} />;
  const onAction = ({ nativeEvent }) => {
    const actions = {
      toggle: props.onToggle, close: props.onClose,
      photo: props.onPhoto, text: props.onText, voiceTap: props.onVoicePress,
    };
    actions[nativeEvent.action]?.();
  };
  const onMetrics = ({ nativeEvent }) => {
    props.onMenuMetrics?.(nativeEvent);
    ["photo", "text", "voice"].forEach((name) => {
      props.onOptionLayout?.(name, nativeEvent[name]);
      props.onOptionSpacing?.(name, nativeEvent[`${name}Left`], nativeEvent[`${name}Right`]);
    });
  };
  return <NativeMenu style={StyleSheet.absoluteFill}
    expanded={props.expanded} recording={false} analyzing={false}
    seconds={0} bottomInset={props.bottomInset || 0} optionWidth={ADD_MENU_OPTION_WIDTH}
    previewPalette={props.previewPalette || "tangerine"} motionDiagnostics={Boolean(props.onMenuMetrics)}
    onAction={onAction} onMetrics={props.onOptionLayout || props.onOptionSpacing || props.onMenuMetrics ? onMetrics : undefined} />;
}
