import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Image,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "@/constants/colors";
import { USERS_API_URL } from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";

// --- Static guide images (same as old calmera-guide) ---
const GUIDE_IMAGES = [
  require("@/assets/images/calmera-guide-1.png"),
  require("@/assets/images/calmera-guide-2.png"),
  require("@/assets/images/calmera-guide-3.png"),
  require("@/assets/images/calmera-guide-4.png"),
];

// --- Scale type options ---
const SCALE_OPTIONS = [
  {
    key: "integer",
    title: "Integer Only",
    description: "No decimal places (e.g., 256g)",
    img: require("@/assets/images/0-decimal.png"),
  },
  {
    key: "1-decimal",
    title: "1 Decimal Place",
    description: "Shows one digit after the decimal (e.g., 256.1g)",
    img: require("@/assets/images/1-decimal.png"),
  },
  {
    key: "2-decimal",
    title: "2 Decimal Places",
    description: "Shows two digits after the decimal (e.g., 256.13g)",
    img: require("@/assets/images/2-decimal.png"),
  },
];

// Option card component shared with update-scale-type screen
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

export default function CalmeraWelcomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { width, height } = Dimensions.get("window");
  const flatRef = useRef(null);
  const [page, setPage] = useState(0);

  // scale selection state
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const { getToken } = useAuth();

  // combine guide images + dummy item for selector
  const DATA = [...GUIDE_IMAGES, "selector"];

  const renderItem = ({ item, index }) => {
    if (item === "selector") {
      // final page: scale selection
      return (
        <View style={{ width, height, paddingTop: 60 }}>
          <Text style={styles.questionText}>Select Your Scale Type</Text>
          <Text style={styles.questionDescription}>
            This helps Calmera to read your scale correctly.
            {"\n\n"}You can always change it later in Settings.
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
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!selected || saving) && styles.saveBtnDisabled,
            ]}
            onPress={async () => {
              if (saving || !selected) return;
              setSaving(true);
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
                if (!res.ok) throw new Error("Failed to save scale type");
                // Pop entire stack back to dashboard then show dashboard
                if (typeof navigation.popToTop === "function") {
                  navigation.popToTop();
                }
                // Navigate into live session
                router.push("/(root)/camera");
              } catch (err) {
                console.error(err);
                Alert.alert("Error", "Unable to save scale type");
              } finally {
                setSaving(false);
              }
            }}
            activeOpacity={0.7}
            disabled={saving || !selected}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Start Using Calmera AI</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }
    // normal guide image slide
    return (
      <Image source={item} style={{ width, height, resizeMode: "cover" }} />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Exit button (top right) */}
      <TouchableOpacity
        onPress={() => navigation.popToTop()}
        style={styles.exitBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={28} color="#000" />
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={DATA}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newPage = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(newPage);
        }}
      />

      {/* Page Indicators */}
      <View style={styles.indicatorContainer}>
        {DATA.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              { backgroundColor: idx === page ? "#000" : "#bbb" },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    top: 10,
    left: 20,
    zIndex: 10,
    padding: 4,
  },
  exitBtn: {
    position: "absolute",
    top: 10,
    left: 20,
    zIndex: 10,
    padding: 4,
  },
  indicatorContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  // ----- Selector styles (reuse from update-scale-type) -----
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 24,
    textAlign: "center",
  },
  questionDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 24,
    textAlign: "center",
    paddingHorizontal: 0,
  },
  optionsList: {
    gap: 12,
    paddingHorizontal: 16,
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
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#fff",
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
  saveBtn: {
    marginTop: 30,
    alignSelf: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 30,
  },
  saveBtnDisabled: {
    backgroundColor: "#ccc",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
