import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { ReduceMotion, interpolate, runOnJS, runOnUI, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { CLOSED, dragPosition, pressIsTap, releaseTarget, rowTouch, tapCloses } from "../../lib/meals/swipeRow.mjs";

// A row that slides left to show the actions behind its right edge. It does what the gesture library's swipeable
// row did for meals, with one difference that matters: that row armed its tap-to-close for every touch, opening
// swipes included, and counted on iOS to call the tap off once the drag began. On the owner's phone the row sprang
// shut the moment the finger lifted, on every swipe. Here the rules in lib/swipeRow decide, and a touch that is
// opening the row can't close it: not by its tap, not by a late report of it, and not through the card's press.
// The gestures also keep their identity across renders, so a render in the middle of a swipe (the Delete button is
// created on the first one) changes nothing about the touch in progress.
const SwipeRow = forwardRef(function SwipeRow({ children, width, threshold = width / 2, friction = 1, activeOffset = [-10, 10],
  overshoot = true, overshootFriction = 1, spring, trackpad = false, containerStyle, pointerEvents, renderActions,
  onStartDrag, onWillOpen, onOpen, onWillClose, onClose }, ref) {
  const touch = useSharedValue(CLOSED);
  const drag = useSharedValue(0);
  const translation = useSharedValue(0);
  const progress = useSharedValue(0);
  const handlers = useRef(null);
  handlers.current = { onStartDrag, onWillOpen, onOpen, onWillClose, onClose };
  const tell = useCallback((name) => handlers.current[name]?.(), []);

  const settle = useCallback((to, velocity) => {
    "worklet";
    const opening = to !== 0;
    const config = { mass: 2, damping: 1000, stiffness: 700, overshootClamping: true, reduceMotion: ReduceMotion.System, ...spring, velocity };
    translation.value = withSpring(to, config, (finished) => {
      if (!finished) return;
      if (opening) touch.value = rowTouch(touch.value, "rested");
      runOnJS(tell)(opening ? "onOpen" : "onClose");
    });
    progress.value = withSpring(opening ? 1 : 0, { ...config, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01,
      velocity: velocity && interpolate(velocity, [-width, width], [-1, 1]) });
    runOnJS(tell)(opening ? "onWillOpen" : "onWillClose");
    touch.value = rowTouch(touch.value, opening ? "opened" : "closed");
  }, [spring, width, tell, touch, translation, progress]);

  const pan = useMemo(() => Gesture.Pan()
    .enableTrackpadTwoFingerGesture(trackpad)
    .activeOffsetX(activeOffset)
    .onBegin(() => { touch.value = rowTouch(touch.value, "touch"); })
    .onStart(() => {
      drag.value = 0;
      if (!touch.value.open) runOnJS(tell)("onStartDrag");
      touch.value = rowTouch(touch.value, "drag");
    })
    .onUpdate((event) => {
      drag.value = event.translationX;
      translation.value = dragPosition(event.translationX, { open: touch.value.open, width, friction, overshoot, overshootFriction });
      progress.value = width > 0 ? interpolate(translation.value, [-width, 0, 1], [1, 0, 0]) : 0;
    })
    .onEnd((event) => {
      const speed = Number.isFinite(event.velocityX) ? event.velocityX : 0;
      const to = releaseTarget({ open: touch.value.open, drag: drag.value, velocity: speed, width, threshold, friction });
      touch.value = rowTouch(touch.value, "release");
      settle(to, speed / friction);
    })
    .onFinalize(() => { touch.value = rowTouch(touch.value, "release"); }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- activeOffset is compared by its two numbers.
  [trackpad, activeOffset[0], activeOffset[1], width, threshold, friction, overshoot, overshootFriction, settle, tell, touch, drag, translation, progress]);

  const tap = useMemo(() => Gesture.Tap()
    .shouldCancelWhenOutside(true)
    .onBegin(() => { touch.value = rowTouch(touch.value, "down"); })
    .onStart(() => { if (tapCloses(touch.value)) settle(0); }),
  [settle, touch]);

  useImperativeHandle(ref, () => ({
    close: () => runOnUI(() => { "worklet"; settle(0); })(),
    open: () => runOnUI(() => { "worklet"; settle(-width); })(),
    // Straight to closed with no animation and no callbacks, for when the row's size changes or its screen goes away.
    reset: () => runOnUI(() => { "worklet"; drag.value = 0; progress.value = 0; translation.value = 0; touch.value = CLOSED; })(),
    // For the card's press handler: false when the touch now lifting was a swipe, not a tap.
    pressIsTap: () => pressIsTap(touch.value),
  }), [settle, width, drag, progress, translation, touch]);

  // The card takes presses only while the row is closed; open, any touch on it belongs to the row.
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translation.value }], pointerEvents: touch.value.open ? "box-only" : "auto" }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: progress.value === 0 ? 0 : 1 }));

  return <GestureDetector gesture={pan}>
    <Animated.View pointerEvents={pointerEvents} style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.actions, actionsStyle]}>{renderActions?.(progress, translation)}</Animated.View>
      <GestureDetector gesture={tap}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  </GestureDetector>;
});

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
  actions: { ...StyleSheet.absoluteFillObject, flexDirection: "row-reverse", overflow: "hidden" },
});

export default SwipeRow;
