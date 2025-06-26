import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "@/assets/styles/create.styles";
import { COLORS } from "@/constants/colors";

// Reusable form card for creating/editing a food entry.
// The parent screen owns the state and simply passes the value + setter pairs.
export const FoodEntryFormCard = ({
  foodName,
  setFoodName,
  weight,
  setWeight,
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
  showWeight = false,
}) => {
  return (
    <View style={styles.card}>
      {/* Meal Type selector (optional) */}
      {showMealType && (
        <>
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
        </>
      )}

      {/* Food name */}
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

      {/* Weight (optional) */}
      {showWeight && (
        <>
          <Text style={styles.sectionTitle}>Weight (g)</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="resize-outline"
              size={20}
              color={COLORS.textLight}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Weight in grams"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
        </>
      )}

      {/* Calories */}
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

      {/* Protein */}
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

      {/* Carbs */}
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

      {/* Fat */}
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
  );
};
