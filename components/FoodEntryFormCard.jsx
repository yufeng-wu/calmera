import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";

// Reusable form card for creating/editing a food entry.
// The parent screen owns the state and simply passes the value + setter pairs.
export const FoodEntryFormCard = ({
  foodName,
  setFoodName,
  quantity,
  setQuantity,
  gramsOnly = false,
  calories,
  setCalories,
  protein,
  setProtein,
  carbs,
  setCarbs,
  fat,
  setFat,
  mealType,
  setMealType,
  showMealType = true,
  showEstimateButton = true,
  onEstimateMacros,
  isEstimating = false,
  estimateDisabled = false,
  showMacros = true,
}) => {
  return (
    <View style={styles.formContainer}>
      {showMealType && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Meal Type</Text>
          <View style={styles.typeSelector}>
            {["Breakfast", "Lunch", "Dinner", "Snack"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  mealType === type && styles.typeButtonActive,
                ]}
                onPress={() => (setMealType ? setMealType(type) : null)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    mealType === type && styles.typeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Food & Quantity + AI button */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Food Name</Text>
        <View style={styles.inputContainer}>
          <Ionicons
            name="restaurant"
            size={20}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Food name"
            placeholderTextColor={COLORS.textLight}
            value={foodName}
            onChangeText={setFoodName}
          />
        </View>

        <Text style={styles.sectionTitle}>Quantity</Text>
        <View style={styles.inputContainer}>
          <Ionicons
            name="cube-outline"
            size={20}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder={
              gramsOnly ? "grams" : "e.g. 1 cup, 12 oz, 150g, 1 piece"
            }
            placeholderTextColor={COLORS.textLight}
            keyboardType={gramsOnly ? "numeric" : "default"}
            value={gramsOnly && quantity ? String(quantity) : quantity}
            onChangeText={(text) => {
              if (gramsOnly) {
                const digits = text.replace(/[^0-9]/g, "");
                setQuantity(digits);
              } else {
                setQuantity(text);
              }
            }}
          />
          {gramsOnly && (
            <Text style={{ marginRight: 6, color: COLORS.text }}>&nbsp;g</Text>
          )}
        </View>

        {showEstimateButton && (
          <Text style={styles.helperText}>
            If the detection is incorrect, please edit the food name or quantity
            and tap the button below to re-estimate macros.
          </Text>
        )}

        {/* Estimate Button */}
        {showEstimateButton && onEstimateMacros && (
          <TouchableOpacity
            style={[
              styles.estimateButton,
              (isEstimating || estimateDisabled) &&
                styles.estimateButtonDisabled,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              onEstimateMacros();
            }}
            disabled={isEstimating || estimateDisabled}
          >
            <Text style={styles.estimateButtonText}>
              {isEstimating ? "Estimating..." : "Estimate Macros with AI"}
            </Text>
            {isEstimating ? (
              <Ionicons
                name="hourglass-outline"
                size={18}
                color={COLORS.primary}
              />
            ) : (
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={COLORS.white}
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Macros Card */}
      {showMacros && (
        <View style={styles.card}>
          <Text style={styles.helperText}>
            You may manually edit these values.
          </Text>
          <View style={styles.macrosGridRow}>
            {/* Calories */}
            <View style={styles.macroCell}>
              <Text style={styles.sectionTitle}>Calories (kcal)</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="flame"
                  size={20}
                  color={COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Calories"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                />
              </View>
            </View>

            {/* Protein */}
            <View style={styles.macroCell}>
              <Text style={styles.sectionTitle}>Protein (g)</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="barbell"
                  size={20}
                  color={COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Protein"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={protein}
                  onChangeText={setProtein}
                />
              </View>
            </View>
          </View>

          <View style={styles.macrosGridRow}>
            {/* Carbs */}
            <View style={styles.macroCell}>
              <Text style={styles.sectionTitle}>Carbs (g)</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="nutrition"
                  size={20}
                  color={COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Carbs"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={carbs}
                  onChangeText={setCarbs}
                />
              </View>
            </View>

            {/* Fat */}
            <View style={styles.macroCell}>
              <Text style={styles.sectionTitle}>Fat (g)</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="egg"
                  size={20}
                  color={COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Fat"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={fat}
                  onChangeText={setFat}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
