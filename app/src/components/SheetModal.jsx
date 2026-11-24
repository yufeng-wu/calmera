import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

const curve = Easing.bezier(0.32, 0.72, 0, 1);
const OPEN = { duration: 420, easing: curve };
const CLOSE = { duration: 260, easing: curve };

// Mount to present; call ref.close(callback) to dismiss. Like a UIKit sheet,
// only the sheet travels while the dimmed backdrop fades, and dragging the
// header area down dismisses it.
const SheetModal = forwardRef(function SheetModal({ onClose, dismissLabel = "Dismiss", header, children, style, containerStyle, ...props }, ref) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const shown = useSharedValue(reducedMotion ? 1 : 0);
  const drag = useSharedValue(0);
  const closing = useRef(false);
  const close = useCallback((after = onClose) => {
    if (closing.current) return;
    closing.current = true;
    const finish = () => after?.();
    if (reducedMotion) return finish();
    shown.value = withTiming(0, CLOSE, finished => { if (finished) runOnJS(finish)(); });
  }, [onClose, reducedMotion, shown]);
  useImperativeHandle(ref, () => ({ close }), [close]);

  const pan = Gesture.Pan().activeOffsetY(8).failOffsetX([-24, 24])
    .onUpdate(event => { drag.value = Math.max(0, event.translationY); })
    .onEnd(event => {
      if (event.translationY > 120 || event.velocityY > 900) runOnJS(close)();
      else drag.value = withSpring(0, { damping: 24, stiffness: 260 });
    });
  const sheetMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.value) * height + drag.value }],
  }));
  const backdropMotion = useAnimatedStyle(() => ({
    opacity: shown.value * Math.max(0.35, 1 - drag.value / height),
  }));

  // Start once UIKit has presented the modal, so the first frames aren't lost to mounting.
  const present = () => { if (!reducedMotion && !closing.current) shown.value = withTiming(1, OPEN); };
  return <Modal visible transparent animationType="none" statusBarTranslucent onShow={present} onRequestClose={() => close()}>
    <GestureHandlerRootView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.root, styles.container, containerStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropMotion]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel={dismissLabel} accessibilityRole="button" />
        </Animated.View>
        <Animated.View {...props} style={[styles.sheet, style, sheetMotion]} accessibilityViewIsModal onAccessibilityEscape={() => close()}>
          <GestureDetector gesture={pan}>
            <View collapsable={false}>
              <View style={styles.grabber} accessible={false} />
              {header}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  </Modal>;
});

export default SheetModal;

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.32)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: "#FFFFFF" },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, marginTop: 6, backgroundColor: "#D9D1CA" },
});
