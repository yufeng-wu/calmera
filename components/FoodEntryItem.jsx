import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles } from "../assets/styles/home.styles";
import { COLORS } from "../constants/colors";
import { formatTime } from "../lib/utils";
import { useState } from "react";
import { useRouter } from "expo-router";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const FoodEntryItem = ({ item, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const {
    foodName = item.food_name,
    calories,
    protein,
    carbs,
    fat,
    createdAt = item.created_at,
  } = item;

  const macros = `Protein ${Number(protein)}g   Carbs ${Number(
    carbs
  )}g   Fat ${Number(fat)}g`;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <TouchableOpacity
      style={styles.transactionCard}
      onPress={toggleExpand}
      activeOpacity={0.9}
    >
      <View style={styles.transactionContent}>
        <View style={styles.categoryIconContainer}>
          <Ionicons name="restaurant" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.transactionLeft}>
          <Text style={styles.transactionTitle}>{foodName}</Text>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: COLORS.primary }]}>
            {parseFloat(calories).toFixed(0)} kcal
          </Text>
          <Text style={styles.transactionDate}>{formatTime(createdAt)}</Text>
        </View>
        <View style={styles.indicatorContainer}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={COLORS.textLight}
          />
        </View>
      </View>
      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.macrosText}>{macros}</Text>
          <View style={styles.iconButtonsContainer}>
            <TouchableOpacity
              style={styles.editButtonExpanded}
              onPress={() => router.push(`/edit/${item.id}`)}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButtonExpanded}
              onPress={() => onDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.expense} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};
