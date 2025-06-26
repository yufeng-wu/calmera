import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles } from "@/assets/styles/home.styles";
import { COLORS } from "@/constants/colors";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    weight = 0,
    foodName = "Unknown",
    nutritionInfo = {},
    timestamp,
  } = entry || {};

  const { calories = 0, protein = 0, carbs = 0, fat = 0 } = nutritionInfo;

  const macrosLine = `${Number(calories).toFixed(0)} kcal   Protein ${Number(
    protein
  )}g   Carbs ${Number(carbs)}g   Fat ${Number(fat)}g`;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <TouchableOpacity
      style={styles.transactionCard}
      activeOpacity={0.9}
      onPress={toggleExpand}
    >
      {/* COLLAPSED ROW */}
      <View
        style={[styles.transactionContent, expanded && { paddingBottom: 5 }]}
      >
        <View style={styles.transactionLeft}>
          <Text
            style={[styles.transactionTitle, { fontSize: 16, marginBottom: 2 }]}
          >
            {foodName}
          </Text>
          <Text style={[styles.macrosText, { marginTop: 0 }]} numberOfLines={1}>
            {macrosLine}
          </Text>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: COLORS.primary }]}>
            {Number(weight)} g
          </Text>
        </View>
        <View style={styles.indicatorContainer}>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={COLORS.textLight}
          />
        </View>
      </View>

      {/* EXPANDED DETAILS */}
      {expanded && (
        <View style={[styles.expandedContent, { paddingTop: 2 }]}>
          <View style={[styles.iconButtonsContainer, { marginLeft: "auto" }]}>
            <TouchableOpacity
              style={styles.editButtonExpanded}
              onPress={() => onEdit(id)}
            >
              <Ionicons
                name="create-outline"
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButtonExpanded}
              onPress={() => onDelete(id)}
            >
              <Ionicons name="trash-outline" size={24} color={COLORS.expense} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};
