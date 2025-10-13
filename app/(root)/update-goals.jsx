import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { USERS_API_URL } from "@/constants/api";
import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { styles as createStyles } from "@/assets/styles/create.styles";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import { useAuth } from "@clerk/clerk-expo";
import PageLoader from "@/components/PageLoader";

export default function UpdateGoals() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Enable LayoutAnimation for Android
  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Animate goal fields when we return from the survey with recommended params
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isFetching && params?.recCal && !hasAnimated.current) {
      hasAnimated.current = true;

      const newGoals = {
        calorieGoal: String(params.recCal),
        proteinGoal: String(params.recProt),
        carbsGoal: String(params.recCarbs),
        fatGoal: String(params.recFat),
      };

      // Simple flip/scroll effect using LayoutAnimation
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setGoals((prev) => ({ ...prev, ...newGoals }));
    }
  }, [isFetching, params]);

  const { setShouldRefresh, setShouldRefreshGoals } = useRefreshSignal();
  const { getToken } = useAuth();
  const [goals, setGoals] = useState({
    calorieGoal: "",
    proteinGoal: "",
    carbsGoal: "",
    fatGoal: "",
  });
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchGoals = async () => {
      setIsFetching(true);
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
          calorieGoal: String(data.calorieGoal ?? ""),
          proteinGoal: String(data.proteinGoal ?? ""),
          carbsGoal: String(data.carbsGoal ?? ""),
          fatGoal: String(data.fatGoal ?? ""),
        });
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Unable to load goals");
      } finally {
        setIsFetching(false);
      }
    };
    fetchGoals();
  }, []);

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
        calorieGoal: goals.calorieGoal ? Number(goals.calorieGoal) : undefined,
        proteinGoal: goals.proteinGoal ? Number(goals.proteinGoal) : undefined,
        carbsGoal: goals.carbsGoal ? Number(goals.carbsGoal) : undefined,
        fatGoal: goals.fatGoal ? Number(goals.fatGoal) : undefined,
        localDate: new Date().toLocaleDateString("en-CA"),
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
            setShouldRefreshGoals(true);
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

  // Show global loader while fetching goals
  if (isFetching) {
    return <PageLoader />;
  }

  return (
    <View style={createStyles.container}>
      <View style={createStyles.header}>
        <TouchableOpacity
          style={createStyles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={createStyles.headerTitle}>Update Macro Goals</Text>
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
            value={goals.calorieGoal}
            onChangeText={(v) => handleChange("calorieGoal", v)}
            placeholder="e.g. 2000"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Protein (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={goals.proteinGoal}
            onChangeText={(v) => handleChange("proteinGoal", v)}
            placeholder="e.g. 150"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Carbs (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={goals.carbsGoal}
            onChangeText={(v) => handleChange("carbsGoal", v)}
            placeholder="e.g. 250"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fat (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={goals.fatGoal}
            onChangeText={(v) => handleChange("fatGoal", v)}
            placeholder="e.g. 70"
          />
        </View>

        {/* AI Recommendation CTA */}
        <View style={[createStyles.card, styles.ctaCard]}>
          <View style={styles.ctaHeader}>
            <Ionicons
              name="sparkles"
              size={18}
              color={COLORS.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.ctaTitle}>Need some help?</Text>
          </View>
          <Text style={styles.ctaText}>
            Take a 1-minute survey and we will recommend the right calories and
            macros for you.
          </Text>
          <TouchableOpacity
            style={[createStyles.estimateButton, { marginTop: 12 }]}
            onPress={() => router.push("/goals-survey")}
            activeOpacity={0.8}
          >
            <Text style={createStyles.estimateButtonText}>Take the survey</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>
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
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  surveyLinkContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  surveyLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: "center",
    lineHeight: 20,
    textDecorationLine: "underline",
  },
  ctaCard: {
    marginTop: 8,
  },
  ctaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  ctaTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  ctaText: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
    marginBottom: 6,
    marginTop: 8,
  },
});
