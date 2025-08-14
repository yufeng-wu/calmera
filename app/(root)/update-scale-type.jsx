import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { styles as createStyles } from "@/assets/styles/create.styles";
import { USERS_API_URL } from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";
import PageLoader from "@/components/PageLoader";

const SCALE_OPTIONS = [
  {
    key: "integer",
    title: "Integer Only",
    description: "No decimal places (e.g., 256g)",
    img: require("../../assets/images/0-decimal.png"),
  },
  {
    key: "1-decimal",
    title: "1 Decimal Place",
    description: "Shows one digit after the decimal (e.g., 256.1g)",
    img: require("../../assets/images/1-decimal.png"),
  },
  {
    key: "2-decimal",
    title: "2 Decimal Places",
    description: "Shows two digits after the decimal (e.g., 256.13g)",
    img: require("../../assets/images/2-decimal.png"),
  },
];

const ScaleOption = ({ option, isSelected, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={[styles.optionCard, isSelected && styles.optionSelectedCard]}
  >
    <Image source={option.img} style={styles.optionImage} />
    <View style={styles.optionTextContainer}>
      <Text style={styles.optionTitle}>{option.title}</Text>
      <Text style={styles.optionDescription}>{option.description}</Text>
    </View>
    {isSelected && (
      <Ionicons
        name="checkmark-circle"
        size={24}
        color={COLORS.primary}
        style={styles.checkIcon}
      />
    )}
  </TouchableOpacity>
);

export default function UpdateScaleType() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [selected, setSelected] = useState("integer");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchScaleType = async () => {
      setIsFetching(true);
      try {
        const token = await getToken();
        const res = await fetch(`${USERS_API_URL}/get-user`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        setSelected(data.scaleType || "integer");
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Unable to load current scale type");
      } finally {
        setIsFetching(false);
      }
    };
    fetchScaleType();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${USERS_API_URL}/update-scale-type`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scaleType: selected }),
      });
      if (!res.ok) throw new Error("Failed to update scale type");
      Alert.alert("Success", "Scale type updated", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Unable to update scale type");
    } finally {
      setLoading(false);
    }
  };

  if (isFetching) return <PageLoader />;

  return (
    <View style={createStyles.container}>
      <View style={createStyles.header}>
        <TouchableOpacity
          style={createStyles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={createStyles.headerTitle}>Update Scale Type</Text>
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

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.questionText}>
          What type of kitchen scale are you using?
        </Text>

        <View style={styles.optionsList}>
          {SCALE_OPTIONS.map((opt) => (
            <ScaleOption
              key={opt.key}
              option={opt}
              isSelected={selected === opt.key}
              onPress={() => setSelected(opt.key)}
            />
          ))}
        </View>

        <Text style={styles.noteText}>
          Selecting the correct scale type helps Calmera AI interpret the
          numbers on your scale display accurately, ensuring precise weight
          readings for your Calmera AI sessions.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 16,
  },
  optionsList: {
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: "transparent",
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  optionSelectedCard: {
    borderColor: COLORS.primary,
  },
  optionImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#fff", // To show image border
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  checkIcon: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  noteText: {
    marginTop: 24,
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    textAlign: "center",
  },
});
