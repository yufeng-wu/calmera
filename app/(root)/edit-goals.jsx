import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { USERS_API_URL } from "@/constants/api";
import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { styles as createStyles } from "@/assets/styles/create.styles";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { useAuth } from "@clerk/clerk-expo";

export default function EditGoals() {
  const router = useRouter();
  const { setShouldRefresh } = useRefreshSignal();
  const { getToken } = useAuth();
  const [goals, setGoals] = useState({
    calorie_goal: "",
    protein_goal: "",
    carbs_goal: "",
    fat_goal: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${USERS_API_URL}/get-user`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch user goals");
        const data = await res.json();
        setGoals({
          calorie_goal: String(data.calorie_goal ?? ""),
          protein_goal: String(data.protein_goal ?? ""),
          carbs_goal: String(data.carbs_goal ?? ""),
          fat_goal: String(data.fat_goal ?? ""),
        });
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Unable to load goals");
      }
    };
    fetchGoals();
  }, [getToken]);

  const handleChange = (field, value) => {
    // Only allow numeric values and optional decimal point
    const sanitized = value.replace(/[^0-9.]/g, "");
    setGoals((prev) => ({ ...prev, [field]: sanitized }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const body = {
        calorie_goal: goals.calorie_goal
          ? Number(goals.calorie_goal)
          : undefined,
        protein_goal: goals.protein_goal
          ? Number(goals.protein_goal)
          : undefined,
        carbs_goal: goals.carbs_goal ? Number(goals.carbs_goal) : undefined,
        fat_goal: goals.fat_goal ? Number(goals.fat_goal) : undefined,
      };
      const res = await fetch(`${USERS_API_URL}/update-user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update goals");
      Alert.alert("Success", "Goals updated successfully", [
        {
          text: "OK",
          onPress: () => {
            setShouldRefresh(true);
            router.back();
          },
        },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Unable to update goals");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={createStyles.container}>
      <View style={createStyles.header}>
        <TouchableOpacity
          style={createStyles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={createStyles.headerTitle}>Edit Macro Goals</Text>
        <TouchableOpacity
          style={createStyles.saveButtonContainer}
          onPress={handleSave}
          disabled={loading}
        >
          <Text
            style={[
              createStyles.saveButton,
              loading && createStyles.saveButtonDisabled,
            ]}
          >
            {loading ? "Saving..." : "Save"}
          </Text>
          {!loading && (
            <Ionicons name="checkmark" size={18} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Calories (kcal)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={goals.calorie_goal}
            onChangeText={(v) => handleChange("calorie_goal", v)}
            placeholder="e.g. 2000"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Protein (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={goals.protein_goal}
            onChangeText={(v) => handleChange("protein_goal", v)}
            placeholder="e.g. 150"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Carbs (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={goals.carbs_goal}
            onChangeText={(v) => handleChange("carbs_goal", v)}
            placeholder="e.g. 250"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fat (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={goals.fat_goal}
            onChangeText={(v) => handleChange("fat_goal", v)}
            placeholder="e.g. 70"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
});
