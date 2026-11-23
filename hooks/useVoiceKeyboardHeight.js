import { useEffect } from "react";
import { Keyboard, Platform } from "react-native";
import { Easing, useAnimatedKeyboard, useSharedValue, withTiming } from "react-native-reanimated";

const curves = {
  easeIn: Easing.bezier(0.42, 0, 1, 1),
  easeInEaseOut: Easing.bezier(0.42, 0, 0.58, 1),
  easeOut: Easing.bezier(0, 0, 0.58, 1),
  linear: Easing.linear,
  keyboard: Easing.bezier(0.24, 0, 0.2, 1),
};

function useIOSKeyboardHeight(windowHeight) {
  const height = useSharedValue(0);

  useEffect(() => {
    const overlap = frame => frame?.screenY > 0
      ? Math.max(0, Math.min(frame.height, windowHeight - frame.screenY))
      : 0;
    height.value = overlap(Keyboard.metrics());
    // Start with the system keyboard's frame change. On iOS 26 the Reanimated
    // observer can skip the intermediate heights and report the endpoint alone.
    const subscription = Keyboard.addListener("keyboardWillChangeFrame", ({ endCoordinates, duration, easing }) => {
      const target = overlap(endCoordinates);
      height.value = duration > 0 ? withTiming(target, { duration, easing: curves[easing] ?? curves.keyboard }) : target;
    });
    return () => subscription.remove();
  }, [height, windowHeight]);

  return height;
}

function useAnimatedKeyboardHeight() {
  return useAnimatedKeyboard().height;
}

export default Platform.OS === "ios" ? useIOSKeyboardHeight : useAnimatedKeyboardHeight;
