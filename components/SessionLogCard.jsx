import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import Animated, { Layout, FadeIn, FadeOut } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { cameraStyles as styles } from "@/assets/styles/camera.styles";
import { COLORS } from "@/constants/colors";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);

/**
 * Card component for displaying a single session log entry during an active camera session.
 * Shows the food name, weight and kcal upfront. Tapping the card expands it to reveal
 * macro details plus Edit and Delete icon-buttons.
 *
 * Props:
 * - entry: {
 *     id: string,
 *     weight: number,
 *     foodName: string,
 *     nutritionInfo?: { calories?: number, protein?: number, carbs?: number, fat?: number },
 *     timestamp?: string,
 *   }
 * - onEdit: (id: string) => void  // invoked when the Edit button is pressed
 * - onDelete: (id: string) => void // invoked when the Delete button is pressed
 */
export const SessionLogCard = ({ entry, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const {
    id,
    absDeltaWeight,
    foodName = "Unknown",
    nutritionInfo = {},
  } = entry || {};

  const { calories = 0, protein = 0, carbs = 0, fat = 0 } = nutritionInfo;

  const macrosLine = `Protein ${Number(protein)}g   Carbs ${Number(
    carbs
  )}g   Fat ${Number(fat)}g`;

  const kcalLine = `${Number(calories).toFixed(0)} kcal`;

  const dispWeight = Number(absDeltaWeight);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <AnimatedTouchable
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify().damping(15)}
      style={[styles.logCard, expanded && { paddingBottom: 8 }]}
      activeOpacity={0.9}
      onPress={toggleExpand}
    >
      {/* COLLAPSED ROW */}
      <View style={styles.logCardRow}>
        {/* Food name left, stats right */}
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: "bold",
            color: COLORS.text,
          }}
          numberOfLines={1}
        >
          {foodName}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginLeft: "auto",
          }}
        >
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "600",
              marginRight: 10,
            }}
          >
            {kcalLine}
          </Text>
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "600",
              marginRight: 2,
            }}
          >
            {dispWeight} g
          </Text>
        </View>

        {/* Expand icon */}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={COLORS.textLight}
          style={{ marginLeft: 6 }}
        />
      </View>

      {/* EXPANDED DETAILS */}
      {expanded && (
        <AnimatedView
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.logCardRow, { marginTop: 2 }]}
        >
          <Text style={{ color: COLORS.textLight, fontSize: 12, flex: 1 }}>
            {macrosLine}
          </Text>

          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              onPress={() => onEdit(id)}
              style={{ paddingHorizontal: 12 }}
            >
              <Ionicons
                name="create-outline"
                size={22}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(id)}
              style={{ paddingHorizontal: 12 }}
            >
              <Ionicons name="trash-outline" size={22} color={COLORS.expense} />
            </TouchableOpacity>
          </View>
        </AnimatedView>
      )}
    </AnimatedTouchable>
  );
};
