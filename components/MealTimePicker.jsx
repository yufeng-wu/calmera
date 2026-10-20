import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { Picker } from "@react-native-picker/picker";
import { formatMealTime, MEAL_TIME_STEP } from "@/lib/mealTimes.mjs";

const NativePicker = Platform.OS === "ios" ? requireNativeViewManager("CalmeraChatGPT", "MealTimePicker") : null;
export default function MealTimePicker({ value, label, disabled = false, onChange }) {
  const { fontScale, width } = useWindowDimensions();
  const pickerStyle = [styles.picker, { width: Math.min(width - 72, 150 * Math.max(1, fontScale)),
    height: Math.max(44, 32 * fontScale + 12) }];
  if (NativePicker) return <NativePicker style={pickerStyle} minutes={value} pickerLabel={label}
    pickerDisabled={disabled} onValueChange={({ nativeEvent }) => onChange(nativeEvent.minutes)} />;
  return <View style={pickerStyle}><Picker selectedValue={value} enabled={!disabled}
    accessibilityLabel={label} onValueChange={onChange}>
    {Array.from({ length: 1440 / MEAL_TIME_STEP }, (_, i) => i * MEAL_TIME_STEP)
      .map(minute => <Picker.Item key={minute} value={minute} label={formatMealTime(minute)} />)}
  </Picker></View>;
}
const styles = StyleSheet.create({ picker: { width: 150, height: 44 } });
