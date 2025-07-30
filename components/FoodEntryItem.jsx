import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
// Reanimated for robust layout animations (works in the New Architecture)
import Animated, { Layout, FadeIn, FadeOut } from "react-native-reanimated";
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

// Create an animated version of TouchableOpacity
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const FoodEntryItem = ({ item, onDelete, enableLayout = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const {
    foodName = item.food_name,
    calories,
    protein,
    carbs,
    fat,
    localTime = item.local_time,
  } = item;

  const displayTime = localTime;

  const macros = `Protein ${Number(protein)}g   Carbs ${Number(
    carbs
  )}g   Fat ${Number(fat)}g`;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <AnimatedTouchable
      layout={enableLayout ? Layout.springify().damping(15) : undefined}
      style={styles.foodEntryCard}
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
          <Text style={styles.transactionDate}>{formatTime(displayTime)}</Text>
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
        <Animated.View
          entering={FadeIn.duration(130)}
          exiting={FadeOut.duration(120)}
          style={styles.expandedContent}
        >
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
        </Animated.View>
      )}
    </AnimatedTouchable>
  );
};
